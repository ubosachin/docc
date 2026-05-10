/**
 * Advanced extraction logic for complex government voter lists
 */

export interface VoterRecord {
  serialNo: string;
  houseNo: string;
  voterName: string;
  relativeName: string;
  gender: string;
  age: string;
  booth?: string;
  ward?: string;
}

export function extractVoterData(text: string): VoterRecord[] {
  // Regex patterns for different fields (multilingual support)
  const patterns = {
    serial: /(?:S\.?No\.?|क्र\.?)\s*[:\-\s]*(\d+)/i,
    house: /(?:House No\.?|मकान संख्या)\s*[:\-\s]*([^\n]+)/i,
    name: /(?:Name|नाम)\s*[:\-\s]*([^\n]+)/i,
    relative: /(?:Father's Name|Husband's Name|पिता\/पति का नाम)\s*[:\-\s]*([^\n]+)/i,
    gender: /(?:Gender|लिंग)\s*[:\-\s]*(Male|Female|Others|पुरूष|महिला)/i,
    age: /(?:Age|आयु)\s*[:\-\s]*(\d+)/i,
  };

  const records: VoterRecord[] = [];
  
  // Voter lists are often arranged in boxes.
  // We look for "Serial No" as a marker for a new record.
  const blocks = text.split(/(?=Serial No|क्र\.?)/i);

  blocks.forEach(block => {
    if (block.length < 20) return; // Skip small fragments

    const record: any = {};
    
    for (const [key, pattern] of Object.entries(patterns)) {
      const match = block.match(pattern);
      if (match) {
        record[key] = match[1].trim();
      }
    }

    if (record.name || record.serial) {
      records.push({
        serialNo: record.serial || "",
        houseNo: record.house || "",
        voterName: record.name || "",
        relativeName: record.relative || "",
        gender: record.gender || "",
        age: record.age || "",
      });
    }
  });

  return records;
}

/**
 * Normalizes messy OCR text for better parsing
 */
export function cleanOCRText(text: string): string {
  return text
    .replace(/[|]/g, "I") // Fix vertical bar as I
    .replace(/[©®]/g, "") // Remove OCR noise symbols
    .replace(/\s+/g, " ")  // Normalize whitespace
    .trim();
}
