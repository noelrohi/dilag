import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    unoptimized: true
  },
  transpilePackages: ["@dilag/ui", "@dilag/db", "@dilag/shared"]
};

export default nextConfig;
