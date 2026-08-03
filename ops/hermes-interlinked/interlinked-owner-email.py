#!/usr/bin/env python3
"""Idempotently send the verified daily Interlinked issue to the owner."""

from __future__ import annotations

import argparse
import html
import json
import re
import time
from pathlib import Path
from typing import Any

from interlinked_common import (
    ARTIFACT_ROOT,
    InterlinkedError,
    SITE_URL,
    STATE_ROOT,
    VALIDATOR,
    atomic_json,
    check_resend_sender,
    newsletter_posts,
    newsletter_rows_for_day,
    now_iso,
    parse_env_file,
    patch_newsletter_row,
    remote_image_info,
    request_json,
    run,
    same_day_pair,
    secret_value,
    today,
)


RECIPIENT = "sitanim8@gmail.com"
DEFAULT_FROM = "Omni AI <bookings@omnileadsagi.com>"


def frontmatter_value(text: str, key: str) -> str:
    match = re.search(
        rf"(?im)^\s*{re.escape(key)}\s*:\s*[\"']?([^\"'\n]+)",
        text,
    )
    if not match:
        raise InterlinkedError(f"artifact frontmatter missing {key}")
    return match.group(1).strip()


def artifact_for_day(day: str) -> tuple[Path, str]:
    path = ARTIFACT_ROOT / f"omni-ai-{day}.md"
    if not path.is_file():
        raise InterlinkedError(f"canonical artifact is missing: {path}")
    text = path.read_text(encoding="utf-8", errors="replace")
    process = run(["python3", str(VALIDATOR), str(path)], timeout=120)
    if "PASS" not in process.stdout.upper():
        raise InterlinkedError("canonical artifact did not pass validation")
    if frontmatter_value(text, "date") != day:
        raise InterlinkedError("artifact date does not match the scheduled day")
    return path, text


def live_preflight(day: str, artifact: str) -> dict[str, Any]:
    rows, source = newsletter_posts()
    if source != "supabase":
        raise InterlinkedError(f"newsletter API source is {source}, not Supabase")
    free, premium = same_day_pair(rows, day)
    if free.get("slug") != f"interlinked-free-{day}":
        raise InterlinkedError("live Free slug does not match the scheduled day")
    if premium.get("slug") != f"interlinked-premium-{day}":
        raise InterlinkedError("live Premium slug does not match the scheduled day")

    hero = frontmatter_value(artifact, "hero_image")
    share = frontmatter_value(artifact, "share_image")
    expected_hero = f"{SITE_URL}/newsletter/generated/interlinked-free-{day}.jpg"
    expected_share = (
        f"{SITE_URL}/newsletter/generated/interlinked-premium-{day}-share.jpg"
    )
    if hero != expected_hero:
        raise InterlinkedError(f"unexpected hero image URL: {hero}")
    if share != expected_share:
        raise InterlinkedError(f"unexpected share image URL: {share}")
    hero_info = remote_image_info(f"{hero}?email={int(time.time())}")
    share_info = remote_image_info(f"{share}?email={int(time.time())}")
    if hero_info[:2] != (1200, 630):
        raise InterlinkedError(f"hero image is {hero_info[0]}x{hero_info[1]}")
    if share_info[:2] != (1024, 1024):
        raise InterlinkedError(f"share image is {share_info[0]}x{share_info[1]}")
    return {
        "source": source,
        "free": free,
        "premium": premium,
        "hero": hero,
        "share": share,
    }


def row_email_state(day: str) -> list[dict[str, Any]]:
    rows = newsletter_rows_for_day(
        day,
        select="slug,tier,status,email_sent,sent_at,send_feedback",
    )
    if not isinstance(rows, list) or len(rows) != 2:
        raise InterlinkedError("database does not contain the same-day Interlinked pair")
    if any(row.get("status") != "published" for row in rows):
        raise InterlinkedError("database pair is not marked published")
    return rows


def provider_receipt(email_id: str, key: str) -> dict[str, Any]:
    payload = request_json(
        f"https://api.resend.com/emails/{email_id}",
        headers={"Authorization": f"Bearer {key}"},
    )
    event = str(payload.get("last_event") or "accepted").lower()
    if event in {"bounced", "complained", "failed", "canceled", "suppressed"}:
        raise InterlinkedError(
            f"Resend reports owner email failure: {email_id} ({event})"
        )
    return {
        "id": email_id,
        "last_event": event,
        "created_at": payload.get("created_at"),
        "subject": payload.get("subject"),
    }


def markdown_body(text: str) -> str:
    body = re.sub(r"\A---\n.*?\n---\n", "", text, count=1, flags=re.DOTALL)
    body = re.sub(r"(?ms)^## Publication Receipt\n.*\Z", "", body).strip()
    chunks: list[str] = []
    in_list = False
    for raw in body.splitlines():
        line = raw.strip()
        if not line:
            if in_list:
                chunks.append("</ul>")
                in_list = False
            continue
        if line.startswith("## "):
            if in_list:
                chunks.append("</ul>")
                in_list = False
            chunks.append(
                '<h2 style="margin:30px 0 12px;color:#fbbf24;font-size:22px;">'
                + html.escape(line[3:])
                + "</h2>"
            )
            continue
        item = re.match(r"^(?:\d+\.|-)\s+(.+)$", line)
        if item:
            if not in_list:
                chunks.append(
                    '<ul style="margin:8px 0 20px;padding-left:22px;color:#e5e7eb;">'
                )
                in_list = True
            chunks.append(
                '<li style="margin:8px 0;line-height:1.65;">'
                + linkify(item.group(1))
                + "</li>"
            )
            continue
        if in_list:
            chunks.append("</ul>")
            in_list = False
        chunks.append(
            '<p style="margin:0 0 15px;color:#e5e7eb;line-height:1.75;">'
            + linkify(line)
            + "</p>"
        )
    if in_list:
        chunks.append("</ul>")
    return "".join(chunks)


def linkify(text: str) -> str:
    escaped = html.escape(text)
    return re.sub(
        r"(https://[^\s<]+)",
        r'<a href="\1" style="color:#fbbf24;">\1</a>',
        escaped,
    )


def build_email(artifact: str, live: dict[str, Any]) -> tuple[str, str]:
    subject = str(live["free"].get("subject") or "").strip()
    if not subject:
        raise InterlinkedError("live Free subject is empty")
    hero = live["hero"]
    free_url = f"{SITE_URL}/newsletter/{live['free']['slug']}"
    premium_url = f"{SITE_URL}/newsletter/{live['premium']['slug']}"
    body = markdown_body(artifact)
    email_html = f"""<!doctype html>
<html>
  <body style="margin:0;background:#050505;font-family:Arial,sans-serif;">
    <div style="max-width:720px;margin:0 auto;padding:26px 18px 42px;">
      <div style="color:#fbbf24;font-size:13px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;">Interlinked · Omni AI</div>
      <h1 style="margin:10px 0 18px;color:#fff;font-size:34px;line-height:1.12;">{html.escape(subject)}</h1>
      <img src="{html.escape(hero)}" alt="" width="720" style="width:100%;height:auto;border-radius:14px;border:1px solid #3f3214;" />
      <div style="margin-top:24px;">{body}</div>
      <div style="margin:30px 0 8px;text-align:center;">
        <a href="{html.escape(free_url)}" style="display:inline-block;margin:5px;padding:13px 20px;border-radius:9px;background:#f59e0b;color:#111827;text-decoration:none;font-weight:700;">Read Free Issue</a>
        <a href="{html.escape(premium_url)}" style="display:inline-block;margin:5px;padding:13px 20px;border-radius:9px;border:1px solid #f59e0b;color:#fbbf24;text-decoration:none;font-weight:700;">Open Premium Brief</a>
      </div>
    </div>
  </body>
</html>"""
    return f"Interlinked — {subject}", email_html


def mark_delivered(day: str, receipt: dict[str, Any]) -> None:
    feedback = (
        f"owner-only resend:{receipt['id']} status:{receipt['last_event']} "
        f"verified:{now_iso()}"
    )
    rows = newsletter_rows_for_day(
        day,
        select="slug,recipients_count,sent_at,send_feedback",
    )
    if len(rows) != 2:
        raise InterlinkedError("cannot mirror owner email; database pair missing")
    for row in rows:
        prior = str(row.get("send_feedback") or "").strip()
        combined = prior if feedback in prior else "\n".join(
            value for value in (prior, feedback) if value
        )
        patch_newsletter_row(
            str(row["slug"]),
            {
                "email_sent": True,
                "recipients_count": max(int(row.get("recipients_count") or 0), 1),
                "sent_at": row.get("sent_at") or now_iso(),
                "send_feedback": combined,
                "updated_at": now_iso(),
            },
        )


def existing_receipt(day: str, key: str) -> dict[str, Any] | None:
    path = STATE_ROOT / f"{day}-email.json"
    try:
        state = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        state = {}
    email_id = str(state.get("provider", {}).get("id") or "")
    if email_id:
        receipt = provider_receipt(email_id, key)
        mark_delivered(day, receipt)
        return {
            "ok": True,
            "day": day,
            "dedupe": "local-receipt",
            "provider": receipt,
        }

    rows = row_email_state(day)
    feedback = "\n".join(str(row.get("send_feedback") or "") for row in rows)
    match = re.search(r"owner-only resend:([A-Za-z0-9-]+)", feedback)
    if all(bool(row.get("email_sent")) for row in rows) and match:
        receipt = provider_receipt(match.group(1), key)
        return {
            "ok": True,
            "day": day,
            "dedupe": "database-receipt",
            "provider": receipt,
        }
    return None


def execute(check_only: bool) -> dict[str, Any]:
    day = today()
    artifact_path, artifact = artifact_for_day(day)
    live = live_preflight(day, artifact)
    rows = row_email_state(day)
    sender = check_resend_sender()
    values = parse_env_file()
    key = secret_value("RESEND_API_KEY", values)
    prior = existing_receipt(day, key)
    if prior:
        return {
            **prior,
            "artifact": str(artifact_path),
            "sender": sender,
        }
    subject, body = build_email(artifact, live)
    if check_only:
        return {
            "ok": True,
            "mode": "check-only",
            "day": day,
            "subject": subject,
            "artifact": str(artifact_path),
            "sender": sender,
            "rows": rows,
        }

    from_address = (
        values.get("RESEND_FROM", "").strip()
        or values.get("NEWSLETTER_FROM_EMAIL", "").strip()
        or DEFAULT_FROM
    )
    if "omnileadsagi.com" not in from_address.lower():
        raise InterlinkedError(f"unsafe owner-newsletter sender: {from_address}")
    send = request_json(
        "https://api.resend.com/emails",
        method="POST",
        headers={
            "Authorization": f"Bearer {key}",
            "Idempotency-Key": f"interlinked-owner/{day}/v2",
        },
        payload={
            "from": from_address,
            "to": [RECIPIENT],
            "subject": subject,
            "html": body,
            "tags": [
                {"name": "workflow", "value": "interlinked_owner"},
                {"name": "issue_date", "value": day.replace("-", "_")},
            ],
        },
        timeout=45,
    )
    email_id = str(send.get("id") or "")
    if not email_id:
        raise InterlinkedError("Resend accepted no provider delivery ID")
    receipt = provider_receipt(email_id, key)
    state = {
        "ok": True,
        "day": day,
        "sent_at": now_iso(),
        "subject": subject,
        "artifact": str(artifact_path),
        "provider": receipt,
        "recipient": RECIPIENT,
        "sender": sender,
    }
    # Persist provider acceptance before the database mirror. If the mirror
    # fails, retries recover from this receipt without sending twice.
    atomic_json(STATE_ROOT / f"{day}-email.json", state)
    mark_delivered(day, receipt)
    return state


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check-only", action="store_true")
    args = parser.parse_args()
    try:
        result = execute(args.check_only)
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        return 0
    except (InterlinkedError, OSError, ValueError, json.JSONDecodeError) as exc:
        failure = {
            "ok": False,
            "day": today(),
            "failed_at": now_iso(),
            "error": str(exc),
        }
        atomic_json(STATE_ROOT / f"{today()}-email-failure.json", failure)
        print(json.dumps(failure, ensure_ascii=False, sort_keys=True))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
