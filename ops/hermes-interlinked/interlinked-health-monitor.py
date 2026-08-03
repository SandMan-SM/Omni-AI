#!/usr/bin/env python3
"""Alert only when the daily Interlinked release lacks an end-to-end receipt."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from interlinked_common import (
    InterlinkedError,
    SITE_URL,
    STATE_ROOT,
    newsletter_posts,
    newsletter_rows_for_day,
    remote_image_info,
    same_day_pair,
    today,
)


def load_receipt(path: Path, label: str) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise InterlinkedError(f"{label} receipt missing") from exc
    if not isinstance(value, dict) or not value.get("ok"):
        raise InterlinkedError(f"{label} receipt is unhealthy")
    return value


def verify() -> None:
    day = today()
    load_receipt(STATE_ROOT / f"{day}.json", "publication")
    load_receipt(STATE_ROOT / f"{day}-email.json", "email")

    rows, source = newsletter_posts()
    if source != "supabase":
        raise InterlinkedError(f"public API source is {source}")
    free, premium = same_day_pair(rows, day)
    for tier, row in (("Free", free), ("Premium", premium)):
        expected = f"interlinked-{tier.lower()}-{day}"
        if row.get("slug") != expected:
            raise InterlinkedError(f"{tier} slug mismatch")

    assets = (
        (f"{SITE_URL}/newsletter/generated/interlinked-free-{day}.jpg", (1200, 630)),
        (
            f"{SITE_URL}/newsletter/generated/interlinked-premium-{day}.jpg",
            (1200, 630),
        ),
        (
            f"{SITE_URL}/newsletter/generated/interlinked-premium-{day}-share.jpg",
            (1024, 1024),
        ),
    )
    for url, dimensions in assets:
        info = remote_image_info(url)
        if info[:2] != dimensions:
            raise InterlinkedError(
                f"asset dimension mismatch: {Path(url).name} is {info[0]}x{info[1]}"
            )

    state = newsletter_rows_for_day(
        day,
        select="slug,tier,status,email_sent,telegram_sent,sent_at",
    )
    if not isinstance(state, list) or len(state) != 2:
        raise InterlinkedError("database pair missing")
    if any(row.get("status") != "published" for row in state):
        raise InterlinkedError("database publication marker missing")
    if any(not row.get("telegram_sent") for row in state):
        raise InterlinkedError("Telegram receipt is not mirrored in the database")
    if any(not row.get("email_sent") for row in state):
        raise InterlinkedError("owner email receipt is not mirrored in the database")


def main() -> int:
    try:
        verify()
        # Empty stdout keeps the healthy no-agent monitor silent.
        return 0
    except Exception as exc:
        print(
            "🚨 Interlinked daily pipeline is unhealthy for "
            f"{today()}: {exc}. Generator/release/email receipts must all be "
            "green; no partial publication is being treated as success."
        )
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
