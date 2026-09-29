import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  async rewrites() {
    return [
      { source: "/supported", destination: "/api/supported" },
      { source: "/verify", destination: "/api/verify" },
      { source: "/settle", destination: "/api/settle" },
      { source: "/metrics", destination: "/api/metrics" },
      { source: "/health", destination: "/api/health" },
    ];
  },
};

export default nextConfig;
