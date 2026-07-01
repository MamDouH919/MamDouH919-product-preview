import type { NextConfig } from "next";
import config from "./config.json";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3010";

// Backends that may serve images (/uploads/...). Add each tenant's API origin
// here (scheme + host + optional port). The env-derived backendUrl is always
// included, and duplicates are removed.
const imageBackends = [
  backendUrl,
  "http://localhost:3010",
  "https://api-ranosh.novaslash.com",
  "https://api-gravity.novaslash.com",
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
    remotePatterns: Array.from(new Set(imageBackends)).map(parseRemotePattern),
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: `/${config.app.defaultLanguage}`,
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
