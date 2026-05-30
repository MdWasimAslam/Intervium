import { ImageResponse } from "next/og";

export const alt = "Intervium — AI-powered mock interviews";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social share image with the Intervium brand. */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        background: "#0b0f0e",
        padding: "80px",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "120px",
            height: "120px",
            borderRadius: "32px",
            background: "#00B775",
          }}
        >
          <svg width="80" height="80" viewBox="0 0 40 40">
            <circle cx="12.5" cy="15.5" r="2.6" fill="#ffffff" />
            <rect x="17" y="13" width="13" height="5" rx="2.5" fill="#ffffff" />
            <rect x="10" y="22" width="13" height="5" rx="2.5" fill="#ffffff" />
            <circle cx="27.5" cy="24.5" r="2.6" fill="#ffffff" />
          </svg>
        </div>
        <div style={{ fontSize: "84px", fontWeight: 800, color: "#f3f5f4" }}>
          Intervium
        </div>
      </div>
      <div
        style={{
          marginTop: "40px",
          fontSize: "40px",
          color: "#9aa8a3",
          maxWidth: "900px",
        }}
      >
        AI-powered mock interviews with instant, actionable feedback.
      </div>
    </div>,
    { ...size },
  );
}
