from __future__ import annotations

import importlib.util
import os
import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo


MODULE_PATH = Path(__file__).with_name("newsletter-fleet-monitor.py")
SPEC = importlib.util.spec_from_file_location("newsletter_fleet_monitor", MODULE_PATH)
assert SPEC and SPEC.loader
monitor = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = monitor
SPEC.loader.exec_module(monitor)


DENVER = ZoneInfo("America/Denver")


def job(*, last_run_at: str | None, last_status: str = "ok", path: str) -> dict:
    return {
        "id": "test-job",
        "name": "Newsletter Cron — Test issue",
        "enabled": True,
        "schedule": {"expr": "0 13 * * 3"},
        "last_run_at": last_run_at,
        "last_status": last_status,
        "prompt": f"Save to `{path}` and deliver receipt.",
    }


class NewsletterFleetMonitorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.now = datetime(2026, 8, 5, 18, 30, tzinfo=DENVER)

    def test_cron_due_today_supports_weekday_and_lists(self) -> None:
        self.assertTrue(monitor.cron_due_today("0 13 * * 3", self.now))
        self.assertTrue(monitor.cron_due_today("15 8 * * 2,3", self.now))
        self.assertFalse(monitor.cron_due_today("0 19 * * 3", self.now))
        self.assertFalse(monitor.cron_due_today("0 13 * * 4", self.now))

    def test_expected_artifact_replaces_longest_date_token_first(self) -> None:
        artifact = monitor.expected_artifact(
            "Save the artifact to `/tmp/brand-YYYY-MM-DD.md`.", self.now
        )
        self.assertEqual(artifact, Path("/tmp/brand-2026-08-05.md"))

    def test_audit_flags_false_ok_when_artifact_is_missing(self) -> None:
        jobs = [
            job(
                last_run_at="2026-08-05T13:02:00-06:00",
                path="/tmp/does-not-exist-YYYY-MM-DD.md",
            )
        ]
        due, findings = monitor.audit_jobs(jobs, self.now)
        self.assertEqual(due, 1)
        self.assertEqual(findings[0].code, "artifact-failed")

    def test_audit_flags_job_that_never_fired(self) -> None:
        jobs = [job(last_run_at="2026-07-29T13:02:00-06:00", path="/tmp/x.md")]
        _, findings = monitor.audit_jobs(jobs, self.now)
        self.assertEqual(findings[0].code, "never-fired")

    def test_audit_accepts_a_validated_artifact(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            artifact = root / "issue-2026-08-05.md"
            artifact.write_text("# Newsletter\n" + ("useful content\n" * 60), encoding="utf-8")
            validator = root / "validator.py"
            validator.write_text("#!/bin/sh\necho 'newsletter-artifact-valid'\nexit 0\n", encoding="utf-8")
            os.chmod(validator, 0o755)
            jobs = [
                job(
                    last_run_at="2026-08-05T13:02:00-06:00",
                    path=str(artifact),
                )
            ]
            due, findings = monitor.audit_jobs(jobs, self.now, validator=validator)
            self.assertEqual(due, 1)
            self.assertEqual(findings, [])

    def test_portfolio_engine_keeps_explicit_client_exclusions(self) -> None:
        source = MODULE_PATH.with_name("portfolio-seo-newsletter-engine.mjs").read_text(
            encoding="utf-8"
        )
        self.assertIn('"/Mafi Rentals/"', source)
        self.assertIn('"/North Peak Roofing/"', source)
        self.assertIn("PORTFOLIO_EXCLUSIONS.some", source)

    def test_runtime_preflight_requires_safe_file_write_and_fallback(self) -> None:
        source = MODULE_PATH.with_name("newsletter-runtime-preflight.py").read_text(
            encoding="utf-8"
        )
        self.assertIn("mcp__filesystem__write_file", source)
        self.assertIn("BEGIN_NEWSLETTER_ARTIFACT", source)
        self.assertIn("never report success without the file", source)

    def test_audit_recovers_marked_fallback_then_validates(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            artifact_root = root / "artifacts"
            artifact = artifact_root / "issue-2026-08-05.md"
            output_root = root / "output"
            job_output = output_root / "test-job"
            job_output.mkdir(parents=True)
            fallback = "# Newsletter\n" + ("useful content\n" * 60)
            (job_output / "2026-08-05_13-01-00.md").write_text(
                "## Response\nBEGIN_NEWSLETTER_ARTIFACT\n"
                + fallback
                + "END_NEWSLETTER_ARTIFACT\n",
                encoding="utf-8",
            )
            timestamp = self.now.timestamp()
            os.utime(job_output / "2026-08-05_13-01-00.md", (timestamp, timestamp))
            validator = root / "validator.py"
            validator.write_text("#!/bin/sh\necho 'PASS'\n", encoding="utf-8")
            os.chmod(validator, 0o755)
            jobs = [
                job(
                    last_run_at="2026-08-05T13:02:00-06:00",
                    path=str(artifact),
                )
            ]
            receipts: list[str] = []
            due, findings = monitor.audit_jobs(
                jobs,
                self.now,
                validator=validator,
                recover_fallback=True,
                output_root=output_root,
                artifact_root=artifact_root,
                recovery_receipts=receipts,
            )
            self.assertEqual(due, 1)
            self.assertEqual(findings, [])
            self.assertEqual(artifact.read_text(encoding="utf-8"), fallback)
            self.assertEqual(len(receipts), 1)


if __name__ == "__main__":
    unittest.main()
