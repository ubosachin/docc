// DO NOT use a static import here.
// A top-level `import * as pdfjs from "pdfjs-dist/..."` causes webpack to
// statically analyze the module and attempt to bundle pdf.worker.mjs into the
// server chunk — which always fails in Next.js API routes.
// Dynamic import bypasses this analysis entirely.

import { Canvas } from "skia-canvas";

export async function extractPdf(pdfBuffer: Buffer) {
  // Dynamic import: invisible to bundler's static analysis, evaluated at runtime.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // Must be set AFTER the dynamic import resolves.
  // Empty string = no worker, run synchronously in the main thread.
  pdfjs.GlobalWorkerOptions.workerSrc = "";

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    disableWorker: true,      // Never spawn a worker thread
    isEvalSupported: false,   // No eval() in Node.js context
    useWorkerFetch: false,    // Use native fetch, not worker-based fetch
    useSystemFonts: true,     // Skip font downloads
    CanvasFactory: {
      create(width: number, height: number) {
        const canvas = new Canvas(width, height);
        const context = canvas.getContext("2d") as any;
        return { canvas, context };
      },
      reset(canvasAndContext: any, width: number, height: number) {
        canvasAndContext.canvas.width = width;
        canvasAndContext.canvas.height = height;
      },
      destroy(canvasAndContext: any) {
        canvasAndContext.canvas.width = 0;
        canvasAndContext.canvas.height = 0;
        canvasAndContext.canvas = null;
        canvasAndContext.context = null;
      },
    },
  } as any);

  const pdf = await loadingTask.promise;
  return pdf;
}
