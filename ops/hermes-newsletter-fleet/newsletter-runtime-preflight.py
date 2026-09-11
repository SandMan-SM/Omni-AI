#!/usr/bin/env python3
"""Required pre-run check injected into every agent-backed newsletter job."""

from datetime import datetime
from zoneinfo import ZoneInfo

from newsletter_runtime import RuntimePreflightError, ensure_newsletter_runtime


def main() -> int:
    try:
        version, recovered = ensure_newsletter_runtime()
    except RuntimePreflightError as exc:
        print(f"NEWSLETTER_RUNTIME_BLOCKED: {exc}")
        return 1

    state = "recovered" if recovered else "ready"
    today = datetime.now(ZoneInfo("America/Denver")).date().isoformat()
    print(
        "NEWSLETTER_RUNTIME_READY "
        f"docker={version} state={state} artifact_dir=writeable validator=executable. "
        f"SCHEDULER_DATE_AMERICA_DENVER={today}. "
        "Use that exact date for every YYYY-MM-DD placeholder; do not derive the date from UTC. "
        "ARTIFACT_WRITE_PROTOCOL: write the requested artifact with the native filesystem "
        "write/edit tool (mcp__filesystem__write_file when available), never with terminal "
        "redirection, a heredoc, python -c, or node -e. Run the validator as a direct "
        "terminal command only after the file exists. If the filesystem write is unavailable, "
        "return the complete intended file between BEGIN_NEWSLETTER_ARTIFACT and "
        "END_NEWSLETTER_ARTIFACT and mark the run blocked; never report success without the file."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
