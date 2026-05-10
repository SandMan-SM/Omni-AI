// Inline X (formerly Twitter) brand mark. Lucide-react ships a Twitter
// bird icon but not the new X logo, and post-rebrand the bird looks
// dated next to native share / LinkedIn / Facebook icons. This is X's
// canonical wordmark glyph drawn as a single <path> so it scales like
// any other lucide icon and inherits color via currentColor.

import type { SVGProps } from "react";

export function XIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
