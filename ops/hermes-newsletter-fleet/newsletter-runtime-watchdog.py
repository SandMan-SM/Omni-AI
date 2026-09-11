#!/usr/bin/env python3
"""Silent Hermes watchdog that restarts Docker Desktop when needed."""

from newsletter_runtime import RuntimePreflightError, ensure_newsletter_runtime


def main() -> int:
    try:
        version, recovered = ensure_newsletter_runtime()
    except RuntimePreflightError as exc:
        print(f"NEWSLETTER_RUNTIME_ALERT: {exc}")
        return 1

    if recovered:
        print(f"NEWSLETTER_RUNTIME_RECOVERED: Docker Desktop {version} is ready")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
