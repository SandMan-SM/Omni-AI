#!/usr/bin/env python3
"""Install the Interlinked host scripts and atomically rewire only its jobs."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path


SOURCE = Path(__file__).resolve().parent
HERMES_HOME = Path("/Users/janahasson/.hermes")
SCRIPTS = HERMES_HOME / "scripts"
JOBS = HERMES_HOME / "cron" / "jobs.json"
REPO = "/Users/janahasson/Desktop/Clients/Sitani Mafi/Omni AI/Website"
GENERATOR_ID = "ef8d8c5edcdf"
RELEASE_ID = "ba92ad8612d1"
EMAIL_ID = "88d2f6823782"
MONITOR_NAME = "Interlinked Daily Health Monitor — receipts or alert"
FILES = (
    "interlinked_common.py",
    "interlinked-daily-channel-post.py",
    "interlinked-daily-release.py",
    "interlinked-owner-email.py",
    "interlinked-health-monitor.py",
)


def run(args: list[str]) -> str:
    process = subprocess.run(args, text=True, capture_output=True)
    if process.returncode != 0:
        raise RuntimeError(
            f"{' '.join(args[:4])} failed: "
            f"{(process.stderr or process.stdout).strip()}"
        )
    return process.stdout


def load_jobs() -> dict:
    return json.loads(JOBS.read_text(encoding="utf-8"))


def jobs_list(document: dict) -> list[dict]:
    rows = document.get("jobs")
    if not isinstance(rows, list):
        raise RuntimeError("Hermes jobs.json has no jobs list")
    return rows


def protected_ums_snapshot(document: dict) -> str:
    rows = [
        row
        for row in jobs_list(document)
        if "utah main street" in str(row.get("name") or "").lower()
        or str(row.get("name") or "").lower().startswith("ums ")
    ]
    return json.dumps(rows, sort_keys=True, ensure_ascii=False)


def atomic_jobs_write(document: dict) -> None:
    fd, temporary = tempfile.mkstemp(
        prefix=".jobs.", suffix=".json", dir=JOBS.parent
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(document, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, JOBS)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def edit_job(job_id: str, *args: str) -> None:
    run(["hermes", "cron", "edit", job_id, *args])


def main() -> int:
    before = load_jobs()
    protected_before = protected_ums_snapshot(before)
    timestamp = datetime.now().strftime("%Y%m%dT%H%M%S")
    backup = JOBS.with_name(f"jobs.json.bak.interlinked-reliability.{timestamp}")
    shutil.copy2(JOBS, backup)

    SCRIPTS.mkdir(parents=True, exist_ok=True)
    for name in FILES:
        source = SOURCE / name
        destination = SCRIPTS / name
        shutil.copy2(source, destination)
        destination.chmod(0o755)

    prompt = (SOURCE / "interlinked-generator-prompt.txt").read_text(
        encoding="utf-8"
    )
    edit_job(
        GENERATOR_ID,
        "--name",
        "Interlinked Daily Generator — research + original art bundle",
        "--schedule",
        "10 7 * * *",
        "--prompt",
        prompt,
        "--deliver",
        "local",
        "--workdir",
        REPO,
        "--agent",
    )
    edit_job(
        RELEASE_ID,
        "--name",
        "Interlinked Daily Publisher — validate + deploy + DB + Telegram",
        "--schedule",
        "0 8 * * *",
        "--script",
        "interlinked-daily-release.py",
        "--deliver",
        "local",
        "--workdir",
        REPO,
        "--no-agent",
    )
    edit_job(
        EMAIL_ID,
        "--name",
        "Interlinked Owner Email — verified idempotent delivery",
        "--schedule",
        "45 8 * * *",
        "--script",
        "interlinked-owner-email.py",
        "--deliver",
        "local",
        "--workdir",
        REPO,
        "--no-agent",
    )

    current = load_jobs()
    monitor = next(
        (row for row in jobs_list(current) if row.get("name") == MONITOR_NAME),
        None,
    )
    if monitor:
        edit_job(
            str(monitor["id"]),
            "--schedule",
            "15 9 * * *",
            "--script",
            "interlinked-health-monitor.py",
            "--deliver",
            "telegram:8459911167",
            "--workdir",
            REPO,
            "--no-agent",
        )
        monitor_id = str(monitor["id"])
    else:
        run(
            [
                "hermes",
                "cron",
                "create",
                "15 9 * * *",
                "Alert only when the daily Interlinked end-to-end receipt is incomplete.",
                "--name",
                MONITOR_NAME,
                "--deliver",
                "telegram:8459911167",
                "--script",
                "interlinked-health-monitor.py",
                "--no-agent",
                "--workdir",
                REPO,
            ]
        )
        created = next(
            row
            for row in jobs_list(load_jobs())
            if row.get("name") == MONITOR_NAME
        )
        monitor_id = str(created["id"])

    # The CLI intentionally exposes only common edit fields. Pin the generator
    # to creative/read-only toolsets afterward so Docker/terminal availability
    # can never block bundle generation again.
    configured = load_jobs()
    generator = next(
        row for row in jobs_list(configured) if row.get("id") == GENERATOR_ID
    )
    generator["enabled_toolsets"] = ["browser", "image_gen"]
    generator["provider"] = "openai-codex"
    generator["model"] = "gpt-5.6-sol"
    atomic_jobs_write(configured)

    final = load_jobs()
    if protected_ums_snapshot(final) != protected_before:
        shutil.copy2(backup, JOBS)
        raise RuntimeError(
            "Utah Main Street job definitions changed unexpectedly; restored backup"
        )
    json.loads(JOBS.read_text(encoding="utf-8"))

    print(
        json.dumps(
            {
                "ok": True,
                "backup": str(backup),
                "generator": GENERATOR_ID,
                "publisher": RELEASE_ID,
                "email": EMAIL_ID,
                "monitor": monitor_id,
                "utah_main_street_unchanged": True,
                "installed": [str(SCRIPTS / name) for name in FILES],
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
