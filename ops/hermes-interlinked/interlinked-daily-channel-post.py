#!/usr/bin/env python3
"""Post one Interlinked Premium teaser with the Free issue artwork.

The website remains the publication. Telegram receives one bounded Premium
teaser, one Premium button, and the verified Free-edition image as the visual
attachment. It never receives the full Free or Premium article.
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import tempfile
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo


CHAT_ID = "-1004424177581"
CHAT_NAME = "Interlinked"
API_URL = "https://omnileadsagi.com/api/newsletter/posts"
BASE_URL = "https://omnileadsagi.com/newsletter"
TZ = ZoneInfo("America/Denver")
ENV_PATH = Path("/Users/janahasson/.hermes/.env")
STATE_PATH = Path(
    "/Users/janahasson/.hermes/state/interlinked-daily-channel-post-v2.json"
)


def load_token() -> str:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if token:
        return token
    if ENV_PATH.exists():
        for raw in ENV_PATH.read_text(
            encoding="utf-8", errors="ignore"
        ).splitlines():
            if raw.startswith("TELEGRAM_BOT_TOKEN="):
                return raw.split("=", 1)[1].strip().strip("\"'")
    raise RuntimeError("Telegram bot token unavailable")


def telegram_call(method: str, payload: dict) -> dict:
    token = load_token()
    request = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/{method}",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "InterlinkedTelegramPublisher/2.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def fetch_posts() -> list[dict]:
    request = urllib.request.Request(
        API_URL,
        headers={
            "Accept": "application/json",
            "User-Agent": "InterlinkedTelegramPublisher/2.0",
        },
    )
    with urllib.request.urlopen(request, timeout=25) as response:
        data = json.load(response)
    if isinstance(data, list):
        return [row for row in data if isinstance(row, dict)]
    if isinstance(data, dict):
        for key in ("posts", "data", "items"):
            rows = data.get(key)
            if isinstance(rows, list):
                return [row for row in rows if isinstance(row, dict)]
    raise RuntimeError("Newsletter API returned no post list")


def post_date(post: dict) -> str:
    slug = str(post.get("slug") or "")
    match = re.search(r"(20\d{2}-\d{2}-\d{2})$", slug)
    if match:
        return match.group(1)
    raw = post.get("published_at") or post.get("created_at")
    if raw:
        try:
            return (
                datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
                .astimezone(TZ)
                .date()
                .isoformat()
            )
        except ValueError:
            pass
    return ""


def choose_pair(posts: list[dict], day: str) -> tuple[dict, dict]:
    same_day = [
        post for post in posts if post_date(post) == day and post.get("slug")
    ]
    free = next(
        (
            post
            for post in same_day
            if str(post.get("tier") or "free").lower() != "premium"
        ),
        None,
    )
    premium = next(
        (
            post
            for post in same_day
            if str(post.get("tier") or "").lower() == "premium"
        ),
        None,
    )
    if not free or not premium:
        found = sorted(
            {str(post.get("tier") or "free").lower() for post in same_day}
        )
        raise RuntimeError(
            f"Both same-day posts are required; found tiers: {found}"
        )
    return free, premium


def fetch_page_teaser(slug: str) -> str:
    url = f"{BASE_URL}/{urllib.parse.quote(slug, safe='')}"
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "InterlinkedTelegramPublisher/2.0"},
    )
    with urllib.request.urlopen(request, timeout=25) as response:
        source = response.read().decode("utf-8", errors="ignore")
    patterns = (
        r'<meta[^>]+property=["\']og:description["\'][^>]+content=["\']([^"\']+)',
        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:description["\']',
        r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)',
    )
    for pattern in patterns:
        match = re.search(pattern, source, re.IGNORECASE)
        if match:
            return html.unescape(match.group(1)).strip()
    return ""


def clean_teaser(value: object) -> str:
    text = re.sub(r"https?://\S+", "", str(value or ""))
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return (
            "The highest-leverage agentic market moves are mapped into "
            "decisions, risks, and execution."
        )
    sentences = re.split(r"(?<=[.!?])\s+", text)
    teaser = " ".join(sentences[:2]).strip()
    if len(teaser) > 420:
        teaser = teaser[:417].rsplit(" ", 1)[0].rstrip(" ,;:") + "…"
    return teaser


def build_payload(free: dict, premium: dict, day: str) -> dict:
    title = str(
        premium.get("subject") or "Today’s Interlinked Premium Brief"
    ).strip()
    teaser_source = (
        premium.get("intro")
        or premium.get("preview")
        or premium.get("description")
    )
    if not teaser_source:
        teaser_source = fetch_page_teaser(str(premium["slug"]))
    teaser = clean_teaser(teaser_source)
    premium_url = (
        f"{BASE_URL}/{urllib.parse.quote(str(premium['slug']), safe='')}"
    )
    free_art = (
        f"{BASE_URL}/generated/interlinked-free-{day}.jpg"
    )
    return {
        "chat_id": CHAT_ID,
        "photo": free_art,
        "caption": (
            "<b>Interlinked Premium · Market Intelligence</b>\n\n"
            f"<b>{html.escape(title)}</b>\n\n{html.escape(teaser)}"
        ),
        "parse_mode": "HTML",
        "reply_markup": {
            "inline_keyboard": [
                [{"text": "Open Premium Brief", "url": premium_url}]
            ]
        },
    }


def load_state() -> dict:
    try:
        return json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def save_state(state: dict) -> None:
    STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(
        prefix="interlinked-daily-v2-",
        suffix=".json",
        dir=STATE_PATH.parent,
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(state, handle, indent=2, sort_keys=True)
            handle.write("\n")
        os.replace(temporary, STATE_PATH)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def verify_permissions() -> int:
    me = telegram_call("getMe", {})
    chat = telegram_call("getChat", {"chat_id": CHAT_ID})
    if not me.get("ok") or not chat.get("ok"):
        print(json.dumps({"ok": False, "stage": "identity"}))
        return 1
    bot_id = (me.get("result") or {}).get("id")
    member = telegram_call(
        "getChatMember", {"chat_id": CHAT_ID, "user_id": bot_id}
    )
    chat_data = chat.get("result") or {}
    member_data = member.get("result") or {}
    ok = (
        str(chat_data.get("id")) == CHAT_ID
        and chat_data.get("title") == CHAT_NAME
        and chat_data.get("type") in {"channel", "supergroup"}
        and member.get("ok")
        and member_data.get("status") in {"administrator", "creator"}
        and member_data.get("can_post_messages") is not False
    )
    print(
        json.dumps(
            {
                "ok": ok,
                "chat_id": str(chat_data.get("id")),
                "title": chat_data.get("title"),
                "type": chat_data.get("type"),
                "bot_status": member_data.get("status"),
                "can_post_messages": member_data.get("can_post_messages"),
            },
            sort_keys=True,
        )
    )
    return 0 if ok else 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--verify-permissions", action="store_true")
    parser.add_argument("--validate", action="store_true")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--day")
    args = parser.parse_args()
    if args.verify_permissions:
        return verify_permissions()

    now = datetime.now(TZ)
    day = args.day or now.date().isoformat()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
        raise RuntimeError("invalid issue day")
    free, premium = choose_pair(fetch_posts(), day)
    payload = build_payload(free, premium, day)
    receipt = {
        "day": day,
        "channel": CHAT_NAME,
        "chat_id": CHAT_ID,
        "title": re.sub(
            r"<[^>]+>", "", payload["caption"].split("\n", 1)[0]
        ),
        "teaser": payload["caption"].split("\n\n", 2)[-1],
        "button": "Open Premium Brief",
        "photo": payload["photo"],
        "free_slug": free["slug"],
        "premium_slug": premium["slug"],
        "telegram_content": "premium_teaser_with_free_art",
    }
    if args.validate:
        print(
            json.dumps(
                {"ok": True, "mode": "validate", **receipt},
                ensure_ascii=False,
                sort_keys=True,
            )
        )
        return 0

    state = load_state()
    key = f"premium-with-free-art:{day}:v2"
    if state.get("last_success_key") == key and not args.force:
        print(
            json.dumps(
                {
                    "ok": True,
                    "dedupe": "skipped",
                    "message_id": state.get("last_message_id"),
                    **receipt,
                },
                ensure_ascii=False,
                sort_keys=True,
            )
        )
        return 0

    result = telegram_call("sendPhoto", payload)
    if not result.get("ok"):
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": result.get(
                        "description", "Telegram rejected photo post"
                    ),
                },
                sort_keys=True,
            )
        )
        return 1
    message_id = (result.get("result") or {}).get("message_id")
    save_state(
        {
            "last_success_key": key,
            "last_success_at": now.isoformat(),
            "last_message_id": message_id,
            "photo": payload["photo"],
            "free_slug": free["slug"],
            "premium_slug": premium["slug"],
        }
    )
    print(
        json.dumps(
            {"ok": True, "message_id": message_id, **receipt},
            ensure_ascii=False,
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
