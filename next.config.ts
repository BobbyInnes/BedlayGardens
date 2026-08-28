import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// No nonce/`proxy.ts` involvement — this is the "Without Nonces" baseline
// from Next's own CSP guide, since dynamic-rendering-everywhere isn't worth
// it here. 'unsafe-inline' is required for script-src (the JSON-LD
// structured-data <script> tags on service-area pages) and style-src (the
// admin rich-text editor's inline swatch colours). Known external embed
// origins are enumerated explicitly — adding a new video-embed provider in
// admin Media (gallery-grid.tsx's EMBED items) or map provider means adding
// its origin here too.
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https://*.r2.dev;
  font-src 'self';
  connect-src 'self';
  frame-src https://www.google.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
`
  .replace(/\s{2,}/g, " ")
  .trim();

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "origin-when-cross-origin" },
          { key: "Content-Security-Policy", value: cspHeader },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
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
