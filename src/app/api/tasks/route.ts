import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { Job, Upload } from "@/lib/db/models";
import { requireAuth, AuthError } from "@/lib/auth/requireAuth";

export async function GET(req: NextRequest) {
  try {
    const userId = await requireAuth(req);

    await dbConnect();

    // Populate the Upload document so the UI gets `filename`
    const jobs = await Job.find({ userId })
      .sort({ createdAt: -1 })
      .populate("uploadId", "filename fileUrl size")
      .lean();

    // Flatten: merge upload fields into the job object for simpler frontend consumption
    const jobsWithFilename = jobs.map((job: any) => ({
      ...job,
      filename: job.uploadId?.filename ?? "Unknown file",
      fileUrl: job.uploadId?.fileUrl ?? null,
      fileSize: job.uploadId?.size ?? null,
      uploadId: job.uploadId?._id ?? job.uploadId,
    }));

    return NextResponse.json(jobsWithFilename);
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("GET Tasks Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
