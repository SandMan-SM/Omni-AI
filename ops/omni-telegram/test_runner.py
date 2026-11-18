from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from datetime import date, datetime, timezone
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import Mock, patch

import public_sources
import runner


class DispatchTests(unittest.TestCase):
    channel = "interlinked"
    destination = {"chat_id": "-1234", "title": "Interlinked"}
    day = date(2026, 11, 18)
    post = runner.prepare_post(channel, {"category": "practice", "text": "Test copy"})

    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.file = Path(directory.name) / "receipts.sqlite3"

    def dispatch(self, client):
        return runner.publish(client, self.destination, self.file, self.channel, self.day, self.post)

    def test_concurrent_replay_sends_only_once(self):
        bot = Mock()
        bot.call.return_value = {"chat": {"id": -1234}, "message_id": 42}

        def attempt():
            try:
                return self.dispatch(bot)
            except runner.DispatchError as exc:
                self.assertIn("reserved", str(exc))
                return False

        with ThreadPoolExecutor(max_workers=4) as executor:
            results = list(executor.map(lambda _: attempt(), range(4)))
        self.assertEqual(1, sum(results))
        self.assertFalse(self.dispatch(bot))
        bot.call.assert_called_once()
        with closing(sqlite3.connect(self.file)) as database:
            self.assertEqual(("sent", 42), database.execute("SELECT status, message_id FROM dispatches").fetchone())

    def test_refusal_and_ambiguous_send_do_not_resend(self):
        for code, expected in ((403, "rejected"), (None, "uncertain")):
            with self.subTest(code=code):
                self.file = self.file.with_name(f"receipts-{code}.sqlite3")
                bot = Mock()
                bot.call.side_effect = runner.TelegramError("sendMessage", code)
                with self.assertRaises(runner.TelegramError):
                    self.dispatch(bot)
                with self.assertRaisesRegex(runner.DispatchError, expected):
                    self.dispatch(bot)
                bot.call.assert_called_once()

    def test_permissions_and_title_must_match(self):
        bot = runner.Telegram("placeholder")
        with patch.object(bot, "call") as call:
            call.side_effect = [
                {"id": 1, "username": "omnileads_bot", "is_bot": True},
                {"id": -1234, "title": "Interlinked", "type": "channel"},
                {"user": {"id": 1}, "status": "administrator", "can_post_messages": False},
            ]
            with self.assertRaisesRegex(runner.DispatchError, "posting permission"):
                bot.verify(self.destination)
            call.side_effect = [
                {"id": 1, "username": "omnileads_bot", "is_bot": True},
                {"id": -1234, "title": "Another group", "type": "channel"},
            ]
            with self.assertRaisesRegex(runner.DispatchError, "destination"):
                bot.verify(self.destination)

    def test_curated_rotation_keeps_two_weeks_of_distinct_copy(self):
        editorial = runner.read_json(runner.SCRIPT_DIR / "editorial.json")["channels"]
        with patch.object(runner, "approved_wins", return_value=[]), patch.object(runner, "fresh_posts", return_value=[]):
            for channel, entry in editorial.items():
                history = []
                for offset in range(45):
                    day = self.day + runner.timedelta(days=offset)
                    post = runner.select_post(channel, day, entry["posts"], history)
                    self.assertNotIn(post["content_id"], [row["content_id"] for row in history[:13]])
                    if history:
                        self.assertNotEqual(post["category"], history[0]["category"])
                    history.insert(0, {**post, "day": day.isoformat(), "status": "sent"})


class PublicSourcesTests(unittest.TestCase):
    def test_rss_uses_publication_dates_and_approved_urls(self):
        payload = b"""<rss><channel>
            <item><title>Eligible</title><link>https://mafiempire.com/newsletter/a</link>
              <pubDate>Tue, 17 Nov 2026 16:00:00 GMT</pubDate></item>
            <item><title>Future</title><link>https://mafiempire.com/newsletter/b</link>
              <pubDate>Wed, 18 Nov 2026 18:00:00 GMT</pubDate></item>
            <item><title>Stale</title><link>https://mafiempire.com/newsletter/c</link>
              <pubDate>Sat, 14 Nov 2026 16:00:00 GMT</pubDate></item>
            <item><title>Unapproved</title><link>https://example.org/newsletter/b</link>
              <pubDate>Tue, 17 Nov 2026 16:00:00 GMT</pubDate></item>
            <item><title>Undated</title><link>https://mafiempire.com/newsletter/d</link></item>
            </channel></rss>"""
        with patch.object(public_sources, "read_public", return_value=payload):
            rows = public_sources.from_feed(public_sources.SUCCESS_FEEDS[0], date(2026, 11, 18),
                                            datetime(2026, 11, 18, 16, tzinfo=timezone.utc))
        self.assertEqual(["Eligible"], [row[1]["text"] for row in rows])

    def test_unsafe_urls_and_paths_are_denied_before_network(self):
        self.assertIsNone(public_sources.read_public("https://example.org/newsletter/story"))
        self.assertIsNone(public_sources.read_public("https://aisempire.org/admin"))
        self.assertIsNone(public_sources.read_public("http://aisempire.org/newsletter"))
        self.assertIsNone(public_sources.read_public("https://aisempire.org/newsletter/story?q=1"))

    def test_syndicated_daily_slug_shares_source_key(self):
        urls = ("https://mafiempire.com/newsletter/example-topic",
                "https://sitanimafi.com/newsletter/daily/daily-letter-2026-11-16-example-topic")
        posts = [public_sources.article("Title", "", url, date(2026, 11, 16), "success-empire") for url in urls]
        self.assertEqual(posts[0][1]["source_key"], posts[1][1]["source_key"])
