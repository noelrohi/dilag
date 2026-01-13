import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Dilag - AI-Powered Design Studio";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  const font = await fetch(
    "https://fonts.gstatic.com/s/urbanist/v18/L0xjDF02iFML4hGCyOCpRdycFsGxSrqDFRkfFg.ttf"
  ).then((res) => res.arrayBuffer());

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#070B0F",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
          }}
        >
          {/* Dilag Logo */}
          <svg
            viewBox="0 0 1024 1024"
            width={120}
            height={120}
            fill="none"
          >
            <rect
              x="0"
              y="0"
              width="1024"
              height="1024"
              rx="227"
              fill="rgba(250, 250, 250, 0.05)"
            />
            <rect
              x="198"
              y="248"
              width="230"
              height="528"
              rx="36"
              fill="none"
              stroke="rgba(250, 250, 250, 0.15)"
              strokeWidth="18"
            />
            <path
              d="M512 248 C696 248, 826 372, 826 512 C826 652, 696 776, 512 776 L512 248 Z"
              fill="#fafafa"
            />
          </svg>

          {/* Text */}
          <span
            style={{
              fontSize: 120,
              fontFamily: "Urbanist",
              fontWeight: 600,
              color: "#fafafa",
              letterSpacing: "-0.02em",
            }}
          >
            Dilag
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Urbanist",
          data: font,
          style: "normal",
          weight: 600,
        },
      ],
    }
  );
}
