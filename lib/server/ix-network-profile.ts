export type IxProfile = {
  fullName: string;
  phone: string;
  artistName: string;
  notes: string;
};

type ProfileResult = { ok: true; profile: Partial<IxProfile> | null } | { ok: false; error: string };
const singleLineControls = /[\u0000-\u001f\u007f]/;
const notesControls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/** Version 2 is set by the trusted caller. Older email-only callers omit it. */
export function parseIxProfile(body: Record<string, unknown>): ProfileResult {
  if (body.intakeVersion === undefined || body.intakeVersion === 1) return { ok: true, profile: null };
  if (body.intakeVersion !== 2) return { ok: false, error: "invalid_intake_version" };
  if (body.fullName === undefined || body.fullName === "" || (typeof body.fullName === "string" && !body.fullName.trim())) {
    return { ok: false, error: "full_name_required" };
  }
  if (typeof body.fullName !== "string" || body.fullName.trim().length > 120 || singleLineControls.test(body.fullName)) {
    return { ok: false, error: "invalid_full_name" };
  }
  const profile: Partial<IxProfile> = { fullName: body.fullName.trim() };
  for (const key of ["phone", "artistName", "notes"] as const) {
    if (body[key] === undefined) continue;
    const value = body[key];
    const error = key === "artistName" ? "invalid_artist_name" : `invalid_${key}`;
    if (typeof value !== "string") return { ok: false, error };
    const trimmed = value.trim();
    if (key === "phone") {
      if (value.length > 40 || singleLineControls.test(value) || /[^+0-9 ().-]/.test(trimmed) || (trimmed.includes("+") && !/^\+[^+]*$/.test(trimmed))) {
        return { ok: false, error };
      }
      const digits = trimmed.replace(/\D/g, "");
      if (trimmed && (digits.length < 7 || digits.length > 15)) return { ok: false, error };
      profile.phone = `${trimmed.startsWith("+") ? "+" : ""}${digits}`;
    } else {
      if (trimmed.length > (key === "notes" ? 2000 : 120) || (key === "notes" ? notesControls : singleLineControls).test(value)) {
        return { ok: false, error };
      }
      profile[key] = trimmed;
    }
  }
  return { ok: true, profile };
}

export function mergeIxProfile(saved: IxProfile | null, incoming: Partial<IxProfile> | null): IxProfile | null {
  if (!incoming) return saved;
  return { fullName: "", phone: "", artistName: "", notes: "", ...saved, ...incoming };
}

export function readIxProfile(value: unknown): IxProfile | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (["fullName", "phone", "artistName", "notes"].some((key) => typeof (value as Record<string, unknown>)[key] !== "string")) return null;
  const result = parseIxProfile({ ...value, intakeVersion: 2 });
  return result.ok && result.profile ? mergeIxProfile(null, result.profile) : null;
}

export function ixProfileNameParts(fullName: string): { firstName: string; lastName: string | null } {
  const parts = fullName.split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || "Subscriber", lastName: parts.slice(1).join(" ") || null };
}

export function ixProfileNote(profile: IxProfile): string {
  return ["The IX Network profile", `Full name: ${profile.fullName}`, `Phone: ${profile.phone || "Not provided"}`,
    `Artist name: ${profile.artistName || "Not provided"}`, `Notes: ${profile.notes || "Not provided"}`].join("\n");
}
