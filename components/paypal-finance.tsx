"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Banknote,
  Receipt,
  RefreshCw,
  Loader2,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Users,
} from "lucide-react";

type Txn = {
  paypal_txn_id: string;
  transaction_amount: number | null;
  fee_amount: number | null;
  net_amount: number | null;
  transaction_currency: string | null;
  transaction_status: string | null;
  transaction_event_code: string | null;
  payer_email: string | null;
  payer_name: string | null;
  transaction_initiation_date: string | null;
  kind: "payment" | "refund" | "withdrawal" | "other";
};

type FinanceData = {
  window_days: number;
  summary: {
    gross_revenue: number;
    fees: number;
    refunds: number;
    net_revenue: number;
    bank_withdrawals: number;
    payment_count: number;
  };
  monthly: { month: string; amount: number }[];
  top_payers: { name: string | null; email: string; total: number; count: number }[];
  transactions: Txn[];
  last_sync: {
    started_at: string;
    finished_at: string;
    status: string;
    fetched_count: number;
    upserted_count: number;
    error_message?: string | null;
  } | null;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

function kindBadge(kind: Txn["kind"]) {
  switch (kind) {
    case "payment":
      return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Payment</Badge>;
    case "refund":
      return <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Refund</Badge>;
    case "withdrawal":
      return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">Withdrawal</Badge>;
    default:
      return <Badge className="bg-gray-500/10 text-gray-400 border-gray-500/20">Other</Badge>;
  }
}

const WINDOWS = [
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "12mo", days: 365 },
];

export function PayPalFinance() {
  const [days, setDays] = useState(365);
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("omni_token") : null;
      const res = await fetch(`/api/admin/paypal-finance?days=${days}`, {
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e: any) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-red-500/5 border-red-500/20">
        <CardContent className="p-6 flex items-center gap-3 text-red-400">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-medium">Could not load finance data</p>
            <p className="text-sm text-red-400/80 mt-1">{error}</p>
          </div>
          <Button size="sm" variant="outline" className="ml-auto border-red-500/30 text-red-300" onClick={load}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const s = data.summary;
  const maxMonthly = Math.max(1, ...data.monthly.map((m) => m.amount));

  return (
    <div className="space-y-6 p-6 sm:p-8 bg-white/[0.02] border border-white/10 rounded-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            PayPal Finance
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Last sync:{" "}
            {data.last_sync?.started_at
              ? new Date(data.last_sync.started_at).toLocaleString()
              : "never"}{" "}
            •{" "}
            <span className={data.last_sync?.status === "ok" ? "text-emerald-400" : "text-red-400"}>
              {data.last_sync?.status || "unknown"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <div className="flex bg-white/5 border border-white/10 rounded-lg p-1 gap-1">
            {WINDOWS.map((w) => (
              <button
                key={w.label}
                onClick={() => setDays(w.days)}
                className={`px-3 py-1 text-xs rounded-md transition ${
                  days === w.days ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" className="border-white/10 text-gray-400 h-8" onClick={load}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 sm:gap-5">
        <SummaryCard
          label="Gross Revenue"
          value={fmt(s.gross_revenue)}
          icon={TrendingUp}
          color="text-emerald-400"
          bg="bg-emerald-500/10"
          sub={`${s.payment_count} payment${s.payment_count === 1 ? "" : "s"}`}
        />
        <SummaryCard
          label="Net Revenue"
          value={fmt(s.net_revenue)}
          icon={Banknote}
          color="text-white"
          bg="bg-gradient-to-br from-purple-500/20 to-blue-500/20"
          sub="after fees & refunds"
        />
        <SummaryCard
          label="PayPal Fees"
          value={fmt(s.fees)}
          icon={Receipt}
          color="text-yellow-400"
          bg="bg-yellow-500/10"
        />
        <SummaryCard
          label="Refunds"
          value={fmt(s.refunds)}
          icon={TrendingDown}
          color="text-red-400"
          bg="bg-red-500/10"
        />
        <SummaryCard
          label="To Bank"
          value={fmt(s.bank_withdrawals)}
          icon={ArrowDownRight}
          color="text-blue-400"
          bg="bg-blue-500/10"
          sub="withdrawals"
        />
      </div>

      {/* Monthly + Top payers */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" /> Revenue by Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.monthly.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No payments in this window.</p>
            ) : (
              <div className="space-y-2">
                {data.monthly.map((m) => (
                  <div key={m.month} className="flex items-center gap-3">
                    <div className="w-16 text-xs text-gray-400 font-mono">{m.month}</div>
                    <div className="flex-1 h-6 bg-white/5 rounded overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500/60 to-emerald-400/40 rounded"
                        style={{ width: `${(m.amount / maxMonthly) * 100}%` }}
                      />
                    </div>
                    <div className="w-24 text-right text-sm text-white font-medium">{fmt(m.amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" /> Top Payers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.top_payers.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No payers yet.</p>
            ) : (
              <div className="space-y-2">
                {data.top_payers.map((p) => (
                  <div key={p.email} className="flex items-center justify-between gap-3 py-1.5 border-b border-white/5 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{p.name || p.email}</p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {p.email} • {p.count} payment{p.count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="text-sm font-semibold text-emerald-400">{fmt(p.total)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transactions */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-white flex items-center gap-2">
            <Receipt className="w-4 h-4 text-gray-400" /> Transactions ({data.transactions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {data.transactions.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No transactions in this window.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500 border-b border-white/10">
                    <th className="py-2 pr-4 font-medium">Date</th>
                    <th className="py-2 pr-4 font-medium">Type</th>
                    <th className="py-2 pr-4 font-medium">Payer</th>
                    <th className="py-2 pr-4 font-medium text-right">Amount</th>
                    <th className="py-2 pr-4 font-medium text-right">Fee</th>
                    <th className="py-2 pr-4 font-medium text-right">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transactions.map((t) => {
                    const amt = Number(t.transaction_amount || 0);
                    const fee = Number(t.fee_amount || 0);
                    const net = Number(t.net_amount || 0);
                    return (
                      <tr key={t.paypal_txn_id} className="border-b border-white/5 last:border-0">
                        <td className="py-2 pr-4 text-gray-300 whitespace-nowrap">{fmtDate(t.transaction_initiation_date)}</td>
                        <td className="py-2 pr-4">{kindBadge(t.kind)}</td>
                        <td className="py-2 pr-4 text-gray-300 max-w-[200px] truncate">
                          {t.payer_name || t.payer_email || <span className="text-gray-600">—</span>}
                        </td>
                        <td className={`py-2 pr-4 text-right font-mono ${amt >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {amt >= 0 ? <ArrowUpRight className="inline w-3 h-3 mr-1" /> : <ArrowDownRight className="inline w-3 h-3 mr-1" />}
                          {fmt(amt)}
                        </td>
                        <td className="py-2 pr-4 text-right font-mono text-gray-400">
                          {fee !== 0 ? fmt(fee) : "—"}
                        </td>
                        <td className="py-2 pr-4 text-right font-mono text-white">
                          {net !== 0 ? fmt(net) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
  sub,
}: {
  label: string;
  value: string;
  icon: any;
  color: string;
  bg: string;
  sub?: string;
}) {
  return (
    <Card className="bg-white/5 border-white/10">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={`p-1.5 rounded-lg ${bg}`}>
            <Icon className={`w-3.5 h-3.5 ${color}`} />
          </div>
          <p className="text-[11px] uppercase tracking-wider text-gray-500">{label}</p>
        </div>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
        {sub && <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}
