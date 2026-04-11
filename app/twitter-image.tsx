import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "Omni AI — Autonomous Lead Generation & AI Business Automation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Re-export the same design for Twitter cards
export { default } from "./opengraph-image";
