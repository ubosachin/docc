/**
 * Voter List / Electoral Roll Parser
 * ------------------------------------
 * Handles government electoral rolls (Hindi + English) produced by the
 * Election Commission of India and state bodies.
 *
 * Supports both:
 *  - Digital PDFs   → pdfjs text content (already structured)
 *  - Scanned images → Tesseract OCR output (raw text blocks)
 */

export interface VoterRecord {
  /** क्र.सं. / S.No. */
  serialNo: string;
  /** मकान सं. / House No. */
  houseNo: string;
  /** मतदाता का नाम / Voter Name */
  voterName: string;
  /** पिता/पति का नाम / Father/Husband Name */
  relativeName: string;
  /** संबंध / Relation */
  relation: string;
  /** लिंग / Gender */
  gender: string;
  /** आयु / Age */
  age: string;
  /** मतदाता पहचान पत्र क्र. / EPIC No. */
  epicNo: string;
  /** Part No (booth) */
  partNo?: string;
  /** Polling Station */
  pollingStation?: string;
  /** Ward / Constituency */
  ward?: string;
  /** Page number the record was extracted from */
  _page: number;
  /** Original block index */
  _blockIndex: number;
}

// ─── Field label patterns (Hindi + English) ───────────────────────────────────

const LABEL = {
  serialNo: /(?:क्र\.?\s*सं\.?|S\.?\s*No\.?|Serial\s*No\.?|क्रम\s*सं\.?|क्रमांक)[:\s]*/i,
  houseNo:  /(?:मकान\s*(?:सं\.?|क्र\.?|संख्या)|House\s*No\.?|M\.?\s*No\.?)[:\s]*/i,
  voterName:/(?:मतदाता\s*का\s*नाम|नाम|Elector'?s?\s*Name|Voter'?s?\s*Name|Name)[:\s]*/i,
  relative: /(?:पिता|पति|माता|पिता\/पति|Father'?s?\s*Name|Husband'?s?\s*Name|Guardian'?s?\s*Name)[:\s]*/i,
  relation: /(?:संबंध|Relation(?:ship)?)[:\s]*/i,
  gender:   /(?:लिंग|Gender|Sex)[:\s]*/i,
  age:      /(?:आयु|उम्र|Age)[:\s]*/i,
  epicNo:   /(?:EPIC\s*(?:No\.?|क्र\.?)|पहचान\s*पत्र|Elector\s*Photo\s*Identity\s*Card|मतदाता\s*पहचान)[:\s]*/i,
};

const GENDER_MAP: Record<string, string> = {
  "पुरूष": "Male", "पुरुष": "Male", "M": "Male", "Male": "Male",
  "महिला": "Female", "F": "Female", "Female": "Female",
  "अन्य": "Other", "Other": "Other", "O": "Other",
};

// ─── Document type detection ───────────────────────────────────────────────────

export function detectDocumentType(text: string): "voter_list" | "generic" {
  const voterSignals = [
    /मतदाता\s*सूची/,
    /Electoral\s*Roll/i,
    /Voter\s*List/i,
    /Election\s*Commission/i,
    /EPIC/i,
    /मतदाता\s*पहचान/,
    /बूथ\s*संख्या|Booth\s*No/i,
    /पोलिंग\s*स्टेशन|Polling\s*Station/i,
    /मकान\s*सं/,
    /क्र\.?\s*सं/,
  ];
  const matches = voterSignals.filter(p => p.test(text)).length;
  return matches >= 3 ? "voter_list" : "generic";
}

// ─── Strategy 1: Block-based parsing (for structured OCR / digital PDFs) ─────

/**
 * Parse a single OCR/text block that contains one voter card/entry.
 * Expected format (label-colon-value on separate or same line):
 *
 *   क्र.सं.: 1       मकान सं.: 12
 *   नाम: Ramesh Kumar
 *   पिता का नाम: Mohan Lal
 *   लिंग: Male    आयु: 35
 *   EPIC No.: ABC1234567
 */
export function parseVoterBlock(
  block: string,
  page: number,
  blockIndex: number
): VoterRecord | null {
  // Remove noise
  const text = block
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();

  if (text.length < 15) return null;

  // ── Extract each field ────────────────────────────────────────────────────

  const extract = (pattern: RegExp): string => {
    // Match the label then capture until next label or line-end
    const labelPattern = new RegExp(
      pattern.source +
        "([^\\n:]{1,80})(?=\\n|" +
        Object.values(LABEL)
          .map(p => p.source)
          .join("|") +
        "|$)",
      "i"
    );
    const m = text.match(labelPattern);
    return m ? m[1].trim().replace(/\s+/g, " ") : "";
  };

  const serialNo   = extract(LABEL.serialNo);
  const houseNo    = extract(LABEL.houseNo);
  const voterName  = extract(LABEL.voterName);
  const relativeName = extract(LABEL.relative);
  const relation   = extract(LABEL.relation);
  const genderRaw  = extract(LABEL.gender);
  const ageStr     = extract(LABEL.age);
  const epicNo     = extract(LABEL.epicNo);

  // Skip blocks with no identifiable voter data
  if (!voterName && !serialNo && !epicNo) return null;

  const gender = GENDER_MAP[genderRaw] || genderRaw;
  const age    = ageStr.match(/\d+/)?.[0] ?? ageStr;

  return {
    serialNo:     serialNo.replace(/[^0-9]/g, "") || serialNo,
    houseNo:      houseNo,
    voterName:    cleanName(voterName),
    relativeName: cleanName(relativeName),
    relation:     relation,
    gender:       gender,
    age:          age,
    epicNo:       epicNo.replace(/\s+/g, "").toUpperCase(),
    _page:        page,
    _blockIndex:  blockIndex,
  };
}

// ─── Strategy 2: Full-page OCR text parsing (line-by-line) ───────────────────

/**
 * Parse a full page of OCR text. Splits on serial-number markers to find
 * voter card boundaries, then extracts each record.
 */
export function parsePageText(
  text: string,
  page: number
): VoterRecord[] {
  const records: VoterRecord[] = [];

  // Split the page text into voter card sections.
  // Electoral rolls typically start each entry with a serial number.
  const sectionPattern = /(?=(?:क्र\.?\s*सं\.?|S\.?\s*No\.?|Serial\s*No\.?)[:\s]*\d)/i;
  const sections = text.split(sectionPattern).filter(s => s.trim().length > 20);

  if (sections.length <= 1) {
    // Fallback: try line-pair parsing
    return parseLinePairs(text, page);
  }

  sections.forEach((section, idx) => {
    const record = parseVoterBlock(section, page, idx);
    if (record) records.push(record);
  });

  return records;
}

/**
 * Fallback: interpret text as a tabular list where each row is a voter.
 * Tries to detect a header row and map subsequent rows to it.
 */
function parseLinePairs(text: string, page: number): VoterRecord[] {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const records: VoterRecord[] = [];

  // Look for header indicators
  const headerIdx = lines.findIndex(l =>
    /(?:serial|s\.no|क्र|name|नाम|voter|age|gender)/i.test(l) &&
    l.split(/\s{2,}|\t/).length >= 3
  );

  if (headerIdx >= 0) {
    const headers = parseTableHeaders(lines[headerIdx]);
    if (headers.length >= 3) {
      for (let i = headerIdx + 1; i < lines.length; i++) {
        const cells = splitTableRow(lines[i]);
        if (cells.length < 2) continue;
        const record = mapTableRowToRecord(headers, cells, page, i);
        if (record) records.push(record);
      }
      return records;
    }
  }

  // Last resort: look for patterns in consecutive lines
  return extractPatternMatches(text, page);
}

function parseTableHeaders(headerLine: string): string[] {
  return headerLine
    .split(/\s{2,}|\t|\|/)
    .map(h => h.trim())
    .filter(Boolean);
}

function splitTableRow(line: string): string[] {
  return line
    .split(/\s{2,}|\t|\|/)
    .map(c => c.trim())
    .filter(Boolean);
}

function mapTableRowToRecord(
  headers: string[],
  cells: string[],
  page: number,
  rowIndex: number
): VoterRecord | null {
  const map: Record<string, string> = {};
  headers.forEach((h, i) => { if (cells[i]) map[h.toLowerCase()] = cells[i]; });

  const voterName =
    map["voter name"] || map["name"] || map["नाम"] || map["elector name"] || "";
  const serialNo =
    map["s.no"] || map["serial no"] || map["क्र.सं"] || map["क्रमांक"] || "";

  if (!voterName && !serialNo) return null;

  return {
    serialNo:     serialNo,
    houseNo:      map["house no"] || map["मकान सं"] || "",
    voterName:    cleanName(voterName),
    relativeName: map["father's name"] || map["husband's name"] || map["पिता/पति"] || "",
    relation:     map["relation"] || map["संबंध"] || "",
    gender:       GENDER_MAP[map["gender"] || map["लिंग"] || ""] ||
                  map["gender"] || map["लिंग"] || "",
    age:          map["age"] || map["आयु"] || "",
    epicNo:       (map["epic no"] || map["epic"] || "").toUpperCase(),
    _page:        page,
    _blockIndex:  rowIndex,
  };
}

/** Extract records using regex scanning on the full text */
function extractPatternMatches(text: string, page: number): VoterRecord[] {
  const records: VoterRecord[] = [];

  // Match EPIC numbers — each defines a voter record scope
  const epicPattern = /[A-Z]{3}\d{7}/g;
  let m: RegExpExecArray | null;

  while ((m = epicPattern.exec(text)) !== null) {
    const epicNo = m[0];
    // Grab 200 chars before the EPIC as the record context
    const start  = Math.max(0, m.index - 200);
    const chunk  = text.slice(start, m.index + epicNo.length + 50);
    const record = parseVoterBlock(chunk + `\nEPIC No.: ${epicNo}`, page, records.length);
    if (record) {
      record.epicNo = epicNo;
      records.push(record);
    }
  }

  return records;
}

// ─── Spatial block parser (for Tesseract word-level output) ──────────────────

export interface WordItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence?: number;
}

/**
 * Given spatially-positioned word items from Tesseract, reconstruct
 * voter records by finding label-value pairs based on proximity.
 */
export function parseSpatialWords(
  words: WordItem[],
  page: number
): VoterRecord[] {
  if (!words.length) return [];

  // Step 1: Re-group words into logical lines
  const lines = groupWordsIntoLines(words);

  // Step 2: Reconstruct full text from lines for text-based parsing
  const fullText = lines.map(l => l.map(w => w.text).join(" ")).join("\n");

  return parsePageText(fullText, page);
}

/** Groups word items into lines based on Y-coordinate proximity */
function groupWordsIntoLines(words: WordItem[]): WordItem[][] {
  if (!words.length) return [];

  const sorted = [...words].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: WordItem[][] = [];
  let currentLine: WordItem[] = [sorted[0]];
  let lineY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    const word = sorted[i];
    const lineHeight = Math.max(...currentLine.map(w => w.height), 10);
    if (Math.abs(word.y - lineY) <= lineHeight * 0.6) {
      currentLine.push(word);
    } else {
      lines.push(currentLine.sort((a, b) => a.x - b.x));
      currentLine = [word];
      lineY = word.y;
    }
  }
  if (currentLine.length) lines.push(currentLine.sort((a, b) => a.x - b.x));

  return lines;
}

// ─── Record → Excel column mapping ───────────────────────────────────────────

export const VOTER_EXCEL_COLUMNS = [
  { header: "S.No.",             key: "serialNo",     width: 8  },
  { header: "EPIC No.",          key: "epicNo",       width: 14 },
  { header: "House No.",         key: "houseNo",      width: 12 },
  { header: "Voter Name",        key: "voterName",    width: 28 },
  { header: "Father/Husband",    key: "relativeName", width: 28 },
  { header: "Relation",         key: "relation",     width: 12 },
  { header: "Gender",            key: "gender",       width: 10 },
  { header: "Age",               key: "age",          width: 6  },
  { header: "Part/Booth",        key: "partNo",       width: 10 },
  { header: "Polling Station",   key: "pollingStation",width: 30},
  { header: "Ward",              key: "ward",         width: 16 },
  { header: "Page",              key: "_page",        width: 8  },
];

export const GENERIC_EXCEL_COLUMNS = [
  { header: "Page",    key: "page",    width: 8  },
  { header: "Content", key: "content", width: 80 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cleanName(raw: string): string {
  return raw
    .replace(/^[\s\-:.,]+|[\s\-:.,]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
