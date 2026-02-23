import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    unoptimized: true,
  },
  transpilePackages: ["@dilag/ui"],
  async redirects() {
    return [
      { source: "/sign-in", destination: "/download", permanent: true },
      { source: "/sign-up", destination: "/download", permanent: true },
      { source: "/dashboard", destination: "/download", permanent: true },
      { source: "/onboarding", destination: "/download", permanent: true },
      { source: "/success", destination: "/download", permanent: true },
      { source: "/forgot-license", destination: "/download", permanent: true },
      { source: "/app", destination: "/download", permanent: true },
      { source: "/app/:path*", destination: "/download", permanent: true },
    ];
  },
};

export default nextConfig;
