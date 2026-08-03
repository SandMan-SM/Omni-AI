#!/usr/bin/env python3
"""Collect, validate, deploy, publish, and Telegram-post one Interlinked pair.

The creative Hermes job emits a strict bundle. This host-side publisher owns
all mutations so failures become real nonzero cron statuses.
"""

from __future__ import annotations

import argparse
import fcntl
import hashlib
import html
import json
import os
import re
import shutil
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any

from interlinked_common import (
    API_URL,
    ARTIFACT_ROOT,
    CANONICAL_REPO,
    CHANNEL_PUBLISHER,
    DOMAIN,
    ENV_PATH,
    GENERATOR_OUTPUT,
    InterlinkedError,
    SITE_URL,
    STAGE_ROOT,
    STATE_ROOT,
    TZ,
    VALIDATOR,
    VERCEL_PROJECT_ID,
    VERCEL_TEAM,
    WORKTREE_ROOT,
    atomic_json,
    atomic_write,
    check_resend_sender,
    free_gib,
    git_sha,
    image_dimensions,
    newsletter_posts,
    newsletter_rows_for_day,
    now_iso,
    patch_newsletter_row,
    remote_image_info,
    run,
    same_day_pair,
    supabase_request,
    supabase_rpc,
    today,
)


REQUIRED_ROW_FIELDS = (
    "slug",
    "subject",
    "intro",
    "insights",
    "power_move",
    "closing",
    "quote",
    "offer",
    "keywords",
    "tier",
)
BANNED_TEXT = ("tbd", "todo", "lorem ipsum", "as an ai", "i cannot browse")


def response_section(text: str) -> str:
    return text.rsplit("## Response", 1)[-1]


def last_marker(text: str, pattern: str, label: str) -> str:
    matches = re.findall(pattern, text, re.MULTILINE | re.DOTALL)
    if not matches:
        raise InterlinkedError(f"generator output missing {label}")
    return str(matches[-1]).strip()


def extract_bundle(path: Path, day: str) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8", errors="replace")
    response = response_section(text)
    output_day = last_marker(
        response,
        r"^INTERLINKED_DATE:\s*(\d{4}-\d{2}-\d{2})\s*$",
        "INTERLINKED_DATE",
    )
    if output_day != day:
        raise InterlinkedError(
            f"generator output date mismatch: expected {day}, got {output_day}"
        )
    if not re.search(r"^VERIFIED\s*$", response, re.MULTILINE):
        raise InterlinkedError("generator output missing final VERIFIED marker")

    rows_text = last_marker(
        response,
        r"BEGIN_INTERLINKED_ROWS\s*\n(.*?)\nEND_INTERLINKED_ROWS",
        "Interlinked rows JSON",
    )
    artifact = last_marker(
        response,
        r"BEGIN_INTERLINKED_ARTIFACT\s*\n(.*?)\nEND_INTERLINKED_ARTIFACT",
        "Interlinked artifact",
    )
    free_image_raw = last_marker(
        response,
        r"^FREE_IMAGE_PATH:\s*(.+?)\s*$",
        "FREE_IMAGE_PATH",
    )
    premium_image_raw = last_marker(
        response,
        r"^PREMIUM_IMAGE_PATH:\s*(.+?)\s*$",
        "PREMIUM_IMAGE_PATH",
    )
    try:
        rows = json.loads(rows_text)
    except json.JSONDecodeError as exc:
        raise InterlinkedError(f"generator rows are not valid JSON: {exc}") from exc
    if not isinstance(rows, dict):
        raise InterlinkedError("generator rows JSON must be an object")
    return {
        "day": output_day,
        "rows": rows,
        "artifact": artifact.strip() + "\n",
        "free_image": Path(
            os.path.expanduser(free_image_raw.strip().strip("`\"'"))
        ),
        "premium_image": Path(
            os.path.expanduser(premium_image_raw.strip().strip("`\"'"))
        ),
        "source_output": path,
    }


def find_generator_bundle(day: str, wait_seconds: int) -> dict[str, Any]:
    deadline = time.monotonic() + max(0, wait_seconds)
    last_reason = "no generator output found"
    while True:
        files = sorted(
            GENERATOR_OUTPUT.glob("*.md"),
            key=lambda path: path.stat().st_mtime,
            reverse=True,
        )
        for path in files[:10]:
            try:
                return extract_bundle(path, day)
            except InterlinkedError as exc:
                last_reason = f"{path.name}: {exc}"
        if time.monotonic() >= deadline:
            raise InterlinkedError(
                f"same-day generator bundle unavailable: {last_reason}"
            )
        time.sleep(15)


def clean_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def validate_rows(payload: dict[str, Any], day: str) -> None:
    if payload.get("date") != day:
        raise InterlinkedError("rows JSON date does not match the scheduled day")
    sources = payload.get("sources")
    if not isinstance(sources, list) or not 2 <= len(sources) <= 8:
        raise InterlinkedError("rows JSON must contain 2-8 sources")
    hosts: set[str] = set()
    for source in sources:
        if not isinstance(source, dict):
            raise InterlinkedError("every source must be an object")
        url = clean_text(source.get("url"))
        if not re.match(r"^https://[^/\s]+/.+", url):
            raise InterlinkedError(f"invalid source URL: {url or '<empty>'}")
        hosts.add(re.sub(r"^www\.", "", re.match(r"^https://([^/]+)", url).group(1)))
    if len(hosts) < 2:
        raise InterlinkedError("sources must include at least two independent domains")

    subjects: list[str] = []
    intros: list[str] = []
    for tier in ("free", "premium"):
        row = payload.get(tier)
        if not isinstance(row, dict):
            raise InterlinkedError(f"missing {tier} row")
        missing = [field for field in REQUIRED_ROW_FIELDS if field not in row]
        if missing:
            raise InterlinkedError(f"{tier} row missing fields: {', '.join(missing)}")
        expected_slug = f"interlinked-{tier}-{day}"
        if row.get("slug") != expected_slug:
            raise InterlinkedError(
                f"{tier} slug mismatch: expected {expected_slug}, got {row.get('slug')}"
            )
        if row.get("tier") != tier:
            raise InterlinkedError(f"{tier} row has the wrong tier")
        if row.get("status") != "published":
            raise InterlinkedError(f"{tier} row must request published status")

        subject = clean_text(row.get("subject"))
        intro = clean_text(row.get("intro"))
        subjects.append(subject)
        intros.append(intro)
        if not 18 <= len(subject) <= 140:
            raise InterlinkedError(f"{tier} subject length is invalid")
        if len(intro.split()) < 18:
            raise InterlinkedError(f"{tier} intro is too thin")

        insights = row.get("insights")
        if not isinstance(insights, list) or not 3 <= len(insights) <= 6:
            raise InterlinkedError(f"{tier} must contain 3-6 insights")
        if any(len(clean_text(item).split()) < 12 for item in insights):
            raise InterlinkedError(f"{tier} contains a thin insight")
        keywords = row.get("keywords")
        if not isinstance(keywords, list) or not 3 <= len(keywords) <= 12:
            raise InterlinkedError(f"{tier} must contain 3-12 keywords")
        for field in ("power_move", "closing", "offer"):
            if len(clean_text(row.get(field)).split()) < 7:
                raise InterlinkedError(f"{tier} {field} is too thin")

        quote = clean_text(row.get("quote"))
        if not 12 <= len(quote) <= 180:
            raise InterlinkedError(f"{tier} quote length is invalid")
        if (
            re.search(r"(?i)\b(?:quote|original line|attribution)\s*:", quote)
            or any(char in quote for char in "\"“”")
            or re.search(r"\s[—–-]\s+[A-Z][A-Za-z .'-]{2,}$", quote)
        ):
            raise InterlinkedError(
                f"{tier} quote contains a label, quotation marks, or attribution"
            )

        searchable = json.dumps(row, ensure_ascii=False).lower()
        found_banned = next((phrase for phrase in BANNED_TEXT if phrase in searchable), None)
        if found_banned:
            raise InterlinkedError(f"{tier} contains banned placeholder text: {found_banned}")

    if subjects[0].lower() == subjects[1].lower():
        raise InterlinkedError("Free and Premium subjects must be distinct")
    if intros[0].lower() == intros[1].lower():
        raise InterlinkedError("Free and Premium intros must be distinct")
    premium = payload["premium"]
    for field in ("exclusive_insight", "ai_recommendation"):
        if len(clean_text(premium.get(field)).split()) < 15:
            raise InterlinkedError(f"premium {field} is too thin")


def validate_image_sources(free_image: Path, premium_image: Path) -> None:
    for label, path in (("free", free_image), ("premium", premium_image)):
        if not path.is_file():
            raise InterlinkedError(f"{label} generated image does not exist: {path}")
        if path.stat().st_size < 25_000:
            raise InterlinkedError(
                f"{label} generated image is suspiciously small: {path.stat().st_size} bytes"
            )
        width, height = image_dimensions(path)
        if min(width, height) < 768:
            raise InterlinkedError(
                f"{label} generated image is too small: {width}x{height}"
            )
    free_hash = hashlib.sha256(free_image.read_bytes()).hexdigest()
    premium_hash = hashlib.sha256(premium_image.read_bytes()).hexdigest()
    if free_hash == premium_hash:
        raise InterlinkedError("Free and Premium generated images are identical")


def crop_resize(source: Path, destination: Path, width: int, height: int) -> None:
    source_width, source_height = image_dimensions(source)
    target_ratio = width / height
    source_ratio = source_width / source_height
    if source_ratio > target_ratio:
        crop_height = source_height
        crop_width = max(1, round(source_height * target_ratio))
    else:
        crop_width = source_width
        crop_height = max(1, round(source_width / target_ratio))

    destination.parent.mkdir(parents=True, exist_ok=True)
    cropped = destination.with_suffix(".crop.png")
    cropped.unlink(missing_ok=True)
    destination.unlink(missing_ok=True)
    try:
        run(
            [
                "/usr/bin/sips",
                "-c",
                str(crop_height),
                str(crop_width),
                str(source),
                "--out",
                str(cropped),
            ],
            timeout=60,
        )
        run(
            [
                "/usr/bin/sips",
                "-z",
                str(height),
                str(width),
                "-s",
                "format",
                "jpeg",
                "-s",
                "formatOptions",
                "88",
                str(cropped),
                "--out",
                str(destination),
            ],
            timeout=60,
        )
    finally:
        cropped.unlink(missing_ok=True)
    actual = image_dimensions(destination)
    if actual != (width, height):
        raise InterlinkedError(
            f"normalized image has wrong dimensions: {destination} is {actual}"
        )
    if destination.stat().st_size < 25_000:
        raise InterlinkedError(f"normalized image is too small: {destination}")


def validate_artifact(artifact: str, day: str, stage: Path) -> Path:
    required = (
        f'date: "{day}"',
        f"interlinked-free-{day}.jpg",
        f"interlinked-premium-{day}-share.jpg",
        "## Free Issue Body",
        "## Premium Issue",
        "## Social Snippets",
        "## Send-Readiness",
        "Not sent",
    )
    missing = [marker for marker in required if marker not in artifact]
    if missing:
        raise InterlinkedError(
            "artifact is missing required markers: " + ", ".join(missing)
        )
    social = re.search(
        r"(?ims)^## Social Snippets\s*\n(.*?)(?=^## |\Z)", artifact
    )
    if not social or len(re.findall(r"(?m)^\s*\d+\.\s+\S", social.group(1))) != 3:
        raise InterlinkedError("artifact must contain exactly three social snippets")
    artifact_path = stage / f"omni-ai-{day}.md"
    atomic_write(artifact_path, artifact)
    if not VALIDATOR.is_file():
        raise InterlinkedError(f"newsletter validator missing: {VALIDATOR}")
    process = run(
        ["python3", str(VALIDATOR), str(artifact_path)],
        timeout=120,
    )
    if "PASS" not in process.stdout.upper():
        raise InterlinkedError("newsletter validator did not return an explicit pass")
    return artifact_path


def prepare_stage(bundle: dict[str, Any]) -> dict[str, Any]:
    day = bundle["day"]
    rows = bundle["rows"]
    validate_rows(rows, day)
    validate_image_sources(bundle["free_image"], bundle["premium_image"])
    stage = STAGE_ROOT / day
    assets = stage / "assets"
    stage.mkdir(parents=True, exist_ok=True)
    rows_path = stage / "rows.json"
    atomic_json(rows_path, rows)
    artifact_path = validate_artifact(bundle["artifact"], day, stage)

    names = {
        "free": f"interlinked-free-{day}.jpg",
        "free_share": f"interlinked-free-{day}-share.jpg",
        "premium": f"interlinked-premium-{day}.jpg",
        "premium_share": f"interlinked-premium-{day}-share.jpg",
    }
    crop_resize(bundle["free_image"], assets / names["free"], 1200, 630)
    crop_resize(bundle["free_image"], assets / names["free_share"], 1024, 1024)
    crop_resize(bundle["premium_image"], assets / names["premium"], 1200, 630)
    crop_resize(
        bundle["premium_image"], assets / names["premium_share"], 1024, 1024
    )
    if hashlib.sha256((assets / names["free"]).read_bytes()).hexdigest() == hashlib.sha256(
        (assets / names["premium"]).read_bytes()
    ).hexdigest():
        raise InterlinkedError("normalized Free and Premium artwork is identical")

    ready = {
        "day": day,
        "prepared_at": now_iso(),
        "source_output": str(bundle["source_output"]),
        "rows": str(rows_path),
        "artifact": str(artifact_path),
        "assets": {key: str(assets / value) for key, value in names.items()},
    }
    atomic_json(stage / "READY.json", ready)
    return ready


def surface_preflight() -> dict[str, Any]:
    authority = supabase_rpc(
        "hermes_federation_surface",
        {"p_domain": DOMAIN},
    )
    if not isinstance(authority, dict):
        raise InterlinkedError("federation authority response is invalid")
    surface = authority.get("surface")
    if not isinstance(surface, dict):
        raise InterlinkedError("federation surface row is missing")
    expected_path = str(CANONICAL_REPO)
    if surface.get("codebase_path") != expected_path:
        raise InterlinkedError(
            "federation codebase mismatch: "
            f"{surface.get('codebase_path')} != {expected_path}"
        )
    if surface.get("vercel_project") != "omni-ai":
        raise InterlinkedError("federation Vercel project mismatch")
    if surface.get("deploy_method") != "git-push":
        raise InterlinkedError("federation deploy method is not git-push")
    changelog = authority.get("recent_changelog")
    if not isinstance(changelog, list):
        raise InterlinkedError("federation changelog could not be read")
    database_check = supabase_request(
        "newsletter_posts",
        query={"select": "id", "limit": "1"},
    )
    if not isinstance(database_check, list):
        raise InterlinkedError("Supabase read-only connectivity check failed")
    return {**surface, "recent_changelog": changelog}


def operational_preflight() -> dict[str, Any]:
    if free_gib(CANONICAL_REPO) < 15:
        raise InterlinkedError(
            f"insufficient disk headroom: {free_gib(CANONICAL_REPO):.1f} GiB free; require 15 GiB"
        )
    if not (CANONICAL_REPO / ".git").exists() and not run(
        ["git", "rev-parse", "--git-dir"], cwd=CANONICAL_REPO, check=False
    ).returncode == 0:
        raise InterlinkedError("canonical Omni AI checkout is unavailable")
    remote = run(
        ["git", "remote", "get-url", "origin"], cwd=CANONICAL_REPO, timeout=30
    ).stdout.strip()
    if "SandMan-SM/Omni-AI" not in remote and "SandMan-SM/omni-ai" not in remote:
        raise InterlinkedError(f"unexpected canonical Git remote: {remote}")
    run(
        ["git", "ls-remote", "--exit-code", "origin", "refs/heads/main"],
        cwd=CANONICAL_REPO,
        timeout=60,
    )
    rows, source = newsletter_posts()
    if source != "supabase":
        raise InterlinkedError(
            f"newsletter API source is {source}, not Supabase; refusing partial publication"
        )
    sender = check_resend_sender()
    permission = run(
        ["python3", str(CHANNEL_PUBLISHER), "--verify-permissions"],
        timeout=90,
    )
    try:
        telegram = json.loads(permission.stdout.strip().splitlines()[-1])
    except (json.JSONDecodeError, IndexError) as exc:
        raise InterlinkedError("Telegram permission preflight returned no receipt") from exc
    if not telegram.get("ok"):
        raise InterlinkedError("Telegram bot lacks Interlinked channel posting permission")
    surface = surface_preflight()
    return {
        "disk_free_gib": round(free_gib(CANONICAL_REPO), 1),
        "api_source": source,
        "api_rows": len(rows),
        "resend": sender,
        "telegram": {
            "chat_id": telegram.get("chat_id"),
            "title": telegram.get("title"),
            "bot_status": telegram.get("bot_status"),
        },
        "surface": {
            "domain": surface.get("domain"),
            "project": surface.get("vercel_project"),
            "deploy_method": surface.get("deploy_method"),
        },
    }


def acquire_lease(session_ref: str) -> int:
    result = supabase_rpc(
        "hermes_federation_acquire_lease",
        {
            "p_target": DOMAIN,
            "p_agent": "hermes",
            "p_kind": "deploy",
            "p_session_ref": session_ref,
            "p_note": "Publish validated daily Interlinked pair with issue-specific art",
            "p_ttl_minutes": 45,
        },
    )
    if not isinstance(result, dict):
        raise InterlinkedError("federation lease response is invalid")
    if not result.get("granted"):
        supabase_rpc(
            "hermes_federation_log_change",
            {
                "p_agent": "hermes",
                "p_target": DOMAIN,
                "p_action": "handoff-request",
                "p_detail": {
                "request": "handoff-request",
                "holder": result.get("holder"),
                "holder_lease_id": result.get("holder_lease_id"),
                "expires_at": result.get("expires_at"),
                "note": "Interlinked daily release deferred",
                },
                "p_lease_id": None,
            },
        )
        raise InterlinkedError(
            "federation deploy lease is held by "
            f"{result.get('holder')} until {result.get('expires_at')}"
        )
    return int(result["lease_id"])


def renew_lease(lease_id: int) -> None:
    result = supabase_rpc(
        "hermes_federation_renew_lease",
        {
            "p_lease_id": lease_id,
            "p_agent": "hermes",
            "p_ttl_minutes": 45,
        },
    )
    if not isinstance(result, dict):
        raise InterlinkedError("federation lease renewal response is invalid")
    if not result.get("renewed"):
        raise InterlinkedError(
            f"federation lease renewal failed: {result.get('reason')}"
        )


def release_lease(lease_id: int, action: str, detail: dict[str, Any]) -> None:
    result = supabase_rpc(
        "hermes_federation_release_lease",
        {
            "p_lease_id": lease_id,
            "p_agent": "hermes",
            "p_action": action,
            "p_detail": detail,
        },
    )
    if not isinstance(result, dict):
        raise InterlinkedError("federation lease release response is invalid")
    if not result.get("released"):
        raise InterlinkedError(
            f"federation lease release failed: {result.get('reason')}"
        )


def link_node_modules(worktree: Path) -> Path | None:
    source = CANONICAL_REPO / "node_modules"
    target = worktree / "node_modules"
    if target.exists() or target.is_symlink():
        return None
    if not source.is_dir():
        raise InterlinkedError(
            "canonical node_modules is unavailable for isolated local checks"
        )
    target.symlink_to(source, target_is_directory=True)
    return target


def link_local_environment(worktree: Path) -> Path | None:
    target = worktree / ".env.local"
    if target.exists() or target.is_symlink():
        return None
    if not ENV_PATH.is_file():
        raise InterlinkedError(
            "canonical local environment is unavailable for isolated checks"
        )
    ignore_path = worktree / ".vercelignore"
    ignore_text = (
        ignore_path.read_text(encoding="utf-8", errors="replace")
        if ignore_path.is_file()
        else ""
    )
    if ".env*" not in ignore_text:
        raise InterlinkedError(
            ".vercelignore does not exclude local environment files"
        )
    target.symlink_to(ENV_PATH)
    return target


def run_release_checks(worktree: Path) -> dict[str, str]:
    linked = link_node_modules(worktree)
    linked_env = link_local_environment(worktree)
    environment = os.environ.copy()
    environment["ALLOW_DIRTY_WORKTREE"] = "1"
    try:
        typecheck = run(
            ["npm", "run", "check"],
            cwd=worktree,
            timeout=1200,
            env=environment,
        )
        build = run(
            ["npm", "run", "build:check"],
            cwd=worktree,
            timeout=1800,
            env=environment,
        )
    finally:
        if linked and linked.is_symlink():
            linked.unlink()
        if linked_env and linked_env.is_symlink():
            linked_env.unlink()
        shutil.rmtree(worktree / ".next-prod", ignore_errors=True)
    return {
        "typecheck": "passed" if typecheck.returncode == 0 else "failed",
        "build": "passed" if build.returncode == 0 else "failed",
    }


def create_release_commit(ready: dict[str, Any], lease_id: int) -> tuple[Path, str, str]:
    day = ready["day"]
    WORKTREE_ROOT.mkdir(parents=True, exist_ok=True)
    run(["git", "fetch", "origin", "main"], cwd=CANONICAL_REPO, timeout=120)
    base_sha = git_sha(CANONICAL_REPO, "origin/main")
    worktree = WORKTREE_ROOT / (
        f"interlinked-{day}-{datetime.now(TZ).strftime('%H%M%S')}"
    )
    run(
        ["git", "worktree", "add", "--detach", str(worktree), "origin/main"],
        cwd=CANONICAL_REPO,
        timeout=180,
    )
    destination = worktree / "public" / "newsletter" / "generated"
    destination.mkdir(parents=True, exist_ok=True)
    for source_raw in ready["assets"].values():
        source = Path(source_raw)
        shutil.copy2(source, destination / source.name)
    run(["git", "add", "public/newsletter/generated"], cwd=worktree, timeout=60)
    run(["git", "diff", "--cached", "--check"], cwd=worktree, timeout=60)
    checks = run_release_checks(worktree)
    renew_lease(lease_id)

    current_main = git_sha(CANONICAL_REPO, "origin/main")
    if current_main != base_sha:
        raise InterlinkedError(
            "origin/main changed during validation; refusing to push a stale release"
        )
    if run(["git", "diff", "--cached", "--quiet"], cwd=worktree, check=False).returncode == 0:
        return worktree, base_sha, json.dumps(checks)
    run(
        ["git", "commit", "-m", f"Publish {day} Interlinked artwork"],
        cwd=worktree,
        timeout=120,
    )
    commit_sha = git_sha(worktree)
    run(
        ["git", "push", "origin", "HEAD:main"],
        cwd=worktree,
        timeout=180,
    )
    return worktree, commit_sha, json.dumps(checks)


def expected_assets(day: str) -> dict[str, tuple[str, tuple[int, int]]]:
    return {
        "free": (
            f"{SITE_URL}/newsletter/generated/interlinked-free-{day}.jpg",
            (1200, 630),
        ),
        "free_share": (
            f"{SITE_URL}/newsletter/generated/interlinked-free-{day}-share.jpg",
            (1024, 1024),
        ),
        "premium": (
            f"{SITE_URL}/newsletter/generated/interlinked-premium-{day}.jpg",
            (1200, 630),
        ),
        "premium_share": (
            f"{SITE_URL}/newsletter/generated/interlinked-premium-{day}-share.jpg",
            (1024, 1024),
        ),
    }


def deployment_for_commit(commit_sha: str) -> dict[str, Any]:
    endpoint = (
        "/v6/deployments?"
        f"projectId={VERCEL_PROJECT_ID}&target=production&limit=20"
    )
    process = run(
        [
            "vercel",
            "api",
            endpoint,
            "--scope",
            VERCEL_TEAM,
            "--raw",
        ],
        cwd=CANONICAL_REPO,
        timeout=90,
    )
    try:
        payload = json.loads(process.stdout)
    except json.JSONDecodeError as exc:
        raise InterlinkedError("Vercel deployment API returned invalid JSON") from exc
    deployments = payload.get("deployments")
    if not isinstance(deployments, list):
        raise InterlinkedError("Vercel deployment API returned no deployment list")
    deployment = next(
        (
            item
            for item in deployments
            if isinstance(item, dict)
            and str((item.get("meta") or {}).get("githubCommitSha") or "")
            == commit_sha
        ),
        None,
    )
    if not deployment:
        raise InterlinkedError(
            f"Vercel has not created a production deployment for {commit_sha[:12]}"
        )
    state = str(deployment.get("readyState") or deployment.get("state") or "")
    substate = str(deployment.get("readySubstate") or "")
    if state != "READY":
        raise InterlinkedError(
            f"Vercel deployment {deployment.get('uid')} is {state or 'unknown'}"
        )
    if substate and substate != "PROMOTED":
        raise InterlinkedError(
            f"Vercel deployment {deployment.get('uid')} is {substate}, not PROMOTED"
        )
    return {
        "id": deployment.get("uid"),
        "status": state,
        "substate": substate or "PROMOTED",
        "commit": commit_sha,
        "url": deployment.get("url"),
    }


def issue_publication_time(day: str) -> str:
    return datetime.fromisoformat(f"{day}T12:00:00").replace(tzinfo=TZ).isoformat()


def parse_vercel_inspect(
    process: Any,
) -> tuple[str, str]:
    # Vercel CLI currently writes the formatted inspect receipt to stderr,
    # although older releases used stdout. Accept either stream and require
    # both fields so a CLI output change cannot look like a healthy deploy.
    text = "\n".join(
        value for value in (process.stdout, process.stderr) if value
    )
    deployment_id = re.search(r"\bid\s+dpl_([A-Za-z0-9]+)", text)
    status = re.search(r"\bstatus\s+●\s+(\w+)", text)
    if not deployment_id or not status:
        raise InterlinkedError(
            "Vercel inspect receipt is missing deployment ID or status"
        )
    return f"dpl_{deployment_id.group(1)}", status.group(1)


def wait_for_production(
    day: str,
    lease_id: int,
    commit_sha: str,
    timeout_seconds: int = 1800,
) -> dict[str, Any]:
    deadline = time.monotonic() + timeout_seconds
    last_error = "production assets not checked"
    last_renewal = time.monotonic()
    while time.monotonic() < deadline:
        if time.monotonic() - last_renewal > 600:
            renew_lease(lease_id)
            last_renewal = time.monotonic()
        receipt: dict[str, Any] = {}
        try:
            deployment = deployment_for_commit(commit_sha)
            for name, (url, expected) in expected_assets(day).items():
                cache_busted = f"{url}?release={int(time.time())}"
                width, height, size, content_type = remote_image_info(cache_busted)
                if (width, height) != expected:
                    raise InterlinkedError(
                        f"{name} production dimensions are {width}x{height}, expected {expected[0]}x{expected[1]}"
                    )
                receipt[name] = {
                    "url": url,
                    "width": width,
                    "height": height,
                    "bytes": size,
                    "content_type": content_type,
                }
            inspect = run(
                [
                    "vercel",
                    "inspect",
                    f"https://{DOMAIN}",
                    "--scope",
                    VERCEL_TEAM,
                ],
                cwd=CANONICAL_REPO,
                timeout=90,
            )
            alias_id, alias_status = parse_vercel_inspect(inspect)
            if alias_status.lower() != "ready":
                raise InterlinkedError(
                    f"custom-domain deployment is {alias_status}, not Ready"
                )
            if alias_id != deployment["id"]:
                raise InterlinkedError(
                    "custom domain is not promoted to the exact Git deployment: "
                    f"{alias_id} != {deployment['id']}"
                )
            receipt["deployment"] = deployment
            return receipt
        except InterlinkedError as exc:
            last_error = str(exc)
            time.sleep(15)
    raise InterlinkedError(
        f"production deployment did not expose verified artwork: {last_error}"
    )


def upsert_rows(payload: dict[str, Any]) -> list[dict[str, Any]]:
    timestamp = now_iso()
    # Newsletter pages render published_at in the server timezone (UTC).
    # A real completion after 6 p.m. Mountain otherwise appears as tomorrow.
    # Anchor the publication timestamp at local noon on the issue date so the
    # date remains stable in both Mountain time and UTC.
    issue_noon = issue_publication_time(str(payload["date"]))
    fields = (
        "slug",
        "subject",
        "intro",
        "insights",
        "power_move",
        "closing",
        "quote",
        "offer",
        "keywords",
        "tier",
        "day_type",
        "exclusive_insight",
        "ai_recommendation",
    )
    rows: list[dict[str, Any]] = []
    for tier in ("free", "premium"):
        source = payload[tier]
        row = {field: source.get(field) for field in fields}
        row.update(
            {
                "published_at": issue_noon,
                "status": "published",
                "updated_at": timestamp,
            }
        )
        rows.append(row)
    result = supabase_request(
        "newsletter_posts",
        method="POST",
        query={
            "on_conflict": "slug",
            "select": "id,slug,tier,status,published_at",
        },
        payload=rows,
        prefer="resolution=merge-duplicates,return=representation",
        timeout=90,
    )
    if not isinstance(result, list) or len(result) != 2:
        raise InterlinkedError("database upsert did not return exactly two rows")
    return [row for row in result if isinstance(row, dict)]


def verify_live_pair(payload: dict[str, Any], wait_seconds: int = 180) -> dict[str, Any]:
    day = payload["date"]
    deadline = time.monotonic() + wait_seconds
    last_error = "API not checked"
    while time.monotonic() < deadline:
        try:
            rows, source = newsletter_posts()
            if source != "supabase":
                raise InterlinkedError(f"API source is {source}, not Supabase")
            free, premium = same_day_pair(rows, day)
            if free.get("slug") != payload["free"]["slug"]:
                raise InterlinkedError("live Free slug does not match the bundle")
            if premium.get("slug") != payload["premium"]["slug"]:
                raise InterlinkedError("live Premium slug does not match the bundle")
            if free.get("subject") != payload["free"]["subject"]:
                raise InterlinkedError("live Free subject does not match the bundle")
            if premium.get("subject") != payload["premium"]["subject"]:
                raise InterlinkedError("live Premium subject does not match the bundle")
            for row in (free, premium):
                url = f"{SITE_URL}/newsletter/{row['slug']}?release={int(time.time())}"
                page = run(
                    [
                        "curl",
                        "-fsS",
                        "--max-time",
                        "30",
                        url,
                    ],
                    timeout=45,
                ).stdout
                if clean_text(row["subject"]) not in clean_text(html.unescape(page)):
                    raise InterlinkedError(
                        f"live page does not contain its subject: {row['slug']}"
                    )
            return {
                "source": source,
                "free_slug": free["slug"],
                "premium_slug": premium["slug"],
                "api": API_URL,
            }
        except InterlinkedError as exc:
            last_error = str(exc)
            time.sleep(10)
    raise InterlinkedError(f"live Interlinked pair did not verify: {last_error}")

def write_publication_artifact(
    source_artifact: Path,
    day: str,
    commit_sha: str,
    production: dict[str, Any],
    live: dict[str, Any],
) -> Path:
    text = source_artifact.read_text(encoding="utf-8")
    receipt = (
        "\n## Publication Receipt\n"
        f"- Published: {now_iso()}\n"
        f"- Git commit: `{commit_sha}`\n"
        f"- Vercel deployment: `{production['deployment']['id']}` "
        f"({production['deployment']['status']})\n"
        f"- API source: `{live['source']}`\n"
        f"- Free route: {SITE_URL}/newsletter/{live['free_slug']}\n"
        f"- Premium route: {SITE_URL}/newsletter/{live['premium_slug']}\n"
        "- Email: not sent by the publication job; the idempotent owner-email "
        "job records its own provider receipt.\n"
    )
    destination = ARTIFACT_ROOT / f"omni-ai-{day}.md"
    atomic_write(destination, text.rstrip() + "\n" + receipt)
    run(["python3", str(VALIDATOR), str(destination)], timeout=120)
    return destination


def post_telegram(day: str) -> dict[str, Any]:
    validation = run(
        ["python3", str(CHANNEL_PUBLISHER), "--validate"],
        timeout=90,
    )
    try:
        validation_receipt = json.loads(validation.stdout.strip().splitlines()[-1])
    except (json.JSONDecodeError, IndexError) as exc:
        raise InterlinkedError("Telegram validation returned no JSON receipt") from exc
    if not validation_receipt.get("ok"):
        raise InterlinkedError("Telegram payload validation failed")
    delivery = run(["python3", str(CHANNEL_PUBLISHER)], timeout=90)
    try:
        receipt = json.loads(delivery.stdout.strip().splitlines()[-1])
    except (json.JSONDecodeError, IndexError) as exc:
        raise InterlinkedError("Telegram delivery returned no JSON receipt") from exc
    if not receipt.get("ok") or receipt.get("day") != day:
        raise InterlinkedError(f"Telegram delivery failed: {receipt}")
    feedback = f"telegram message:{receipt.get('message_id')} day:{day}"
    rows = newsletter_rows_for_day(day, select="slug,send_feedback")
    if len(rows) != 2:
        raise InterlinkedError("cannot mirror Telegram receipt; database pair missing")
    for row in rows:
        prior = str(row.get("send_feedback") or "").strip()
        combined = prior if feedback in prior else "\n".join(
            value for value in (prior, feedback) if value
        )
        patch_newsletter_row(
            str(row["slug"]),
            {
                "telegram_sent": True,
                "send_feedback": combined,
                "updated_at": now_iso(),
            },
        )
    return receipt


def remove_owned_worktree(worktree: Path) -> None:
    process = run(
        ["git", "worktree", "remove", "--force", str(worktree)],
        cwd=CANONICAL_REPO,
        timeout=180,
        check=False,
    )
    if process.returncode != 0:
        # Cleanup failure is non-fatal after a fully verified release; the
        # path is recorded so the next maintenance pass can prune it safely.
        return


def execute(args: argparse.Namespace) -> dict[str, Any]:
    day = today()
    bundle = (
        extract_bundle(Path(args.source_output), day)
        if args.source_output
        else find_generator_bundle(day, args.wait_seconds)
    )
    ready = prepare_stage(bundle)
    if args.prepare_only:
        return {"ok": True, "mode": "prepare-only", **ready}

    preflight = operational_preflight()
    session_ref = f"hermes-interlinked-{day}-{datetime.now(TZ).strftime('%H%M%S')}"
    lease_id = acquire_lease(session_ref)
    worktree: Path | None = None
    commit_sha = ""
    try:
        worktree, commit_sha, checks_json = create_release_commit(ready, lease_id)
        production = wait_for_production(day, lease_id, commit_sha)
        database = upsert_rows(bundle["rows"])
        live = verify_live_pair(bundle["rows"])
        artifact = write_publication_artifact(
            Path(ready["artifact"]), day, commit_sha, production, live
        )
        telegram = post_telegram(day)
        receipt = {
            "ok": True,
            "day": day,
            "completed_at": now_iso(),
            "source_output": ready["source_output"],
            "preflight": preflight,
            "checks": json.loads(checks_json),
            "commit": commit_sha,
            "production": production,
            "database": database,
            "live": live,
            "artifact": str(artifact),
            "telegram": telegram,
        }
        atomic_json(STATE_ROOT / f"{day}.json", receipt)
        release_lease(
            lease_id,
            "deploy",
            {
                "status": "success",
                "commit": commit_sha,
                "deployment": production["deployment"]["id"],
                "free_slug": live["free_slug"],
                "premium_slug": live["premium_slug"],
                "telegram_message_id": telegram.get("message_id"),
            },
        )
        if worktree:
            remove_owned_worktree(worktree)
        return receipt
    except Exception as exc:
        error = str(exc)
        try:
            release_lease(
                lease_id,
                "deploy-failed",
                {
                    "status": "failed",
                    "error": error[:1000],
                    "commit": commit_sha or None,
                    "worktree": str(worktree) if worktree else None,
                },
            )
        except Exception:
            pass
        raise


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-output")
    parser.add_argument("--wait-seconds", type=int, default=2700)
    parser.add_argument("--prepare-only", action="store_true")
    args = parser.parse_args()
    lock_path = STATE_ROOT / "publisher.lock"
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open("a+", encoding="utf-8") as lock:
        try:
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print(
                json.dumps(
                    {
                        "ok": False,
                        "stage": "lock",
                        "error": "another Interlinked publisher is already running",
                    },
                    sort_keys=True,
                )
            )
            return 75
        try:
            receipt = execute(args)
            print(json.dumps(receipt, ensure_ascii=False, sort_keys=True))
            return 0
        except (InterlinkedError, OSError, ValueError, json.JSONDecodeError) as exc:
            failure = {
                "ok": False,
                "day": today(),
                "failed_at": now_iso(),
                "error": str(exc),
            }
            atomic_json(STATE_ROOT / f"{today()}-failure.json", failure)
            print(json.dumps(failure, ensure_ascii=False, sort_keys=True))
            return 1


if __name__ == "__main__":
    raise SystemExit(main())
