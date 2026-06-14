import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Club logos are external URLs stored in Firestore (Firebase Storage /
    // Google Cloud Storage CDN, plus the occasional club-hosted asset), so the
    // exact hostname is not known at build time. Allow https from any host so
    // next/image can optimize/resize them; we never render attacker-controlled
    // hosts beyond curated club records.
    remotePatterns: [
      { protocol: "https", hostname: "storage.googleapis.com" },
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
