import type { NextConfig } from "next";
import config from "./config.json";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3010";

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
      parseRemotePattern(backendUrl),
    ],
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
