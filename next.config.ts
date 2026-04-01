import type { NextConfig } from "next";

// NOTE: unsafe-inline and unsafe-eval are required by Next.js (hydration scripts)
// and Mapbox GL JS (shader compilation / web workers). The strict domain allowlist
// on connect-src / img-src / frame-src is the meaningful restriction here.
// TODO: Migrate to nonce-based CSP (removes unsafe-inline) before FedRAMP / SOC 2 Type II.
const ContentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://api.mapbox.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://*.mapbox.com https://*.supabase.co",
  "font-src 'self'",
  [
    "connect-src 'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://api.mapbox.com",
    "https://events.mapbox.com",
    "https://*.sentry.io",
    "https://*.ingest.sentry.io",
  ].join(" "),
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "worker-src blob:",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: ContentSecurityPolicy,
          },
          // Prevent this app from being embedded in iframes (clickjacking defence)
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          // Prevent MIME-type sniffing
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // Only send origin in Referer header for cross-origin requests
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Restrict browser feature access — allow geolocation only for this origin (field maps)
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
