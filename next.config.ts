import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.0.103",
    "*.trycloudflare.com",
  ],
};

export default nextConfig;
