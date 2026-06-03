export const DOCUMENT_SIGNATURE_CREDIT = 10;

export const DOCUMENT_SIGNATURES = {
  "omni-program": {
    slug: "omni-program",
    title: "The Omni Program",
    path: "/dashboard",
  },
  oracle: {
    slug: "oracle",
    title: "The Oracle",
    path: "/oracle",
  },
  manifesto: {
    slug: "manifesto",
    title: "Interlinked Manifesto",
    path: "/manifesto",
  },
} as const;

export type DocumentSignatureSlug = keyof typeof DOCUMENT_SIGNATURES;

export type DocumentSignatureDefinition =
  (typeof DOCUMENT_SIGNATURES)[DocumentSignatureSlug];

export function normalizeDocumentSignatureSlug(
  value: unknown,
): DocumentSignatureSlug | null {
  if (typeof value !== "string") return null;
  const slug = value.trim().toLowerCase();
  return slug in DOCUMENT_SIGNATURES ? (slug as DocumentSignatureSlug) : null;
}

export function getDocumentSignatureDefinition(
  value: unknown,
): DocumentSignatureDefinition | null {
  const slug = normalizeDocumentSignatureSlug(value);
  return slug ? DOCUMENT_SIGNATURES[slug] : null;
}
