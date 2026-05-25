"use client";

// DelHassonInfoClient — thin wrapper around the shared
// SponsorInfoClient with Del's specific props plugged in.
// All §1–§8 markup + savings chart + LB/Alira proof cards live
// in app/sponsor/_components/SponsorInfoClient.tsx so the same
// component renders for every sponsor's /info surface.

import { SponsorInfoClient } from "../../_components/SponsorInfoClient";

type Props = {
  pageUrl: string;
};

export function DelHassonInfoClient({ pageUrl }: Props) {
  return (
    <SponsorInfoClient
      pageUrl={pageUrl}
      sponsorName="Del Hasson"
      sponsorFirstName="Del"
      brandHook="Hasson Enterprises"
      signEndpoint="/api/sponsor/delhasson/sign"
      teaserHref="/sponsor/delhasson"
      sitaniSignedDate="May 22, 2026"
    />
  );
}
