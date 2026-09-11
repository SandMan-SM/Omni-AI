from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch


HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
spec = importlib.util.spec_from_file_location(
    "interlinked_release", HERE / "interlinked-daily-release.py"
)
release = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(release)

owner_spec = importlib.util.spec_from_file_location(
    "interlinked_owner_email", HERE / "interlinked-owner-email.py"
)
owner_email = importlib.util.module_from_spec(owner_spec)
assert owner_spec.loader
owner_spec.loader.exec_module(owner_email)

channel_spec = importlib.util.spec_from_file_location(
    "interlinked_channel_post", HERE / "interlinked-daily-channel-post.py"
)
channel_post = importlib.util.module_from_spec(channel_spec)
assert channel_spec.loader
channel_spec.loader.exec_module(channel_post)


def valid_rows(day: str = "2026-08-02") -> dict:
    base = {
        "subject": "What is an agentic AI system and how does it work?",
        "intro": (
            "An agentic AI system is software that can pursue a goal through multiple "
            "tool-using steps while checking its own progress. The practical difference "
            "is controlled action, not merely a longer chatbot response."
        ),
        "insights": [
            "The first source documents a material change in AI agent orchestration with enough detail for a responsible decision.",
            "The second source independently confirms the agentic direction and adds a useful implementation constraint.",
            "The combined evidence suggests a measured workflow-agent rollout with one deterministic verification gate.",
        ],
        "power_move": "Select one workflow and add a deterministic verification gate before Friday.",
        "closing": "The durable advantage comes from proving completed outcomes rather than counting automated actions.",
        "quote": "Verified outcomes compound faster than unmeasured activity.",
        "offer": "Build the private AI CEO operating loop at https://omnileadsagi.com/interlinked",
        "keywords": ["AI operations", "verification", "automation"],
        "status": "published",
    }
    free = {**base, "slug": f"interlinked-free-{day}", "tier": "free"}
    premium = {
        **base,
        "slug": f"interlinked-premium-{day}",
        "tier": "premium",
        "subject": "The premium control system behind that operating shift",
        "intro": (
            "The deeper implementation question is where identity, cost, and "
            "verification meet. This brief turns the signal into a control loop."
        ),
        "day_type": "insight",
        "exclusive_insight": (
            "The control record should connect each agent identity to one owner, "
            "one permission boundary, one cost ceiling, and one verification result."
        ),
        "ai_recommendation": (
            "Create the control record this week, run it against one live workflow, "
            "and pause the workflow when the verification result is missing."
        ),
        "agentic_relevance": (
            "This signal changes how operators deploy AI agents with tool calling, "
            "bounded autonomy, and accountable orchestration in production workflows."
        ),
        "original_thesis": (
            "The durable advantage is not another agent interface but a control record "
            "that makes every autonomous action attributable, bounded, and reversible."
        ),
        "originality_note": (
            "This brief synthesizes the dated sources into an original operator framework "
            "and does not reproduce source sentences, quotations, or editorial framing."
        ),
    }
    return {
        "date": day,
        "seo_question": free["subject"],
        "search_intent": (
            "The searcher wants a plain definition, a practical mechanism, and "
            "a safe way to try an agentic workflow."
        ),
        "demand_evidence": (
            "The same natural-language question appeared across two current demand "
            "surfaces, outranked narrower candidates, and has not been answered by "
            "a recent Interlinked issue."
        ),
        "demand_signals": [
            {
                "source": "Search related questions",
                "url": "https://example.edu/search/questions",
                "observed_at": day,
                "query": "agentic AI",
                "signal": (
                    "The selected definition question repeated alongside several "
                    "closely related implementation questions."
                ),
            },
            {
                "source": "Technical community discussions",
                "url": "https://community.example.dev/questions",
                "observed_at": day,
                "query": "AI agents how work",
                "signal": (
                    "Current threads repeatedly asked how agentic systems differ "
                    "from chatbots and workflow automation."
                ),
            },
        ],
        "related_questions": [
            "How is agentic AI different from a chatbot?",
            "What tools can an AI agent use?",
            "How do you keep an AI agent safe?",
        ],
        "trend_evidence": (
            "A primary product release and independent reporting published this week "
            "show the same agent-control shift moving from demos into production operations."
        ),
        "premium_market_summary": (
            "Agent infrastructure is consolidating around explicit control, evaluation, "
            "and interoperable tool layers, creating leverage for operators who standardize "
            "their runtime before adding more agents."
        ),
        "market_moves": [
            {
                "rank": 1,
                "headline": "Agent controls move into the runtime",
                "what_changed": (
                    "A primary product release added explicit production controls "
                    "for tool-using agent workflows this week."
                ),
                "leverage": (
                    "Operators with one control plane gain deployment speed while "
                    "fragmented stacks absorb more verification work."
                ),
                "risk": (
                    "A control interface can create false confidence when outcome "
                    "verification remains outside the runtime."
                ),
                "action": (
                    "Map one live workflow to an owner, permission boundary, cost "
                    "ceiling, and deterministic completion check."
                ),
                "source_urls": ["https://example.net/report"],
            },
            {
                "rank": 2,
                "headline": "Independent testing exposes reliability gaps",
                "what_changed": (
                    "Independent analysis documented where current agent controls "
                    "still fail under production-like tool sequences."
                ),
                "leverage": (
                    "Teams with scenario-based evaluations can reject brittle agents "
                    "before customers or operators discover the failure."
                ),
                "risk": (
                    "Benchmark improvements may not transfer to each company’s tools, "
                    "permissions, or long-running workflows."
                ),
                "action": (
                    "Build three failure scenarios from your own production history "
                    "and gate releases on all three passing."
                ),
                "source_urls": ["https://example.org/analysis"],
            },
            {
                "rank": 3,
                "headline": "Implementation standards become a buying filter",
                "what_changed": (
                    "New technical documentation made agent implementation boundaries "
                    "clearer for buyers comparing production stacks."
                ),
                "leverage": (
                    "Vendors that expose portable interfaces and receipts become easier "
                    "to adopt without creating irreversible platform dependence."
                ),
                "risk": (
                    "Superficial standards support can hide proprietary behavior in "
                    "identity, memory, evaluation, or audit storage."
                ),
                "action": (
                    "Require an exportable action log and one replaceable integration "
                    "before approving a new agent platform."
                ),
                "source_urls": ["https://example.com/context"],
            },
        ],
        "sources": [
            {
                "name": "Source A",
                "url": "https://example.net/report",
                "published_at": day,
                "kind": "primary",
                "supports": "Documents the dated product release and its agent control changes.",
            },
            {
                "name": "Source B",
                "url": "https://example.org/analysis",
                "published_at": day,
                "kind": "independent",
                "supports": "Independently analyzes production adoption and operator constraints.",
            },
            {
                "name": "Source C",
                "url": "https://example.com/context",
                "published_at": day,
                "kind": "primary",
                "supports": "Provides technical documentation for the implementation details discussed.",
            },
        ],
        "free": free,
        "premium": premium,
    }


class PipelineTests(unittest.TestCase):
    def test_valid_rows_pass(self) -> None:
        release.validate_rows(valid_rows(), "2026-08-02")

    def test_free_subject_must_match_selected_question(self) -> None:
        payload = valid_rows()
        payload["free"]["subject"] = "A headline that is not the chosen question"
        with self.assertRaises(release.InterlinkedError):
            release.validate_rows(payload, "2026-08-02")

    def test_demand_signals_require_two_surfaces(self) -> None:
        payload = valid_rows()
        payload["demand_signals"][1]["url"] = (
            "https://example.edu/search/other"
        )
        with self.assertRaises(release.InterlinkedError):
            release.validate_rows(payload, "2026-08-02")

    def test_quote_attribution_fails(self) -> None:
        payload = valid_rows()
        payload["free"]["quote"] = "Verified work wins. — Famous Person"
        with self.assertRaises(release.InterlinkedError):
            release.validate_rows(payload, "2026-08-02")

    def test_same_source_domain_fails(self) -> None:
        payload = valid_rows()
        payload["sources"][1]["url"] = "https://example.net/other"
        payload["sources"][2]["url"] = "https://example.net/context"
        with self.assertRaises(release.InterlinkedError):
            release.validate_rows(payload, "2026-08-02")

    def test_stale_trend_sources_fail(self) -> None:
        payload = valid_rows()
        for source in payload["sources"]:
            source["published_at"] = "2026-07-01"
        with self.assertRaises(release.InterlinkedError):
            release.validate_rows(payload, "2026-08-02")

    def test_sources_require_primary_and_independent_reporting(self) -> None:
        payload = valid_rows()
        for source in payload["sources"]:
            source["kind"] = "independent"
        with self.assertRaises(release.InterlinkedError):
            release.validate_rows(payload, "2026-08-02")

    def test_non_agentic_premium_topic_fails(self) -> None:
        payload = valid_rows()
        premium = payload["premium"]
        premium["subject"] = "The management practice changing quarterly planning"
        premium["intro"] = "A current business signal is changing how leaders structure quarterly planning and reporting. The evidence points to a practical management decision."
        premium["insights"] = [
            "The first report documents a change in management practice with enough detail for a responsible decision.",
            "The second report independently confirms the direction and adds an implementation constraint for leaders.",
            "The combined evidence suggests a measured rollout with one deterministic review gate for managers.",
        ]
        premium["agentic_relevance"] = "This business planning topic offers general management context but does not materially change current technology operations or production systems."
        with self.assertRaises(release.InterlinkedError):
            release.validate_rows(payload, "2026-08-02")

    def test_copyright_led_premium_subject_fails(self) -> None:
        payload = valid_rows()
        payload["premium"]["subject"] = (
            "The copyright lawsuit changing agentic AI licensing"
        )
        with self.assertRaises(release.InterlinkedError):
            release.validate_rows(payload, "2026-08-02")

    def test_extracts_last_response_bundle(self) -> None:
        day = "2026-08-02"
        rows = json.dumps(valid_rows(day))
        transcript = f"""# Cron Job
INTERLINKED_DATE: YYYY-MM-DD
BEGIN_INTERLINKED_ROWS
{{"example": true}}
END_INTERLINKED_ROWS
## Response
INTERLINKED_DATE: {day}
FREE_IMAGE_PATH: /tmp/free.png
PREMIUM_IMAGE_PATH: /tmp/premium.png
BEGIN_INTERLINKED_ROWS
{rows}
END_INTERLINKED_ROWS
BEGIN_INTERLINKED_ARTIFACT
---
date: "{day}"
---
## Free Issue Body
Complete.
END_INTERLINKED_ARTIFACT
VERIFIED
"""
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "output.md"
            path.write_text(transcript, encoding="utf-8")
            bundle = release.extract_bundle(path, day)
        self.assertEqual(bundle["rows"]["date"], day)
        self.assertEqual(str(bundle["free_image"]), "/tmp/free.png")

    def test_send_readiness_accepts_case_variation(self) -> None:
        day = "2026-08-02"
        artifact = f'''---
date: "{day}"
hero_image: "https://omnileadsagi.com/newsletter/generated/interlinked-free-{day}.jpg"
share_image: "https://omnileadsagi.com/newsletter/generated/interlinked-premium-{day}-share.jpg"
---
## Free Issue Body
Complete.
## Premium Issue
Complete.
## Social Snippets
1. First.
2. Second.
3. Third.
## Send-Readiness
Publication-ready draft; not sent.
'''
        with tempfile.TemporaryDirectory() as directory:
            stage = Path(directory)
            validator = stage / "validator.py"
            validator.write_text("print('PASS')\n", encoding="utf-8")
            with (
                patch.object(release, "VALIDATOR", validator),
                patch.object(
                    release,
                    "run",
                    return_value=SimpleNamespace(stdout="PASS", stderr=""),
                ),
            ):
                artifact_path = release.validate_artifact(artifact, day, stage)
        self.assertEqual(artifact_path.name, f"omni-ai-{day}.md")

    def test_vercel_inspect_accepts_stderr(self) -> None:
        process = SimpleNamespace(
            stdout="",
            stderr=(
                "General\n"
                "  id  dpl_Example123\n"
                "  status  ● Ready\n"
            ),
        )
        self.assertEqual(
            release.parse_vercel_inspect(process),
            ("dpl_Example123", "Ready"),
        )

    def test_issue_publication_time_stays_on_issue_day(self) -> None:
        self.assertEqual(
            release.issue_publication_time("2026-08-02"),
            "2026-08-02T12:00:00-06:00",
        )

    def test_owner_email_is_a_combined_teaser_not_the_artifact(self) -> None:
        day = "2026-08-02"
        rows = valid_rows(day)
        live = {
            "free": rows["free"],
            "premium": rows["premium"],
            "hero": (
                "https://omnileadsagi.com/newsletter/generated/"
                f"interlinked-free-{day}.jpg"
            ),
        }
        subject, body = owner_email.build_email(live)

        self.assertIn("Interlinked Admin", subject)
        self.assertIn(f"/newsletter/interlinked-free-{day}", body)
        self.assertIn(f"/newsletter/interlinked-premium-{day}", body)
        self.assertIn("Read Free Issue", body)
        self.assertIn("Open Premium Brief", body)
        self.assertNotIn("Publication Receipt", body)
        self.assertNotIn("Source Status", body)
        self.assertNotIn("Social Snippets", body)
        self.assertNotIn("Send-Readiness", body)
        self.assertNotIn("## ", body)
        self.assertNotIn("**", body)
        self.assertLess(len(body), 9000)

    def test_owner_teaser_is_bounded(self) -> None:
        long_text = "A grounded signal changes the operating decision. " * 30
        teaser = owner_email.teaser_excerpt(long_text)
        self.assertLessEqual(len(teaser), 261)
        self.assertTrue(teaser.endswith(".") or teaser.endswith("…"))

    def test_owner_preflight_uses_canonical_rows_for_teaser_content(self) -> None:
        day = "2026-08-02"
        rows = valid_rows(day)
        public_rows = [
            {
                "slug": rows["free"]["slug"],
                "tier": "free",
                "subject": rows["free"]["subject"],
            },
            {
                "slug": rows["premium"]["slug"],
                "tier": "premium",
                "subject": rows["premium"]["subject"],
            },
        ]
        artifact = (
            f'hero_image: "{owner_email.SITE_URL}/newsletter/generated/'
            f'interlinked-free-{day}.jpg"\n'
            f'share_image: "{owner_email.SITE_URL}/newsletter/generated/'
            f'interlinked-premium-{day}-share.jpg"\n'
        )
        with (
            patch.object(
                owner_email,
                "newsletter_posts",
                return_value=(public_rows, "supabase"),
            ),
            patch.object(
                owner_email,
                "newsletter_rows_for_day",
                return_value=[rows["free"], rows["premium"]],
            ),
            patch.object(
                owner_email,
                "remote_image_info",
                side_effect=[(1200, 630, "image/jpeg"), (1024, 1024, "image/jpeg")],
            ),
        ):
            live = owner_email.live_preflight(day, artifact)
        self.assertEqual(live["free"]["intro"], rows["free"]["intro"])
        self.assertEqual(live["premium"]["intro"], rows["premium"]["intro"])

    def test_telegram_posts_only_premium_link_with_free_art(self) -> None:
        day = "2026-08-02"
        rows = valid_rows(day)
        payload = channel_post.build_payload(
            rows["free"], rows["premium"], day
        )
        buttons = payload["reply_markup"]["inline_keyboard"]
        self.assertEqual(payload["photo"].split("/")[-1], f"interlinked-free-{day}.jpg")
        self.assertEqual(len(buttons), 1)
        self.assertEqual(len(buttons[0]), 1)
        self.assertEqual(buttons[0][0]["text"], "Open Premium Brief")
        self.assertIn(f"interlinked-premium-{day}", buttons[0][0]["url"])
        self.assertNotIn(f"interlinked-free-{day}", buttons[0][0]["url"])


if __name__ == "__main__":
    unittest.main()
