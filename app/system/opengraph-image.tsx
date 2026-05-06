// /system OG card — chrome-gold positioning. Used by every social
// platform (LinkedIn, Twitter/X, Facebook, Slack unfurls, iMessage rich
// links) when the URL https://omnileadsagi.com/system is shared.
//
// Next 14 wires this file in automatically — no metadata reference
// needed. The runtime is edge so the image renders fast on cold cache.

import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "Omni AI Portfolio Promotion System — One sponsor, every site, real attribution.";
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          background: "#050505",
          position: "relative",
          overflow: "hidden",
          fontFamily: "system-ui, sans-serif",
          color: "#fafafa",
        }}
      >
        {/* Top-left amber glow */}
        <div
          style={{
            position: "absolute",
            top: -200,
            left: -200,
            width: 700,
            height: 700,
            borderRadius: "50%",
            background:
              "radial-gradient(closest-side, rgba(251,191,36,0.35), rgba(251,191,36,0))",
            display: "flex",
          }}
        />
        {/* Bottom-right purple glow */}
        <div
          style={{
            position: "absolute",
            bottom: -240,
            right: -180,
            width: 640,
            height: 640,
            borderRadius: "50%",
            background:
              "radial-gradient(closest-side, rgba(168,85,247,0.28), rgba(168,85,247,0))",
            display: "flex",
          }}
        />

        {/* Content frame */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "60px 72px",
            width: "100%",
            height: "100%",
          }}
        >
          {/* Eyebrow */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 18,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#fbbf24",
              fontWeight: 800,
            }}
          >
            <span style={{ fontSize: 22 }}>★</span>
            Omni AI · Portfolio Promotion System
          </div>

          {/* Headline cluster */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 28,
              maxWidth: 1000,
            }}
          >
            <div
              style={{
                fontSize: 70,
                fontWeight: 900,
                letterSpacing: -2.5,
                lineHeight: 1.04,
                color: "#fafafa",
                display: "flex",
              }}
            >
              One sponsor, every site, real attribution.
            </div>
            <div
              style={{
                fontSize: 26,
                lineHeight: 1.4,
                color: "#d4d4d8",
                maxWidth: 880,
                display: "flex",
              }}
            >
              We don&rsquo;t sell ads — we run a portfolio of high-trust
              local sites and feature one sponsor across all of them at
              the same time.
            </div>
          </div>

          {/* Footer row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 20,
                fontSize: 18,
                color: "#a1a1aa",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <div style={{ color: "#fbbf24", fontWeight: 800 }}>13</div>
                <div>portfolio sites</div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <div style={{ color: "#fbbf24", fontWeight: 800 }}>1</div>
                <div>sponsor at a time</div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <div style={{ color: "#fbbf24", fontWeight: 800 }}>Live</div>
                <div>attribution dashboard</div>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 4,
              }}
            >
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  letterSpacing: 2,
                  color: "#fafafa",
                }}
              >
                omnileadsagi.com/system
              </div>
              <div style={{ fontSize: 14, color: "#71717a", letterSpacing: 1.5 }}>
                Sponsorships · Partnerships · Editorial
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
