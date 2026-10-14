import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import type { Pool } from "pg";

const secret = "isolated-repeat-regression-secret";
Object.assign(process.env, {
  NODE_ENV: "development", IX_OMNI_LOCAL_BRIDGE: "1", IX_LOCAL_SOURCE_SECRET: secret,
  IX_OWNER_EMAIL: "owner@invalid.example", RESEND_API_KEY: "isolated-fixture-key",
  OMNI_UNSUB_SECRET: "isolated-fixture-signing-secret",
  POSTGRES_URL: "postgresql://fixture:fixture@database.invalid:5432/fixture",
});

let sequence = 0;
type Scenario = {
  suppression?: string | null;
  workspaceMissing?: boolean;
  missingReceipt?: boolean;
  analyticsCount?: number;
  dashboardCount?: number;
  mirrorThrows?: boolean;
  concurrentUnsubscribe?: boolean;
  commit?: () => Promise<void>;
};

async function scenario(options: Scenario = {}) {
  const { ixSignupPost } = await import("../lib/server/ix-network-signup");
  const email = `repeat-${++sequence}@invalid.example`;
  const row = {
    id: "00000000-0000-4000-8000-000000000001", email, first_name: "Existing Name",
    source: "luxurybran", subscription_state: options.concurrentUnsubscribe ? "pending" : "active",
    consent_epoch: "00000000-0000-4000-8000-000000000002", unsubscribe_token_expires_at: 1900000000,
    welcome_status: "accepted", owner_status: "accepted", welcome_message_id: "original-welcome",
    owner_message_id: options.missingReceipt ? null : "original-owner",
    welcome_idempotency_key: "stable-welcome-key", owner_idempotency_key: "stable-owner-key",
  };
  const state = { queries: [] as string[], commits: 0, rollbacks: 0, releases: 0, connections: 0, completions: 0, committed: false };
  const client = {
    async query(text: string) {
      const sql = text.replace(/\s+/g, " ").trim(); state.queries.push(sql);
      if (sql === "begin") return { rows: [], rowCount: null };
      if (sql === "commit") { await options.commit?.(); state.commits++; state.committed = true; return { rows: [], rowCount: null }; }
      if (sql === "rollback") { state.rollbacks++; return { rows: [], rowCount: null }; }
      if (sql.includes("pg_advisory_xact_lock")) return { rows: [{}], rowCount: 1 };
      if (sql.includes("as business_id") && sql.includes("newsletter_suppression_status")) return { rows: [{ business_id: options.workspaceMissing ? null : "workspace", status: options.suppression === undefined ? "clear" : options.suppression }], rowCount: 1 };
      if (sql.startsWith("select consent_epoch")) return { rows: [{ ...row, subscription_state: "unsubscribed", consent_epoch: "rotated-epoch" }], rowCount: 1 };
      if (sql.startsWith("select") && sql.includes("from public.federation_newsletter_subscribers")) return { rows: [{ ...row }], rowCount: 1 };
      if (sql.startsWith("update public.federation_newsletter_subscribers")) return { rows: [{ ...row }], rowCount: 1 };
      if (sql.startsWith("insert into analytics.leads")) return { rows: [{ id: "existing-analytics" }], rowCount: 1 };
      if (sql.startsWith("update public.omni_leads_generated as target")) return { rows: [{ id: "existing-dashboard" }], rowCount: 1 };
      if (sql.startsWith("with analytics_updated")) {
        state.completions++;
        if (options.mirrorThrows) throw new Error("synthetic mirror database failure");
        return { rows: [{ analytics_count: options.analyticsCount ?? 1, dashboard_count: options.dashboardCount ?? 1 }], rowCount: 1 };
      }
      throw new Error(`Unexpected SQL in no-network regression: ${sql.slice(0, 100)}`);
    },
    release() { state.releases++; },
  };
  const pool = {
    async connect() { state.connections++; return client; },
    async query(text: string) {
      assert.ok(options.concurrentUnsubscribe, "Active repeats must finish in their existing transaction");
      assert.match(text, /from public\.federation_newsletter_subscribers/);
      return { rows: [{ ...row, subscription_state: "active" }], rowCount: 1 };
    },
  };
  const previousPool = globalThis.__ixFormsPgPool;
  const previousFetch = globalThis.fetch;
  globalThis.__ixFormsPgPool = pool as unknown as Pool;
  globalThis.fetch = async () => { throw new Error("Network forbidden: accepted repeat must not send again"); };
  const key = `ix-waitlist-${createHash("sha256").update(`theixnetwork|waitlist|${email}`).digest("hex").slice(0, 40)}`;
  const req = new Request("http://127.0.0.1:3002/api/inbound/theixnetwork/forms", {
    method: "POST", headers: { "content-type": "application/json", "x-ix-local-source": secret, "idempotency-key": key },
    body: JSON.stringify({ site: "theixnetwork", source: "luxurybran", email, kind: "waitlist", mode: "submit", consent: true, idempotency_key: key }),
  });
  const operation = ixSignupPost(req).finally(() => { globalThis.__ixFormsPgPool = previousPool; globalThis.fetch = previousFetch; });
  return { operation, state };
}

test("accepted repeats finish both mirrors in one locked transaction without another send", async () => {
  const { operation, state } = await scenario(); const response = await operation;
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.completion, "already_subscribed");
  assert.equal(result.workflow_complete, true);
  assert.equal(state.connections, 1); assert.equal(state.commits, 1); assert.equal(state.rollbacks, 0);
  assert.equal(state.releases, 1); assert.equal(state.completions, 1);
  assert.ok(state.queries.findIndex((q) => q.includes("for update")) < state.queries.findIndex((q) => q.startsWith("with analytics_updated")));
});

test("repeat success waits for commit rather than only successful mirror statements", async () => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  const { operation, state } = await scenario({ commit: () => pending });
  let settled = false; void operation.then(() => { settled = true; });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(state.completions, 1); assert.equal(state.committed, false); assert.equal(settled, false);
  release(); assert.equal((await operation).status, 200); assert.equal(state.committed, true);
});

test("missing mirror receipts or database failure roll back the entire repeat", async () => {
  for (const options of [{ analyticsCount: 0 }, { analyticsCount: 2 }, { dashboardCount: 0 }, { mirrorThrows: true }, { missingReceipt: true }]) {
    const { operation, state } = await scenario(options); const response = await operation;
    assert.equal(response.status, 503); assert.equal((await response.json()).workflow_complete, false);
    assert.equal(state.commits, 0); assert.equal(state.rollbacks, 1); assert.equal(state.releases, 1);
  }
});

test("fresh suppression and workspace validation still fail closed before mirror updates", async () => {
  for (const suppression of ["global", "protected", "error", "unexpected", null]) {
    const { operation, state } = await scenario({ suppression }); const response = await operation;
    assert.equal(response.status, suppression === "global" || suppression === "protected" ? 409 : 503);
    assert.equal((await response.json()).workflow_complete, false);
    assert.equal(state.completions, 0); assert.equal(state.commits, 0); assert.equal(state.rollbacks, 1);
  }
  const { operation, state } = await scenario({ workspaceMissing: true });
  assert.equal((await operation).status, 503); assert.equal(state.completions, 0); assert.equal(state.rollbacks, 1);
});

test("concurrent completion retains fresh epoch lock and rejects an intervening unsubscribe", async () => {
  const { operation, state } = await scenario({ concurrentUnsubscribe: true }); const response = await operation;
  assert.equal(response.status, 503); assert.equal((await response.json()).error, "subscription_completion_stale");
  assert.equal(state.connections, 2); assert.equal(state.commits, 1); assert.equal(state.rollbacks, 1);
  assert.equal(state.completions, 0); assert.equal(state.releases, 2);
});
