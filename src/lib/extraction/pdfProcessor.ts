import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "canvas";

export interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  fontName?: string;
}

export async function extractTextFromPDF(buffer: Buffer) {
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableWorker: true,
    // Add CanvasFactory for Node.js rendering support
    CanvasFactory: {
      create(width: number, height: number) {
        const canvas = createCanvas(width, height);
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
  
  const pdfDocument = await loadingTask.promise;
  const numPages = pdfDocument.numPages;
  
  return { pdfDocument, numPages };
}

/**
 * Universal spatial text extraction
 */
export async function processPageText(pdfDocument: any, pageNum: number) {
  const page = await pdfDocument.getPage(pageNum);
  const textContent = await page.getTextContent();
  
  const items: TextItem[] = textContent.items.map((item: any) => ({
    text: item.str,
    x: item.transform[4],
    y: item.transform[5],
    width: item.width,
    height: item.height,
    fontSize: item.transform[0], // Approximate font size
  }));
  
  if (items.length === 0) return [];

  // Spatial Layout Analysis
  // 1. Sort by Y descending (top to bottom)
  const sortedItems = [...items].sort((a, b) => b.y - a.y);
  
  // 2. Group into lines based on Y coordinate proximity
  const lines: TextItem[][] = [];
  let currentLine: TextItem[] = [];
  let currentY = sortedItems[0].y;
  const yTolerance = 5; // Better for Hindi matras

  for (const item of sortedItems) {
    if (Math.abs(item.y - currentY) <= yTolerance) {
      currentLine.push(item);
    } else {
      currentLine.sort((a, b) => a.x - b.x); // Sort line by X
      lines.push(currentLine);
      currentLine = [item];
      currentY = item.y;
    }
  }
  if (currentLine.length > 0) {
    currentLine.sort((a, b) => a.x - b.x);
    lines.push(currentLine);
  }

  // 3. Detect columns and structure
  // For a universal converter, we look for gaps in X coordinates across lines
  // But a simpler and more robust way for "preserving structure" is to 
  // group items that are vertically aligned.
  
  const blocks: TextItem[][] = [];
  const used = new Set<number>();
  
  // Flattened for block detection
  const allItems = lines.flat();
  
  for (let i = 0; i < allItems.length; i++) {
    if (used.has(i)) continue;
    
    const block: TextItem[] = [allItems[i]];
    used.add(i);
    
    // Greedy box expansion
    const box = {
      minX: allItems[i].x,
      maxX: allItems[i].x + allItems[i].width,
      minY: allItems[i].y - allItems[i].height,
      maxY: allItems[i].y + allItems[i].height
    };
    
    // Expand box based on proximity
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (let j = 0; j < allItems.length; j++) {
        if (used.has(j)) continue;
        const item = allItems[j];
        
        // If item overlaps or is very close to current box
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
    
    // Sort block items by reading order (Y desc, X asc)
    block.sort((a, b) => {
      if (Math.abs(a.y - b.y) > 5) return b.y - a.y;
      return a.x - b.x;
    });
    
    blocks.push(block);
  }
  
  // Sort blocks by reading order
  blocks.sort((a, b) => {
    const ay = a[0].y;
    const by = b[0].y;
    if (Math.abs(ay - by) > 20) return by - ay;
    return a[0].x - b[0].x;
  });

  return blocks;
}

export async function isScannedPDF(pdfDocument: any) {
  const page = await pdfDocument.getPage(1);
  const textContent = await page.getTextContent();
  
  // 1. Check for very low text count (Scanned/Image PDF)
  if (textContent.items.length < 5) return true;
  
  // 2. Check for Broken Encoding (Digital but corrupted)
  const sampleText = textContent.items.map((it: any) => it.str).join(" ");
  return isBrokenEncoding(sampleText);
}

/**
 * Detects if the text layer is corrupted with broken glyphs (Ǖ, ȡ, etc)
 */
export function isBrokenEncoding(text: string): boolean {
  if (!text || text.length < 10) return false;
  
  // Specific corruption glyphs provided by the user
  const corruptionGlyphs = ["Ǖ", "ȡ", "ȡ", "ǡ", "Ȣ", "ȣ", "Ȥ", "ȥ"];
  
  let suspiciousCount = 0;
  for (const glyph of corruptionGlyphs) {
    const regex = new RegExp(glyph, "g");
    const matches = text.match(regex);
    if (matches) suspiciousCount += matches.length;
  }
  
  // Check for excessive replacement characters or high-density non-standard symbols
  const replacementMatches = text.match(/\uFFFD/g);
  if (replacementMatches) suspiciousCount += replacementMatches.length;
  
  // If more than 3% of characters are garbage, it's broken
  const ratio = suspiciousCount / text.length;
  return ratio > 0.03 || suspiciousCount > 10;
}

/**
 * Heuristic language detection
 */
export function detectLanguages(text: string): string[] {
  const langs = new Set<string>();
  
  // Basic Unicode range checks
  if (/[a-zA-Z]/.test(text)) langs.add("eng");
  if (/[\u0900-\u097F]/.test(text)) langs.add("hin"); // Hindi
  if (/[\u0600-\u06FF]/.test(text)) langs.add("ara"); // Arabic
  if (/[\u4E00-\u9FFF]/.test(text)) langs.add("chi_sim"); // Chinese
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) langs.add("jpn"); // Japanese
  if (/[\u0AC0-\u0AFF]/.test(text)) langs.add("guj"); // Gujarati
  if (/[\u0B80-\u0BFF]/.test(text)) langs.add("tam"); // Tamil
  if (/[\u0C00-\u0C7F]/.test(text)) langs.add("tel"); // Telugu
  if (/[\u0A00-\u0A7F]/.test(text)) langs.add("pan"); // Punjabi
  if (/[\u0980-\u09FF]/.test(text)) langs.add("ben"); // Bengali
  
  return langs.size > 0 ? Array.from(langs) : ["eng"];
}
