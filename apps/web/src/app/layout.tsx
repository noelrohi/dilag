import type { Metadata } from "next";
import { Rubik, IBM_Plex_Mono, IBM_Plex_Serif } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const ibmPlexSerif = IBM_Plex_Serif({
  variable: "--font-ibm-plex-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Dilag - AI-Powered Mobile UI Design",
  description:
    "Design mobile app screens with natural language. Dilag is a native macOS app that uses AI to generate beautiful, responsive mobile UI designs in real-time.",
  openGraph: {
    title: "Dilag - AI-Powered Mobile UI Design",
    description:
      "Design mobile app screens with natural language. A native macOS app that uses AI to generate beautiful mobile UI designs in real-time.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Dilag - AI-Powered Mobile UI Design",
    description:
      "Design mobile app screens with natural language. A native macOS app that uses AI to generate beautiful mobile UI designs in real-time.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${rubik.variable} ${ibmPlexMono.variable} ${ibmPlexSerif.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
