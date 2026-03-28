import path from "node:path";
import type { NextConfig } from "next";

const backendOrigin = (process.env.API_PROXY_TARGET ?? "http://127.0.0.1:3002").replace(
  /\/$/,
  "",
);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.resolve(process.cwd()),
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
