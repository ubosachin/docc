import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These packages must NOT be bundled by webpack on the server.
  // Bundling pdfjs-dist causes webpack to resolve the worker import chain at
  // build time → produces a broken .next/server/chunks/pdf.worker.mjs chunk.
  // Bundling tesseract.js causes similar worker path resolution failures.
  // Marking them external lets Node.js require() them directly at runtime.
  serverExternalPackages: [
    "skia-canvas",
    "pdfjs-dist",
    "tesseract.js",
    "sharp",
  ],
};

export default nextConfig;
