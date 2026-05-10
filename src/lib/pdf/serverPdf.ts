import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { Canvas } from "skia-canvas";

export async function extractPdf(pdfBuffer: Buffer) {
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    useSystemFonts: true,
    disableWorker: true,
    CanvasFactory: {
      create(width: number, height: number) {
        const canvas = new Canvas(width, height);
        const context = canvas.getContext("2d");
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
