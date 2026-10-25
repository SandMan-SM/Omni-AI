import { mafiPartnerHealth, mafiPartnerPost } from '@/lib/server/mafiempire-partner-intake';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;
export const GET = mafiPartnerHealth;
export const POST = mafiPartnerPost;
