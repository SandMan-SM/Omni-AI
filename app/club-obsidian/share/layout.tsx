import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  path: "/club-obsidian/share",
  title: "Invite a Friend | Club Obsidian",
  description: "Share your Club Obsidian invite and move up the referral queue. Private invite link — not indexed by search engines.",
  noindex: true,
  imageTitle: "Invite a Friend",
  imageTopic: "Club Obsidian referral invite",
  imageEyebrow: "Club Obsidian",
});

export default function ClubObsidianShareLayout({ children }: { children: ReactNode }) {
  return children;
}
