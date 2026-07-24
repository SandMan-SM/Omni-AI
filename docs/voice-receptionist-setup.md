# Omni AI Inbound Voice Receptionist

An inbound AI phone receptionist on **ElevenLabs Conversational AI**, brained by
**Claude**, that answers Omni AI's line, answers questions, qualifies callers,
and books the free 30-minute strategy call — all flowing into the same Supabase
CRM and the Mythos dashboard as every other surface.

The **backend is built and deployed** in this repo. What remains is standing up
the ElevenLabs agent (needs your ElevenLabs account + API key) and pointing your
Twilio number at it.

## Architecture

```
Caller → Twilio number → ElevenLabs agent (Claude + voice)
                             │  live tools (server webhooks, bearer-secured):
                             ├─ check_availability → /api/voice/availability → meetings/slots
                             ├─ book_consult       → /api/voice/book        → meetings/book (+ lead + recap SMS + owner email)
                             └─ capture_lead       → /api/voice/capture-lead → omni_leads_generated (+ owner email)
                          end of call ↓
                       post_call_transcription (HMAC-signed)
                             → /api/voice/postcall → omni_voice_calls + owner recap email → Mythos
```

- Public founder identity on calls: **Alfred Belvedere**. The agent discloses it
  is an AI ("Ava, their AI virtual assistant") and opens with a recording notice.
- Business context: `omni_businesses` slug `omnileads`
  (`146f6f87-6ed7-4c21-a0e3-fac2c91c2748`). Bookings mirror to
  `inbound_omnileads_bookings`; the dashboard KPIs count them automatically.

## 1. Environment variables (set in Vercel — values only, never committed)

| Name | Purpose |
| --- | --- |
| `VOICE_AGENT_SECRET` | Shared bearer secret the ElevenLabs tools send to `/api/voice/*`. Generate a long random string; put the same value here and in the tool auth header. Until set, the tool routes fail closed (401). |
| `VOICE_POSTCALL_WEBHOOK_SECRET` | The signing secret ElevenLabs shows when you create the post-call webhook. Paste it here so the webhook signature verifies. |

Already present and reused: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
`TWILIO_FROM_NUMBER`, `RESEND_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`. (The Claude LLM is hosted by ElevenLabs — **no
Anthropic key needed** for the agent.)

## 2. Provision the agent (one command)

Create an ElevenLabs account, grab an API key (Settings → API Keys), then:

```bash
ELEVENLABS_API_KEY=xi-... \
VOICE_AGENT_SECRET=<same value you set in Vercel> \
node scripts/provision-voice-agent.mjs
```

This creates the three webhook tools and the agent (Claude LLM, disclosed
persona, tools attached) and prints `agent_id` + `tool_ids`. Optional — import
and bind your Twilio number in the same run:

```bash
ELEVENLABS_API_KEY=xi-... VOICE_AGENT_SECRET=... \
TWILIO_ACCOUNT_SID=AC... TWILIO_AUTH_TOKEN=... VOICE_PHONE_NUMBER=+1XXXXXXXXXX \
node scripts/provision-voice-agent.mjs
```

Override defaults with `ELEVENLABS_LLM` (default `claude-haiku-4-5`; use
`claude-sonnet-5` for richer conversation) and `ELEVENLABS_VOICE_ID`.

## 3. Connect the phone number (if not done in step 2)

ElevenLabs dashboard → **Agents → Phone Numbers → Import a phone number** →
enter the E.164 number + your Twilio Account SID + Auth Token → assign the
"Omni AI Receptionist" agent. ElevenLabs auto-configures the Twilio voice
webhook — don't also hand-edit that webhook in the Twilio console.

## 4. Post-call webhook

ElevenLabs dashboard → **Agents → Settings → Post-call webhooks** → add
`https://omnileadsagi.com/api/voice/postcall`, enable **transcription**. Copy
the generated signing secret into `VOICE_POSTCALL_WEBHOOK_SECRET` in Vercel and
redeploy. Every completed call then lands in `omni_voice_calls` with transcript
+ summary and emails you a recap.

## 5. Test

- Call the number. You should hear the disclosure opener.
- Ask what Omni AI does, then ask to book — the agent offers real open slots and
  books one; you get a recap text and an owner email; the booking shows on the
  meetings calendar and in Mythos.
- Check `omni_voice_calls` for the row after you hang up.

## Compliance (built in)

- **AI disclosure** up front on every call (satisfies CA SB 1001, Utah, Colorado
  AI-notice, FTC deception). Keep it — don't remove the disclosure line.
- **Recording notice** in the opener (calls are transcribed/stored). This
  establishes implied consent for all-party-consent states (CA, FL, PA, WA, …).
  If you ever turn off recording/transcription, drop that sentence.
- The agent **refuses card/payment and sensitive data by voice** and offers a
  secure email/text link instead.
- Outbound reminders/callbacks are a separate TCPA question — this build is
  inbound-only. Capture consent before adding any outbound calling/texting.

## Files

- `app/api/voice/availability` · `book` · `capture-lead` · `postcall` — routes
- `lib/voice/{config,auth,sms,notify}.ts` — shared helpers
- `scripts/provision-voice-agent.mjs` — one-command ElevenLabs provisioning
- `supabase` migration `omni_voice_calls` — the call log (RLS-on, service_role)
