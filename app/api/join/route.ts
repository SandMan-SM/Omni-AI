import { authorizeCronOrAdmin } from '@/lib/api-auth';
import { handleJoin, joinReadiness } from '@/lib/server/join-intake';

export const dynamic = 'force-dynamic';

// Authenticated operator preflight: reads the real database and sender API only.
export async function GET(request: Request) {
  const denied = await authorizeCronOrAdmin(request);
  if (denied) return denied;
  return joinReadiness();
}

export async function POST(request: Request) {
  return handleJoin(request);
}
