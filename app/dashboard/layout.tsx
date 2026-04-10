import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — Your AI Command Center | Omni AI",
  description: "Access your Omni AI member dashboard. Track campaigns, view AI agent performance, and manage your account.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
