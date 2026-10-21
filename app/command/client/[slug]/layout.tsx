import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const slug = decodeURIComponent(params.slug);
  return buildMetadata({
    path: `/command/client/${slug}`,
    title: "Client Command View | Omni AI",
    description: "Per-client command view in the Omni AI Synthetic Intelligence Command Center — live agent runs, open risks, and deployment state.",
    noindex: true,
    imageTitle: "Client Command View",
    imageTopic: "Live agent runs, open risks, and deployment state",
    imageEyebrow: "Omni AI · Command",
  });
}

export default function CommandClientSlugLayout({ children }: { children: ReactNode }) {
  return children;
}
