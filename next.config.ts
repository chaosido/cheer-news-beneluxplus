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
  // Defense-in-depth response headers applied to every route. No Content-Security
  // -Policy yet: the app loads external Leaflet map tiles, the Firebase Auth
  // helper, and Turnstile, so a CSP needs per-source allowlisting to avoid
  // breakage — tracked separately. These headers are safe and break nothing.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
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
