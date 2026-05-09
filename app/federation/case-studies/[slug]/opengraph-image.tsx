import { ImageResponse } from "next/og";
import { getCaseStudy } from "@/lib/case-studies";

export const runtime = "edge";
export const alt = "Federation case study · Omni AI";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = getCaseStudy(slug);
  const brand = c?.brand ?? "Federation case study";
  const tagline = c?.tagline ?? "Build & pricing case study.";
  const tier = c?.marketTierLabel ?? "Federation node";
  const range = c?.buildPriceRange ?? "—";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          color: "#e7eaf5",
          background: "linear-gradient(120deg, #02030a 0%, #0c0e1a 50%, #02030a 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", width: 14, height: 14, borderRadius: 999, background: "#fbbf24" }} />
          <div style={{ display: "flex", fontSize: 22, letterSpacing: 8, textTransform: "uppercase", color: "#fbbf24" }}>
            Infrastructure · Development · Case Study
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 80, lineHeight: 1.05, fontWeight: 700, letterSpacing: -2, color: "#ffffff" }}>
            {brand}
          </div>
          <div style={{ display: "flex", fontSize: 28, lineHeight: 1.3, color: "#9ba2b8", maxWidth: 1000, marginTop: 24 }}>
            {tagline}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 18, color: "#5e6478", letterSpacing: 4, textTransform: "uppercase" }}>
              {tier}
            </div>
            <div style={{ display: "flex", fontSize: 22, color: "#fbbf24", letterSpacing: 4, textTransform: "uppercase", marginTop: 8 }}>
              Build · {range}
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 22, color: "#5e6478", letterSpacing: 4, textTransform: "uppercase" }}>
            omnileadsagi.com
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
