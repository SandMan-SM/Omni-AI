import { ImageResponse } from "next/og";

export const runtime = "edge";

const size = { width: 1200, height: 630 };

function hashSlug(slug: string): number {
  let hash = 2166136261;
  for (let index = 0; index < slug.length; index += 1) {
    hash ^= slug.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function GET(
  _request: Request,
  { params }: { params: { slug: string } }
) {
  const hash = hashSlug(params.slug);
  const rotation = hash % 360;
  const orbX = 90 + (hash % 720);
  const orbY = 80 + ((hash >>> 8) % 360);
  const secondX = 420 + ((hash >>> 12) % 620);
  const secondY = 120 + ((hash >>> 18) % 360);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        background: `linear-gradient(${rotation}deg, #03030b 0%, #171044 46%, #38106b 72%, #09050f 100%)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: `${orbX}px`,
          top: `${orbY}px`,
          width: "360px",
          height: "360px",
          borderRadius: "999px",
          background:
            "radial-gradient(circle, rgba(168,85,247,0.92) 0%, rgba(99,102,241,0.34) 48%, rgba(0,0,0,0) 72%)",
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: `${secondX}px`,
          top: `${secondY}px`,
          width: "460px",
          height: "460px",
          borderRadius: "999px",
          background:
            "radial-gradient(circle, rgba(245,158,11,0.62) 0%, rgba(124,58,237,0.30) 44%, rgba(0,0,0,0) 72%)",
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: "46px",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "54px",
          transform: `rotate(${(hash % 11) - 5}deg)`,
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "-160px",
          right: "-160px",
          top: "274px",
          height: "2px",
          transform: `rotate(${(hash % 19) - 9}deg)`,
          background:
            "linear-gradient(90deg, rgba(0,0,0,0), rgba(196,181,253,0.86), rgba(245,158,11,0.68), rgba(0,0,0,0))",
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.10) 56%, rgba(0,0,0,0.54) 100%)",
          display: "flex",
        }}
      />
    </div>,
    size
  );
}
