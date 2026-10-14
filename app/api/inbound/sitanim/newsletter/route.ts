import { sitanimNewsletterHealth, sitanimNewsletterPost } from "@/lib/server/sitanim-newsletter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;
export const GET = sitanimNewsletterHealth;
export const POST = sitanimNewsletterPost;
