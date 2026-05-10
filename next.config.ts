import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These packages must NOT be bundled by webpack on the server.
  // Bundling pdfjs-dist causes webpack to resolve the worker import chain at
  // build time → broken .next/server/chunks/pdf.worker.mjs.
  // Bundling tesseract.js causes similar worker path resolution failures.
  // Marking them external lets Node.js load them directly at runtime.
  serverExternalPackages: [
    "skia-canvas",
    "pdfjs-dist",
    "tesseract.js",
    "sharp",
    "worker_threads", // Ensure Node.js built-in is never shimmed by webpack
  ],

  webpack: (config, { isServer }) => {
    if (isServer) {
      // Prevent webpack from trying to bundle pdfjs worker chunks.
      // This is belt-and-suspenders on top of serverExternalPackages.
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
        "pdfjs-dist",
        "canvas",
        "skia-canvas",
      ];
    }
    return config;
  },
};

export default nextConfig;
