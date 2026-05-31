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
  // nodejs-whisper spawns a native whisper.cpp binary and reads model files by
  // path relative to its own package dir — keep it external so the server
  // bundler doesn't try to trace/bundle it.
  serverExternalPackages: ["nodejs-whisper"],
};


export default nextConfig;
