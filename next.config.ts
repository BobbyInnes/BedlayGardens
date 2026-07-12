import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Public media (gallery/hero/service images) is served from Cloudflare R2.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
    ],
  },
};

export default nextConfig;
