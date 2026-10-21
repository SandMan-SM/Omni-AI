import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  path: "/club-obsidian/text",
  title: "Opening Your Text Message | Club Obsidian",
  description: "Club Obsidian invite link opened from a text message. Private share link — not indexed by search engines.",
  noindex: true,
  imageTitle: "Opening Your Text Message",
  imageTopic: "Club Obsidian invite link",
  imageEyebrow: "Club Obsidian",
});

export default function ClubObsidianTextLayout({ children }: { children: ReactNode }) {
  return children;
}
