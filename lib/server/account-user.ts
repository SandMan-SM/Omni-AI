import { createServerClient } from "@supabase/ssr";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  decodeOmniToken,
  isOmniTokenPayloadFresh,
  type OmniTokenPayload,
} from "@/lib/omni-token";

export type AccountUser = {
  id: string;
  email: string | null;
  username: string | null;
  name: string | null;
  source: "omni-token" | "supabase";
};

type ProfileRow = {
  id: string;
  email: string | null;
  username: string | null;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
};

function tokenString(payload: OmniTokenPayload, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function metadataString(
  metadata: SupabaseUser["user_metadata"],
  key: string,
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function fullNameFromProfile(profile: ProfileRow | null): string | null {
  if (!profile) return null;
  if (profile.name?.trim()) return profile.name.trim();
  const combined = [profile.first_name, profile.last_name]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ")
    .trim();
  return combined || null;
}

function displayNameFromSupabaseUser(user: SupabaseUser): string | null {
  return (
    metadataString(user.user_metadata, "full_name") ||
    metadataString(user.user_metadata, "name") ||
    metadataString(user.user_metadata, "display_name")
  );
}

function usernameFromEmail(email: string | null | undefined): string | null {
  const localPart = email?.split("@")[0]?.trim();
  return localPart || null;
}

async function findProfile(userId: string): Promise<ProfileRow | null> {
  try {
    const sb = createAdminClient();
    const { data } = await sb
      .from("profiles")
      .select("id, email, username, name, first_name, last_name")
      .eq("id", userId)
      .maybeSingle();
    return (data as ProfileRow | null) || null;
  } catch {
    return null;
  }
}

async function ensureSupabaseProfile(user: SupabaseUser) {
  try {
    const sb = createAdminClient();
    const email = user.email || null;
    const displayName = displayNameFromSupabaseUser(user);
    await sb.from("profiles").upsert(
      {
        id: user.id,
        email,
        username: `oauth_${user.id.slice(0, 8)}`,
        name: displayName,
        role: "user",
        is_admin: false,
        is_sponsor: false,
        tier: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  } catch {
    // Credit claims can still be bound to the Supabase user id even if the
    // legacy profile table is temporarily unavailable or has stricter columns.
  }
}

async function resolveBearerUser(req: Request): Promise<AccountUser | null> {
  const bearer = (req.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!bearer) return null;

  const payload = decodeOmniToken(bearer);
  if (!isOmniTokenPayloadFresh(payload)) return null;

  const profile = await findProfile(payload.sub);
  const email = profile?.email || tokenString(payload, "email");
  const username = profile?.username || tokenString(payload, "username");
  const name =
    fullNameFromProfile(profile) ||
    tokenString(payload, "name") ||
    tokenString(payload, "full_name") ||
    username ||
    usernameFromEmail(email);

  return {
    id: payload.sub,
    email,
    username,
    name,
    source: "omni-token",
  };
}

async function resolveSupabaseCookieUser(): Promise<AccountUser | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // Read-only in route handlers.
          },
        },
      },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const profile = await findProfile(user.id);
    if (!profile) await ensureSupabaseProfile(user);

    const email = profile?.email || user.email || null;
    const name =
      fullNameFromProfile(profile) ||
      displayNameFromSupabaseUser(user) ||
      usernameFromEmail(email);
    const username =
      profile?.username ||
      metadataString(user.user_metadata, "user_name") ||
      metadataString(user.user_metadata, "preferred_username") ||
      usernameFromEmail(email);

    return {
      id: user.id,
      email,
      username,
      name,
      source: "supabase",
    };
  } catch {
    return null;
  }
}

export async function resolveAccountUser(
  req: Request,
): Promise<AccountUser | null> {
  return (await resolveBearerUser(req)) || (await resolveSupabaseCookieUser());
}
