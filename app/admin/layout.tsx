import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin — Omni AI Dashboard",
  description: "Omni AI admin control panel. Manage users, campaigns, newsletter, and system operations.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
