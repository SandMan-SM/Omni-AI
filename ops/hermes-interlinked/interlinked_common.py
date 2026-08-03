#!/usr/bin/env python3
"""Shared, dependency-free helpers for the Interlinked Hermes cron pipeline."""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo


TZ = ZoneInfo("America/Denver")
HERMES_HOME = Path(os.environ.get("HERMES_HOME", "/Users/janahasson/.hermes"))
CLIENTS_ROOT = Path(
    os.environ.get("CLIENTS_ROOT", "/Users/janahasson/Desktop/Clients")
)
CANONICAL_REPO = Path(
    os.environ.get(
        "INTERLINKED_REPO",
        str(CLIENTS_ROOT / "Sitani Mafi/Omni AI/Website"),
    )
)
ENV_PATH = Path(
    os.environ.get("INTERLINKED_ENV", str(CANONICAL_REPO / ".env.local"))
)
ARTIFACT_ROOT = Path(
    os.environ.get(
        "INTERLINKED_ARTIFACT_ROOT",
        str(CLIENTS_ROOT / "_agent-logs/newsletters"),
    )
)
WORKTREE_ROOT = Path(
    os.environ.get(
        "INTERLINKED_WORKTREE_ROOT",
        str(CLIENTS_ROOT / "_agent-worktrees"),
    )
)
GENERATOR_JOB_ID = "ef8d8c5edcdf"
GENERATOR_OUTPUT = HERMES_HOME / "cron" / "output" / GENERATOR_JOB_ID
STAGE_ROOT = HERMES_HOME / "drafts" / "interlinked"
STATE_ROOT = HERMES_HOME / "state" / "interlinked-release"
VALIDATOR = HERMES_HOME / "scripts" / "validate-newsletter-artifact.py"
CHANNEL_PUBLISHER = HERMES_HOME / "scripts" / "interlinked-daily-channel-post.py"
SITE_URL = "https://omnileadsagi.com"
API_URL = f"{SITE_URL}/api/newsletter/posts"
VERCEL_TEAM = "sandman-sms-projects"
VERCEL_PROJECT_ID = "prj_TRmLRTqEhjJj8ZlV4MQk0zjFGtU4"
DOMAIN = "omnileadsagi.com"


class InterlinkedError(RuntimeError):
    """Expected fail-closed pipeline error."""


def today() -> str:
    return datetime.now(TZ).date().isoformat()


def now_iso() -> str:
    return datetime.now(TZ).isoformat()


def atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=path.parent
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def atomic_json(path: Path, value: Any) -> None:
    atomic_write(
        path,
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
    )


def parse_env_file(path: Path = ENV_PATH) -> dict[str, str]:
    if not path.is_file():
        raise InterlinkedError(f"environment file missing: {path}")
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        match = re.match(r"^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$", line)
        if not match:
            continue
        key, value = match.groups()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            quote = value[0]
            value = value[1:-1]
            if quote == '"':
                value = bytes(value, "utf-8").decode("unicode_escape")
        values[key] = value
    return values


def secret_value(name: str, env_file: dict[str, str] | None = None) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        value = (env_file or parse_env_file()).get(name, "").strip()
    if not value:
        raise InterlinkedError(f"required credential is unavailable: {name}")
    return value


def run(
    args: list[str],
    *,
    cwd: Path | None = None,
    timeout: int = 900,
    env: dict[str, str] | None = None,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    process = subprocess.run(
        args,
        cwd=str(cwd) if cwd else None,
        env=env,
        text=True,
        capture_output=True,
        timeout=timeout,
    )
    if check and process.returncode != 0:
        lines = (process.stderr or process.stdout).strip().splitlines()
        summary = lines[-1] if lines else f"exit {process.returncode}"
        raise InterlinkedError(f"{Path(args[0]).name} failed: {summary}")
    return process


def request_data(
    url: str,
    *,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    payload: Any | None = None,
    timeout: int = 30,
) -> Any:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    request_headers = {
        "Accept": "application/json",
        "User-Agent": "Hermes-Interlinked-Reliability/2.0",
        **(headers or {}),
    }
    if body is not None:
        request_headers["Content-Type"] = "application/json"
    request = urllib.request.Request(
        url,
        data=body,
        headers=request_headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read()
            data = json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        detail = exc.read(600).decode("utf-8", errors="replace")
        raise InterlinkedError(f"HTTP {exc.code} from {url}: {detail}") from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise InterlinkedError(f"request failed for {url}: {exc}") from exc
    return data


def request_json(
    url: str,
    *,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    payload: Any | None = None,
    timeout: int = 30,
) -> dict[str, Any]:
    data = request_data(
        url,
        method=method,
        headers=headers,
        payload=payload,
        timeout=timeout,
    )
    if not isinstance(data, dict):
        raise InterlinkedError(f"expected JSON object from {url}")
    return data


def supabase_request(
    resource: str,
    *,
    method: str = "GET",
    query: dict[str, str] | None = None,
    payload: Any | None = None,
    prefer: str | None = None,
    timeout: int = 45,
) -> Any:
    values = parse_env_file()
    base = secret_value("NEXT_PUBLIC_SUPABASE_URL", values).rstrip("/")
    key = secret_value("SUPABASE_SERVICE_ROLE_KEY", values)
    url = f"{base}/rest/v1/{resource.lstrip('/')}"
    if query:
        url += "?" + urllib.parse.urlencode(query, safe="(),.*:")
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
    }
    if prefer:
        headers["Prefer"] = prefer
    return request_data(
        url,
        method=method,
        headers=headers,
        payload=payload,
        timeout=timeout,
    )


def supabase_rpc(
    name: str,
    payload: dict[str, Any],
    *,
    timeout: int = 45,
) -> Any:
    return supabase_request(
        f"rpc/{name}",
        method="POST",
        payload=payload,
        timeout=timeout,
    )


def newsletter_rows_for_day(
    day: str,
    *,
    select: str = "*",
) -> list[dict[str, Any]]:
    slugs = (
        f"interlinked-free-{day}",
        f"interlinked-premium-{day}",
    )
    data = supabase_request(
        "newsletter_posts",
        query={
            "select": select,
            "slug": f"in.({','.join(slugs)})",
            "order": "tier.asc",
        },
    )
    if not isinstance(data, list):
        raise InterlinkedError("Supabase newsletter query returned no row list")
    return [row for row in data if isinstance(row, dict)]


def patch_newsletter_row(slug: str, values: dict[str, Any]) -> dict[str, Any]:
    data = supabase_request(
        "newsletter_posts",
        method="PATCH",
        query={"slug": f"eq.{slug}", "select": "slug,tier,status"},
        payload=values,
        prefer="return=representation",
    )
    if not isinstance(data, list) or len(data) != 1 or not isinstance(data[0], dict):
        raise InterlinkedError(f"Supabase failed to update newsletter row: {slug}")
    return data[0]


def fetch_bytes(url: str, *, timeout: int = 30) -> tuple[bytes, str]:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "Hermes-Interlinked-Reliability/2.0"},
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.read(), response.headers.get("Content-Type", "")
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as exc:
        raise InterlinkedError(f"asset request failed for {url}: {exc}") from exc


def newsletter_posts(cache_bust: bool = True) -> tuple[list[dict[str, Any]], str]:
    url = API_URL
    if cache_bust:
        url += f"?v={int(time.time())}"
    payload = request_json(url)
    rows = payload.get("posts")
    if not isinstance(rows, list):
        raise InterlinkedError("newsletter API returned no posts list")
    return [row for row in rows if isinstance(row, dict)], str(
        payload.get("source") or "unknown"
    )


def same_day_pair(
    rows: list[dict[str, Any]], day: str
) -> tuple[dict[str, Any], dict[str, Any]]:
    matching = [
        row
        for row in rows
        if str(row.get("slug") or "").endswith(day)
        and str(row.get("slug") or "").startswith("interlinked-")
    ]
    free = next(
        (row for row in matching if str(row.get("tier") or "free") != "premium"),
        None,
    )
    premium = next(
        (row for row in matching if str(row.get("tier") or "") == "premium"),
        None,
    )
    if not free or not premium:
        tiers = sorted({str(row.get("tier") or "free") for row in matching})
        raise InterlinkedError(
            f"live API is missing the {day} pair; found tiers: {tiers}"
        )
    return free, premium


def image_dimensions(path: Path) -> tuple[int, int]:
    process = run(
        [
            "/usr/bin/sips",
            "-g",
            "pixelWidth",
            "-g",
            "pixelHeight",
            str(path),
        ],
        timeout=30,
    )
    width = re.search(r"pixelWidth:\s*(\d+)", process.stdout)
    height = re.search(r"pixelHeight:\s*(\d+)", process.stdout)
    if not width or not height:
        raise InterlinkedError(f"could not inspect image dimensions: {path}")
    return int(width.group(1)), int(height.group(1))


def remote_image_info(url: str) -> tuple[int, int, int, str]:
    data, content_type = fetch_bytes(url)
    if not content_type.lower().startswith("image/"):
        raise InterlinkedError(f"asset is not an image: {url} ({content_type})")
    if len(data) < 25_000:
        raise InterlinkedError(f"asset is suspiciously small: {url} ({len(data)} bytes)")
    suffix = Path(urllib.parse.urlparse(url).path).suffix or ".img"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as handle:
        handle.write(data)
        temporary = Path(handle.name)
    try:
        width, height = image_dimensions(temporary)
    finally:
        temporary.unlink(missing_ok=True)
    return width, height, len(data), content_type


def check_resend_sender() -> dict[str, Any]:
    values = parse_env_file()
    key = secret_value("RESEND_API_KEY", values)
    payload = request_json(
        "https://api.resend.com/domains",
        headers={"Authorization": f"Bearer {key}"},
    )
    domains = payload.get("data")
    if not isinstance(domains, list):
        raise InterlinkedError("Resend domain inventory unavailable")
    domain = next(
        (
            item
            for item in domains
            if isinstance(item, dict)
            and str(item.get("name") or "").lower() == DOMAIN
        ),
        None,
    )
    if not domain:
        raise InterlinkedError(f"Resend sending domain is missing: {DOMAIN}")
    domain_id = str(domain.get("id") or "")
    if not domain_id:
        raise InterlinkedError(f"Resend domain has no provider ID: {DOMAIN}")
    detail = request_json(
        f"https://api.resend.com/domains/{domain_id}",
        headers={"Authorization": f"Bearer {key}"},
    )
    status = str(detail.get("status") or domain.get("status") or "").lower()
    sending = str((detail.get("capabilities") or {}).get("sending") or "").lower()
    records = [
        record
        for record in (detail.get("records") or [])
        if isinstance(record, dict)
    ]
    required_records = [
        record
        for record in records
        if str(record.get("record") or "").upper() in {"DKIM", "SPF"}
    ]
    failed_required = [
        str(record.get("record") or "unknown")
        for record in required_records
        if str(record.get("status") or "").lower() != "verified"
    ]
    if sending != "enabled":
        raise InterlinkedError(
            f"Resend sending capability is not enabled: {DOMAIN} "
            f"({sending or 'unknown'})"
        )
    if not required_records or failed_required:
        raise InterlinkedError(
            "Resend core sending records are not verified: "
            + ", ".join(failed_required or ["DKIM/SPF missing"])
        )
    tracking = next(
        (
            str(record.get("status") or "unknown").lower()
            for record in records
            if str(record.get("record") or "").lower() == "tracking"
        ),
        "not_configured",
    )
    return {
        "domain": DOMAIN,
        "status": status,
        "sending": sending,
        "core_records": "verified",
        "tracking": tracking,
    }


def git_sha(path: Path, ref: str = "HEAD") -> str:
    return run(["git", "rev-parse", ref], cwd=path, timeout=30).stdout.strip()


def free_gib(path: Path) -> float:
    usage = shutil.disk_usage(path)
    return usage.free / (1024**3)
