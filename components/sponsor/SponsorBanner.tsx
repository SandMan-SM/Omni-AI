// Generic cross-portfolio newsletter banners are retired. Preserve the
// component API so existing articles render without a promotion placement.
export function SponsorBanner(_props: {
  slug: string;
  seed?: string;
  className?: string;
}) {
  return null;
}
