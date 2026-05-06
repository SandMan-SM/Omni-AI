// Twitter card — same design as opengraph-image. Next 14's static
// analyzer requires `runtime` etc. to be string-literal exports in
// THIS file, not re-exported from another module. So we declare them
// inline + thinly wrap the OG generator's default export.

import OG from "./opengraph-image";

export const runtime = "edge";
export const alt =
  "Omni AI Portfolio Promotion System — One sponsor, every site, real attribution.";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

export default async function Image() {
  return OG();
}
