import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { Job, ExtractedRow, Upload } from "@/lib/db/models";
import { extractTextFromPDF, processPageText, isScannedPDF, detectLanguages } from "@/lib/extraction/pdfProcessor";
import { preprocessImage } from "@/lib/extraction/imageProcessor";
import * as Tesseract from "tesseract.js";
import { Canvas } from "skia-canvas";

export async function POST(req: NextRequest) {
  try {
    const { uploadId } = await req.json();
    if (!uploadId) return NextResponse.json({ error: "Missing uploadId" }, { status: 400 });

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

    // Start background processing
    (async () => {
      try {
        const response = await fetch(upload.fileUrl);
        if (!response.ok) throw new Error("Failed to fetch PDF");
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        const { pdfDocument, numPages } = await extractTextFromPDF(buffer);
        const isScanned = await isScannedPDF(pdfDocument);
        
        await Job.findByIdAndUpdate(job._id, { 
          totalPages: numPages, 
          currentStep: `Processing ${numPages} pages (${isScanned ? "OCR" : "Direct"})...` 
        });

        for (let i = 1; i <= numPages; i++) {
          await Job.findByIdAndUpdate(job._id, { 
            progress: Math.round((i / numPages) * 95),
            currentStep: `Processing Page ${i} of ${numPages}...`,
            processedPages: i
          });

          let blocks: any[] = [];

          if (isScanned) {
            // OCR Path - Render at 400 DPI equivalent
            const page = await pdfDocument.getPage(i);
            const scale = 3200 / page.getViewport({ scale: 1 }).width;
            const viewport = page.getViewport({ scale });
            
            const canvas = new Canvas(viewport.width, viewport.height);
            const context = canvas.getContext("2d");
            
            await page.render({
              canvasContext: context,
              viewport: viewport,
            }).promise;
            
            const pageImageBuffer = await canvas.toBuffer("png");
            
            // Preprocess image for OCR fidelity
            const processedImage = await preprocessImage(pageImageBuffer);
            
            const worker = await Tesseract.createWorker(["eng", "hin", "ben", "mar", "pan", "guj"]);
            const { data } = await worker.recognize(processedImage);
            await worker.terminate();
            
            // Map Tesseract blocks to our format
            blocks = data.blocks?.map((block: any) => block.paragraphs.flatMap((p: any) => p.lines.flatMap((l: any) => l.words.map((w: any) => ({
              text: w.text,
              x: w.bbox.x0,
              y: w.bbox.y0,
              width: w.bbox.x1 - w.bbox.x0,
              height: w.bbox.y1 - w.bbox.y0,
              confidence: w.confidence
            }))))) || [];
            
            // Re-group into our block format
            blocks = groupIntoSpatialBlocks(blocks);
          } else {
            // Direct Path
            blocks = await processPageText(pdfDocument, i);
          }
          
          const rowsToInsert = blocks.map((block, blockIndex) => {
            const rawText = Array.isArray(block) ? block.map((item: any) => item.text).join(" ") : block.text;
            const data: Record<string, any> = { "Content": rawText };
            
            if (Array.isArray(block)) {
              block.forEach((item: any, idx: number) => {
                data[`Field ${idx + 1}`] = item.text;
              });
            }

            return {
              jobId: job._id,
              page: i,
              rowIndex: blockIndex,
              data: data,
              rawText: rawText,
              confidence: Array.isArray(block) ? (block[0] as any).confidence || 1.0 : 1.0,
              isEdited: false
            };
          });

          if (rowsToInsert.length > 0) {
            await ExtractedRow.insertMany(rowsToInsert);
          }
        }

        await Job.findByIdAndUpdate(job._id, {
          progress: 100,
          status: "completed",
          currentStep: "Extraction complete"
        });
      } catch (err: any) {
        console.error("Process API Error:", err);
        await Job.findByIdAndUpdate(job._id, { status: "failed", currentStep: "Error: " + err.message, error: err.message });
      }
    })();

    return NextResponse.json({ message: "Process triggered", jobId: job._id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Groups raw OCR word/line items into logical spatial blocks
 */
function groupIntoSpatialBlocks(items: any[]) {
  if (!items || items.length === 0) return [];
  
  const blocks: any[][] = [];
  const used = new Set<number>();
  
  for (let i = 0; i < items.length; i++) {
    if (used.has(i)) continue;
    const block = [items[i]];
    used.add(i);
    
    const box = {
      minX: items[i].x,
      maxX: items[i].x + items[i].width,
      minY: items[i].y,
      maxY: items[i].y + items[i].height
    };
    
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (let j = 0; j < items.length; j++) {
        if (used.has(j)) continue;
        const item = items[j];
        
        const xOverlap = Math.max(0, Math.min(box.maxX, item.x + item.width) - Math.max(box.minX, item.x));
        const yOverlap = Math.max(0, Math.min(box.maxY, item.y + item.height) - Math.max(box.minY, item.y));
        
        const xDist = Math.min(Math.abs(item.x - box.maxX), Math.abs(item.x + item.width - box.minX));
        const yDist = Math.min(Math.abs(item.y - box.maxY), Math.abs(item.y - box.minY));
        
        // OCR blocks are usually tighter
        if ((xOverlap > 0 && yDist < 10) || (yOverlap > 0 && xDist < 15)) {
          block.push(item);
          used.add(j);
          box.minX = Math.min(box.minX, item.x);
          box.maxX = Math.max(box.maxX, item.x + item.width);
          box.minY = Math.min(box.minY, item.y);
          box.maxY = Math.max(box.maxY, item.y + item.height);
          expanded = true;
        }
      }
    }
    blocks.push(block);
  }
  
  return blocks.sort((a, b) => {
    // Sort by Y descending (Top to Bottom)
    if (Math.abs(b[0].y - a[0].y) > 15) return b[0].y - a[0].y;
    // Then by X ascending (Left to Right)
    return a[0].x - b[0].x;
  });
}
