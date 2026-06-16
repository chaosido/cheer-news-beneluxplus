import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Curated club logos only. Today they are self-hosted root-relative assets
    // (/logos/*.jpg, same-origin → no remotePattern needed); the entries below
    // cover club logos uploaded to Firebase/Cloud Storage. We deliberately do
    // NOT use a "**" host wildcard: that turns /_next/image into an open proxy
    // anyone can point at any https host (SSRF + bandwidth amplification). Add a
    // specific host here if a future logo lives elsewhere.
    remotePatterns: [
      { protocol: "https", hostname: "storage.googleapis.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    ],
  },
  // Defense-in-depth response headers applied to every route. The
  // Content-Security-Policy is set separately in proxy.ts because it needs a
  // fresh per-request nonce (a static header here cannot do that). These
  // headers are safe and break nothing.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            // No `preload`: that submits the apex + all subdomains to the
            // browser preload list and is hard to reverse. Graduate to a longer
            // max-age + preload once every subdomain is confirmed HTTPS-only.
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
