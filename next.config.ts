import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  // Public BVS artwork under /api/media is validated before redirecting to signed R2.
  // The production optimizer path is smoke-tested for WebP, PNG and JPEG; arbitrary
  // absolute/blob/data sources stay browser-direct at the component boundary.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "rdwwyolrxahimcgpkzzy.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
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
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
      {
        source: "/branding/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
          { key: "CDN-Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
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
      { source: "/admin/editorial", destination: "/editorial", permanent: true },
      { source: "/admin/editorial/finance", destination: "/editorial/finance", permanent: true },
      { source: "/radio.html", destination: "/radio", permanent: true },
      { source: "/listen", destination: "/radio", permanent: true },
      { source: "/listen.html", destination: "/radio", permanent: true },
      { source: "/music", destination: "/catalogue", permanent: true },
      { source: "/music.html", destination: "/catalogue", permanent: true },
      { source: "/articles", destination: "/blog", permanent: true },
      { source: "/articles.html", destination: "/blog", permanent: true },
    ];
  },
};

export default nextConfig;
