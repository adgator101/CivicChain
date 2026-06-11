import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce a self-contained build (.next/standalone) with only the files and
  // node_modules needed to run the server — ideal for a minimal Docker image.
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.mapbox.com",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
