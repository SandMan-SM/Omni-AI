import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "$MAFI Command Center — Omni AI",
  description: "Synthetic Intelligence Command Center. Live agent control, deployment tracking, visual error detection.",
  robots: { index: false, follow: false },
};

export default function CommandCenterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
