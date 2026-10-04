import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: let a real tablet on the LAN load the dev scripts — via the Mac's Bonjour name
  // (*.local, stable) or its IP. Without this, Next blocks them and the page never hydrates.
  allowedDevOrigins: ["*.local", "127.0.0.1", "192.168.*.*", "10.*.*.*"],

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // Always fetch a fresh service worker so updates roll out on next open
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
