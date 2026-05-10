import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { Job, ExtractedRow, Upload } from "@/lib/db/models";
import { extractTextFromPDF, isScannedPDF } from "@/lib/extraction/pdfProcessor";
import { detectDocumentType, parsePageText } from "@/lib/extraction/voterListParser";
import * as Tesseract from "tesseract.js";
import sharp from "sharp";
import mongoose from "mongoose";

export async function POST(req: NextRequest) {
  try {
    const { uploadId } = await req.json();
    if (!uploadId) return NextResponse.json({ error: "Missing uploadId" }, { status: 400 });
    if (!mongoose.isValidObjectId(uploadId)) {
      return NextResponse.json({ error: "Invalid uploadId" }, { status: 400 });
    }

    await dbConnect();
    const upload = await Upload.findById(uploadId);
    if (!upload) return NextResponse.json({ error: "Upload not found" }, { status: 404 });

    let job = await Job.findOne({ uploadId: upload._id });
    if (!job) {
      job = await Job.create({
        userId: upload.userId,
        uploadId: upload._id,
        status: "queued",
        currentStep: "Initializing...",
        progress: 0,
      });
    }

    job.status = "processing";
    job.progress = 5;
    job.currentStep = "Fetching PDF...";
    await job.save();

    (async () => {
      try {
        const response = await fetch(upload.fileUrl);
        if (!response.ok) throw new Error(`Failed to fetch PDF (HTTP ${response.status})`);
        const buffer = Buffer.from(await response.arrayBuffer());
        if (!buffer.length) throw new Error("Downloaded PDF is empty");

        const { pdfDocument, numPages } = await extractTextFromPDF(buffer);
        if (!numPages) throw new Error("PDF has no readable pages");

        const isScanned = await isScannedPDF(pdfDocument);

        // Detect document type from filename + first-page text
        let sampleText = upload.filename + "\n";
        try {
          const pg = await pdfDocument.getPage(1);
          const tc = await pg.getTextContent();
          sampleText += tc.items.map((it: any) => it.str).join(" ");
        } catch (_) {}
        const docType = detectDocumentType(sampleText);

        await Job.findByIdAndUpdate(job._id, {

          totalPages: numPages,
          currentStep: `Processing ${numPages} pages [${docType === "voter_list" ? "Voter List" : "Document"} / ${isScanned ? "OCR" : "Digital"}]...`,
        });

        const CONCURRENCY = 4;
        let tesseractScheduler: any = null;
        
        if (isScanned) {
          tesseractScheduler = Tesseract.createScheduler();
          // Initialize 4 workers for parallel OCR
          const workerPromises = Array(CONCURRENCY).fill(0).map(async () => {
            const worker = await Tesseract.createWorker(["eng", "hin", "ben", "mar", "pan", "guj"]);
            tesseractScheduler.addWorker(worker);
            return worker;
          });
          await Promise.all(workerPromises);
        }

        let processedCount = 0;
        const pageIndices = Array.from({ length: numPages }, (_, i) => i + 1);
        
        // Process pages with limited concurrency
        const processPool = async () => {
          const queue = [...pageIndices];
          const workers = Array(CONCURRENCY).fill(0).map(async () => {
            while (queue.length > 0) {
              const i = queue.shift()!;
              try {
                let pageText = "";

                if (isScanned && tesseractScheduler) {
                  const page = await pdfDocument.getPage(i);
                  const imgBuf = await extractPageImage(page);

                  if (imgBuf) {
                    const processed = await sharp(imgBuf)
                      .grayscale()
                      .normalize()
                      .sharpen()
                      .toBuffer();
                    
                    const { data } = await tesseractScheduler.addJob("recognize", processed);
                    pageText = data.text || "";
                  } else {
                    const page2 = await pdfDocument.getPage(i);
                    const tc = await page2.getTextContent();
                    pageText = tc.items.map((it: any) => it.str + (it.hasEOL ? "\n" : " ")).join("");
                  }
                } else {
                  const page = await pdfDocument.getPage(i);
                  const tc = await page.getTextContent();
                  pageText = reconstructPageText(tc.items);
                }

                const rowsToInsert = buildRows(pageText, i, docType, job._id);
                if (rowsToInsert.length > 0) {
                  await ExtractedRow.insertMany(rowsToInsert);
                }

                processedCount++;
                await Job.findByIdAndUpdate(job._id, {
                  progress: Math.round((processedCount / numPages) * 95),
                  currentStep: `Processing Page ${processedCount} of ${numPages}...`,
                  processedPages: processedCount,
                });
              } catch (pageErr: any) {
                console.error(`Error processing page ${i}:`, pageErr);
              }
            }
          });
          await Promise.all(workers);
        };

        await processPool();

        if (tesseractScheduler) {
          await tesseractScheduler.terminate();
        }

        await Job.findByIdAndUpdate(job._id, {
          progress: 100,
          status: "completed",
          currentStep: `Extraction complete — ${docType === "voter_list" ? "Voter List" : "Document"}`,
        });
      } catch (err: any) {
        console.error("Process Error:", err);
        await Job.findByIdAndUpdate(job._id, {
          status: "failed",
          currentStep: "Error: " + err.message,
          error: err.message,
        });
      }
    })();

    return NextResponse.json({ message: "Process triggered", jobId: job._id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ─── Extract embedded image from a PDF page via operator list ─────────────────
// This completely avoids canvas rendering (which fails due to CanvasElement
// type conflicts between pdfjs and skia-canvas). Instead we pull the raw
// pixel data that pdfjs has already decoded from the PDF stream.

async function extractPageImage(page: any): Promise<Buffer | null> {
  try {
    const ops = await page.getOperatorList();
    const viewport = page.getViewport({ scale: 1 });

    // OPS numeric codes (from pdfjs source):
    // paintInlineImageXObject = 84, paintImageXObject = 85
    const PAINT_INLINE = 84;
    const PAINT_IMAGE  = 85;

    const candidates: Array<{ width: number; height: number; buf: Buffer }> = [];

    for (let j = 0; j < ops.fnArray.length; j++) {
      const fn   = ops.fnArray[j];
      const args = ops.argsArray[j];

      if (fn === PAINT_INLINE) {
        // args[0] is the image data object directly
        const img = args[0];
        if (img?.data) {
          const buf = imgDataToBuffer(img);
          if (buf) candidates.push({ width: img.width, height: img.height, buf });
        }
      } else if (fn === PAINT_IMAGE) {
        // args[0] is the image name; fetch from page.objs
        const name = args[0];
        try {
          const img: any = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("timeout")), 5000);
            page.objs.get(name, (obj: any) => {
              clearTimeout(timeout);
              resolve(obj);
            });
          });
          if (img?.data) {
            const buf = imgDataToBuffer(img);
            if (buf) candidates.push({ width: img.width, height: img.height, buf });
          }
        } catch (_) {}
      }
    }

    if (!candidates.length) return null;

    // Use the largest image (the scanned page)
    candidates.sort((a, b) => b.width * b.height - a.width * a.height);
    const { width, height, buf } = candidates[0];

    // Scale to ~300 DPI equivalent width for good OCR
    const targetW = Math.min(width, 3000);
    const scale   = targetW / width;
    return await sharp(buf, { raw: { width, height, channels: 4 } })
      .resize(Math.round(width * scale), Math.round(height * scale))
      .png()
      .toBuffer();
  } catch (err: any) {
    console.error("extractPageImage failed:", err.message);
    return null;
  }
}

// Convert pdfjs ImageData object to a raw RGBA Buffer
function imgDataToBuffer(img: any): Buffer | null {
  try {
    const { width, height, data, kind } = img;
    if (!data || !width || !height) return null;

    const bytes = data instanceof Uint8ClampedArray || Buffer.isBuffer(data)
      ? data
      : new Uint8ClampedArray(data.buffer ?? data);

    // kind: 1=GRAYSCALE_1BPP, 2=RGB_24BPP, 3=RGBA_32BPP
    if (kind === 3 || bytes.length === width * height * 4) {
      return Buffer.from(bytes);
    }
    if (kind === 2 || bytes.length === width * height * 3) {
      // RGB → RGBA
      const rgba = Buffer.allocUnsafe(width * height * 4);
      for (let p = 0, q = 0; p < bytes.length; p += 3, q += 4) {
        rgba[q] = bytes[p]; rgba[q+1] = bytes[p+1]; rgba[q+2] = bytes[p+2]; rgba[q+3] = 255;
      }
      return rgba;
    }
    if (kind === 1) {
      // 1-bit grayscale packed — expand to RGBA
      const rgba = Buffer.allocUnsafe(width * height * 4);
      for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
          const byteIdx = row * Math.ceil(width / 8) + Math.floor(col / 8);
          const bit     = (bytes[byteIdx] >> (7 - (col % 8))) & 1;
          const v       = bit ? 255 : 0;
          const idx     = (row * width + col) * 4;
          rgba[idx] = rgba[idx+1] = rgba[idx+2] = v; rgba[idx+3] = 255;
        }
      }
      return rgba;
    }
    return null;
  } catch (_) {
    return null;
  }
}

// Reconstruct readable text from pdfjs text items preserving line structure
function reconstructPageText(items: any[]): string {
  if (!items.length) return "";
  const lines: Map<number, string[]> = new Map();
  for (const item of items) {
    const y = Math.round(item.transform?.[5] ?? 0);
    if (!lines.has(y)) lines.set(y, []);
    lines.get(y)!.push(item.str);
  }
  return Array.from(lines.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([, words]) => words.join(" "))
    .join("\n");
}

// Build ExtractedRow documents from page text
function buildRows(pageText: string, page: number, docType: string, jobId: any): any[] {
  if (!pageText.trim()) return [];

  if (docType === "voter_list") {
    const records = parsePageText(pageText, page);

    if (records.length > 0) {
      return records.map((rec, idx) => ({
        jobId, page, rowIndex: idx,
        data: {
          "S.No.":           rec.serialNo,
          "EPIC No.":        rec.epicNo,
          "House No.":       rec.houseNo,
          "Voter Name":      rec.voterName,
          "Father/Husband":  rec.relativeName,
          "Relation":        rec.relation,
          "Gender":          rec.gender,
          "Age":             rec.age,
          "Part/Booth":      rec.partNo ?? "",
          "Polling Station": rec.pollingStation ?? "",
          "Ward":            rec.ward ?? "",
        },
        rawText: pageText.slice(0, 300),
        confidence: 1.0,
        isEdited: false,
      }));
    }
  }

  // Generic / fallback: store every non-empty line
  return pageText
    .split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 2)
    .map((line, idx) => ({
      jobId, page, rowIndex: idx,
      data: { "Content": line },
      rawText: line,
      confidence: 0.8,
      isEdited: false,
    }));
}
