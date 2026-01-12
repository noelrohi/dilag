import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";
import Script from "next/script";
import { Figtree, Instrument_Serif, IBM_Plex_Mono } from "next/font/google";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-sans",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-serif",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Dilag - AI-Powered Design Studio",
  description:
    "Design mobile and web apps with natural language. Dilag is a native macOS app that uses AI to generate beautiful, responsive UI designs in real-time.",
  openGraph: {
    title: "Dilag - AI-Powered Design Studio",
    description:
      "Design mobile and web apps with natural language. A native macOS app that uses AI to generate beautiful UI designs in real-time.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dilag - AI-Powered Design Studio",
    description:
      "Design mobile and web apps with natural language. A native macOS app that uses AI to generate beautiful UI designs in real-time.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${figtree.variable} ${instrumentSerif.variable} ${ibmPlexMono.variable}`}>
      <head>
        {process.env.NODE_ENV === "development" && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
