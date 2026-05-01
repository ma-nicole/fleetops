import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const backendOrigin = process.env.BACKEND_ORIGIN || "http://127.0.0.1:8000";
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const origin = backendOrigin.replace(/\/+$/, "");
    return [
      {
        source: "/api-proxy/:path*",
        destination: `${origin}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
