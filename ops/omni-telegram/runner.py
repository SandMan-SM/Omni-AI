"""Publish one vetted editorial post to a verified Telegram destination."""

import argparse
from contextlib import closing
from datetime import datetime, timedelta
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import ProxyHandler, Request, build_opener

from public_sources import MOUNTAIN, NoRedirects, fresh_posts


SCRIPT_DIR = Path(__file__).resolve().parent
HERMES_HOME = Path.home() / ".hermes"
STATE_DIR = HERMES_HOME / "omni-telegram"
USERNAME = "omnileads_bot"
CHANNEL_HOSTS = {
    "success-empire": {"mafiempire.com", "sitanimafi.com"},
    "imperium": {"secretimperium.com"},
    "interlinked": {"aisempire.org", "omnileadsagi.com"},
}
SCHEMA = """
    CREATE TABLE IF NOT EXISTS dispatches (
        channel TEXT NOT NULL,
        day TEXT NOT NULL,
        content_id TEXT NOT NULL,
        category TEXT NOT NULL,
        source_key TEXT,
        status TEXT NOT NULL CHECK (status IN ('reserved', 'sent', 'rejected', 'uncertain')),
        message_id INTEGER,
        PRIMARY KEY (channel, day)
    )
"""


class DispatchError(RuntimeError):
    pass


class TelegramError(DispatchError):
    def __init__(self, method, rejection_code=None):
        self.rejection_code = rejection_code
        description = f"rejected by Telegram ({rejection_code})" if rejection_code else "outcome unconfirmed"
        super().__init__(f"{method} {description}")


class Telegram:
    def __init__(self, token):
        self.token = token
        self.client = build_opener(ProxyHandler({}), NoRedirects)

    def call(self, method, **parameters):
        encoded = json.dumps(parameters, ensure_ascii=False).encode()
        request = Request(f"https://api.telegram.org/bot{self.token}/{method}", data=encoded,
                          headers={"Content-Type": "application/json"}, method="POST")
        try:
            with self.client.open(request, timeout=12) as response:
                data = json.loads(response.read(65_536))
        except HTTPError as exc:
            try:
                with exc:
                    data = json.loads(exc.read(65_536))
            except (OSError, ValueError):
                raise TelegramError(method) from None
        except (URLError, OSError, ValueError):
            raise TelegramError(method) from None
        if not isinstance(data, dict):
            raise TelegramError(method)
        if data.get("ok") is True and isinstance(data.get("result"), dict):
            return data["result"]
        code = data.get("error_code")
        if data.get("ok") is False and type(code) is int and 400 <= code < 500:
            raise TelegramError(method, code)
        raise TelegramError(method)

    def verify(self, destination):
        bot = self.call("getMe")
        if bot.get("is_bot") is not True or str(bot.get("username", "")).lower() != USERNAME:
            raise DispatchError("Configured credential did not identify the Omni AI bot")
        chat = self.call("getChat", chat_id=destination["chat_id"])
        kind = chat.get("type")
        if (str(chat.get("id")) != destination["chat_id"] or chat.get("title") != destination["title"]
                or kind not in {"group", "supergroup", "channel"}):
            raise DispatchError("Live Telegram destination did not match the verified group")
        member = self.call("getChatMember", chat_id=chat["id"], user_id=bot["id"])
        if member.get("user", {}).get("id") != bot["id"]:
            raise DispatchError("Telegram membership response did not match the Omni AI bot")
        status = member.get("status")
        if kind == "channel":
            permitted = status == "creator" or (status == "administrator" and member.get("can_post_messages") is True)
        else:
            permitted = status in {"creator", "administrator"} or (
                status == "member" and chat.get("permissions", {}).get("can_send_messages") is True
            ) or (status == "restricted" and member.get("is_member") is True and member.get("can_send_messages") is True)
        if not permitted:
            raise DispatchError("Omni AI lacks posting permission in the verified group")


def bot_token():
    found = []
    for line in (HERMES_HOME / ".env").read_text().splitlines():
        match = re.fullmatch(r"(?:export\s+)?TELEGRAM_BOT_TOKEN\s*=\s*(['\"]?)([0-9]+:[A-Za-z0-9_-]+)\1\s*(?:#.*)?", line.strip())
        if match:
            found.append(match.group(2))
    if len(found) != 1:
        raise DispatchError("Expected the existing Omni AI Telegram credential in Hermes")
    return found[0]


def read_json(path):
    return json.loads(path.read_text())


def load_channel(key):
    channel = read_json(SCRIPT_DIR / "editorial.json")["channels"][key]
    destination = read_json(STATE_DIR / "destinations.json").get(key)
    if (not destination or not re.fullmatch(r"-[0-9]+", str(destination.get("chat_id", "")))
            or not destination.get("title")):
        raise DispatchError("Channel is awaiting a verified Telegram destination")
    if channel.get("chat_id") is not None and str(channel["chat_id"]) != destination["chat_id"]:
        raise DispatchError("Editorial and verified Telegram destinations disagree")
    if not channel["posts"]:
        raise DispatchError("Missing rotating editorial posts")
    return channel, destination


def prepare_post(channel, post):
    category = post["category"]
    text = post["text"].strip()
    link = post.get("url")
    if not text or not re.fullmatch(r"[a-z-]{2,40}", category) or re.search(r"https?://", text, re.I):
        raise DispatchError("Invalid editorial copy")
    source_key = post.get("source_key")
    if link:
        parts = urlsplit(link)
        if parts.scheme != "https" or parts.netloc not in CHANNEL_HOSTS[channel] or re.search(r"\s", link):
            raise DispatchError("Editorial link uses an unapproved destination")
        text = f"{text}\n\n{link}"
        if parts.path.startswith("/newsletter/") and not source_key:
            source_key = f"{channel}:{parts.path.rstrip('/').rsplit('/', 1)[-1]}"
    if len(text) > 1500:
        raise DispatchError("Editorial copy exceeds 1,500 characters")
    return {"category": category, "text": text,
            "source_key": source_key, "content_id": hashlib.sha256(text.encode()).hexdigest()}


def approved_wins(channel, day):
    file = STATE_DIR / "approved-wins.json"
    if not file.exists():
        return []
    candidates = []
    for entry in read_json(file).get(channel, []):
        if entry.get("approved_for_public_post") is not True or not entry.get("url") or not entry.get("source_key"):
            continue
        date = datetime.fromisoformat(entry["date"]).date()
        if day - timedelta(days=13) <= date <= day:
            candidates.append((date, {**entry, "category": "community-win"}))
    return [post for _, post in sorted(candidates, key=lambda candidate: candidate[0], reverse=True)]


def select_post(channel, day, editorial, history):
    # Reservations and ambiguous sends count as possibly seen. Distinct copy
    # waits at least two weeks before reuse, and fresh sources publish once.
    entries = [row for row in history if row["status"] != "rejected"]
    recent = [row for row in entries if row["day"] > (day - timedelta(days=14)).isoformat()]
    recent_ids = {row["content_id"] for row in recent}
    recent_sources = {row["source_key"] for row in recent if row["source_key"]}
    all_sources = {row["source_key"] for row in entries if row["source_key"]}
    last_category = entries[0]["category"] if entries else None

    candidates = [prepare_post(channel, item) for item in approved_wins(channel, day)]
    for post in candidates:
        if post["source_key"] not in all_sources and post["category"] != last_category:
            return post
    if entries and last_category != "article":
        for candidate in fresh_posts(channel, day):
            post = prepare_post(channel, candidate)
            if post["source_key"] not in all_sources:
                return post

    last_used = {row["content_id"]: row["day"] for row in reversed(entries)}
    curated = [prepare_post(channel, item) for item in editorial]
    ordered = sorted(curated, key=lambda post: (
        post["category"] == last_category, last_used.get(post["content_id"], "")
    ))
    for post in ordered:
        if post["content_id"] not in recent_ids and post["source_key"] not in recent_sources:
            return post
    raise DispatchError("No different post is available in the two-week editorial rotation")


def previous_dispatches(file, channel, day):
    if not file.exists():
        return []
    with closing(sqlite3.connect(f"{file.as_uri()}?mode=ro", uri=True)) as connection:
        connection.row_factory = sqlite3.Row
        return connection.execute("SELECT * FROM dispatches WHERE channel = ? AND day < ? ORDER BY day DESC",
                                  (channel, day.isoformat())).fetchall()


def publish(client, destination, file, channel, day, post):
    connection = sqlite3.connect(file, timeout=10)
    try:
        connection.execute(SCHEMA)
        with connection:
            cursor = connection.execute(
                "INSERT OR IGNORE INTO dispatches VALUES (?, ?, ?, ?, ?, 'reserved', NULL)",
                (channel, day.isoformat(), post["content_id"], post["category"], post["source_key"]),
            )
        if cursor.rowcount == 0:
            existing = connection.execute("SELECT status FROM dispatches WHERE channel = ? AND day = ?",
                                          (channel, day.isoformat())).fetchone()[0]
            if existing != "sent":
                raise DispatchError(f"A prior attempt is {existing}. Check its receipt before deciding on recovery")
            return False

        status, message_id = "uncertain", None
        try:
            result = client.call("sendMessage", chat_id=destination["chat_id"], text=post["text"],
                                 link_preview_options={"is_disabled": True})
            if (str(result.get("chat", {}).get("id")) != destination["chat_id"]
                    or type(result.get("message_id")) is not int or result["message_id"] <= 0):
                raise TelegramError("sendMessage")
            status, message_id = "sent", result["message_id"]
        except TelegramError as exc:
            if exc.rejection_code:
                status = "rejected"
            raise
        finally:
            with connection:
                connection.execute("UPDATE dispatches SET status = ?, message_id = ? WHERE channel = ? AND day = ?",
                                   (status, message_id, channel, day.isoformat()))
        return True
    finally:
        connection.close()


def run():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("channel", choices=CHANNEL_HOSTS)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--check-only", action="store_true")
    mode.add_argument("--publish", action="store_true")
    args = parser.parse_args()
    os.umask(0o077)

    channel, destination = load_channel(args.channel)
    now = datetime.now(MOUNTAIN)
    schedule = now.replace(hour=channel["hour"], minute=channel["minute"], second=0, microsecond=0)
    if args.publish and not schedule <= now < schedule + timedelta(hours=1):
        raise DispatchError("Run fell outside its scheduled Mountain Time hour")

    client = Telegram(bot_token())
    client.verify(destination)
    file = STATE_DIR / "dispatches.sqlite3"
    history = previous_dispatches(file, args.channel, now.date())
    for configured_post in channel["posts"]:
        prepare_post(args.channel, configured_post)
    post = select_post(args.channel, now.date(), channel["posts"], history)
    if args.check_only:
        print(f"{channel['label']}: Telegram identity, destination, posting permission and copy verified ({schedule:%H:%M %Z})")
    else:
        publish(client, destination, file, args.channel, now.date(), post)


if __name__ == "__main__":
    try:
        run()
    except (DispatchError, KeyError, OSError, ValueError, sqlite3.Error) as exc:
        print(str(exc) if isinstance(exc, DispatchError) else f"Dispatcher stopped: {type(exc).__name__}", file=sys.stderr)
        sys.exit(1)
