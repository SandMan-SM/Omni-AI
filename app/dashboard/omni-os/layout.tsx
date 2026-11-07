import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Omni OS — AI CEO Control Plane | Omni AI",
  robots: { index: false, follow: false },
};

export default function OmniOSLayout({ children }: { children: React.ReactNode }) {
  return children;
}
