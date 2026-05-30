-- Round 24 — OmniClaw joins Pantheon as the operator-facing execution lens.

INSERT INTO public.council_agents (
  name,
  archetype_tier,
  domain,
  current_tier,
  elo,
  sources_text,
  standing_question,
  status,
  agent_kind,
  metadata
) VALUES (
  'OmniClaw',
  'greek',
  'Messenger',
  'council',
  1200,
  'Local OmniClaw runtime; OpenAI-Codex/gpt-5.5; outbound operator receipts to MAFI.',
  'Is this proposal clear enough for one human operator to execute from a Telegram message?',
  'active',
  'archetype',
  jsonb_build_object(
    'provider', 'openai-codex/gpt-5.5',
    'endpoint', 'local-omniclaw-proxy',
    'lens_weight', 0.10,
    'notes', 'Operator-facing execution voice. Calls back to MAFI with receipts.'
  )
)
ON CONFLICT (name) DO NOTHING;
