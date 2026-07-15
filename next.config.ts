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
  experimental: {
    serverActions: {
      // Default is 1mb, which silently rejects most phone photos and any
      // hero video clip uploaded via the admin Media form (createMedia /
      // updateMedia server actions in src/app/admin/media/actions.ts).
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
