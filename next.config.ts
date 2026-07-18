import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  // Keep serverless/VHS artifacts small — media in public/ is static CDN, not lambda FS
  outputFileTracingExcludes: {
    "*": [
      "./android/**/*",
      "./ios/**/*",
      "./ops/**/*",
      "./artifacts/**/*",
      "./public/music/**/*",
      "./node_modules/@img/sharp-*/**/*",
      "./node_modules/sharp/**/*",
    ],
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [
          { key: "Content-Type", value: "application/manifest+json" },
          { key: "Cache-Control", value: "public, max-age=3600" },
        ],
      },
      {
        source: "/.well-known/apple-app-site-association",
        headers: [
          { key: "Content-Type", value: "application/json" },
        ],
      },
      {
        source: "/.well-known/assetlinks.json",
        headers: [
          { key: "Content-Type", value: "application/json" },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/radio.html", destination: "/radio", permanent: true },
      { source: "/listen", destination: "/radio", permanent: true },
      { source: "/listen.html", destination: "/radio", permanent: true },
    ];
  },
};

export default nextConfig;
