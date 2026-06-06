import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // LAN-first dev: the app is opened from other machines on the network
  // (e.g. pancho.local), not just localhost. Next 16 blocks cross-origin
  // requests to its dev resources (incl. the HMR socket) by default, which
  // leaves the page rendered but non-interactive — taps/clicks never fire.
  // Allow our LAN hosts so the client hydrates. Dev-only; ignored in prod.
  allowedDevOrigins: ["*.local", "192.168.*.*", "10.*.*.*"],
  turbopack: {
    root: process.cwd(),
  },
  images: {
    // Cinemeta posters/backgrounds and episode thumbnails are served from
    // metahub.space subdomains (images.metahub.space, episodes.metahub.space).
    remotePatterns: [{ protocol: "https", hostname: "**.metahub.space" }],
  },
};

export default nextConfig;
