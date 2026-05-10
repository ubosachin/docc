import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { Job, ExtractedRow } from "@/lib/db/models";
import { requireAuth, AuthError } from "@/lib/auth/requireAuth";
import ExcelJS from "exceljs";

export async function POST(
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

    // .lean() converts Mongoose docs (including Map fields) to plain JS objects
    const rows = await ExtractedRow.find({ jobId: job._id })
      .sort({ page: 1, rowIndex: 1 })
      .lean();

    // Coerce data field: Mongoose Map → plain object (handles both lean() and non-lean paths)
    const normalizedRows = rows.map((row: any) => ({
      ...row,
      data: row.data instanceof Map
        ? Object.fromEntries(row.data)
        : (typeof row.data?.toObject === "function" ? row.data.toObject() : row.data) ?? {},
    }));

    // Build Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Extracted Data");

    // Collect all unique data keys for columns
    const allKeys = new Set<string>();
    normalizedRows.forEach(row => {
      Object.keys(row.data).forEach(key => allKeys.add(key));
    });
    const columnKeys = Array.from(allKeys);

    worksheet.columns = [
      { header: "Page", key: "page", width: 10 },
      ...columnKeys.map(key => ({ header: key, key, width: 30 })),
    ];

    normalizedRows.forEach(row => {
      const rowData: Record<string, any> = { page: row.page };
      columnKeys.forEach(key => {
        rowData[key] = row.data[key] ?? "";
      });
      worksheet.addRow(rowData);
    });

    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.eachRow(row => {
      row.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="extracted_data_${id}.xlsx"`,
      },
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Export Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
