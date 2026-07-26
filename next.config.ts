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
      // 200mb comfortably covers phone-recorded video clips (commonly
      // 50-150MB). Note this only affects this Next.js server — a hosting
      // platform (e.g. Vercel serverless functions) may impose its own,
      // separate request-body ceiling that this cannot override.
      bodySizeLimit: "200mb",
    },
    // Separate from the serverActions limit above — proxy.ts (Next's
    // middleware-equivalent) runs on every /admin/* request and buffers the
    // body independently, capped at 10MB by default regardless of the
    // setting above. Without raising this too, any upload over the limit
    // gets truncated before it reaches the server action at all, failing
    // with "Unexpected end of form".
    proxyClientMaxBodySize: "200mb",
  },
};

export default nextConfig;
