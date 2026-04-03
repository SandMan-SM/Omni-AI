import { z } from 'zod';

// ── Server-side Environment Variables ─────────────────────────────────────
// Validated lazily on first access to avoid issues during build/SSG.

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_ADMIN_CHAT_ID: z.string().min(1),
  // Optional with defaults
  DEPLOY_NOTIFY_SECRET: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  NEWSLETTER_FROM_EMAIL: z.string().default('Omni AI <newsletter@omnileadsagi.com>'),
  NEWSLETTER_TO_EMAIL: z.string().default('sitanim8@gmail.com'),
  NEXT_PUBLIC_SITE_URL: z.string().default('https://omnileadsagi.com'),
  NEWSLETTER_DEV_MODE: z.string().optional(),
});

// ── Public (client-safe) Environment Variables ────────────────────────────

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().default('https://omnileadsagi.com'),
});

// ── Lazy-validated accessors ──────────────────────────────────────────────

let _serverEnv: z.infer<typeof serverSchema> | null = null;
let _publicEnv: z.infer<typeof publicSchema> | null = null;

/**
 * Server-side env vars — validated on first call.
 * Only use in API routes, server components, and server actions.
 */
export function serverEnv() {
  if (!_serverEnv) {
    const result = serverSchema.safeParse(process.env);
    if (!result.success) {
      const missing = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
      throw new Error(`Missing or invalid environment variables:\n${missing}`);
    }
    _serverEnv = result.data;
  }
  return _serverEnv;
}

/**
 * Public env vars — safe to use in client components.
 * Validated on first call.
 */
export function publicEnv() {
  if (!_publicEnv) {
    const result = publicSchema.safeParse(process.env);
    if (!result.success) {
      const missing = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
      throw new Error(`Missing or invalid public environment variables:\n${missing}`);
    }
    _publicEnv = result.data;
  }
  return _publicEnv;
}
