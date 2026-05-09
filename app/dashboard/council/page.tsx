// Mafi admin view — the Council Codex + the latest acknowledgement
// thread. Lives under /dashboard/* (the only namespace where personal
// names from upstream may appear; this view is operator-only).

import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata = {
  title: "Council Codex · Omni AI",
  description: "Active operator directives + latest training thread.",
};

const SEVERITY_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  prime: { bg: "rgba(251,191,36,0.16)", fg: "#fbbf24", label: "PRIME" },
  standard: { bg: "rgba(160,123,255,0.16)", fg: "#a07bff", label: "STANDARD" },
  runbook: { bg: "rgba(45,220,168,0.16)", fg: "#2ddca8", label: "RUNBOOK" },
};

type Directive = {
  slug: string;
  title: string;
  body_md: string;
  severity: string;
  issued_by: string;
  version: number;
  updated_at: string;
};

type DialogueRow = {
  id: string;
  message_md: string;
  status: string;
  created_at: string | null;
  council_agents: { name: string; archetype_tier: string } | null;
};

async function loadCodex() {
  const sb = createAdminClient();
  const [{ data: directives }, { data: dialogues }] = await Promise.all([
    sb
      .from("council_directives")
      .select("slug, title, body_md, severity, issued_by, version, updated_at")
      .eq("status", "active")
      .order("severity", { ascending: true }),
    sb
      .from("pantheon_dialogue")
      .select("id, message_md, status, created_at, council_agents:from_agent_id (name, archetype_tier)")
      .eq("topic", "council_directives_acknowledged_2026_05_08")
      .order("created_at", { ascending: true })
      .limit(40),
  ]);
  return {
    directives: (directives || []) as Directive[],
    dialogues: (dialogues || []) as unknown as DialogueRow[],
  };
}

export default async function CouncilCodexPage() {
  const { directives, dialogues } = await loadCodex();

  const grouped: Record<string, Directive[]> = { prime: [], standard: [], runbook: [] };
  for (const d of directives) {
    (grouped[d.severity] ||= []).push(d);
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-12 space-y-12">
        <header>
          <p className="text-xs uppercase tracking-[0.4em] text-amber-400">Mafi admin · council</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Council Codex</h1>
          <p className="mt-3 text-zinc-400 max-w-2xl">
            The operative directives every Pantheon agent obeys. Versioned. Read on every reasoning cycle.
            Public API: <code className="text-amber-400">/api/council/codex</code>.
          </p>
        </header>

        {(["prime", "standard", "runbook"] as const).map((sev) => {
          const items = grouped[sev] || [];
          if (items.length === 0) return null;
          const badge = SEVERITY_BADGE[sev];
          return (
            <section key={sev}>
              <div className="flex items-baseline gap-3 mb-4">
                <span
                  className="text-[10px] font-bold tracking-[0.32em] px-2 py-1 rounded"
                  style={{ background: badge.bg, color: badge.fg }}
                >
                  {badge.label}
                </span>
                <p className="text-zinc-500 text-xs uppercase tracking-[0.32em]">
                  {items.length} {items.length === 1 ? "directive" : "directives"}
                </p>
              </div>
              <div className="space-y-3">
                {items.map((d) => (
                  <article key={d.slug} className="border border-zinc-800 rounded-xl p-6 bg-zinc-900/40">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <p className="font-semibold text-lg">{d.title}</p>
                        <p className="text-xs text-zinc-500 mt-1">
                          slug: <code className="text-zinc-400">{d.slug}</code> · v{d.version} · issued by {d.issued_by} · updated {new Date(d.updated_at).toISOString().slice(0, 16).replace("T", " ")}Z
                        </p>
                      </div>
                    </div>
                    <pre className="mt-4 whitespace-pre-wrap text-sm text-zinc-300 font-sans leading-relaxed">
                      {d.body_md}
                    </pre>
                  </article>
                ))}
              </div>
            </section>
          );
        })}

        <section>
          <div className="flex items-baseline gap-3 mb-4">
            <h2 className="text-xl font-semibold">Latest training thread</h2>
            <p className="text-xs text-zinc-500 uppercase tracking-[0.3em]">
              {dialogues.length} acknowledgements
            </p>
          </div>
          <div className="space-y-2">
            {dialogues.length === 0 && (
              <p className="text-zinc-500 text-sm">No training thread yet.</p>
            )}
            {dialogues.map((row) => (
              <details key={row.id} className="border border-zinc-800 rounded-lg bg-zinc-900/30">
                <summary className="cursor-pointer px-4 py-3 text-sm flex items-center justify-between">
                  <span>
                    <span className="text-amber-400">{row.council_agents?.name || "Unknown"}</span>
                    <span className="text-zinc-500 ml-2 text-xs">· {row.council_agents?.archetype_tier || "?"} · {row.status}</span>
                  </span>
                  <span className="text-zinc-500 text-xs">
                    {row.created_at ? new Date(row.created_at).toISOString().slice(11, 19) : ""}
                  </span>
                </summary>
                <pre className="px-4 pb-4 whitespace-pre-wrap text-xs text-zinc-300 font-sans leading-relaxed">
                  {row.message_md}
                </pre>
              </details>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
