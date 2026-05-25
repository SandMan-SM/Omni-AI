"use client";

// DelHassonClient — thin wrapper around the shared
// SponsorTeaserClient with Del's specific props plugged in.
// All teaser markup lives in app/sponsor/_components/
// SponsorTeaserClient.tsx so the same component renders for
// every sponsor's teaser surface (Del, Debbie, Landon, Blake,
// Joshua, James, Setefano, Supileo, Nele).

import { SponsorTeaserClient } from "../_components/SponsorTeaserClient";

type Props = {
  pageUrl: string;
};

export function DelHassonClient({ pageUrl }: Props) {
  return (
    <SponsorTeaserClient
      pageUrl={pageUrl}
      sponsorName="Del Hasson"
      brandHook="Hasson Enterprises"
      signEndpoint="/api/sponsor/delhasson/sign"
      infoHref="/sponsor/delhasson/info"
      sitaniSignedDate="May 22, 2026"
    />
  );
}
