import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new pg.Pool({
  connectionString: 'postgresql://postgres:N3ukKz4A2k%2CC%23TV@db.odvxtychuxxsudfpcqqs.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const migrations = [
  '015_create_missing_tables.sql',
  '016_events_table.sql',
  '017_revenue_pipeline.sql',
  '018_intelligence_loop.sql',
  '019_metrics_and_cleanup.sql',
];

async function run() {
  const client = await pool.connect();

  for (const file of migrations) {
    const filePath = path.join(__dirname, '..', 'supabase', 'migrations', file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Running: ${file}`);
    console.log('='.repeat(60));

    try {
      await client.query(sql);
      console.log(`✅ ${file} — SUCCESS`);
    } catch (err) {
      console.error(`❌ ${file} — FAILED: ${err.message}`);
      // Try to continue with remaining statements if one fails
      // Split by semicolons and run individually
      console.log('  Retrying statement-by-statement...');
      const statements = sql.split(/;\s*\n/).filter(s => s.trim().length > 5);
      let passed = 0, failed = 0;
      for (const stmt of statements) {
        try {
          await client.query(stmt);
          passed++;
        } catch (e2) {
          // Skip "already exists" type errors
          if (e2.message.includes('already exists') || e2.message.includes('duplicate')) {
            passed++;
          } else {
            console.error(`  ⚠️  ${e2.message.slice(0, 120)}`);
            failed++;
          }
        }
      }
      console.log(`  ${passed} passed, ${failed} failed`);
    }
  }

  // Verification queries
  console.log(`\n${'='.repeat(60)}`);
  console.log('VERIFICATION');
  console.log('='.repeat(60));

  const checks = [
    { name: 'newsletter_subscriptions', q: "SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_name = 'newsletter_subscriptions' AND table_schema = 'public'" },
    { name: 'demo_bookings', q: "SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_name = 'demo_bookings' AND table_schema = 'public'" },
    { name: 'webinar_registrations', q: "SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_name = 'webinar_registrations' AND table_schema = 'public'" },
    { name: 'events', q: "SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_name = 'events' AND table_schema = 'public'" },
    { name: 'deals', q: "SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_name = 'deals' AND table_schema = 'public'" },
    { name: 'transactions', q: "SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_name = 'transactions' AND table_schema = 'public'" },
    { name: 'campaign_metrics', q: "SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_name = 'campaign_metrics' AND table_schema = 'public'" },
    { name: 'outcomes', q: "SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_name = 'outcomes' AND table_schema = 'public'" },
    { name: 'ai_decisions', q: "SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_name = 'ai_decisions' AND table_schema = 'public'" },
    { name: 'ai_learnings', q: "SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_name = 'ai_learnings' AND table_schema = 'public'" },
    { name: 'v_mrr (view)', q: "SELECT COUNT(*) AS cnt FROM information_schema.views WHERE table_name = 'v_mrr' AND table_schema = 'public'" },
    { name: 'v_pipeline (view)', q: "SELECT COUNT(*) AS cnt FROM information_schema.views WHERE table_name = 'v_pipeline' AND table_schema = 'public'" },
    { name: 'v_client_revenue (view)', q: "SELECT COUNT(*) AS cnt FROM information_schema.views WHERE table_name = 'v_client_revenue' AND table_schema = 'public'" },
    { name: 'mv_dashboard_metrics', q: "SELECT COUNT(*) AS cnt FROM pg_matviews WHERE matviewname = 'mv_dashboard_metrics' AND schemaname = 'public'" },
    { name: 'total indexes added', q: "SELECT COUNT(*) AS cnt FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%'" },
  ];

  for (const { name, q } of checks) {
    try {
      const { rows } = await client.query(q);
      const exists = rows[0]?.cnt > 0;
      console.log(`${exists ? '✅' : '❌'} ${name}: ${rows[0]?.cnt}`);
    } catch (e) {
      console.log(`❌ ${name}: ${e.message.slice(0, 80)}`);
    }
  }

  // Count total tables
  try {
    const { rows } = await client.query("SELECT COUNT(*) AS cnt FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'");
    console.log(`\n📊 Total tables: ${rows[0]?.cnt}`);
  } catch (e) {}

  client.release();
  await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
