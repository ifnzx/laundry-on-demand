import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Smaller image for Docker / VPS (`node .next/standalone/server.js`)
  output: "standalone",
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
