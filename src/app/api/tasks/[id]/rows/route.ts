import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { Job, ExtractedRow } from "@/lib/db/models";
import { requireAuth, AuthError } from "@/lib/auth/requireAuth";

export async function GET(
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

    const rows = await ExtractedRow.find({ jobId: job._id })
      .sort({ page: 1, rowIndex: 1 })
      .lean();

    // Coerce Mongoose Map → plain object for correct JSON serialization
    const normalizedRows = (rows as any[]).map((row: any) => ({
      ...row,
      data: row.data instanceof Map
        ? Object.fromEntries(row.data)
        : (typeof row.data?.toObject === "function" ? row.data.toObject() : row.data) ?? {},
    }));

    return NextResponse.json(normalizedRows);
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("GET Rows Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(req);
    const { id } = await params;
    const { rowId, data } = await req.json();

    await dbConnect();
    const updatedRow = await ExtractedRow.findOneAndUpdate(
      { _id: rowId, jobId: id },
      { data, isEdited: true },
      { new: true }
    );

    if (!updatedRow) {
      return NextResponse.json({ error: "Row not found" }, { status: 404 });
    }

    return NextResponse.json(updatedRow);
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("PATCH Row Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
