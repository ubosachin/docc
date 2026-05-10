import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { Job, ExtractedRow, Upload } from "@/lib/db/models";
import { requireAuth, AuthError } from "@/lib/auth/requireAuth";
import { UTApi } from "uploadthing/server";

const utapi = new UTApi();

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireAuth(req);
    const { id } = await params;

    await dbConnect();
    const job = await Job.findOne({ _id: id, userId });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // 1. Delete extracted rows
    await ExtractedRow.deleteMany({ jobId: job._id });

    // 2. Delete upload and file from UploadThing
    const upload = await Upload.findById(job.uploadId);
    if (upload) {
      try {
        await utapi.deleteFiles(upload.fileKey);
      } catch (err) {
        console.error("Failed to delete file from UploadThing:", err);
      }
      await Upload.findByIdAndDelete(upload._id);
    }

    // 3. Delete job
    await Job.findByIdAndDelete(job._id);

    return NextResponse.json({ message: "Job deleted successfully" });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("DELETE Job Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
