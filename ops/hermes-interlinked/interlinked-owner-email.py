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
    supabase_request,
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
    public_free, public_premium = same_day_pair(rows, day)
    if public_free.get("slug") != f"interlinked-free-{day}":
        raise InterlinkedError("live Free slug does not match the scheduled day")
    if public_premium.get("slug") != f"interlinked-premium-{day}":
        raise InterlinkedError("live Premium slug does not match the scheduled day")

    # The public posts endpoint intentionally exposes only minimal dashboard
    # fields. Fetch the bounded teaser source directly from the canonical rows
    # after the public slugs have been verified.
    content_rows = newsletter_rows_for_day(
        day,
        select="slug,tier,subject,intro,status",
    )
    free, premium = same_day_pair(content_rows, day)
    if any(row.get("status") != "published" for row in (free, premium)):
        raise InterlinkedError("canonical Interlinked pair is not published")
    if free.get("subject") != public_free.get("subject"):
        raise InterlinkedError("public Free subject does not match the database")
    if premium.get("subject") != public_premium.get("subject"):
        raise InterlinkedError("public Premium subject does not match the database")

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


def recipient_entitlements() -> dict[str, Any]:
    rows = supabase_request(
        "profiles",
        query={
            "select": (
                "email,is_admin,is_premium,role,subscription_status,"
                "newsletter_subscribed"
            ),
            "email": f"eq.{RECIPIENT}",
            "limit": "1",
        },
    )
    if not isinstance(rows, list) or len(rows) != 1:
        raise InterlinkedError("owner profile is missing or ambiguous")
    row = rows[0]
    if not isinstance(row, dict):
        raise InterlinkedError("owner profile is malformed")
    is_admin = row.get("is_admin") is True or row.get("role") == "admin"
    is_premium = (
        row.get("is_premium") is True
        or row.get("subscription_status") == "active"
    )
    if not is_admin:
        raise InterlinkedError("owner recipient is not an active admin")
    if not is_premium:
        raise InterlinkedError("owner recipient is not entitled to Premium")
    if row.get("newsletter_subscribed") is False:
        raise InterlinkedError("owner recipient is unsubscribed")
    return {
        "email": RECIPIENT,
        "is_admin": True,
        "is_premium": True,
    }


def teaser_excerpt(value: Any, max_length: int = 260) -> str:
    clean = re.sub(r"\s+", " ", str(value or "")).strip()
    if not clean:
        raise InterlinkedError("live issue teaser is empty")
    if len(clean) <= max_length:
        return clean
    sentence = re.match(r"^.{80,260}?[.!?](?:\s|$)", clean)
    if sentence:
        return sentence.group(0).strip()
    clipped = clean[: max_length + 1]
    boundary = clipped.rfind(" ")
    return clipped[: boundary if boundary > 120 else max_length].strip() + "…"


def build_email(live: dict[str, Any]) -> tuple[str, str]:
    free_subject = str(live["free"].get("subject") or "").strip()
    premium_subject = str(live["premium"].get("subject") or "").strip()
    if not free_subject or not premium_subject:
        raise InterlinkedError("live Interlinked subject is empty")
    free_teaser = teaser_excerpt(live["free"].get("intro"))
    premium_teaser = teaser_excerpt(live["premium"].get("intro"))
    hero = str(live["hero"])
    free_url = f"{SITE_URL}/newsletter/{live['free']['slug']}"
    premium_url = f"{SITE_URL}/newsletter/{live['premium']['slug']}"
    email_html = f"""<!doctype html>
<html>
  <body style="margin:0;background:#0a0a0f;font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0a0a0f;">
      <tr><td align="center" style="padding:28px 16px 42px;">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;">
          <tr><td style="padding:0 0 16px;color:#f59e0b;font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;">Interlinked · Admin Edition</td></tr>
          <tr><td style="padding:0 0 20px;">
            <h1 style="margin:0;color:#f1f5f9;font-size:32px;line-height:1.18;">Today’s Free + Premium intelligence is live.</h1>
          </td></tr>
          <tr><td style="padding:0 0 22px;">
            <img src="{html.escape(hero)}" alt="" width="640" style="display:block;width:100%;height:auto;border:0;border-radius:10px;" />
          </td></tr>
          <tr><td style="padding:0 0 16px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#13131a;border:1px solid #262631;border-radius:10px;">
              <tr><td style="padding:22px 24px;">
                <p style="margin:0 0 9px;color:#a855f7;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;">Free Brief</p>
                <h2 style="margin:0 0 11px;color:#f1f5f9;font-size:22px;line-height:1.3;">{html.escape(free_subject)}</h2>
                <p style="margin:0 0 18px;color:#e5e7eb;font-size:15px;line-height:1.7;">{html.escape(free_teaser)}</p>
                <a href="{html.escape(free_url)}" style="display:inline-block;padding:13px 20px;border-radius:9px;background:#a855f7;color:#ffffff;text-decoration:none;font-weight:700;">Read Free Issue</a>
              </td></tr>
            </table>
          </td></tr>
          <tr><td style="padding:0 0 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#13131a;border:1px solid #3a321f;border-radius:10px;">
              <tr><td style="padding:22px 24px;">
                <p style="margin:0 0 9px;color:#f59e0b;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;">Premium Brief</p>
                <h2 style="margin:0 0 11px;color:#f1f5f9;font-size:22px;line-height:1.3;">{html.escape(premium_subject)}</h2>
                <p style="margin:0 0 18px;color:#e5e7eb;font-size:15px;line-height:1.7;">{html.escape(premium_teaser)}</p>
                <a href="{html.escape(premium_url)}" style="display:inline-block;padding:13px 20px;border-radius:9px;background:#f59e0b;color:#111827;text-decoration:none;font-weight:700;">Open Premium Brief</a>
              </td></tr>
            </table>
          </td></tr>
          <tr><td align="center" style="padding-top:4px;color:#6b7280;font-size:12px;">The full intelligence stays on Interlinked. Your inbox gets the signal and the route.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>"""
    return f"Interlinked Admin — {free_subject}", email_html


def mark_delivered(day: str, receipt: dict[str, Any]) -> None:
    feedback = (
        f"owner-teaser-v3:{receipt['id']} status:{receipt['last_event']} "
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
    path = STATE_ROOT / f"{day}-owner-teaser-v3.json"
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
    match = re.search(r"owner-teaser-v3:([A-Za-z0-9-]+)", feedback)
    if all(bool(row.get("email_sent")) for row in rows) and match:
        receipt = provider_receipt(match.group(1), key)
        return {
            "ok": True,
            "day": day,
            "dedupe": "database-receipt",
            "provider": receipt,
        }
    return None


def execute(
    check_only: bool,
    requested_day: str | None = None,
    preview_html: Path | None = None,
) -> dict[str, Any]:
    day = requested_day or today()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
        raise InterlinkedError(f"invalid issue day: {day}")
    artifact_path, artifact = artifact_for_day(day)
    live = live_preflight(day, artifact)
    rows = row_email_state(day)
    entitlements = recipient_entitlements()
    sender = check_resend_sender()
    values = parse_env_file()
    key = secret_value("RESEND_API_KEY", values)
    prior = existing_receipt(day, key)
    if prior:
        return {
            **prior,
            "artifact": str(artifact_path),
            "entitlements": entitlements,
            "sender": sender,
        }
    subject, body = build_email(live)
    if preview_html is not None:
        preview_html.parent.mkdir(parents=True, exist_ok=True)
        preview_html.write_text(body, encoding="utf-8")
    if check_only:
        return {
            "ok": True,
            "mode": "check-only",
            "day": day,
            "subject": subject,
            "artifact": str(artifact_path),
            "entitlements": entitlements,
            "preview_html": str(preview_html) if preview_html else None,
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
            "Idempotency-Key": f"interlinked-owner/{day}/v3",
        },
        payload={
            "from": from_address,
            "to": [RECIPIENT],
            "subject": subject,
            "html": body,
            "tags": [
                {"name": "workflow", "value": "interlinked_owner"},
                {"name": "template", "value": "teaser_v3"},
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
        "entitlements": entitlements,
        "sender": sender,
    }
    # Persist provider acceptance before the database mirror. If the mirror
    # fails, retries recover from this receipt without sending twice.
    atomic_json(STATE_ROOT / f"{day}-owner-teaser-v3.json", state)
    mark_delivered(day, receipt)
    return state


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check-only", action="store_true")
    parser.add_argument("--day")
    parser.add_argument("--preview-html", type=Path)
    args = parser.parse_args()
    try:
        result = execute(args.check_only, args.day, args.preview_html)
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        return 0
    except (InterlinkedError, OSError, ValueError, json.JSONDecodeError) as exc:
        failure = {
            "ok": False,
            "day": args.day or today(),
            "failed_at": now_iso(),
            "error": str(exc),
        }
        atomic_json(
            STATE_ROOT / f"{args.day or today()}-owner-teaser-v3-failure.json",
            failure,
        )
        print(json.dumps(failure, ensure_ascii=False, sort_keys=True))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
