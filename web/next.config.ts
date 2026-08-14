import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["home.tailb9c821.ts.net", "*.ts.net"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
