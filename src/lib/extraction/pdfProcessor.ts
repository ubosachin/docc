// DO NOT use a static import for pdfjs-dist here.
// Dynamic import prevents webpack from resolving and bundling the worker chain.

export interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
}

// Module-level cache — only initialise once per server process
let _pdfjsLib: any = null;
let _CanvasClass: any = null;
let _SkiaCanvasFactory: any = null;

async function getPdfJs() {
  if (_pdfjsLib) return _pdfjsLib;

  // @ts-ignore
  _pdfjsLib = await import("pdfjs-dist/build/pdf.mjs");


  const skia = await import("skia-canvas");
  _CanvasClass = skia.Canvas;

  // ── Build a proper CanvasFactory class ────────────────────────────────
  //
  // pdfjs calls: new CanvasFactory({ enableHWA }) at line ~487759 of pdf.mjs.
  // It expects a CLASS extending BaseCanvasFactory with _createCanvas() overridden.
  //
  // Passing an object literal was wrong — new objectLiteral() returns an empty
  // instance with no prototype methods, so pdfjs falls back to NodeCanvasFactory
  // which tries require('@napi-rs/canvas') and then falls back to its own
  // CanvasElement type, causing the drawImage() type-mismatch with skia-canvas.
  //
  // Define a factory class from scratch that mirrors BaseCanvasFactory.
  // pdfjs only calls: create(), reset(), destroy() — all inherited from Base.
  // We only need to implement _createCanvas().
  const CanvasClass = _CanvasClass;
  _SkiaCanvasFactory = class SkiaNodeCanvasFactory {
    // Constructor mirrors BaseCanvasFactory({ enableHWA })
    constructor(_opts?: any) {}

    // The one method pdfjs calls internally:
    _createCanvas(width: number, height: number) {
      return new CanvasClass(Math.max(1, Math.ceil(width)), Math.max(1, Math.ceil(height)));
    }

    // Methods from BaseCanvasFactory:
    create(width: number, height: number) {
      if (width <= 0 || height <= 0) throw new Error("Invalid canvas size");
      const canvas = this._createCanvas(width, height);
      return { canvas, context: canvas.getContext("2d") };
    }
    reset(pair: any, width: number, height: number) {
      if (!pair.canvas) throw new Error("Canvas is not specified");
      if (width <= 0 || height <= 0) throw new Error("Invalid canvas size");
      pair.canvas.width = Math.max(1, Math.ceil(width));
      pair.canvas.height = Math.max(1, Math.ceil(height));
    }
    destroy(pair: any) {
      pair.canvas = null;
      pair.context = null;
    }
  };

  // ── Fix workerSrc ──────────────────────────────────────────────────────
  // In serverless environments (Vercel), resolving node_modules at runtime
  // via file:// is unreliable. We use a CDN fallback to ensure the worker
  // is always found, preventing the "Setting up fake worker failed" error.
  _pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${_pdfjsLib.version}/build/pdf.worker.min.mjs`;



  return _pdfjsLib;
}

export async function extractTextFromPDF(buffer: Buffer) {
  const pdfjsLib = await getPdfJs();

  // pdfjs calls: new CanvasFactory({ ownerDocument, enableHWA })
  // _SkiaCanvasFactory is a proper class (not an object literal) so
  // `new _SkiaCanvasFactory()` correctly returns an instance with all methods.
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    CanvasFactory: _SkiaCanvasFactory,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
    disableRange: true,
    disableStream: true,
    standardFontDataUrl:
      `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,

  } as any);

  const pdfDocument = await loadingTask.promise;
  const numPages = pdfDocument.numPages;

  return { pdfDocument, numPages };
}

export async function processPageText(pdfDocument: any, pageNum: number) {
  const page = await pdfDocument.getPage(pageNum);
  const textContent = await page.getTextContent();

  const items: TextItem[] = textContent.items.map((item: any) => ({
    text: item.str,
    x: item.transform[4],
    y: item.transform[5],
    width: item.width,
    height: item.height,
    fontSize: item.transform[0],
  }));

  if (items.length === 0) return [];

  const sortedItems = [...items].sort((a, b) => b.y - a.y);
  const lines: TextItem[][] = [];
  let currentLine: TextItem[] = [];
  let currentY = sortedItems[0].y;
  const yTolerance = 5;

  for (const item of sortedItems) {
    if (Math.abs(item.y - currentY) <= yTolerance) {
      currentLine.push(item);
    } else {
      currentLine.sort((a, b) => a.x - b.x);
      lines.push(currentLine);
      currentLine = [item];
      currentY = item.y;
    }
  }
  if (currentLine.length > 0) {
    currentLine.sort((a, b) => a.x - b.x);
    lines.push(currentLine);
  }

  const blocks: TextItem[][] = [];
  const used = new Set<number>();
  const allItems = lines.flat();

  for (let i = 0; i < allItems.length; i++) {
    if (used.has(i)) continue;
    const block: TextItem[] = [allItems[i]];
    used.add(i);
    const box = {
      minX: allItems[i].x,
      maxX: allItems[i].x + allItems[i].width,
      minY: allItems[i].y - allItems[i].height,
      maxY: allItems[i].y + allItems[i].height,
    };
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (let j = 0; j < allItems.length; j++) {
        if (used.has(j)) continue;
        const item = allItems[j];
        const xOverlap = Math.max(0, Math.min(box.maxX, item.x + item.width) - Math.max(box.minX, item.x));
        const yOverlap = Math.max(0, Math.min(box.maxY, item.y + item.height) - Math.max(box.minY, item.y - item.height));
        const xDist = Math.min(Math.abs(item.x - box.maxX), Math.abs(item.x + item.width - box.minX));
        const yDist = Math.min(Math.abs(item.y - box.maxY), Math.abs(item.y - box.minY));
        if ((xOverlap > 0 && yDist < 15) || (yOverlap > 0 && xDist < 25) || (xDist < 25 && yDist < 15)) {
          block.push(item);
          used.add(j);
          box.minX = Math.min(box.minX, item.x);
          box.maxX = Math.max(box.maxX, item.x + item.width);
          box.minY = Math.min(box.minY, item.y - item.height);
          box.maxY = Math.max(box.maxY, item.y + item.height);
          expanded = true;
        }
      }
    }
    block.sort((a, b) => {
      if (Math.abs(a.y - b.y) > 5) return b.y - a.y;
      return a.x - b.x;
    });
    blocks.push(block);
  }

  blocks.sort((a, b) => {
    const ay = a[0].y, by = b[0].y;
    if (Math.abs(ay - by) > 20) return by - ay;
    return a[0].x - b[0].x;
  });

  return blocks;
}

export async function isScannedPDF(pdfDocument: any) {
  const page = await pdfDocument.getPage(1);
  const textContent = await page.getTextContent();
  if (textContent.items.length < 5) return true;
  const sampleText = textContent.items.map((it: any) => it.str).join(" ");
  return isBrokenEncoding(sampleText);
}

export function isBrokenEncoding(text: string): boolean {
  if (!text || text.length < 10) return false;
  const corruptionGlyphs = ["Ǖ", "ȡ", "ȡ", "ǡ", "Ȣ", "ȣ", "Ȥ", "ȥ"];
  let suspiciousCount = 0;
  for (const glyph of corruptionGlyphs) {
    const matches = text.match(new RegExp(glyph, "g"));
    if (matches) suspiciousCount += matches.length;
  }
  const replacementMatches = text.match(/\uFFFD/g);
  if (replacementMatches) suspiciousCount += replacementMatches.length;
  return suspiciousCount / text.length > 0.03 || suspiciousCount > 10;
}

export function detectLanguages(text: string): string[] {
  const langs = new Set<string>();
  if (/[a-zA-Z]/.test(text)) langs.add("eng");
  if (/[\u0900-\u097F]/.test(text)) langs.add("hin");
  if (/[\u0600-\u06FF]/.test(text)) langs.add("ara");
  if (/[\u4E00-\u9FFF]/.test(text)) langs.add("chi_sim");
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) langs.add("jpn");
  if (/[\u0AC0-\u0AFF]/.test(text)) langs.add("guj");
  if (/[\u0B80-\u0BFF]/.test(text)) langs.add("tam");
  if (/[\u0C00-\u0C7F]/.test(text)) langs.add("tel");
  if (/[\u0A00-\u0A7F]/.test(text)) langs.add("pan");
  if (/[\u0980-\u09FF]/.test(text)) langs.add("ben");
  return langs.size > 0 ? Array.from(langs) : ["eng"];
}
