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

/**
 * Returns a CanvasFactory object that pdfjs uses for all internal canvas
 * operations (e.g. drawing inline images embedded in a page).
 * By using skia-canvas here, every sub-canvas pdfjs creates is a skia-canvas
 * instance — so ctx.drawImage(skiaCanvas) works without type errors.
 */
function makeSkiaCanvasFactory(CanvasClass: any) {
  return {
    create(width: number, height: number) {
      const canvas = new CanvasClass(Math.ceil(width) || 1, Math.ceil(height) || 1);
      return { canvas, context: canvas.getContext("2d") };
    },
    reset(pair: any, width: number, height: number) {
      pair.canvas.width = Math.ceil(width) || 1;
      pair.canvas.height = Math.ceil(height) || 1;
    },
    destroy(pair: any) {
      pair.canvas = null;
      pair.context = null;
    },
  };
}

async function getPdfJs() {
  if (_pdfjsLib) return _pdfjsLib;

  _pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const skia = await import("skia-canvas");
  _CanvasClass = skia.Canvas;

  // In Node.js, pdfjs v4 automatically sets workerSrc = "./pdf.worker.mjs"
  // (a relative path that doesn't resolve). Override with an absolute file:// URL.
  const { resolve } = await import("path");
  const { pathToFileURL } = await import("url");
  const workerPath = resolve(
    process.cwd(),
    "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
  );
  _pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

  return _pdfjsLib;
}

export async function extractTextFromPDF(buffer: Buffer) {
  const pdfjsLib = await getPdfJs();

  // Provide a skia-canvas CanvasFactory so pdfjs uses skia-canvas for ALL
  // internal canvas operations (inline images, tiling patterns, etc.).
  // Without this, pdfjs creates its own CanvasElement wrappers which are
  // incompatible with the skia-canvas ctx.drawImage() call → type error.
  const CanvasFactory = makeSkiaCanvasFactory(_CanvasClass);

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    CanvasFactory,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
    disableRange: true,
    disableStream: true,
    standardFontDataUrl:
      "https://unpkg.com/pdfjs-dist@4.10.38/standard_fonts/",
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
