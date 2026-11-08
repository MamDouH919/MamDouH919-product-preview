import type { NextConfig } from "next";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3010";

// Backends that may serve images (/uploads/...). Add each tenant's API origin
// here (scheme + host + optional port). The env-derived backendUrl is always
// included, and duplicates are removed.
const imageBackends = [
  backendUrl,
  "http://localhost:3010",
  "https://api-ranosh.novaslash.com",
  "https://api-gravity.novaslash.com",
  "https://api-demo.novaslash.com",
  "https://api-mk.novaslash.com",
  "https://api-nuxi.novaslash.com",
];

function parseRemotePattern(url: string) {
  const parsed = new URL(url);
  return {
    protocol: parsed.protocol.replace(":", "") as "http" | "https",
    hostname: parsed.hostname,
    port: parsed.port || undefined,
  };
}

const nextConfig: NextConfig = {
  images: {
    unoptimized: process.env.NODE_ENV === "development",
    remotePatterns: [
      ...Array.from(new Set(imageBackends)).map(parseRemotePattern),
      // Uploaded images on Cloudflare R2 (public r2.dev bucket URL)
      { protocol: "https", hostname: "*.r2.dev" },
      // Placeholder images on demo products (backend `npm run seed:products`)
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
};

export default nextConfig;
