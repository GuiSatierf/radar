import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-hosted on Coolify through the Dockerfile (docs/DECISOES.md).
  output: "standalone",
  // The floating dev badge covers the bottom navigation on phones.
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
