import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db/mongodb";
import { Job, ExtractedRow } from "@/lib/db/models";
import { requireAuth, AuthError } from "@/lib/auth/requireAuth";
import ExcelJS from "exceljs";
import { VOTER_EXCEL_COLUMNS } from "@/lib/extraction/voterListParser";

// ── Colour palette ─────────────────────────────────────────────────────────────
const HEADER_BG   = "1A237E"; // Deep navy
const HEADER_FG   = "FFFFFF";
const ALT_ROW_BG  = "E8EAF6"; // Soft lavender
const BORDER_CLR  = "9FA8DA";

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

    const rows = await ExtractedRow.find({ jobId: job._id })
      .sort({ page: 1, rowIndex: 1 })
      .lean();

    // Normalise Mongoose Map → plain object
    const normalizedRows = rows.map((row: any) => ({
      ...row,
      data:
        row.data instanceof Map
          ? Object.fromEntries(row.data)
          : typeof row.data?.toObject === "function"
          ? row.data.toObject()
          : row.data ?? {},
    }));

    // ── Detect if this is a voter list export ──────────────────────────────────
    const sampleKeys = Object.keys(normalizedRows[0]?.data ?? {});
    const isVoterList =
      sampleKeys.includes("Voter Name") ||
      sampleKeys.includes("EPIC No.") ||
      sampleKeys.includes("S.No.");

    // ── Build workbook ─────────────────────────────────────────────────────────
    const workbook  = new ExcelJS.Workbook();
    workbook.creator = "DocuExtract AI";
    workbook.created = new Date();

    if (isVoterList) {
      await buildVoterListSheet(workbook, normalizedRows, job);
    } else {
      await buildGenericSheet(workbook, normalizedRows, job);
    }

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="extracted_${id}.xlsx"`,
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

// ─── Voter List Sheet ──────────────────────────────────────────────────────────

async function buildVoterListSheet(
  wb: ExcelJS.Workbook,
  rows: any[],
  job: any
) {
  const ws = wb.addWorksheet("Voter Data", {
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true },
    views: [{ state: "frozen", xSplit: 0, ySplit: 2 }],
  });

  // ── Title row ────────────────────────────────────────────────────────────────
  ws.addRow(["Electoral Roll — Extracted Data"]);
  const titleCell = ws.getCell("A1");
  titleCell.font  = { bold: true, size: 14, color: { argb: "FF" + HEADER_BG } };
  ws.mergeCells(`A1:${columnLetter(VOTER_EXCEL_COLUMNS.length)}1`);

  // ── Column definitions ────────────────────────────────────────────────────────
  ws.columns = VOTER_EXCEL_COLUMNS.map(col => ({
    header: col.header,
    key:    col.key,
    width:  col.width,
  }));

  // ── Style header row (row 2 after title) ─────────────────────────────────────
  // We need to add the header row manually since we have a title row above
  const headerRowValues = VOTER_EXCEL_COLUMNS.map(c => c.header);
  const headerRow = ws.addRow(headerRowValues);
  styleHeaderRow(headerRow, VOTER_EXCEL_COLUMNS.length);

  // ── Data rows ─────────────────────────────────────────────────────────────────
  let rowNum = 0;
  let prevPage = -1;

  rows.forEach(row => {
    const d = row.data;

    // Insert a light separator when the page changes
    if (row.page !== prevPage && prevPage !== -1) {
      const sepRow = ws.addRow(
        Array(VOTER_EXCEL_COLUMNS.length).fill("")
      );
      sepRow.height = 4;
      applyBackground(sepRow, "D0D0D0", VOTER_EXCEL_COLUMNS.length);
    }
    prevPage = row.page;

    const dataRow = ws.addRow({
      serialNo:       d["S.No."]          ?? "",
      epicNo:         d["EPIC No."]       ?? "",
      houseNo:        d["House No."]      ?? "",
      voterName:      d["Voter Name"]     ?? "",
      relativeName:   d["Father/Husband"] ?? "",
      relation:       d["Relation"]       ?? "",
      gender:         d["Gender"]         ?? "",
      age:            d["Age"]            ?? "",
      partNo:         d["Part/Booth"]     ?? "",
      pollingStation: d["Polling Station"]?? "",
      ward:           d["Ward"]           ?? "",
      _page:          row.page,
    });

    dataRow.height = 18;

    // Alternate row shading
    if (rowNum % 2 === 0) {
      applyBackground(dataRow, ALT_ROW_BG, VOTER_EXCEL_COLUMNS.length);
    }

    // Style cells
    dataRow.eachCell((cell, colIdx) => {
      const colDef = VOTER_EXCEL_COLUMNS[colIdx - 1];
      cell.alignment = {
        vertical:   "middle",
        horizontal: colDef?.key === "age" || colDef?.key === "serialNo" ? "center" : "left",
        wrapText:   false,
      };
      cell.border = {
        bottom: { style: "thin", color: { argb: "FF" + BORDER_CLR } },
        right:  { style: "hair", color: { argb: "FF" + BORDER_CLR } },
      };
    });

    // Highlight voter name in bold
    dataRow.getCell("voterName").font    = { bold: true };
    dataRow.getCell("relativeName").font = { italic: true };

    rowNum++;
  });

  // ── Summary row ───────────────────────────────────────────────────────────────
  const totalVoters = rows.filter(
    r => r.data["Voter Name"] && r.data["Voter Name"].trim()
  ).length;

  const summaryRow = ws.addRow([`Total Records: ${totalVoters}`, ...Array(VOTER_EXCEL_COLUMNS.length - 1).fill("")]);
  summaryRow.getCell(1).font = { bold: true, italic: true, size: 11 };
  ws.mergeCells(
    `A${summaryRow.number}:${columnLetter(VOTER_EXCEL_COLUMNS.length)}${summaryRow.number}`
  );

  // ── Auto-filter on header ─────────────────────────────────────────────────────
  ws.autoFilter = {
    from: { row: 2, column: 1 },
    to:   { row: 2, column: VOTER_EXCEL_COLUMNS.length },
  };
}

// ─── Generic Document Sheet ───────────────────────────────────────────────────

async function buildGenericSheet(
  wb: ExcelJS.Workbook,
  rows: any[],
  job: any
) {
  const ws = wb.addWorksheet("Extracted Data", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 1 }],
  });

  // Collect all unique keys
  const allKeys = new Set<string>();
  rows.forEach(row => Object.keys(row.data).forEach(k => allKeys.add(k)));
  const colKeys = Array.from(allKeys);

  ws.columns = [
    { header: "Page", key: "page", width: 8 },
    ...colKeys.map(k => ({ header: k, key: k, width: Math.max(20, k.length + 4) })),
  ];

  const headerRow = ws.getRow(1);
  styleHeaderRow(headerRow, colKeys.length + 1);

  rows.forEach((row, idx) => {
    const rowData: Record<string, any> = { page: row.page };
    colKeys.forEach(k => { rowData[k] = row.data[k] ?? ""; });
    const dataRow = ws.addRow(rowData);
    dataRow.height = 18;
    if (idx % 2 === 0) applyBackground(dataRow, ALT_ROW_BG, colKeys.length + 1);
    dataRow.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  });

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colKeys.length + 1 } };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function styleHeaderRow(row: ExcelJS.Row, colCount: number) {
  row.height = 24;
  row.eachCell((cell, colIdx) => {
    if (colIdx > colCount) return;
    cell.font       = { bold: true, color: { argb: "FF" + HEADER_FG }, size: 11 };
    cell.fill       = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + HEADER_BG } };
    cell.alignment  = { vertical: "middle", horizontal: "center", wrapText: false };
    cell.border     = {
      top:    { style: "thin", color: { argb: "FFFFFFFF" } },
      bottom: { style: "medium", color: { argb: "FFFFFFFF" } },
      right:  { style: "thin", color: { argb: "FFFFFFFF" } },
    };
  });
}

function applyBackground(row: ExcelJS.Row, argbColor: string, colCount: number) {
  row.eachCell((cell, colIdx) => {
    if (colIdx > colCount) return;
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + argbColor } };
  });
}

/** Convert 1-based column index to Excel letter (1→A, 27→AA, …) */
function columnLetter(n: number): string {
  let result = "";
  while (n > 0) {
    n--;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}
