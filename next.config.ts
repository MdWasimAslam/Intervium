import type { NextConfig } from "next";

/**
 * Next.js configuration.
 * @see https://nextjs.org/docs/app/api-reference/config/next-config-js
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Ensures Turbopack resolves the workspace from the actual project root on
  // platforms like Vercel.
  turbopack: {
    root: __dirname,
  },
};


export default nextConfig;
