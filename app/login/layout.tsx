import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  path: "/login",
  title: "Sign In | Omni AI — Operator Access",
  description: "Sign in to Omni AI. Operator access to the agentic dashboard: leads, campaigns, agent runs, and client reporting.",
  keywords: [
    "Omni AI sign in",
    "Omni AI login",
    "AI operator dashboard",
  ],
  noindex: true,
  imageTitle: "Sign In",
  imageTopic: "Operator access to the Omni AI dashboard",
  imageEyebrow: "Omni AI · Access",
});

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
