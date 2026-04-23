import type { Metadata } from "next";

// /interlinked/premium is the conversion page for the paid tier of the
// Interlinked newsletter (featured placement, private operator channel,
// priority access, 1:1 consultations). Parent /interlinked already has
// metadata, but a child segment without its own export inherits the
// parent's title verbatim — which tanks CTR from SERPs and from social
// share cards since the headline doesn't describe *this* page.
//
// Canonical is distinct from the parent (/interlinked/premium vs
// /interlinked) so Google doesn't collapse them in the index.
export const metadata: Metadata = {
  title:
    "Interlinked Premium — Featured Placement + Private Operator Access | Omni AI",
  description:
    "Upgrade to Interlinked Premium: featured placement across editions, the private Omni AI operator network, priority on new agents and tooling, and 1-on-1 strategy consultations.",
  keywords: [
    "Interlinked Premium",
    "premium AI newsletter",
    "private AI operator network",
    "AI strategy consultations",
    "Omni AI premium",
    "featured placement AI newsletter",
  ],
  alternates: { canonical: "https://omnileadsagi.com/interlinked/premium" },
  openGraph: {
    title:
      "Interlinked Premium — Featured Placement + Private Operator Access",
    description:
      "Upgrade to the paid tier: featured placement, private operator network, priority access, and 1:1 strategy consultations with the Omni AI team.",
    url: "https://omnileadsagi.com/interlinked/premium",
    siteName: "Omni AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Interlinked Premium | Omni AI",
    description:
      "Featured placement, private operator network, priority access, and 1:1 strategy consultations.",
  },
};

export default function InterlinkedPremiumLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
