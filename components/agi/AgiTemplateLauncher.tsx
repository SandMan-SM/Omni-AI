"use client";

import { useEffect, useState } from "react";
import { Sparkles, Zap, ChevronDown, CheckCircle2, Loader2 } from "lucide-react";

type Template = {
  id: string;
  name: string;
  industry: string | null;
  description: string | null;
  use_count: number;
};

// Wave C: AGI Sequence Template Launcher
// Dropdown that lists 5 industry playbooks. Click to instantiate as a campaign.
export function AgiTemplateLauncher({ onApplied }: { onApplied?: () => void }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/agi/templates").then(r => r.json()).then(d => setTemplates(d.templates ?? []));
    fetch("/api/agi/admin/businesses").then(r => r.json()).then(d => {
      const first = d.businesses?.[0];
      if (first) setBusinessId(first.id);
    });
  }, []);

  async function apply(template_id: string) {
    if (!businessId) return;
    setApplying(template_id);
    setSuccess(null);
    try {
      const r = await fetch("/api/agi/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id, business_id: businessId }),
      });
      const j = await r.json();
      if (j.ok) {
        setSuccess(j.campaign?.name ?? "Campaign created");
        onApplied?.();
        setTimeout(() => { setOpen(false); setSuccess(null); }, 2000);
      }
    } finally {
      setApplying(null);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-colors"
      >
        <Sparkles className="w-3 h-3" />
        Quick-Start from AGI Template
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl border border-emerald-500/20 bg-[#0a0a0a]/95 backdrop-blur-xl p-2 z-50 shadow-2xl">
          <div className="px-2 py-1.5 mb-1">
            <div className="text-[10px] uppercase tracking-wider text-emerald-400 font-bold">
              Battle-tested industry playbooks
            </div>
          </div>
          {templates.map(t => (
            <button
              key={t.id}
              onClick={() => apply(t.id)}
              disabled={applying === t.id || !businessId}
              className="w-full text-left p-2.5 rounded-lg hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white">{t.name}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    {t.industry} · used {t.use_count}x
                  </div>
                </div>
                {applying === t.id ? (
                  <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                ) : (
                  <Zap className="w-3 h-3 text-emerald-400" />
                )}
              </div>
            </button>
          ))}
          {success && (
            <div className="mt-2 px-2 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-[11px] text-emerald-300 inline-flex items-center gap-2 w-full">
              <CheckCircle2 className="w-3 h-3" />
              {success}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
