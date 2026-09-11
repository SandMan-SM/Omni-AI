#!/usr/bin/env python3
"""Shared runtime checks for Hermes newsletter jobs.

The agent-backed newsletter jobs use Hermes' Docker terminal and file tools.
This module keeps that dependency explicit and recoverable without weakening
the configured Docker sandbox.
"""

from __future__ import annotations

import os
import platform
import subprocess
import time
from pathlib import Path


ARTIFACT_DIR = Path("/Users/janahasson/Desktop/Clients/_agent-logs/newsletters")
VALIDATOR = Path("/Users/janahasson/.hermes/scripts/validate-newsletter-artifact.py")


class RuntimePreflightError(RuntimeError):
    """Raised when the newsletter runtime cannot be made ready."""


def _run(argv: list[str], timeout: float = 12.0) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        argv,
        capture_output=True,
        check=False,
        text=True,
        timeout=timeout,
    )


def docker_version() -> tuple[str | None, str]:
    """Return the Docker server version and a redacted failure reason."""
    try:
        result = _run(["docker", "info", "--format", "{{.ServerVersion}}"])
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        return None, type(exc).__name__

    version = result.stdout.strip()
    if result.returncode == 0 and version:
        return version, ""

    reason = (result.stderr or result.stdout or "docker info failed").strip()
    return None, reason[-500:]


def start_docker() -> None:
    """Start Docker Desktop in the logged-in user session."""
    if platform.system() == "Darwin":
        argv = ["open", "-a", "Docker"]
    else:
        argv = ["docker", "desktop", "start"]

    try:
        result = _run(argv, timeout=20)
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        raise RuntimePreflightError(f"could not start Docker Desktop: {type(exc).__name__}") from exc

    if result.returncode != 0:
        reason = (result.stderr or result.stdout or "unknown start failure").strip()
        raise RuntimePreflightError(f"could not start Docker Desktop: {reason[-500:]}")


def ensure_docker(wait_seconds: float = 90.0, poll_seconds: float = 3.0) -> tuple[str, bool]:
    """Ensure Docker is available, returning ``(version, recovered)``."""
    version, _ = docker_version()
    if version:
        return version, False

    start_docker()
    deadline = time.monotonic() + wait_seconds
    last_reason = "Docker Desktop did not become ready"
    while time.monotonic() < deadline:
        version, last_reason = docker_version()
        if version:
            return version, True
        time.sleep(poll_seconds)

    raise RuntimePreflightError(f"Docker Desktop unavailable after recovery attempt: {last_reason}")


def verify_local_dependencies() -> None:
    """Verify the shared output directory and validator are usable."""
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    probe = ARTIFACT_DIR / f".newsletter-runtime-{os.getpid()}.probe"
    try:
        probe.write_text("ok\n", encoding="utf-8")
        if probe.read_text(encoding="utf-8") != "ok\n":
            raise RuntimePreflightError("newsletter artifact directory failed read-after-write")
    finally:
        probe.unlink(missing_ok=True)

    if not VALIDATOR.is_file():
        raise RuntimePreflightError(f"newsletter validator missing: {VALIDATOR}")
    if not os.access(VALIDATOR, os.X_OK):
        raise RuntimePreflightError(f"newsletter validator is not executable: {VALIDATOR}")


def ensure_newsletter_runtime() -> tuple[str, bool]:
    version, recovered = ensure_docker()
    verify_local_dependencies()
    return version, recovered
