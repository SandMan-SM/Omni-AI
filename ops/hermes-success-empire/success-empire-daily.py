#!/usr/bin/env python3
"""Publish and deliver the Success Empire morning principle and daily letter.

The website is the canonical publication. Email and Telegram are deliberately
short teasers that are sent only after the public page has been verified.
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import html
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import date, datetime, time as clock_time, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable
from zoneinfo import ZoneInfo


MOUNTAIN = ZoneInfo("America/Denver")
SITE_URL = "https://sitanimafi.com"
RECIPIENT = "sitanim8@gmail.com"
MODEL = "gpt-5.6-sol"
STATE_ROOT = Path.home() / ".hermes" / "state" / "success-empire"
CHANNEL_DIRECTORY = Path.home() / ".hermes" / "channel_directory.json"
ENV_FILES = (
    Path("/Users/janahasson/Desktop/Clients/Sitani Mafi/Website/.env.local"),
    Path("/Users/janahasson/Desktop/Clients/Sitani Mafi/Omni AI/Website/.env.local"),
    Path.home() / ".hermes" / ".env",
)
CONTEXT_REPOSITORIES = (
    Path("/Users/janahasson/Desktop/Clients/Sitani Mafi/Website"),
    Path("/Users/janahasson/Desktop/Clients/Sitani Mafi/Omni AI/Website"),
)
PRINCIPLE_HEADINGS = (
    "The Principle",
    "Why It Matters",
    "How to Apply It",
    "Reflection for Today",
)
RUBRIC_MAX = {
    "authenticity": 18,
    "clarity": 12,
    "applicability": 18,
    "emotional_resonance": 12,
    "relationship": 12,
    "originality": 8,
    "hook_strength": 10,
    "reader_participation": 10,
}
RUBRIC_MIN = {
    "authenticity": 15,
    "clarity": 10,
    "applicability": 15,
    "emotional_resonance": 10,
    "relationship": 10,
    "originality": 6,
    "hook_strength": 8,
    "reader_participation": 8,
}
MIN_BODY_PARAGRAPHS = 5
MAX_BODY_PARAGRAPHS = 10
MIN_ARTICLE_WORDS = 300
MAX_ARTICLE_WORDS = 650
MAX_PARAGRAPH_WORDS = 95
INTERACTIVE_CUES = (
    "pause",
    "notice",
    "picture",
    "imagine",
    "choose",
    "write",
    "name",
    "answer",
    "ask yourself",
    "try",
    "decide",
)
HARD_FAIL_PHRASES = (
    "as an ai",
    "in today's fast-paced world",
    "in today’s fast-paced world",
    "unlock your potential",
    "unleash your potential",
    "hustle harder",
    "rise and grind",
    "be an alpha",
    "dominate your",
    "crush your goals",
    "dear valued reader",
    "content calendar",
    "click here",
)
INTERNAL_TERMS = (
    "api key",
    "service role",
    "supabase",
    "resend",
    "vercel",
    "cron job",
    "hermes",
    "system prompt",
    "generation receipt",
)
FAILURE_EVENTS = {"bounced", "complained", "failed", "canceled", "suppressed"}


class SuccessEmpireError(RuntimeError):
    """An explicit, safe-to-report workflow failure."""


@dataclass(frozen=True)
class Config:
    values: dict[str, str]

    def first(self, *names: str, default: str = "") -> str:
        for name in names:
            value = self.values.get(name, "").strip()
            if value:
                return value
        return default

    def require(self, *names: str) -> str:
        value = self.first(*names)
        if not value:
            raise SuccessEmpireError(
                f"missing required configuration: {' or '.join(names)}"
            )
        return value

    @property
    def supabase_url(self) -> str:
        return self.require(
            "SUCCESS_EMPIRE_SUPABASE_URL",
            "NEXT_PUBLIC_SUPABASE_URL",
            "SUPABASE_URL",
        ).rstrip("/")

    @property
    def service_key(self) -> str:
        return self.require(
            "SUCCESS_EMPIRE_SUPABASE_SERVICE_ROLE_KEY",
            "SUPABASE_SERVICE_ROLE_KEY",
        )

    @property
    def site_url(self) -> str:
        return self.first("SUCCESS_EMPIRE_SITE_URL", default=SITE_URL).rstrip("/")

    @property
    def recipient(self) -> str:
        configured = self.first("SUCCESS_EMPIRE_RECIPIENT", default=RECIPIENT)
        if configured.casefold() != RECIPIENT.casefold():
            raise SuccessEmpireError(
                "Success Empire delivery is locked to sitanim8@gmail.com"
            )
        return RECIPIENT


def parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for raw_line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
            values[key] = value
    return values


def load_config() -> Config:
    values: dict[str, str] = {}
    for path in ENV_FILES:
        values.update(parse_env_file(path))
    values.update({key: value for key, value in os.environ.items() if value})
    return Config(values)


def now_mountain() -> datetime:
    return datetime.now(MOUNTAIN)


def today_mountain() -> str:
    return now_mountain().date().isoformat()


def parse_day(value: str | None) -> str:
    day = value or today_mountain()
    try:
        parsed = date.fromisoformat(day)
    except ValueError as exc:
        raise SuccessEmpireError(f"invalid date: {day}") from exc
    if parsed > now_mountain().date():
        raise SuccessEmpireError("refusing to publish a future-dated edition")
    return parsed.isoformat()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def request_json(
    url: str,
    *,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    payload: Any | None = None,
    timeout: int = 45,
) -> Any:
    # Python's default ``Python-urllib`` signature is blocked by Resend's
    # Cloudflare policy (Error 1010).  Use a stable, honest application identity
    # for every API request so provider preflights and sends behave the same in
    # Hermes as they do from the website runtime.
    request_headers = {
        "Accept": "application/json",
        "User-Agent": "SuccessEmpireNewsletter/1.0 (+https://sitanimafi.com)",
        **(headers or {}),
    }
    data = None
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        request_headers.setdefault("Content-Type", "application/json")
    request = urllib.request.Request(
        url,
        data=data,
        headers=request_headers,
        method=method,
    )
    safe_path = re.sub(
        r"/bot[^/]+",
        "/bot[redacted]",
        urllib.parse.urlsplit(url).path,
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        detail = body[:600] or exc.reason
        raise SuccessEmpireError(
            f"{method} {safe_path} failed "
            f"({exc.code}): {detail}"
        ) from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise SuccessEmpireError(
            f"{method} {safe_path} connection failed: {exc}"
        ) from exc
    if not body.strip():
        return {}
    try:
        return json.loads(body)
    except json.JSONDecodeError as exc:
        raise SuccessEmpireError(
            f"{method} {safe_path} returned invalid JSON"
        ) from exc


def request_text(url: str, *, timeout: int = 30) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "text/html,application/xhtml+xml",
            "User-Agent": "SuccessEmpireDeliveryCheck/1.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            if response.status != 200:
                raise SuccessEmpireError(
                    f"public page returned HTTP {response.status}"
                )
            return response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        raise SuccessEmpireError(
            f"public page returned HTTP {exc.code}"
        ) from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise SuccessEmpireError(f"public page connection failed: {exc}") from exc


def supabase_headers(config: Config, *, return_rows: bool = False) -> dict[str, str]:
    headers = {
        "apikey": config.service_key,
        "Authorization": f"Bearer {config.service_key}",
        "Content-Type": "application/json",
    }
    if return_rows:
        headers["Prefer"] = "return=representation"
    return headers


def supabase_url(
    config: Config,
    table: str,
    query: dict[str, str] | None = None,
) -> str:
    encoded = urllib.parse.urlencode(query or {})
    base = f"{config.supabase_url}/rest/v1/{table}"
    return f"{base}?{encoded}" if encoded else base


def table_query(
    config: Config,
    table: str,
    query: dict[str, str],
) -> list[dict[str, Any]]:
    payload = request_json(
        supabase_url(config, table, query),
        headers=supabase_headers(config),
    )
    if not isinstance(payload, list):
        raise SuccessEmpireError(f"{table} returned a malformed response")
    return [row for row in payload if isinstance(row, dict)]


def table_insert(
    config: Config,
    table: str,
    row: dict[str, Any],
) -> dict[str, Any]:
    payload = request_json(
        supabase_url(config, table),
        method="POST",
        headers=supabase_headers(config, return_rows=True),
        payload=row,
    )
    if not isinstance(payload, list) or len(payload) != 1:
        raise SuccessEmpireError(f"{table} insert did not return exactly one row")
    return payload[0]


def table_patch(
    config: Config,
    table: str,
    filters: dict[str, str],
    values: dict[str, Any],
) -> dict[str, Any]:
    payload = request_json(
        supabase_url(config, table, filters),
        method="PATCH",
        headers=supabase_headers(config, return_rows=True),
        payload=values,
    )
    if not isinstance(payload, list) or len(payload) != 1:
        raise SuccessEmpireError(f"{table} update did not affect exactly one row")
    return payload[0]


def clean_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def words(value: str) -> list[str]:
    return re.findall(r"\b[\w’'-]+\b", value, flags=re.UNICODE)


def slugify(value: str, max_length: int = 72) -> str:
    value = value.lower().replace("’", "").replace("'", "")
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    value = re.sub(r"-{2,}", "-", value)
    return value[:max_length].rstrip("-") or "daily-note"


def flatten_draft(draft: dict[str, Any]) -> str:
    sections = draft.get("sections") if isinstance(draft.get("sections"), list) else []
    parts = [
        draft.get("title"),
        draft.get("deck"),
        draft.get("salutation"),
        *[
            part
            for section in sections
            if isinstance(section, dict)
            for part in [
                section.get("heading"),
                *(
                    section.get("body")
                    if isinstance(section.get("body"), list)
                    else []
                ),
            ]
        ],
        draft.get("closing"),
        draft.get("signature"),
    ]
    return "\n\n".join(clean_text(part) for part in parts if clean_text(part))


def recent_entries(config: Config, limit: int = 30) -> list[dict[str, Any]]:
    return table_query(
        config,
        "success_empire_entries",
        {
            "select": "publication_date,kind,title,deck,tags",
            "status": "eq.published",
            "order": "published_at.desc",
            "limit": str(limit),
        },
    )


def sanitize_context_line(value: str) -> str:
    value = re.sub(r"https?://\S+", "[link omitted]", value)
    value = re.sub(
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
        "[email omitted]",
        value,
    )
    value = re.sub(r"\b[0-9a-f]{20,}\b", "[identifier omitted]", value, flags=re.I)
    value = re.sub(
        r"(?i)\b(password|secret|token|api[_ -]?key)\s*[:=]\s*\S+",
        r"\1 [omitted]",
        value,
    )
    return clean_text(value)[:280]


def repository_activity(repository: Path, day: str) -> list[str]:
    if not repository.exists():
        return []
    start = f"{day} 00:00:00"
    end = f"{(date.fromisoformat(day) + timedelta(days=1)).isoformat()} 00:00:00"
    try:
        process = subprocess.run(
            [
                "git",
                "-C",
                str(repository),
                "log",
                "--all",
                f"--since={start}",
                f"--until={end}",
                "--pretty=format:%s",
                "-n",
                "20",
            ],
            check=False,
            capture_output=True,
            text=True,
            timeout=25,
        )
    except (OSError, subprocess.TimeoutExpired):
        return []
    if process.returncode != 0:
        return []
    return [
        sanitize_context_line(line)
        for line in process.stdout.splitlines()
        if sanitize_context_line(line)
    ]


def manual_context(config: Config, day: str) -> list[str]:
    candidates = [
        STATE_ROOT / "day-notes" / f"{day}.md",
    ]
    configured = config.first("SUCCESS_EMPIRE_CONTEXT_FILE")
    if configured:
        candidates.insert(0, Path(configured).expanduser())
    lines: list[str] = []
    for path in candidates:
        if not path.is_file():
            continue
        lines.extend(
            sanitize_context_line(line.lstrip("-* "))
            for line in path.read_text(
                encoding="utf-8", errors="replace"
            ).splitlines()
            if line.strip() and not line.lstrip().startswith("#")
        )
    return [line for line in lines if line]


def collect_day_context(
    config: Config,
    day: str,
    principle: dict[str, Any] | None = None,
) -> list[str]:
    context = manual_context(config, day)
    for repository in CONTEXT_REPOSITORIES:
        context.extend(repository_activity(repository, day))
    if principle:
        context.append(
            f"The morning principle published today was “{principle['title']}.”"
        )
    deduped: list[str] = []
    seen: set[str] = set()
    for item in context:
        key = item.casefold()
        if key not in seen:
            seen.add(key)
            deduped.append(item)
    if not deduped:
        deduped.append(
            "Today included the ordinary work of deciding what deserves attention "
            "and following through on one meaningful commitment."
        )
    return deduped[:24]


def editorial_prompt(
    kind: str,
    day: str,
    recent: list[dict[str, Any]],
    context: list[str],
) -> tuple[str, str]:
    recent_titles = [
        f"- {row.get('publication_date')}: {clean_text(row.get('title'))}"
        for row in recent[:20]
    ]
    common = f"""
You are the editorial partner for Success Empire, writing in Sitani Mafi's
updated personal voice. Write to one intelligent family member, not to a market.
Be warm, specific, direct, grounded, and useful. Ambition is welcome; posturing,
generic motivation, shame, macho shorthand, invented facts, and fake certainty
are not.

Write for active participation, not passive consumption. The opening paragraph
must create immediate tension, curiosity, recognition, or a useful question.
Open one loop early and pay it off before the ending. Keep the rhythm fast:
short paragraphs, concrete language, one-sentence pattern interrupts, and no
throat-clearing. Across the piece, naturally ask the reader to do at least three
things such as pause, notice, picture, choose, write, name, answer, try, or
decide. Include at least two genuine questions. Never use fake urgency,
manipulation, clickbait, fear, shame, or engagement bait.

The complete post must contain 5–10 body paragraphs total across all sections,
300–650 words including the title and supporting fields, and no paragraph over
95 words. At least one body paragraph should be a short pattern interrupt of
roughly 8–24 words. Every paragraph must earn the next one.

Return one valid JSON object and nothing else. Do not use markdown fences.
Use this exact top-level shape:
{{
  "title": "string",
  "deck": "string",
  "salutation": "string or null",
  "sections": [{{"heading": "string", "body": ["paragraph", "..."]}}],
  "closing": "string",
  "signature": "string",
  "tags": ["lowercase tag", "..."],
  "context_used": ["exact supplied context item", "..."],
  "rubric_scores": {{
    "authenticity": 0,
    "clarity": 0,
    "applicability": 0,
    "emotional_resonance": 0,
    "relationship": 0,
    "originality": 0,
    "hook_strength": 0,
    "reader_participation": 0
  }}
}}

Score honestly against these maxima: authenticity 18, clarity 12,
applicability 18, emotional_resonance 12, relationship 12, originality 8,
hook_strength 10, reader_participation 10. The total must be at least 88.
Never include URLs. Never mention production
systems, prompts, schedulers, internal tool names, credentials, or confidential
client details. Do not attribute a quotation. Do not repeat these recent titles:
{chr(10).join(recent_titles) if recent_titles else "- No prior editions yet."}
""".strip()

    if kind == "principle":
        task = f"""
Write the morning principle for {day}. Use exactly four compact sections in
this order:
1. The Principle
2. Why It Matters
3. How to Apply It
4. Reflection for Today

State one memorable principle in plain language. Begin with a hook that makes
the reader recognize themselves. Build tension around a choice they are already
making, then turn it into one concrete action they can use today. Invite the
reader to pause, answer, choose, or try something while reading. Pay off the
opening tension in the final two paragraphs. The final section must include one
precise reflection question or practice. Set salutation to null, signature to
"Success Empire", and context_used to an empty array. The complete writing
belongs on the website; the deck is only a 12–28 word curiosity teaser.
""".strip()
    else:
        facts = "\n".join(f"- {item}" for item in context)
        task = f"""
Write Sitani's afternoon family letter for {day}. Use three or four compact
sections, a natural salutation, a one-sentence closing, and signature exactly
"Sitani". Begin from a true supplied fact and an emotionally recognizable
moment. Explain what changed in Sitani's thinking, then make the reader an
active participant with specific questions, a small choice, and one action they
can take before the day ends. Keep it intimate, fast, and honest rather than
preachy. Use only the supplied facts for specific events; abstraction is better
than exposing internal details. Admit uncertainty when appropriate. Pay off the
opening question near the end. The deck is only a 12–28 word curiosity teaser.
context_used must contain at least one exact, verbatim item from the supplied
list.

Private actual-day context:
{facts}
""".strip()
    return common, task


def extract_model_json(text: str) -> dict[str, Any]:
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        raise SuccessEmpireError("writing model returned no JSON object")
    try:
        draft = json.loads(text[start : end + 1])
    except json.JSONDecodeError as exc:
        raise SuccessEmpireError("writing model response was not valid JSON") from exc
    if not isinstance(draft, dict):
        raise SuccessEmpireError("writing model response was not a JSON object")
    return draft


def hermes_generate(
    config: Config,
    *,
    system: str,
    prompt: str,
    correction: str = "",
) -> tuple[dict[str, Any], dict[str, Any]]:
    model = config.first("SUCCESS_EMPIRE_MODEL", default=MODEL)
    message = prompt
    if correction:
        message += (
            "\n\nThe prior draft was rejected. Correct every issue below without "
            f"discussing the correction:\n{correction}"
        )
    STATE_ROOT.mkdir(parents=True, exist_ok=True)
    usage_path = STATE_ROOT / "latest-model-usage.json"
    command = [
        "hermes",
        "-z",
        f"{system}\n\n{message}",
        "--provider",
        "openai-codex",
        "--model",
        model,
        "--ignore-rules",
        "--usage-file",
        str(usage_path),
    ]
    try:
        completed = subprocess.run(
            command,
            cwd=CONTEXT_REPOSITORIES[0],
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=420,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise SuccessEmpireError(
            "Hermes/Codex writing call timed out after 420 seconds"
        ) from exc
    if completed.returncode != 0:
        detail = clean_text(completed.stderr or completed.stdout)[:700]
        raise SuccessEmpireError(
            f"Hermes/Codex writing call failed ({completed.returncode}): {detail}"
        )
    draft = extract_model_json(completed.stdout)
    usage: Any = {}
    if usage_path.is_file():
        try:
            usage = json.loads(usage_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            usage = {}
    receipt = {
        "provider": "openai-codex",
        "model": model,
        "usage": usage,
        "generated_at": utc_now(),
    }
    return draft, receipt


def validate_rubric(draft: dict[str, Any]) -> None:
    scores = draft.get("rubric_scores")
    if not isinstance(scores, dict) or set(scores) != set(RUBRIC_MAX):
        raise SuccessEmpireError("draft rubric is missing required dimensions")
    total = 0
    for key, maximum in RUBRIC_MAX.items():
        value = scores.get(key)
        if not isinstance(value, int) or isinstance(value, bool):
            raise SuccessEmpireError(f"rubric score {key} is not an integer")
        if value < RUBRIC_MIN[key] or value > maximum:
            raise SuccessEmpireError(
                f"rubric score {key} is outside the passing range"
            )
        total += value
    if total < 88:
        raise SuccessEmpireError(f"draft rubric score is {total}, below 88")


def validate_draft(
    draft: dict[str, Any],
    kind: str,
    *,
    context: list[str],
    recent: list[dict[str, Any]],
) -> None:
    title = clean_text(draft.get("title"))
    deck = clean_text(draft.get("deck"))
    if not 3 <= len(title) <= 100:
        raise SuccessEmpireError("title length is outside 3–100 characters")
    if not 25 <= len(deck) <= 220:
        raise SuccessEmpireError("deck length is outside 25–220 characters")
    if len(words(deck)) < 12 or len(words(deck)) > 28:
        raise SuccessEmpireError("deck must remain a concise 12–28 word teaser")

    sections = draft.get("sections")
    if not isinstance(sections, list) or not sections:
        raise SuccessEmpireError("draft sections are missing")
    headings: list[str] = []
    body_paragraphs: list[str] = []
    for section in sections:
        if not isinstance(section, dict):
            raise SuccessEmpireError("draft section is malformed")
        heading = clean_text(section.get("heading"))
        body = section.get("body")
        if not heading or not isinstance(body, list) or not 1 <= len(body) <= 3:
            raise SuccessEmpireError(
                "every section needs a heading and one to three paragraphs"
            )
        for paragraph in body:
            paragraph_words = words(paragraph) if isinstance(paragraph, str) else []
            if len(paragraph_words) < 6:
                raise SuccessEmpireError(
                    "draft contains an empty or fragmentary paragraph"
                )
            if len(paragraph_words) > MAX_PARAGRAPH_WORDS:
                raise SuccessEmpireError(
                    f"draft contains a paragraph over {MAX_PARAGRAPH_WORDS} words"
                )
            body_paragraphs.append(clean_text(paragraph))
        headings.append(heading)

    if not MIN_BODY_PARAGRAPHS <= len(body_paragraphs) <= MAX_BODY_PARAGRAPHS:
        raise SuccessEmpireError(
            f"draft has {len(body_paragraphs)} body paragraphs; expected "
            f"{MIN_BODY_PARAGRAPHS}–{MAX_BODY_PARAGRAPHS}"
        )
    if not any(len(words(paragraph)) <= 24 for paragraph in body_paragraphs):
        raise SuccessEmpireError(
            "draft needs one short pattern-interrupt paragraph"
        )

    if kind == "principle":
        if tuple(headings) != PRINCIPLE_HEADINGS:
            raise SuccessEmpireError("morning principle headings are not exact")
        if draft.get("salutation") is not None:
            raise SuccessEmpireError("morning principle salutation must be null")
        if clean_text(draft.get("signature")) != "Success Empire":
            raise SuccessEmpireError("morning signature must be Success Empire")
        context_used = draft.get("context_used")
        if context_used not in ([], None):
            raise SuccessEmpireError("morning principle cannot claim day context")
    else:
        if len(sections) < 3 or len(sections) > 4:
            raise SuccessEmpireError("afternoon letter needs three or four sections")
        if len(words(clean_text(draft.get("salutation")))) < 1:
            raise SuccessEmpireError("afternoon salutation is missing")
        closing_words = words(clean_text(draft.get("closing")))
        if len(closing_words) < 3 or len(closing_words) > 25:
            raise SuccessEmpireError(
                "afternoon closing must be one concise sentence"
            )
        if clean_text(draft.get("signature")) != "Sitani":
            raise SuccessEmpireError("afternoon signature must be Sitani")
        context_used = draft.get("context_used")
        if not isinstance(context_used, list) or not context_used:
            raise SuccessEmpireError("afternoon letter did not identify actual-day context")
        if any(item not in context for item in context_used):
            raise SuccessEmpireError("afternoon context_used contains an invented fact")
        minimum, maximum = 700, 1400

    article_text = flatten_draft(draft)
    article_words = len(words(article_text))
    if article_words < MIN_ARTICLE_WORDS or article_words > MAX_ARTICLE_WORDS:
        raise SuccessEmpireError(
            f"{kind} word count is {article_words}; expected "
            f"{MIN_ARTICLE_WORDS}–{MAX_ARTICLE_WORDS}"
        )
    lowered = article_text.casefold()
    for phrase in (*HARD_FAIL_PHRASES, *INTERNAL_TERMS):
        if phrase in lowered:
            raise SuccessEmpireError(f"draft contains prohibited phrase: {phrase}")
    if re.search(r"https?://|www\.", article_text, flags=re.I):
        raise SuccessEmpireError("article body contains a URL")
    if re.search(r"(?m)^\s{0,3}#{1,6}\s|\*\*|```", article_text):
        raise SuccessEmpireError("article contains raw markdown scaffolding")
    if re.search(r"[—-]\s*[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){1,3}\s*$", article_text):
        raise SuccessEmpireError("article appears to contain an attributed quotation")
    if not re.search(r"\b(you|your)\b", lowered):
        raise SuccessEmpireError("draft does not speak directly to the reader")
    if not re.search(r"\b(i|i’m|i've|i’ve|we|my|our)\b", lowered):
        raise SuccessEmpireError("draft lacks a personal point of view")
    if article_text.count("?") < 2:
        raise SuccessEmpireError(
            "draft needs at least two genuine reader-facing questions"
        )
    cues_used = {
        cue
        for cue in INTERACTIVE_CUES
        if re.search(rf"\b{re.escape(cue)}\b", lowered)
    }
    if len(cues_used) < 3:
        raise SuccessEmpireError(
            "draft needs at least three distinct reader-participation cues"
        )

    normalized_title = slugify(title)
    for row in recent:
        prior = slugify(clean_text(row.get("title")))
        if prior and (
            prior == normalized_title
            or SequenceSimilarity(prior, normalized_title) >= 0.82
        ):
            raise SuccessEmpireError("draft title is too similar to a recent edition")
    validate_rubric(draft)


def SequenceSimilarity(left: str, right: str) -> float:
    """Small dependency-free token Jaccard score for recent-title rejection."""
    left_tokens = set(left.split("-"))
    right_tokens = set(right.split("-"))
    if not left_tokens or not right_tokens:
        return 0.0
    return len(left_tokens & right_tokens) / len(left_tokens | right_tokens)


def generate_validated_draft(
    config: Config,
    kind: str,
    day: str,
    context: list[str],
) -> tuple[dict[str, Any], dict[str, Any]]:
    recent = recent_entries(config)
    system, prompt = editorial_prompt(kind, day, recent, context)
    correction = ""
    errors: list[str] = []
    for _ in range(3):
        try:
            draft, receipt = hermes_generate(
                config,
                system=system,
                prompt=prompt,
                correction=correction,
            )
            validate_draft(
                draft,
                kind,
                context=context,
                recent=recent,
            )
            receipt["rubric_scores"] = draft["rubric_scores"]
            return draft, receipt
        except SuccessEmpireError as exc:
            errors.append(str(exc))
            correction = "\n".join(f"- {item}" for item in errors[-4:])
    raise SuccessEmpireError(
        "editorial gate rejected three drafts: " + "; ".join(errors)
    )


def entry_for_day(
    config: Config,
    day: str,
    kind: str,
) -> dict[str, Any] | None:
    rows = table_query(
        config,
        "success_empire_entries",
        {
            "select": "*",
            "publication_date": f"eq.{day}",
            "kind": f"eq.{kind}",
            "limit": "1",
        },
    )
    if len(rows) > 1:
        raise SuccessEmpireError(f"duplicate {kind} rows exist for {day}")
    return rows[0] if rows else None


def sender_for(kind: str) -> tuple[str, str]:
    if kind == "principle":
        return "Success Empire", "newsletter@sitanimafi.com"
    return "Sitani Mafi", "CEO@sitanimafi.com"


def entry_path(entry: dict[str, Any]) -> str:
    prefix = (
        "/newsletter/principles/"
        if entry["kind"] == "principle"
        else "/newsletter/daily/"
    )
    return f"{prefix}{entry['slug']}"


def entry_url(config: Config, entry: dict[str, Any]) -> str:
    return f"{config.site_url}{entry_path(entry)}"


def persist_draft(
    config: Config,
    day: str,
    kind: str,
    draft: dict[str, Any],
    receipt: dict[str, Any],
    context: list[str],
    principle_slug: str | None = None,
) -> dict[str, Any]:
    sender_name, sender_email = sender_for(kind)
    title_slug = slugify(draft["title"], 58)
    slug = (
        f"principle-{day}-{title_slug}"
        if kind == "principle"
        else f"daily-letter-{day}-{title_slug}"
    )
    context_hash = hashlib.sha256(
        json.dumps(context, sort_keys=True, ensure_ascii=False).encode("utf-8")
    ).hexdigest()
    values = {
        "publication_date": day,
        "kind": kind,
        "slug": slug,
        "title": clean_text(draft["title"]),
        "deck": clean_text(draft["deck"]),
        "salutation": (
            clean_text(draft.get("salutation")) if draft.get("salutation") else None
        ),
        "sections": draft["sections"],
        "closing": clean_text(draft.get("closing")),
        "signature": clean_text(draft.get("signature")),
        "principle_slug": principle_slug,
        "tags": [
            slugify(clean_text(tag), 40)
            for tag in draft.get("tags", [])
            if clean_text(tag)
        ][:8],
        "status": "draft",
        "published_at": None,
        "sender_name": sender_name,
        "sender_email": sender_email,
        "source_context": {
            "context_hash": context_hash,
            "source_count": len(context),
            "context_used_count": len(draft.get("context_used") or []),
        },
        "generation_receipt": receipt,
    }
    existing = entry_for_day(config, day, kind)
    if existing:
        if existing.get("status") == "published":
            return existing
        if existing.get("email_status") in {"accepted", "delivered"} or existing.get(
            "telegram_status"
        ) in {"accepted", "delivered"}:
            raise SuccessEmpireError(
                "refusing to rewrite content after a channel accepted delivery"
            )
        return table_patch(
            config,
            "success_empire_entries",
            {"id": f"eq.{existing['id']}"},
            values,
        )
    return table_insert(config, "success_empire_entries", values)


def publish_entry(config: Config, entry: dict[str, Any]) -> dict[str, Any]:
    if entry.get("status") == "published":
        return entry
    return table_patch(
        config,
        "success_empire_entries",
        {"id": f"eq.{entry['id']}"},
        {
            "status": "published",
            "published_at": utc_now(),
        },
    )


def hide_unverified_entry(
    config: Config,
    entry: dict[str, Any],
    error: str,
) -> None:
    receipt = (
        entry.get("generation_receipt")
        if isinstance(entry.get("generation_receipt"), dict)
        else {}
    )
    receipt["publication_error"] = error[:500]
    receipt["publication_failed_at"] = utc_now()
    table_patch(
        config,
        "success_empire_entries",
        {"id": f"eq.{entry['id']}"},
        {
            "status": "failed",
            "published_at": None,
            "generation_receipt": receipt,
        },
    )


def page_contains_title(page: str, title: str) -> bool:
    visible = html.unescape(re.sub(r"<[^>]+>", " ", page))
    return clean_text(title).casefold() in clean_text(visible).casefold()


def verify_public_entry(
    config: Config,
    entry: dict[str, Any],
    *,
    attempts: int = 12,
    delay_seconds: int = 5,
) -> str:
    url = entry_url(config, entry)
    last_error = "page did not contain the title"
    for attempt in range(attempts):
        separator = "&" if "?" in url else "?"
        try:
            page = request_text(
                f"{url}{separator}delivery_check={int(time.time())}",
                timeout=30,
            )
            if page_contains_title(page, str(entry["title"])):
                return url
            last_error = "public page did not contain the published title"
        except SuccessEmpireError as exc:
            last_error = str(exc)
        if attempt + 1 < attempts:
            time.sleep(delay_seconds)
    raise SuccessEmpireError(f"website verification failed: {last_error}")


def delivery_attempt(
    config: Config,
    channel: str,
    key: str,
) -> dict[str, Any] | None:
    rows = table_query(
        config,
        "success_empire_delivery_attempts",
        {
            "select": "*",
            "channel": f"eq.{channel}",
            "idempotency_key": f"eq.{key}",
            "limit": "1",
        },
    )
    if len(rows) > 1:
        raise SuccessEmpireError(f"duplicate {channel} delivery attempts exist")
    return rows[0] if rows else None


def begin_attempt(
    config: Config,
    entry: dict[str, Any],
    channel: str,
    key: str,
    metadata: dict[str, Any],
) -> dict[str, Any]:
    existing = delivery_attempt(config, channel, key)
    if existing:
        if existing.get("status") in {"accepted", "delivered"}:
            return existing
        attempted_at = str(existing.get("attempted_at") or "")
        try:
            attempted = datetime.fromisoformat(attempted_at.replace("Z", "+00:00"))
        except ValueError:
            attempted = datetime.now(timezone.utc) - timedelta(hours=1)
        if (
            existing.get("status") == "pending"
            and datetime.now(timezone.utc) - attempted < timedelta(minutes=15)
        ):
            raise SuccessEmpireError(
                f"{channel} delivery already has a recent in-flight attempt"
            )
        return table_patch(
            config,
            "success_empire_delivery_attempts",
            {"id": f"eq.{existing['id']}"},
            {
                "status": "pending",
                "provider_id": None,
                "error": None,
                "metadata": metadata,
                "attempted_at": utc_now(),
            },
        )
    return table_insert(
        config,
        "success_empire_delivery_attempts",
        {
            "entry_id": entry["id"],
            "channel": channel,
            "idempotency_key": key,
            "status": "pending",
            "metadata": metadata,
        },
    )


def finish_attempt(
    config: Config,
    attempt: dict[str, Any],
    *,
    status: str,
    provider_id: str | None = None,
    error: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    values: dict[str, Any] = {
        "status": status,
        "provider_id": provider_id,
        "error": error[:800] if error else None,
    }
    if metadata is not None:
        values["metadata"] = metadata
    return table_patch(
        config,
        "success_empire_delivery_attempts",
        {"id": f"eq.{attempt['id']}"},
        values,
    )


def suppressed_recipient(config: Config) -> dict[str, Any] | None:
    rows = table_query(
        config,
        "omni_suppressions",
        {
            "select": "id,reason,created_at",
            "email": f"eq.{config.recipient.lower()}",
            "limit": "1",
        },
    )
    return rows[0] if rows else None


def verified_resend_domain(config: Config) -> dict[str, Any]:
    key = config.require("RESEND_API_KEY")
    payload = request_json(
        "https://api.resend.com/domains?limit=100",
        headers={"Authorization": f"Bearer {key}"},
    )
    rows = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(rows, list):
        raise SuccessEmpireError("Resend domain response is malformed")
    for row in rows:
        if not isinstance(row, dict):
            continue
        if (
            clean_text(row.get("name")).casefold() == "sitanimafi.com"
            and clean_text(row.get("status")).casefold() == "verified"
        ):
            return row
    raise SuccessEmpireError("Resend sender domain sitanimafi.com is not verified")


def teaser_excerpt(value: Any, max_length: int = 180) -> str:
    clean = clean_text(value)
    if not clean:
        raise SuccessEmpireError("teaser is empty")
    if len(clean) <= max_length:
        return clean
    sentence = re.match(
        rf"^.{{60,{max_length}}}?[.!?](?:\s|$)",
        clean,
    )
    if sentence:
        return sentence.group(0).strip()
    clipped = clean[: max_length + 1]
    boundary = clipped.rfind(" ")
    return clipped[: boundary if boundary > 80 else max_length].strip() + "…"


def compact_email_subject(kind: str, title: str, max_length: int = 58) -> str:
    prefix = "Try this today: " if kind == "principle" else "A quick note: "
    candidate = f"{prefix}{clean_text(title)}"
    if len(candidate) <= max_length:
        return candidate
    available = max_length - len(prefix) - 1
    clipped = clean_text(title)[: available + 1]
    boundary = clipped.rfind(" ")
    short_title = clipped[: boundary if boundary > 18 else available].rstrip(" ,:;.-")
    return f"{prefix}{short_title}…"


def render_email(
    config: Config,
    entry: dict[str, Any],
) -> tuple[str, str]:
    kind = str(entry["kind"])
    title = clean_text(entry["title"])
    teaser = teaser_excerpt(entry["deck"])
    url = entry_url(config, entry)
    if kind == "principle":
        eyebrow = "Success Empire · Morning Principle"
        subject = compact_email_subject(kind, title)
        button = "Read the Full Principle"
        accent = "#c99837"
    else:
        eyebrow = "A note from Sitani"
        subject = compact_email_subject(kind, title)
        button = "Read Sitani’s Note"
        accent = "#9f7aea"
    body = f"""<!doctype html>
<html>
  <body style="margin:0;background:#0d0d10;font-family:Georgia,'Times New Roman',serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0d0d10;">
      <tr><td align="center" style="padding:28px 16px 34px;">
        <table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;background:#15151a;border:1px solid #2b2b33;border-radius:14px;">
          <tr><td style="padding:28px 30px 26px;">
            <p style="margin:0 0 12px;color:{accent};font-family:Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;">{html.escape(eyebrow)}</p>
            <h1 style="margin:0 0 14px;color:#f5f2ea;font-size:28px;line-height:1.18;font-weight:600;">{html.escape(title)}</h1>
            <p style="margin:0 0 22px;color:#d7d4cc;font-size:16px;line-height:1.6;">{html.escape(teaser)}</p>
            <a href="{html.escape(url)}" style="display:inline-block;padding:13px 19px;border-radius:8px;background:{accent};color:#111116;font-family:Arial,sans-serif;font-size:14px;font-weight:700;text-decoration:none;">{html.escape(button)}</a>
          </td></tr>
          <tr><td style="padding:15px 30px;border-top:1px solid #2b2b33;color:#777783;font-family:Arial,sans-serif;font-size:10px;line-height:1.5;">
            The full 3-minute read is on sitanimafi.com.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>"""
    article_sections = entry.get("sections")
    if isinstance(article_sections, list):
        for section in article_sections:
            if not isinstance(section, dict):
                continue
            if clean_text(section.get("heading")) in body:
                raise SuccessEmpireError("email leaked a full article heading")
            for paragraph in section.get("body") or []:
                sample = clean_text(paragraph)[:100]
                if len(sample) > 40 and sample in body:
                    raise SuccessEmpireError("email leaked article body content")
    return subject, body


def mark_entry_channel(
    config: Config,
    entry: dict[str, Any],
    channel: str,
    *,
    status: str,
    provider_id: str | None = None,
    error: str | None = None,
    chat_id: str | None = None,
    message_id: int | None = None,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    if channel == "email":
        values = {
            "email_status": status,
            "email_provider_id": provider_id,
            "email_idempotency_key": idempotency_key,
            "email_error": error[:800] if error else None,
        }
    else:
        values = {
            "telegram_status": status,
            "telegram_chat_id": chat_id,
            "telegram_message_id": message_id,
            "telegram_error": error[:800] if error else None,
        }
    return table_patch(
        config,
        "success_empire_entries",
        {"id": f"eq.{entry['id']}"},
        values,
    )


def deliver_email(config: Config, entry: dict[str, Any]) -> dict[str, Any]:
    if entry.get("email_status") in {"accepted", "delivered"}:
        return {"status": entry["email_status"], "id": entry.get("email_provider_id")}
    day = str(entry["publication_date"])
    kind = str(entry["kind"])
    key = f"success-empire/{kind}/{day}/v1"
    prior = delivery_attempt(config, "email", key)
    if prior and prior.get("status") in {"accepted", "delivered"}:
        mark_entry_channel(
            config,
            entry,
            "email",
            status=str(prior["status"]),
            provider_id=str(prior.get("provider_id") or ""),
            idempotency_key=key,
        )
        return {"status": prior["status"], "id": prior.get("provider_id")}

    suppression = suppressed_recipient(config)
    if suppression:
        attempt = prior or begin_attempt(
            config,
            entry,
            "email",
            key,
            {"recipient": config.recipient, "reason": "suppression check"},
        )
        finish_attempt(
            config,
            attempt,
            status="suppressed",
            error=f"recipient is suppressed: {suppression.get('reason') or 'unspecified'}",
        )
        mark_entry_channel(
            config,
            entry,
            "email",
            status="suppressed",
            error="recipient is present on the suppression list",
            idempotency_key=key,
        )
        raise SuccessEmpireError("email recipient is suppressed; delivery stopped")

    domain = verified_resend_domain(config)
    subject, email_html = render_email(config, entry)
    attempt = begin_attempt(
        config,
        entry,
        "email",
        key,
        {
            "recipient": config.recipient,
            "subject": subject,
            "domain_id": domain.get("id"),
            "article_url": entry_url(config, entry),
        },
    )
    if attempt.get("status") in {"accepted", "delivered"}:
        return {"status": attempt["status"], "id": attempt.get("provider_id")}
    sender_name, sender_email = sender_for(kind)
    resend_key = config.require("RESEND_API_KEY")
    try:
        sent = request_json(
            "https://api.resend.com/emails",
            method="POST",
            headers={
                "Authorization": f"Bearer {resend_key}",
                "Idempotency-Key": key,
            },
            payload={
                "from": f"{sender_name} <{sender_email}>",
                "to": [config.recipient],
                "reply_to": config.recipient,
                "subject": subject,
                "html": email_html,
                "tags": [
                    {"name": "publication", "value": "success-empire"},
                    {"name": "edition", "value": kind},
                ],
            },
            timeout=60,
        )
        email_id = clean_text(sent.get("id") if isinstance(sent, dict) else "")
        if not email_id:
            raise SuccessEmpireError("Resend accepted no provider message ID")
        receipt = request_json(
            f"https://api.resend.com/emails/{urllib.parse.quote(email_id)}",
            headers={"Authorization": f"Bearer {resend_key}"},
        )
        event = clean_text(
            receipt.get("last_event") if isinstance(receipt, dict) else "accepted"
        ).lower() or "accepted"
        if event in FAILURE_EVENTS:
            raise SuccessEmpireError(
                f"Resend reports {event} for message {email_id}"
            )
        status = "delivered" if event == "delivered" else "accepted"
        finish_attempt(
            config,
            attempt,
            status=status,
            provider_id=email_id,
            metadata={
                "recipient": config.recipient,
                "subject": subject,
                "article_url": entry_url(config, entry),
                "last_event": event,
            },
        )
        mark_entry_channel(
            config,
            entry,
            "email",
            status=status,
            provider_id=email_id,
            idempotency_key=key,
        )
        return {"status": status, "id": email_id, "last_event": event}
    except SuccessEmpireError as exc:
        finish_attempt(config, attempt, status="failed", error=str(exc))
        mark_entry_channel(
            config,
            entry,
            "email",
            status="failed",
            error=str(exc),
            idempotency_key=key,
        )
        raise


def telegram_token(config: Config) -> str:
    return config.require(
        "TELEGRAM_BOT_TOKEN",
        "SUCCESS_EMPIRE_TELEGRAM_BOT_TOKEN",
        "OMNI_TELEGRAM_BOT_TOKEN",
        "HERMES_TELEGRAM_BOT_TOKEN",
    )


def telegram_call(
    config: Config,
    method: str,
    payload: dict[str, Any] | None = None,
) -> Any:
    token = telegram_token(config)
    response = request_json(
        f"https://api.telegram.org/bot{token}/{method}",
        method="POST" if payload is not None else "GET",
        payload=payload,
        timeout=45,
    )
    if not isinstance(response, dict) or response.get("ok") is not True:
        description = (
            response.get("description")
            if isinstance(response, dict)
            else "malformed response"
        )
        raise SuccessEmpireError(f"Telegram {method} failed: {description}")
    return response.get("result")


def telegram_chat_id(config: Config) -> str:
    value = config.first(
        "SUCCESS_EMPIRE_TELEGRAM_CHAT_ID",
        "SUCCESS_EMPIRE_CHANNEL_ID",
    )
    if value:
        return value
    if CHANNEL_DIRECTORY.is_file():
        try:
            payload = json.loads(CHANNEL_DIRECTORY.read_text(encoding="utf-8"))
            rows = payload.get("platforms", {}).get("telegram", [])
            matches = [
                row
                for row in rows
                if isinstance(row, dict)
                and clean_text(row.get("name")).casefold() == "success empire"
                and row.get("type") in {"channel", "supergroup", "group"}
                and clean_text(row.get("id"))
            ]
            if len(matches) > 1:
                raise SuccessEmpireError(
                    "multiple Success Empire Telegram destinations are registered"
                )
            if matches:
                return clean_text(matches[0]["id"])
        except SuccessEmpireError:
            raise
        except (OSError, json.JSONDecodeError, AttributeError, TypeError):
            pass
    state = STATE_ROOT / "telegram-chat.json"
    if state.is_file():
        try:
            payload = json.loads(state.read_text(encoding="utf-8"))
            value = clean_text(payload.get("chat_id"))
            if value:
                return value
        except (OSError, json.JSONDecodeError, AttributeError):
            pass
    raise SuccessEmpireError(
        "Success Empire Telegram channel ID is not configured"
    )


def telegram_preflight(config: Config) -> dict[str, Any]:
    me = telegram_call(config, "getMe")
    if not isinstance(me, dict) or not me.get("id"):
        raise SuccessEmpireError("Telegram getMe returned a malformed bot")
    chat_id = telegram_chat_id(config)
    chat = telegram_call(config, "getChat", {"chat_id": chat_id})
    if not isinstance(chat, dict):
        raise SuccessEmpireError("Telegram getChat returned a malformed channel")
    title = clean_text(chat.get("title"))
    if title.casefold() != "success empire":
        raise SuccessEmpireError(
            f"configured Telegram chat is “{title or 'untitled'}”, not Success Empire"
        )
    if chat.get("type") not in {"channel", "supergroup"}:
        raise SuccessEmpireError("Success Empire Telegram destination is not a channel")
    membership = telegram_call(
        config,
        "getChatMember",
        {"chat_id": chat_id, "user_id": me["id"]},
    )
    if not isinstance(membership, dict) or membership.get("status") not in {
        "administrator",
        "creator",
    }:
        raise SuccessEmpireError("Omni AI bot is not a Success Empire admin")
    if membership.get("can_post_messages") is False:
        raise SuccessEmpireError(
            "Omni AI bot lacks permission to post in Success Empire"
        )
    return {
        "chat_id": str(chat_id),
        "title": title,
        "bot_id": me["id"],
        "bot_username": me.get("username"),
        "status": membership.get("status"),
        "can_post_messages": membership.get("can_post_messages", True),
    }


def telegram_message(
    config: Config,
    entry: dict[str, Any],
    principle: dict[str, Any] | None = None,
) -> tuple[str, dict[str, Any]]:
    kind = str(entry["kind"])
    title = html.escape(clean_text(entry["title"]))
    teaser = html.escape(teaser_excerpt(entry["deck"], 260))
    if kind == "principle":
        text = (
            "<b>Success Empire · Morning Principle</b>\n\n"
            f"<b>{title}</b>\n\n{teaser}"
        )
        buttons = [
            [{"text": "Read the Principle", "url": entry_url(config, entry)}]
        ]
    else:
        text = f"<b>A note from Sitani</b>\n\n<b>{title}</b>\n\n{teaser}"
        buttons = [
            [{"text": "Read the Full Letter", "url": entry_url(config, entry)}]
        ]
        if principle:
            buttons.append(
                [
                    {
                        "text": "Today’s Morning Principle",
                        "url": entry_url(config, principle),
                    }
                ]
            )
    return text, {"inline_keyboard": buttons}


def deliver_telegram(
    config: Config,
    entry: dict[str, Any],
    principle: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if entry.get("telegram_status") in {"accepted", "delivered"}:
        return {
            "status": entry["telegram_status"],
            "message_id": entry.get("telegram_message_id"),
        }
    day = str(entry["publication_date"])
    kind = str(entry["kind"])
    key = f"success-empire/telegram/{kind}/{day}/v1"
    prior = delivery_attempt(config, "telegram", key)
    if prior and prior.get("status") in {"accepted", "delivered"}:
        metadata = prior.get("metadata") if isinstance(prior.get("metadata"), dict) else {}
        message_id = metadata.get("message_id")
        mark_entry_channel(
            config,
            entry,
            "telegram",
            status=str(prior["status"]),
            provider_id=str(prior.get("provider_id") or ""),
            chat_id=str(metadata.get("chat_id") or ""),
            message_id=int(message_id) if str(message_id).isdigit() else None,
        )
        return {"status": prior["status"], "message_id": message_id}

    preflight = telegram_preflight(config)
    message, reply_markup = telegram_message(config, entry, principle)
    attempt = begin_attempt(
        config,
        entry,
        "telegram",
        key,
        {
            "chat_id": preflight["chat_id"],
            "article_url": entry_url(config, entry),
        },
    )
    if attempt.get("status") in {"accepted", "delivered"}:
        return {"status": attempt["status"], "id": attempt.get("provider_id")}
    try:
        sent = telegram_call(
            config,
            "sendMessage",
            {
                "chat_id": preflight["chat_id"],
                "text": message,
                "parse_mode": "HTML",
                "disable_web_page_preview": True,
                "reply_markup": reply_markup,
            },
        )
        if not isinstance(sent, dict) or not isinstance(sent.get("message_id"), int):
            raise SuccessEmpireError("Telegram accepted no message ID")
        message_id = int(sent["message_id"])
        provider_id = f"{preflight['chat_id']}:{message_id}"
        metadata = {
            "chat_id": preflight["chat_id"],
            "message_id": message_id,
            "article_url": entry_url(config, entry),
        }
        finish_attempt(
            config,
            attempt,
            status="accepted",
            provider_id=provider_id,
            metadata=metadata,
        )
        mark_entry_channel(
            config,
            entry,
            "telegram",
            status="accepted",
            provider_id=provider_id,
            chat_id=preflight["chat_id"],
            message_id=message_id,
        )
        return {"status": "accepted", "message_id": message_id}
    except SuccessEmpireError as exc:
        finish_attempt(config, attempt, status="failed", error=str(exc))
        mark_entry_channel(
            config,
            entry,
            "telegram",
            status="failed",
            error=str(exc),
            chat_id=preflight["chat_id"],
        )
        raise


def deterministic_afternoon_target(
    day: str,
    secret: str,
    *,
    start: clock_time = clock_time(15, 5),
    end: clock_time = clock_time(17, 55),
) -> datetime:
    parsed = date.fromisoformat(day)
    start_at = datetime.combine(parsed, start, tzinfo=MOUNTAIN)
    end_at = datetime.combine(parsed, end, tzinfo=MOUNTAIN)
    slots = int((end_at - start_at).total_seconds() // 300) + 1
    digest = hmac.new(
        secret.encode("utf-8"),
        f"success-empire-afternoon:{day}".encode("utf-8"),
        hashlib.sha256,
    ).digest()
    offset = int.from_bytes(digest[:8], "big") % slots
    return start_at + timedelta(minutes=offset * 5)


def delivery_preflight(
    config: Config,
    entry: dict[str, Any] | None = None,
    *,
    require_telegram: bool = True,
) -> dict[str, Any]:
    checks: dict[str, Any] = {}
    if not entry or entry.get("email_status") not in {"accepted", "delivered"}:
        suppression = suppressed_recipient(config)
        if suppression:
            raise SuccessEmpireError(
                "email recipient is suppressed; publication stopped before writing"
            )
        domain = verified_resend_domain(config)
        checks["email"] = {
            "domain": domain.get("name"),
            "status": domain.get("status"),
        }
    if require_telegram and (
        not entry
        or entry.get("telegram_status") not in {"accepted", "delivered"}
    ):
        checks["telegram"] = telegram_preflight(config)
    return checks


def defer_telegram(
    config: Config,
    entry: dict[str, Any],
    reason: str,
) -> dict[str, Any]:
    mark_entry_channel(
        config,
        entry,
        "telegram",
        status="pending",
        error=reason,
    )
    return {
        "status": "pending",
        "reason": "channel-not-yet-registered",
    }


def deliver_or_defer_telegram(
    config: Config,
    entry: dict[str, Any],
    principle: dict[str, Any] | None,
    *,
    require_telegram: bool,
) -> dict[str, Any]:
    try:
        return deliver_telegram(config, entry, principle=principle)
    except SuccessEmpireError as exc:
        if (
            require_telegram
            or str(exc) != "Success Empire Telegram channel ID is not configured"
        ):
            raise
        return defer_telegram(config, entry, str(exc))


def afternoon_secret(config: Config) -> str:
    return config.require(
        "SUCCESS_EMPIRE_SCHEDULE_SECRET",
        "CRON_SECRET",
        "HERMES_CRON_SECRET",
    )


def workflow(
    config: Config,
    kind: str,
    day: str,
    *,
    preview: bool = False,
    require_telegram: bool = False,
    skip_telegram: bool = False,
) -> dict[str, Any]:
    existing = entry_for_day(config, day, kind)
    delivery_preflight(
        config,
        existing,
        require_telegram=require_telegram and not skip_telegram,
    )
    principle = (
        entry_for_day(config, day, "principle")
        if kind == "journal"
        else None
    )
    if kind == "journal" and (
        not principle or principle.get("status") != "published"
    ):
        raise SuccessEmpireError(
            "afternoon letter requires the published morning principle"
        )
    if existing and existing.get("status") == "published":
        entry = existing
    else:
        context = collect_day_context(config, day, principle)
        draft, receipt = generate_validated_draft(config, kind, day, context)
        if preview:
            return {
                "preview": True,
                "kind": kind,
                "day": day,
                "word_count": len(words(flatten_draft(draft))),
                "draft": draft,
                "receipt": receipt,
            }
        entry = persist_draft(
            config,
            day,
            kind,
            draft,
            receipt,
            context,
            str(principle["slug"]) if principle else None,
        )
        entry = publish_entry(config, entry)

    try:
        public_url = verify_public_entry(config, entry)
    except SuccessEmpireError as exc:
        if existing is None or existing.get("status") != "published":
            hide_unverified_entry(config, entry, str(exc))
        raise
    if preview:
        subject, email_html = render_email(config, entry)
        telegram_text, buttons = telegram_message(config, entry, principle)
        return {
            "preview": True,
            "kind": kind,
            "day": day,
            "subject": subject,
            "email_html": email_html,
            "telegram_text": telegram_text,
            "telegram_buttons": buttons,
            "public_url": public_url,
        }
    email_result = deliver_email(config, entry)
    latest = entry_for_day(config, day, kind)
    delivery_entry = latest or entry
    telegram_result = (
        defer_telegram(
            config,
            delivery_entry,
            "Success Empire Telegram channel ID is not configured",
        )
        if skip_telegram
        else deliver_or_defer_telegram(
            config,
            delivery_entry,
            principle,
            require_telegram=require_telegram,
        )
    )
    return {
        "kind": kind,
        "day": day,
        "slug": entry["slug"],
        "public_url": public_url,
        "email": email_result,
        "telegram": telegram_result,
    }


def run_check(config: Config) -> dict[str, Any]:
    rows = table_query(
        config,
        "success_empire_entries",
        {"select": "id", "limit": "1"},
    )
    domain = verified_resend_domain(config)
    suppression = suppressed_recipient(config)
    telegram = telegram_preflight(config)
    request_text(f"{config.site_url}/newsletter/daily")
    return {
        "database": "reachable",
        "existing_entry_count_sample": len(rows),
        "resend_domain": domain.get("name"),
        "resend_status": domain.get("status"),
        "recipient_suppressed": suppression is not None,
        "telegram": telegram,
        "archive": f"{config.site_url}/newsletter/daily",
    }


def run_monitor(config: Config, day: str) -> dict[str, Any]:
    results: dict[str, Any] = {}
    errors: list[str] = []
    for kind in ("principle", "journal"):
        try:
            results[kind] = workflow(
                config,
                kind,
                day,
                require_telegram=True,
            )
        except SuccessEmpireError as exc:
            errors.append(f"{kind}: {exc}")
    rows = table_query(
        config,
        "success_empire_entries",
        {
            "select": "kind,status,email_status,telegram_status,slug",
            "publication_date": f"eq.{day}",
            "order": "kind.asc",
        },
    )
    for row in rows:
        if row.get("status") != "published":
            errors.append(f"{row.get('kind')}: publication is {row.get('status')}")
        if row.get("email_status") not in {"accepted", "delivered"}:
            errors.append(f"{row.get('kind')}: email is {row.get('email_status')}")
        if row.get("telegram_status") not in {"accepted", "delivered"}:
            errors.append(
                f"{row.get('kind')}: Telegram is {row.get('telegram_status')}"
            )
    if len(rows) != 2:
        errors.append(f"expected two daily entries, found {len(rows)}")
    if errors:
        raise SuccessEmpireError("monitor found incomplete work: " + "; ".join(errors))
    return {"day": day, "status": "complete", "entries": rows, "repairs": results}


def print_json(value: Any) -> None:
    print(json.dumps(value, indent=2, ensure_ascii=False, sort_keys=True))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    for command in ("morning", "afternoon"):
        sub = subparsers.add_parser(command)
        sub.add_argument("--day")
        sub.add_argument(
            "--preview",
            action="store_true",
            help="generate or render without delivering",
        )
        sub.add_argument(
            "--skip-telegram",
            action="store_true",
            help=(
                "publish the website and owner email while leaving Telegram "
                "pending for the monitor"
            ),
        )
        if command == "afternoon":
            sub.add_argument(
                "--force",
                action="store_true",
                help="ignore the randomized-time gate",
            )
    monitor = subparsers.add_parser("monitor")
    monitor.add_argument("--day")
    check = subparsers.add_parser("check")
    check.add_argument("--day", help=argparse.SUPPRESS)
    target = subparsers.add_parser("target")
    target.add_argument("--day")
    subparsers.add_parser("telegram-check")
    context = subparsers.add_parser("context")
    context.add_argument("--day")
    return parser


def inferred_command(script_name: str) -> str | None:
    stem = Path(script_name).stem.casefold()
    for suffix, command in (
        ("-morning", "morning"),
        ("-afternoon", "afternoon"),
        ("-monitor", "monitor"),
    ):
        if stem.endswith(suffix):
            return command
    return None


def main(argv: list[str] | None = None) -> int:
    if argv is None:
        argv = sys.argv[1:]
        if not argv:
            inferred = inferred_command(sys.argv[0])
            if inferred:
                argv = [inferred]
    args = build_parser().parse_args(argv)
    config = load_config()
    try:
        if args.command == "check":
            print_json(run_check(config))
            return 0
        if args.command == "telegram-check":
            print_json(telegram_preflight(config))
            return 0
        day = parse_day(getattr(args, "day", None))
        if args.command == "target":
            target = deterministic_afternoon_target(
                day,
                afternoon_secret(config),
            )
            print_json({"day": day, "target": target.isoformat()})
            return 0
        if args.command == "context":
            principle = entry_for_day(config, day, "principle")
            print_json({"day": day, "context": collect_day_context(config, day, principle)})
            return 0
        if args.command == "morning":
            print_json(
                workflow(
                    config,
                    "principle",
                    day,
                    preview=args.preview,
                    skip_telegram=args.skip_telegram,
                )
            )
            return 0
        if args.command == "afternoon":
            target = deterministic_afternoon_target(
                day,
                afternoon_secret(config),
            )
            if not args.force and now_mountain() < target:
                print_json(
                    {
                        "day": day,
                        "status": "waiting",
                        "target": target.isoformat(),
                    }
                )
                return 0
            print_json(
                workflow(
                    config,
                    "journal",
                    day,
                    preview=args.preview,
                    skip_telegram=args.skip_telegram,
                )
            )
            return 0
        if args.command == "monitor":
            print_json(run_monitor(config, day))
            return 0
        raise SuccessEmpireError(f"unknown command: {args.command}")
    except SuccessEmpireError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
