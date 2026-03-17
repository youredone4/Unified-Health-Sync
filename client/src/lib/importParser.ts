import * as XLSX from "xlsx";

export interface NormalizedRow {
  barangay: string;
  disease_name: string;
  cases: number;
  reporting_date: string;
}

export interface ParseError {
  file: string;
  row: number;
  reason: string;
}

export interface ParseResult {
  valid: NormalizedRow[];
  errors: ParseError[];
  totalRows: number;
}

const KNOWN_BARANGAYS = [
  "Amoslog", "Anislagan", "Bad-as", "Boyongan", "Bugas-bugas",
  "Central (Poblacion)", "Ellaperal (Nonok)", "Ipil (Poblacion)", "Lakandula",
  "Mabini", "Macalaya", "Magsaysay (Poblacion)", "Magupange", "Pananay-an",
  "Panhutongan", "San Isidro", "Sani-sani", "Santa Cruz", "Suyoc", "Tagbongabong",
];

const COL_MAP: Record<string, string[]> = {
  barangay: ["barangay", "brgy", "barangay_name", "location", "area", "purok", "bgy"],
  disease_name: ["disease", "disease_name", "category", "condition", "illness", "diagnosis", "disease_type", "type", "name"],
  cases: ["cases", "total", "count", "num_cases", "number", "no_of_cases", "case_count", "reported_cases", "no"],
  reporting_date: ["date", "reporting_date", "date_reported", "report_date", "period", "week", "month", "reportdate", "year_month"],
};

function norm(s: string): string {
  return String(s).toLowerCase().replace(/[\s\-]+/g, "_").replace(/[^a-z0-9_]/g, "").trim();
}

function detectColumn(headers: string[], field: string): number {
  const synonyms = COL_MAP[field].map(norm);
  for (let i = 0; i < headers.length; i++) {
    if (headers[i] != null && synonyms.includes(norm(String(headers[i])))) return i;
  }
  return -1;
}

function matchBarangay(raw: string): string {
  const normalized = raw.toLowerCase().trim();
  for (const b of KNOWN_BARANGAYS) {
    if (b.toLowerCase() === normalized) return b;
  }
  for (const b of KNOWN_BARANGAYS) {
    if (normalized.includes(b.toLowerCase().replace(/[()]/g, "").split(" ")[0])) return b;
  }
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function barangayFromFilename(filename: string): string | null {
  const base = filename.replace(/\.(csv|xls|xlsx)$/i, "").trim();
  if (!base) return null;
  return matchBarangay(base);
}

function formatDate(val: unknown): string {
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) {
      return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    }
  }
  const str = String(val ?? "").trim();
  if (!str) return new Date().toISOString().split("T")[0];
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];
  return str;
}

function processSheet(
  ws: XLSX.WorkSheet,
  filename: string,
  sheetName: string,
  filenameBarangay: string | null
): { valid: NormalizedRow[]; errors: ParseError[]; totalRows: number } {
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
  const valid: NormalizedRow[] = [];
  const errors: ParseError[] = [];

  const nonEmpty = raw.filter(row => row.some(c => c !== null && String(c).trim() !== ""));
  if (nonEmpty.length < 2) return { valid, errors, totalRows: 0 };

  const headers = (nonEmpty[0] as string[]).map(h => String(h ?? ""));
  const dataRows = nonEmpty.slice(1);
  const totalRows = dataRows.length;

  const brgyIdx = detectColumn(headers, "barangay");
  const diseaseIdx = detectColumn(headers, "disease_name");
  const casesIdx = detectColumn(headers, "cases");
  const dateIdx = detectColumn(headers, "reporting_date");

  const fileLabel = sheetName !== "Sheet1" ? `${filename} [${sheetName}]` : filename;

  if (diseaseIdx === -1) {
    errors.push({ file: fileLabel, row: 0, reason: `No disease column found. Headers: ${headers.join(", ")}` });
    return { valid, errors, totalRows };
  }
  if (casesIdx === -1) {
    errors.push({ file: fileLabel, row: 0, reason: `No cases column found. Headers: ${headers.join(", ")}` });
    return { valid, errors, totalRows };
  }

  dataRows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const r = row as unknown[];

    const diseaseRaw = String(r[diseaseIdx] ?? "").trim();
    if (!diseaseRaw) return;

    let barangay = "";
    if (brgyIdx !== -1 && r[brgyIdx] != null && String(r[brgyIdx]).trim()) {
      barangay = matchBarangay(String(r[brgyIdx]).trim());
    } else if (filenameBarangay) {
      barangay = filenameBarangay;
    }
    if (!barangay) {
      errors.push({ file: fileLabel, row: rowNum, reason: "Cannot determine barangay (no barangay column and filename not recognized)" });
      return;
    }

    const casesRaw = r[casesIdx];
    const cases = parseFloat(String(casesRaw ?? "0").replace(/,/g, ""));
    if (isNaN(cases) || cases < 0) {
      errors.push({ file: fileLabel, row: rowNum, reason: `Invalid case count: "${casesRaw}"` });
      return;
    }

    const reporting_date = dateIdx !== -1 ? formatDate(r[dateIdx]) : new Date().toISOString().split("T")[0];

    valid.push({ barangay, disease_name: diseaseRaw, cases: Math.max(1, Math.round(cases)), reporting_date });
  });

  return { valid, errors, totalRows };
}

export async function parseFile(file: File): Promise<ParseResult> {
  const filename = file.name;
  const isCSV = /\.csv$/i.test(filename);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const readType = isCSV ? "string" : "binary";
        const wb = XLSX.read(data, { type: readType, cellDates: true });

        const allValid: NormalizedRow[] = [];
        const allErrors: ParseError[] = [];
        let totalRows = 0;
        const filenameBarangay = barangayFromFilename(filename);

        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          const result = processSheet(ws, filename, sheetName, filenameBarangay);
          allValid.push(...result.valid);
          allErrors.push(...result.errors);
          totalRows += result.totalRows;
        }

        resolve({ valid: allValid, errors: allErrors, totalRows });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error(`Failed to read file: ${filename}`));
    if (isCSV) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  });
}

export function generateCSVTemplate(): string {
  return [
    "barangay,disease_name,cases,reporting_date",
    "Amoslog,Dengue,3,2025-01-15",
    "San Isidro,Diarrhea,5,2025-01-15",
    "Mabini,ARI,2,2025-01-15",
  ].join("\n");
}

export function generateXLSXTemplate(): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet([
    ["barangay", "disease_name", "cases", "reporting_date"],
    ["Amoslog", "Dengue", 3, "2025-01-15"],
    ["San Isidro", "Diarrhea", 5, "2025-01-15"],
    ["Mabini", "ARI", 2, "2025-01-15"],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Disease Data");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" });
}
