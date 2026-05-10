import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { Job } from "@/lib/db/models";
import { adminAuth } from "@/lib/firebase/admin";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth().verifyIdToken(idToken);
    const userId = decodedToken.uid;

    await dbConnect();
    const jobs = await Job.find({ userId }).sort({ createdAt: -1 });

    return NextResponse.json(jobs);
  } catch (error: any) {
    console.error("GET Tasks Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
