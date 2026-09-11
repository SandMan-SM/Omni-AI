#!/usr/bin/env python3
"""Deterministically verify due portfolio newsletter draft jobs.

This monitor intentionally does not publish or send. The portfolio jobs it
checks are explicitly configured as draft-only jobs. It turns missing files,
missed launches, and validator failures into real non-zero cron failures so a
model response can no longer masquerade as a successful receipt.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo


DENVER = ZoneInfo("America/Denver")
JOBS_PATH = Path("/Users/janahasson/.hermes/cron/jobs.json")
VALIDATOR = Path("/Users/janahasson/.hermes/scripts/validate-newsletter-artifact.py")
OUTPUT_ROOT = Path("/Users/janahasson/.hermes/cron/output")
ARTIFACT_ROOT = Path("/Users/janahasson/Desktop/Clients/_agent-logs/newsletters")
NAME_PREFIX = "Newsletter Cron —"
PATH_RE = re.compile(r"Save(?: the artifact)? to\s+`([^`]+)`", re.IGNORECASE)
FALLBACK_RE = re.compile(
    r"BEGIN_NEWSLETTER_ARTIFACT\s*\n(.*?)\nEND_NEWSLETTER_ARTIFACT",
    re.DOTALL,
)


@dataclass(frozen=True)
class Finding:
    name: str
    code: str
    detail: str


def _field_matches(value: int, expression: str, minimum: int, maximum: int) -> bool:
    expression = expression.strip()
    for raw_part in expression.split(","):
        part = raw_part.strip()
        if not part:
            continue
        step = 1
        if "/" in part:
            part, raw_step = part.split("/", 1)
            try:
                step = int(raw_step)
            except ValueError:
                return False
            if step < 1:
                return False

        if part == "*":
            start, end = minimum, maximum
        elif "-" in part:
            raw_start, raw_end = part.split("-", 1)
            try:
                start, end = int(raw_start), int(raw_end)
            except ValueError:
                return False
        else:
            try:
                start = end = int(part)
            except ValueError:
                return False

        if start < minimum or end > maximum or start > end:
            return False
        if start <= value <= end and (value - start) % step == 0:
            return True
    return False


def cron_due_today(expr: str, now: datetime) -> bool:
    """Return whether a five-field cron has a scheduled instant due by now."""
    fields = expr.split()
    if len(fields) != 5:
        return False
    minute, hour, dom, month, dow = fields

    if not _field_matches(now.month, month, 1, 12):
        return False

    cron_dow = (now.weekday() + 1) % 7
    dom_matches = _field_matches(now.day, dom, 1, 31)
    dow_matches = _field_matches(cron_dow, dow.replace("7", "0"), 0, 6)
    dom_any = dom == "*"
    dow_any = dow == "*"
    day_matches = (
        dom_matches
        if dow_any
        else dow_matches
        if dom_any
        else dom_matches or dow_matches
    )
    if not day_matches:
        return False

    for scheduled_hour in range(24):
        if not _field_matches(scheduled_hour, hour, 0, 23):
            continue
        for scheduled_minute in range(60):
            if not _field_matches(scheduled_minute, minute, 0, 59):
                continue
            if (scheduled_hour, scheduled_minute) <= (now.hour, now.minute):
                return True
    return False


def expected_artifact(prompt: str, now: datetime) -> Path | None:
    match = PATH_RE.search(prompt)
    if not match:
        return None
    raw = match.group(1)
    raw = raw.replace("YYYY-MM-DD", now.strftime("%Y-%m-%d"))
    raw = raw.replace("YYYY-MM", now.strftime("%Y-%m"))
    return Path(raw)


def _same_local_date(raw: str | None, now: datetime) -> bool:
    if not raw:
        return False
    try:
        parsed = datetime.fromisoformat(raw)
    except ValueError:
        return False
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=DENVER)
    return parsed.astimezone(DENVER).date() == now.date()


def validate_artifact(path: Path, validator: Path = VALIDATOR) -> tuple[bool, str]:
    if not path.is_file():
        return False, "artifact missing"
    if path.stat().st_size < 500:
        return False, f"artifact too small ({path.stat().st_size} bytes)"
    if not validator.is_file():
        return False, f"validator missing: {validator}"

    try:
        result = subprocess.run(
            [str(validator), str(path)],
            capture_output=True,
            check=False,
            text=True,
            timeout=45,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return False, f"validator execution failed: {type(exc).__name__}"

    output = (result.stdout or result.stderr or "no validator output").strip()
    output = output.replace("\n", " ")[-600:]
    return result.returncode == 0, output


def recover_fallback_artifact(
    job: dict,
    path: Path,
    now: datetime,
    *,
    output_root: Path = OUTPUT_ROOT,
    artifact_root: Path = ARTIFACT_ROOT,
) -> tuple[bool, str]:
    """Recover a missing local draft from the agent's marked final response."""
    try:
        path.resolve().relative_to(artifact_root.resolve())
    except ValueError:
        return False, f"refused fallback outside artifact root: {path}"

    job_id = str(job.get("id") or "")
    job_output = output_root / job_id
    if not job_id or not job_output.is_dir():
        return False, "no job output directory for fallback"

    candidates = sorted(
        (candidate for candidate in job_output.glob("*.md") if candidate.is_file()),
        key=lambda candidate: candidate.stat().st_mtime,
        reverse=True,
    )
    for candidate in candidates:
        modified = datetime.fromtimestamp(candidate.stat().st_mtime, tz=DENVER)
        if modified.date() != now.date():
            continue
        try:
            transcript = candidate.read_text(encoding="utf-8")
        except OSError as exc:
            return False, f"fallback output read failed: {type(exc).__name__}"
        matches = FALLBACK_RE.findall(transcript)
        if not matches:
            return False, f"fallback markers missing in {candidate}"
        artifact = matches[-1].strip() + "\n"
        if len(artifact) < 500:
            return False, f"fallback artifact too small ({len(artifact)} chars)"

        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
        try:
            temporary.write_text(artifact, encoding="utf-8")
            os.replace(temporary, path)
        finally:
            temporary.unlink(missing_ok=True)
        return True, f"recovered from {candidate}"

    return False, f"no {now.date()} job output available for fallback"


def audit_jobs(
    jobs: list[dict],
    now: datetime,
    validator: Path = VALIDATOR,
    *,
    recover_fallback: bool = False,
    output_root: Path = OUTPUT_ROOT,
    artifact_root: Path = ARTIFACT_ROOT,
    recovery_receipts: list[str] | None = None,
) -> tuple[int, list[Finding]]:
    due = 0
    findings: list[Finding] = []
    for job in jobs:
        name = str(job.get("name") or "")
        if not name.startswith(NAME_PREFIX) or not job.get("enabled"):
            continue
        schedule = job.get("schedule") or {}
        expr = str(schedule.get("expr") or schedule.get("display") or "")
        if not cron_due_today(expr, now):
            continue
        due += 1

        if not _same_local_date(job.get("last_run_at"), now):
            findings.append(Finding(name, "never-fired", f"no {now.date()} execution"))
            continue
        if job.get("last_status") != "ok":
            detail = str(job.get("last_error") or job.get("last_status") or "unknown error")
            findings.append(Finding(name, "execution-failed", detail.replace("\n", " ")[-500:]))
            continue

        path = expected_artifact(str(job.get("prompt") or ""), now)
        if path is None:
            findings.append(Finding(name, "configuration-error", "no canonical Save-to artifact path"))
            continue

        healthy, detail = validate_artifact(path, validator=validator)
        if not healthy and recover_fallback and not path.is_file():
            recovered, recovery_detail = recover_fallback_artifact(
                job,
                path,
                now,
                output_root=output_root,
                artifact_root=artifact_root,
            )
            if recovered:
                healthy, detail = validate_artifact(path, validator=validator)
                if healthy and recovery_receipts is not None:
                    recovery_receipts.append(f"{name}: {recovery_detail}")
            else:
                detail = f"{detail}; {recovery_detail}"
        if not healthy:
            findings.append(Finding(name, "artifact-failed", f"{path}: {detail}"))

    return due, findings


def main() -> int:
    now = datetime.now(DENVER)
    try:
        payload = json.loads(JOBS_PATH.read_text(encoding="utf-8"))
        jobs = payload.get("jobs", [])
    except (OSError, json.JSONDecodeError) as exc:
        print(f"NEWSLETTER_FLEET_ALERT: cannot read scheduler state: {type(exc).__name__}")
        return 1

    recoveries: list[str] = []
    due, findings = audit_jobs(
        jobs,
        now,
        recover_fallback=True,
        recovery_receipts=recoveries,
    )
    if findings:
        print(
            f"NEWSLETTER_FLEET_ALERT date={now.date()} due={due} "
            f"failed={len(findings)} mode=draft-only"
        )
        for finding in findings:
            print(f"- {finding.name}: {finding.code} — {finding.detail}")
        for receipt in recoveries:
            print(f"- recovered — {receipt}")
        print("No subscriber email was expected: these portfolio jobs are configured as draft-only.")
        return 1

    print(
        f"NEWSLETTER_FLEET_HEALTHY date={now.date()} due={due} "
        f"validated={due} recovered={len(recoveries)} mode=draft-only"
    )
    for receipt in recoveries:
        print(f"- recovered — {receipt}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
