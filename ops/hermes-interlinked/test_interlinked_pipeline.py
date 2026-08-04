from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace


HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
spec = importlib.util.spec_from_file_location(
    "interlinked_release", HERE / "interlinked-daily-release.py"
)
release = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(release)


def valid_rows(day: str = "2026-08-02") -> dict:
    base = {
        "subject": "A specific operating shift worth acting on now",
        "intro": (
            "A current agentic AI signal is changing how operators should structure "
            "their autonomous workflows. The evidence points to a concrete control point."
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
        "trend_evidence": (
            "A primary product release and independent reporting published this week "
            "show the same agent-control shift moving from demos into production operations."
        ),
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


if __name__ == "__main__":
    unittest.main()
