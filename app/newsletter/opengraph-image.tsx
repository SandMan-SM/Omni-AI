import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Interlinked — AI strategy for operators building the future";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const backgroundUrl =
  "https://omnileadsagi.com/newsletter/interlinked-og-background.png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#03040a",
          color: "#ffffff",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <img
          src={backgroundUrl}
          alt=""
          width="1200"
          height="630"
          style={{
            position: "absolute",
            inset: 0,
            width: "1200px",
            height: "630px",
            objectFit: "cover",
          }}
        />

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "linear-gradient(90deg, rgba(2,3,9,0.98) 0%, rgba(3,4,12,0.92) 39%, rgba(3,4,12,0.48) 67%, rgba(3,4,12,0.12) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: "18px",
            display: "flex",
            border: "1px solid rgba(167,139,250,0.22)",
            borderRadius: "26px",
            boxShadow: "inset 0 0 80px rgba(76,29,149,0.12)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 18,
            left: 190,
            right: 190,
            height: "3px",
            display: "flex",
            background:
              "linear-gradient(90deg, transparent, #a855f7, #38bdf8, #f4c96b, transparent)",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: "760px",
            height: "100%",
            padding: "64px 0 64px 76px",
          }}
        >
          <div
            style={{
              display: "flex",
              marginTop: "0px",
              fontSize: "78px",
              lineHeight: 0.98,
              letterSpacing: "-4px",
              fontWeight: 900,
              color: "#ffffff",
              textShadow: "0 4px 34px rgba(0,0,0,0.72)",
            }}
          >
            INTERLINKED
          </div>

          <div
            style={{
              display: "flex",
              marginTop: "20px",
              maxWidth: "650px",
              fontSize: "29px",
              lineHeight: 1.25,
              fontWeight: 500,
              color: "#d6d8e3",
            }}
          >
            AI strategy for operators building the future.
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginTop: "34px",
              gap: "12px",
              color: "#9ca3b7",
              fontSize: "17px",
              letterSpacing: "0.4px",
            }}
          >
            <span style={{ color: "#c084fc" }}>capture</span>
            <span style={{ color: "#555b70" }}>→</span>
            <span style={{ color: "#818cf8" }}>classify</span>
            <span style={{ color: "#555b70" }}>→</span>
            <span style={{ color: "#60a5fa" }}>act</span>
            <span style={{ color: "#555b70" }}>→</span>
            <span style={{ color: "#67e8f9" }}>verify</span>
            <span style={{ color: "#555b70" }}>→</span>
            <span style={{ color: "#f4c96b" }}>remember</span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
