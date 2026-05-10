import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { Job, ExtractedRow, Upload } from "@/lib/db/models";
import { extractTextFromPDF, processPageText, isScannedPDF } from "@/lib/extraction/pdfProcessor";
import { preprocessImage } from "@/lib/extraction/imageProcessor";
import {
  detectDocumentType,
  parsePageText,
  parseSpatialWords,
  VoterRecord,
} from "@/lib/extraction/voterListParser";
import * as Tesseract from "tesseract.js";
import { Canvas } from "skia-canvas";
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

    // ── Background processing ──────────────────────────────────────────────────
    (async () => {
      try {
        const response = await fetch(upload.fileUrl);
        if (!response.ok)
          throw new Error(`Failed to fetch PDF from storage (HTTP ${response.status})`);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        if (buffer.length === 0) throw new Error("Downloaded PDF is empty");

        // ── Load PDF ──────────────────────────────────────────────────────────
        let pdfDocument: any;
        let numPages: number;
        try {
          const result = await extractTextFromPDF(buffer);
          pdfDocument = result.pdfDocument;
          numPages    = result.numPages;
        } catch (pdfErr: any) {
          throw new Error(`PDF initialization failed: ${pdfErr.message}`);
        }

        if (!numPages || numPages === 0) throw new Error("PDF has no readable pages");

        const isScanned = await isScannedPDF(pdfDocument);

        await Job.findByIdAndUpdate(job._id, {
          totalPages:  numPages,
          currentStep: `Detecting document type & structure...`,
        });

        // ── Sniff document type from first two pages ───────────────────────────
        let docType: "voter_list" | "generic" = "generic";
        try {
          let sampleText = "";
          for (let sn = 1; sn <= Math.min(2, numPages); sn++) {
            const pg = await pdfDocument.getPage(sn);
            const tc = await pg.getTextContent();
            sampleText += tc.items.map((it: any) => it.str).join(" ") + "\n";
          }
          docType = detectDocumentType(sampleText);
        } catch (_) { /* keep generic */ }

        await Job.findByIdAndUpdate(job._id, {
          currentStep: `Processing ${numPages} pages [${docType === "voter_list" ? "Voter List" : "Document"} / ${isScanned ? "OCR" : "Digital"}]...`,
        });

        // ── Set up Tesseract if needed ─────────────────────────────────────────
        let tesseractWorker: Tesseract.Worker | null = null;
        if (isScanned) {
          tesseractWorker = await Tesseract.createWorker([
            "eng", "hin", "ben", "mar", "pan", "guj",
          ]);
        }

        // ── Page-by-page extraction ────────────────────────────────────────────
        for (let i = 1; i <= numPages; i++) {
          await Job.findByIdAndUpdate(job._id, {
            progress:       Math.round((i / numPages) * 95),
            currentStep:    `Processing Page ${i} of ${numPages}...`,
            processedPages: i,
          });

          let pageTextFull = "";       // full plain text from this page
          let wordItems: any[] = [];   // spatial word list (OCR path)

          // ── Render / extract page content ─────────────────────────────────
          if (isScanned && tesseractWorker) {
            // ── OCR Path ────────────────────────────────────────────────────
            const page     = await pdfDocument.getPage(i);
            const scale    = 3200 / page.getViewport({ scale: 1 }).width;
            const viewport = page.getViewport({ scale });

            try {
              const canvas  = new Canvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
              const context = canvas.getContext("2d") as any;

              // drawImage shim: pdfjs creates internal CanvasElement objects
              // (not skia-canvas) for inline images. Convert them via ImageData.
              const _origDraw = context.drawImage.bind(context);
              context.drawImage = function (src: any, ...args: any[]) {
                if (src && typeof src === "object" && !(src instanceof Canvas)) {
                  try {
                    const raw = src.canvas ?? src;
                    if (raw && typeof raw.getContext === "function") {
                      const rc  = raw.getContext("2d");
                      const w   = raw.width  || 1;
                      const h   = raw.height || 1;
                      if (rc && typeof rc.getImageData === "function") {
                        const id  = rc.getImageData(0, 0, w, h);
                        const tmp = new Canvas(w, h);
                        tmp.getContext("2d").putImageData(id, 0, 0);
                        return _origDraw(tmp, ...args);
                      }
                    }
                  } catch (_) { return; }
                }
                return _origDraw(src, ...args);
              };

              await page.render({ canvasContext: context, viewport }).promise;

              const rawPng        = await canvas.toBuffer("png");
              const processedPng  = await preprocessImage(rawPng);
              const { data }      = await tesseractWorker.recognize(processedPng);

              // Collect spatial words
              wordItems = (data.blocks ?? []).flatMap((b: any) =>
                b.paragraphs.flatMap((p: any) =>
                  p.lines.flatMap((l: any) =>
                    l.words.map((w: any) => ({
                      text:       w.text,
                      x:          w.bbox.x0,
                      y:          w.bbox.y0,
                      width:      w.bbox.x1 - w.bbox.x0,
                      height:     w.bbox.y1 - w.bbox.y0,
                      confidence: w.confidence,
                    }))
                  )
                )
              );

              // Build full page text for text-based parsers
              pageTextFull = (data.blocks ?? [])
                .flatMap((b: any) =>
                  b.paragraphs.flatMap((p: any) =>
                    p.lines.map((l: any) => l.words.map((w: any) => w.text).join(" "))
                  )
                )
                .join("\n");
            } catch (renderErr: any) {
              console.error(`Page ${i} OCR failed:`, renderErr.message);
            }
          } else {
            // ── Digital PDF Path ─────────────────────────────────────────────
            const blocks = await processPageText(pdfDocument, i);
            pageTextFull = blocks
              .map(block =>
                (Array.isArray(block) ? block : [block])
                  .map((it: any) => it.text || "")
                  .join(" ")
              )
              .join("\n");
          }

          // ── Parse page content into records ──────────────────────────────────
          let rowsToInsert: any[] = [];

          if (docType === "voter_list") {
            // ── Voter List: structured record extraction ──────────────────────
            const records: VoterRecord[] =
              isScanned && wordItems.length
                ? parseSpatialWords(wordItems, i)
                : parsePageText(pageTextFull, i);

            rowsToInsert = records.map((rec, idx) => ({
              jobId:      job._id,
              page:       i,
              rowIndex:   idx,
              data: {
                "S.No.":           rec.serialNo,
                "EPIC No.":        rec.epicNo,
                "House No.":       rec.houseNo,
                "Voter Name":      rec.voterName,
                "Father/Husband":  rec.relativeName,
                "Relation":        rec.relation,
                "Gender":          rec.gender,
                "Age":             rec.age,
                "Part/Booth":      rec.partNo     ?? "",
                "Polling Station": rec.pollingStation ?? "",
                "Ward":            rec.ward        ?? "",
              },
              rawText:    pageTextFull.slice(0, 500),
              confidence: 1.0,
              isEdited:   false,
            }));

            // Fallback: if structured parsing found nothing, store raw text lines
            if (rowsToInsert.length === 0 && pageTextFull.trim()) {
              rowsToInsert = pageTextFull
                .split("\n")
                .map(l => l.trim())
                .filter(l => l.length > 3)
                .map((line, idx) => ({
                  jobId:    job._id,
                  page:     i,
                  rowIndex: idx,
                  data:     { "Content": line },
                  rawText:  line,
                  confidence: 0.5,
                  isEdited: false,
                }));
            }
          } else {
            // ── Generic document: store text lines / blocks ───────────────────
            const lines = pageTextFull
              .split("\n")
              .map(l => l.trim())
              .filter(l => l.length > 2);

            rowsToInsert = lines.map((line, idx) => ({
              jobId:      job._id,
              page:       i,
              rowIndex:   idx,
              data:       { "Content": line },
              rawText:    line,
              confidence: 1.0,
              isEdited:   false,
            }));
          }

          if (rowsToInsert.length > 0) {
            await ExtractedRow.insertMany(rowsToInsert);
          }
        }

        if (tesseractWorker) await tesseractWorker.terminate();

        await Job.findByIdAndUpdate(job._id, {
          progress:    100,
          status:      "completed",
          currentStep: `Extraction complete — document type: ${docType}`,
        });
      } catch (err: any) {
        console.error("Process API Error:", err);
        await Job.findByIdAndUpdate(job._id, {
          status:      "failed",
          currentStep: "Error: " + err.message,
          error:       err.message,
        });
      }
    })();

    return NextResponse.json({ message: "Process triggered", jobId: job._id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
