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
            "A current signal is changing how operators should structure their "
            "AI workflows. The evidence points to a concrete control point."
        ),
        "insights": [
            "The first source documents a material operating change with enough detail for a responsible decision.",
            "The second source independently confirms the direction and adds a useful implementation constraint.",
            "The combined evidence suggests a measured rollout with one deterministic verification gate.",
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
    }
    return {
        "date": day,
        "sources": [
            {"name": "Source A", "url": "https://example.net/report"},
            {"name": "Source B", "url": "https://example.org/analysis"},
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
