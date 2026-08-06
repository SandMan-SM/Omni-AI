from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from datetime import time as clock_time
from pathlib import Path
from unittest.mock import patch
from urllib.error import URLError


HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location(
    "success_empire_daily",
    HERE / "success-empire-daily.py",
)
daily = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
sys.modules[SPEC.name] = daily
SPEC.loader.exec_module(daily)


def long_paragraph(seed: str, count: int = 82) -> str:
    words = (
        f"{seed} attention becomes useful when a person slows down enough to "
        "notice the choice in front of them and then takes one honest step. "
        "The point is not perfection or performance. The point is to practice "
        "a clear decision, learn from the result, and return with more patience. "
    ).split()
    repeated: list[str] = []
    while len(repeated) < count:
        repeated.extend(words)
    return " ".join(repeated[:count]) + "."


def valid_rubric() -> dict[str, int]:
    return {
        "authenticity": 18,
        "clarity": 14,
        "applicability": 22,
        "emotional_resonance": 13,
        "relationship": 14,
        "originality": 9,
    }


def valid_principle() -> dict:
    return {
        "title": "Keep the promise small enough to keep",
        "deck": (
            "A dependable life is built through promises you can actually keep, "
            "especially when no one is watching and the first excitement is gone."
        ),
        "salutation": None,
        "sections": [
            {
                "heading": heading,
                "body": [
                    long_paragraph(
                        f"I have learned that you can begin {index} with honest"
                    ),
                    long_paragraph(
                        f"Your next practice in section {index} can stay simple"
                    ),
                ],
            }
            for index, heading in enumerate(daily.PRINCIPLE_HEADINGS, start=1)
        ],
        "closing": "Choose one promise and keep it before the day is over.",
        "signature": "Success Empire",
        "tags": ["discipline", "trust"],
        "context_used": [],
        "rubric_scores": valid_rubric(),
    }


def valid_journal(context: str) -> dict:
    return {
        "title": "What the unfinished work taught me today",
        "deck": (
            "Today reminded me that unfinished work is not a verdict. It is an "
            "invitation to become more honest about the next decision."
        ),
        "salutation": "Hey family,",
        "sections": [
            {
                "heading": f"A lesson from part {index}",
                "body": [
                    long_paragraph(
                        f"I carried one real question through today and you may know it {index}"
                    ),
                    long_paragraph(
                        f"My clearest lesson is that your next step can be gentle {index}"
                    ),
                ],
            }
            for index in range(1, 5)
        ],
        "closing": "I hope you give yourself enough room to take the next honest step.",
        "signature": "Sitani",
        "tags": ["reflection", "follow-through"],
        "context_used": [context],
        "rubric_scores": valid_rubric(),
    }


def entry(kind: str = "principle") -> dict:
    draft = valid_principle() if kind == "principle" else valid_journal("true fact")
    return {
        **draft,
        "id": "entry-id",
        "kind": kind,
        "slug": "principle-2026-08-05-keep-the-promise"
        if kind == "principle"
        else "daily-letter-2026-08-05-unfinished-work",
        "publication_date": "2026-08-05",
        "status": "published",
    }


class SuccessEmpireDailyTests(unittest.TestCase):
    def test_api_requests_use_stable_application_identity(self) -> None:
        class Response:
            status = 200

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def read(self) -> bytes:
                return b"{}"

        def inspect_request(request, **_kwargs):
            self.assertEqual(
                request.get_header("User-agent"),
                "SuccessEmpireNewsletter/1.0 (+https://sitanimafi.com)",
            )
            return Response()

        with patch.object(daily.urllib.request, "urlopen", side_effect=inspect_request):
            self.assertEqual(daily.request_json("https://api.resend.com/domains"), {})

    def test_principle_passes_editorial_gate(self) -> None:
        draft = valid_principle()
        daily.validate_draft(
            draft,
            "principle",
            context=[],
            recent=[],
        )

    def test_journal_requires_verbatim_actual_day_context(self) -> None:
        supplied = "I made a difficult decision about what deserved attention."
        draft = valid_journal(supplied)
        daily.validate_draft(
            draft,
            "journal",
            context=[supplied],
            recent=[],
        )
        draft["context_used"] = ["I invented a meeting that never happened."]
        with self.assertRaises(daily.SuccessEmpireError):
            daily.validate_draft(
                draft,
                "journal",
                context=[supplied],
                recent=[],
            )

    def test_low_rubric_score_fails(self) -> None:
        draft = valid_principle()
        draft["rubric_scores"]["relationship"] = 5
        with self.assertRaises(daily.SuccessEmpireError):
            daily.validate_draft(
                draft,
                "principle",
                context=[],
                recent=[],
            )

    def test_internal_language_fails(self) -> None:
        draft = valid_principle()
        draft["sections"][0]["body"][0] += " The cron job made this possible."
        with self.assertRaises(daily.SuccessEmpireError):
            daily.validate_draft(
                draft,
                "principle",
                context=[],
                recent=[],
            )

    def test_email_is_teaser_only(self) -> None:
        config = daily.Config({"SUCCESS_EMPIRE_SITE_URL": "https://sitanimafi.com"})
        item = entry("principle")
        subject, body = daily.render_email(config, item)
        self.assertIn("Today’s principle", subject)
        self.assertIn(item["title"], body)
        self.assertIn(item["deck"], body)
        self.assertIn("Read the Principle", body)
        for section in item["sections"]:
            self.assertNotIn(section["heading"], body)
            self.assertNotIn(section["body"][0][:100], body)
        self.assertLess(len(body), 6500)

    def test_telegram_buttons_drive_to_website(self) -> None:
        config = daily.Config({"SUCCESS_EMPIRE_SITE_URL": "https://sitanimafi.com"})
        principle = entry("principle")
        journal = entry("journal")
        message, markup = daily.telegram_message(config, journal, principle)
        self.assertIn("A note from Sitani", message)
        self.assertNotIn(journal["sections"][0]["body"][0], message)
        buttons = markup["inline_keyboard"]
        self.assertEqual(len(buttons), 2)
        self.assertIn("/newsletter/daily/", buttons[0][0]["url"])
        self.assertIn("/newsletter/principles/", buttons[1][0]["url"])

    def test_randomized_time_is_stable_and_inside_window(self) -> None:
        first = daily.deterministic_afternoon_target(
            "2026-08-05",
            "stable-secret",
        )
        second = daily.deterministic_afternoon_target(
            "2026-08-05",
            "stable-secret",
        )
        self.assertEqual(first, second)
        self.assertGreaterEqual(first.time(), clock_time(15, 5))
        self.assertLessEqual(first.time(), clock_time(17, 55))
        self.assertEqual(first.minute % 5, 0)

    def test_admin_sender_identities_are_exact(self) -> None:
        self.assertEqual(
            daily.sender_for("principle"),
            ("Success Empire", "newsletter@sitanimafi.com"),
        )
        self.assertEqual(
            daily.sender_for("journal"),
            ("Sitani Mafi", "CEO@sitanimafi.com"),
        )

    def test_recipient_is_hard_locked_to_owner(self) -> None:
        self.assertEqual(daily.Config({}).recipient, "sitanim8@gmail.com")
        self.assertEqual(
            daily.Config(
                {"SUCCESS_EMPIRE_RECIPIENT": "SITANIM8@GMAIL.COM"}
            ).recipient,
            "sitanim8@gmail.com",
        )
        with self.assertRaises(daily.SuccessEmpireError):
            _ = daily.Config(
                {"SUCCESS_EMPIRE_RECIPIENT": "someone@example.com"}
            ).recipient

    def test_live_hermes_token_takes_precedence(self) -> None:
        config = daily.Config(
            {
                "TELEGRAM_BOT_TOKEN": "live-hermes-token",
                "SUCCESS_EMPIRE_TELEGRAM_BOT_TOKEN": "stale-project-token",
            }
        )
        self.assertEqual(daily.telegram_token(config), "live-hermes-token")

    def test_success_channel_can_be_resolved_from_directory(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            channel_directory = Path(directory) / "channel_directory.json"
            channel_directory.write_text(
                """{
                  "platforms": {
                    "telegram": [
                      {"id": "-100123", "name": "Success Empire", "type": "channel"}
                    ]
                  }
                }""",
                encoding="utf-8",
            )
            with patch.object(daily, "CHANNEL_DIRECTORY", channel_directory):
                self.assertEqual(
                    daily.telegram_chat_id(daily.Config({})),
                    "-100123",
                )

    def test_telegram_token_is_redacted_from_network_errors(self) -> None:
        secret = "123456:do-not-print-this-token"
        with patch.object(
            daily.urllib.request,
            "urlopen",
            side_effect=URLError("offline"),
        ):
            with self.assertRaises(daily.SuccessEmpireError) as raised:
                daily.request_json(
                    f"https://api.telegram.org/bot{secret}/getMe",
                )
        self.assertNotIn(secret, str(raised.exception))
        self.assertIn("/bot[redacted]/getMe", str(raised.exception))

    def test_suppression_stops_before_any_sender_preflight(self) -> None:
        config = daily.Config({})
        with (
            patch.object(
                daily,
                "suppressed_recipient",
                return_value={"id": "suppressed"},
            ),
            patch.object(daily, "verified_resend_domain") as resend,
            patch.object(daily, "telegram_preflight") as telegram,
        ):
            with self.assertRaises(daily.SuccessEmpireError):
                daily.delivery_preflight(config)
        resend.assert_not_called()
        telegram.assert_not_called()

    def test_script_aliases_infer_the_scheduled_command(self) -> None:
        self.assertEqual(
            daily.inferred_command("success-empire-morning.py"),
            "morning",
        )
        self.assertEqual(
            daily.inferred_command("success-empire-afternoon.py"),
            "afternoon",
        )
        self.assertEqual(
            daily.inferred_command("success-empire-monitor.py"),
            "monitor",
        )
        self.assertIsNone(daily.inferred_command("success-empire-daily.py"))


if __name__ == "__main__":
    unittest.main()
