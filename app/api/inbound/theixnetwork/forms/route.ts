import { ixSignupHealth, ixSignupPost } from "@/lib/server/ix-network-signup";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;
export const GET = ixSignupHealth;
export const POST = ixSignupPost;
