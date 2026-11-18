# Omni AI Telegram publishing

Hermes runs one script-only job for each verified Telegram destination. The local wrappers in `~/.hermes/scripts/omni-telegram/` invoke `runner.py` with a fixed channel. `editorial.json` holds the approved posts and Mountain Time schedule. The runner accepts dispatches during the scheduled hour and stays quiet on success.

| Destination | Mountain Time | Channel key |
| --- | --- | --- |
| Success Empire | 8:00 a.m. | `success-empire` |
| Interlinked | 10:00 a.m. | `interlinked` |
| Imperium | Noon | `imperium` |

## Destination verification

Use the current `TELEGRAM_BOT_TOKEN` in `~/.hermes/.env`. The runner checks that Telegram identifies it as `@omnileads_bot` before each post. Set only independently verified `chat_id` and exact Telegram `title` pairs in `~/.hermes/omni-telegram/destinations.json`. The `--check-only` command verifies identity, title, membership, posting permission, and configured copy without sending anything.

```bash
python3 -B runner.py interlinked --check-only
python3 -B -m unittest -v test_runner
```

Pass the group’s negative numeric Telegram ID to `provision.py`. It checks the exact group title and bot permissions, then creates or resumes one script-only Hermes job. For a read-only preflight, add `--check-only`.

```bash
python3 -B provision.py success-empire --chat-id=-<chat-id>
python3 -B provision.py imperium --chat-id=-<chat-id>
```

## Editorial rotation and receipts

The rotation uses published, recently dated articles when they fit the channel. It tracks delivered copy and article identifiers, rotates topics, and prevents copy from repeating within two weeks. Without a fresh source it draws from the curated posts in `editorial.json`.

To share a real community win with permission, put a channel-keyed list in `~/.hermes/omni-telegram/approved-wins.json`. Each entry requires `date` in `YYYY-MM-DD` format, `text`, a `url` on the channel’s approved domains, a unique `source_key`, and `approved_for_public_post` set to `true`. Use only copy the member approved for this audience, including any name or attribution. These entries expire after two weeks and receive at most one dispatch. Recognition prompts in the standard rotation let members volunteer their own stories. Adaptation uses delivery history and approved editorial sources.

`~/.hermes/omni-telegram/dispatches.sqlite3` records one reservation per channel and date, followed by Telegram’s message ID or a failure state. If a run is rejected or leaves an uncertain outcome, check the job history and target chat before allowing a same-day retry. The runner will never resend an unresolved reservation automatically.
