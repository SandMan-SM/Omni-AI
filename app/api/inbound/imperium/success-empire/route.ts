import { imperiumApplicationHealth, imperiumApplicationPost } from '@/lib/server/imperium-success-empire-intake';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;
export const GET = imperiumApplicationHealth;
export const POST = imperiumApplicationPost;
