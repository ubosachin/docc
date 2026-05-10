import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These packages must NOT be bundled — they contain native bindings,
  // worker threads, or large static assets that must be loaded at runtime.
  serverExternalPackages: [
    "skia-canvas",
    "pdfjs-dist",
    "tesseract.js",
    "sharp",
    "worker_threads",
  ],

  // Empty turbopack config silences the "webpack config but no turbopack
  // config" error in Next.js 16. The serverExternalPackages above already
  // handles the critical externals for Turbopack builds.
  turbopack: {},

  webpack: (config, { isServer }) => {
    if (isServer) {
      // Belt-and-suspenders: also mark native/heavy modules as webpack
      // externals so the webpack build worker never traverses them
      // (prevents "Call retries were exceeded / WorkerError").
      config.externals = [
        ...(Array.isArray(config.externals)
          ? config.externals
          : [config.externals].filter(Boolean)),
        "pdfjs-dist",
        "canvas",
        "skia-canvas",
        "sharp",
        "tesseract.js",
      ];
    }
    return config;
  },
};

export default nextConfig;
