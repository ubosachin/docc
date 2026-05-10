import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { Job, ExtractedRow } from "@/lib/db/models";
import { adminAuth } from "@/lib/firebase/admin";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const { id } = await params;

    await dbConnect();
    const job = await Job.findOne({ _id: id, userId });

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const rows = await ExtractedRow.find({ jobId: job._id }).sort({ page: 1, rowIndex: 1 });

    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("GET Rows Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    await adminAuth().verifyIdToken(idToken);

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
    console.error("PATCH Row Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
