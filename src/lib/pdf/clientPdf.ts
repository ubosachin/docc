"use client";

// Browser-only PDF.js — used exclusively for PDF preview rendering in the UI.
// NEVER import this in API routes or server-side code.
//
// We use a plain string URL (not ?url import syntax) because:
// - ?url is a Vite convention; this project uses Next.js + webpack
// - Webpack will correctly resolve /pdf.worker.min.mjs from the /public directory
// - This avoids version-mismatch and workerPort errors

import * as pdfjsLib from "pdfjs-dist";

if (typeof window !== "undefined") {
  // Point to the worker file served statically from /public
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

export { pdfjsLib };
