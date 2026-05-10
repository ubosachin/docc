"use client";

import * as pdfjsLib from "pdfjs-dist";
// Use the legacy worker for broader compatibility or the standard one
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
}

export { pdfjsLib };
