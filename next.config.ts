import type { NextConfig } from "next";

/**
 * Next.js configuration.
 * @see https://nextjs.org/docs/app/api-reference/config/next-config-js
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // nodejs-whisper spawns a native whisper.cpp binary and reads model files by
  // path relative to its own package dir — keep it external so the server
  // bundler doesn't try to trace/bundle it.
  serverExternalPackages: ["nodejs-whisper"],
};

export default nextConfig;
