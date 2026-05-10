import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { Job, ExtractedRow, Export } from "@/lib/db/models";
import { adminAuth } from "@/lib/firebase/admin";
import ExcelJS from "exceljs";
import { UTApi } from "uploadthing/server";

const utapi = new UTApi();

export async function POST(
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

    // Create Excel Workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Extracted Data");

    // Get all unique keys for columns
    const allKeys = new Set<string>();
    rows.forEach(row => {
      Object.keys(row.data).forEach(key => allKeys.add(key));
    });
    const columnKeys = Array.from(allKeys);

    // Set columns
    worksheet.columns = [
      { header: "Page", key: "page", width: 10 },
      ...columnKeys.map(key => ({ header: key, key: key, width: 30 }))
    ];

    // Add rows
    rows.forEach(row => {
      const rowData: any = { page: row.page };
      columnKeys.forEach(key => {
        rowData[key] = row.data[key] || "";
      });
      worksheet.addRow(rowData);
    });

    // Formatting
    worksheet.getRow(1).font = { bold: true };
    worksheet.eachRow((row, rowNumber) => {
      row.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    });

    const buffer = await workbook.xlsx.writeBuffer();

    // Since we want to return the file directly and also maybe store it
    // The user wants: "User downloads Excel"
    
    // We can return it directly as a response
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="extracted_data_${id}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error("Export Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
