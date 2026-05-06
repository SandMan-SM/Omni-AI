// Twitter card — same design as opengraph-image. Next 14 picks this
// up by file convention; we re-export the OG image generator so the
// two stay in lockstep without a parallel implementation drifting.

export {
  default,
  runtime,
  alt,
  contentType,
  size,
} from "./opengraph-image";
