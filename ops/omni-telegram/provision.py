"""Verify a Telegram chat ID and register its daily, script-only Hermes job."""

import argparse
from datetime import datetime
import fcntl
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
from tempfile import NamedTemporaryFile

from runner import (
    DispatchError, HERMES_HOME, MOUNTAIN, SCRIPT_DIR, STATE_DIR, Telegram, bot_token,
    prepare_post, read_json,
)


DESTINATION_TITLES = {"success-empire": "Success Empire", "imperium": "IMPERIUM", "interlinked": "Interlinked"}
HERMES_CLI = Path.home() / ".local/bin/hermes"


def write_atomic(file, text, mode=0o600):
    with NamedTemporaryFile(mode="w", dir=file.parent, delete=False) as stream:
        temporary = Path(stream.name)
        try:
            stream.write(text)
            stream.flush()
            os.fchmod(stream.fileno(), mode)
            temporary.replace(file)
        finally:
            temporary.unlink(missing_ok=True)


def register(key, destination, channel):
    title = destination["title"] if key != "imperium" else "Imperium"
    name = f"Omni AI Telegram · {title}"
    script = f"omni-telegram/{key}.sh"
    schedule = f"{channel['minute']} {channel['hour']} * * *"
    state_file = STATE_DIR / "destinations.json"
    jobs_file = HERMES_HOME / "cron/jobs.json"

    STATE_DIR.mkdir(exist_ok=True)
    with (STATE_DIR / "provision.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        jobs = read_json(jobs_file)["jobs"] if jobs_file.exists() else []
        existing = [job for job in jobs if job.get("name") == name or job.get("script") == script]
        if len(existing) > 1 or (existing and (
            existing[0].get("name") != name or existing[0].get("script") != script
            or existing[0].get("schedule", {}).get("expr") != schedule
            or existing[0].get("repeat", {}).get("times") is not None
            or existing[0].get("deliver") != "local" or existing[0].get("no_agent") is not True
        )):
            raise DispatchError("The Hermes job already exists with a different configuration")

        routes = read_json(state_file) if state_file.exists() else {}
        if key in routes and routes[key] != destination:
            raise DispatchError("An independently verified Telegram route already exists for this channel")
        routes[key] = destination

        wrapper = HERMES_HOME / "scripts" / script
        wrapper.parent.mkdir(parents=True, exist_ok=True)
        command = shlex.join([sys.executable, "-B", str(SCRIPT_DIR / "runner.py"), key, "--publish"])
        write_atomic(wrapper, f"#!/bin/bash\nexec {command}\n", 0o700)
        write_atomic(state_file, json.dumps(routes, indent=2) + "\n")

        if not existing:
            args = ["create", schedule, "--name", name, "--script", script, "--no-agent", "--deliver", "local"]
        elif not existing[0].get("enabled"):
            args = ["resume", existing[0]["id"]]
        else:
            args = []
        if args:
            result = subprocess.run([HERMES_CLI, "cron", *args], capture_output=True, timeout=30, check=False)
            if result.returncode:
                raise DispatchError("Hermes did not register the job. The verified Telegram route remains saved")

        scheduled = [job for job in read_json(jobs_file)["jobs"] if job.get("name") == name and job.get("enabled")]
        if len(scheduled) != 1:
            raise DispatchError("Could not confirm one enabled Hermes job")
        job = scheduled[0]
        fire = datetime.fromisoformat(job["next_run_at"]).astimezone(MOUNTAIN)
        if (fire.hour, fire.minute) != (channel["hour"], channel["minute"]):
            subprocess.run([HERMES_CLI, "cron", "pause", job["id"]], capture_output=True, timeout=30, check=False)
            raise DispatchError("Hermes time zone differs from the Mountain Time schedule. Check the job before enabling it")
        print(f"{name} · job {job['id']} verified · next {fire:%Y-%m-%d %H:%M %Z}")


def run():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("channel", choices=DESTINATION_TITLES)
    parser.add_argument("--chat-id", required=True)
    parser.add_argument("--check-only", action="store_true")
    args = parser.parse_args()
    os.umask(0o077)
    if not re.fullmatch(r"-[0-9]+", args.chat_id):
        raise DispatchError("Use the negative numeric Telegram chat ID")
    channel = read_json(SCRIPT_DIR / "editorial.json")["channels"][args.channel]
    if channel.get("chat_id") is not None and str(channel["chat_id"]) != args.chat_id:
        raise DispatchError("ID differs from the approved editorial destination")
    for post in channel["posts"]:
        prepare_post(args.channel, post)
    destination = {"chat_id": args.chat_id, "title": DESTINATION_TITLES[args.channel]}
    Telegram(bot_token()).verify(destination)
    if args.check_only:
        print(f"{destination['title']}: verified bot, exact group and posting permission")
    else:
        register(args.channel, destination, channel)


if __name__ == "__main__":
    try:
        run()
    except (DispatchError, KeyError, OSError, ValueError, subprocess.TimeoutExpired) as exc:
        print(str(exc) if isinstance(exc, DispatchError) else f"Provisioning stopped: {type(exc).__name__}", file=sys.stderr)
        sys.exit(1)
