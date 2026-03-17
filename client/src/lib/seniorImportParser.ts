import * as XLSX from "xlsx";

export interface SeniorImportRow {
  firstName: string;
  lastName: string;
  dob: string | null;
  age: number;
  sex: string | null;
  barangay: string;
  addressLine: string | null;
  seniorCitizenId: string | null;
  phone: string | null;
  civilStatus: string | null;
}

export interface SeniorParseError {
  file: string;
  row: number;
  reason: string;
}

export interface SeniorParseResult {
  valid: SeniorImportRow[];
  errors: SeniorParseError[];
  totalRows: number;
}

const KNOWN_BARANGAYS: Record<string, string> = {
  amoslog: "Amoslog",
  anislagan: "Anislagan",
  "bad-as": "Bad-as",
  badas: "Bad-as",
  boyongan: "Boyongan",
  "bugas-bugas": "Bugas-bugas",
  bugasbugas: "Bugas-bugas",
  central: "Central (Poblacion)",
  "central (poblacion)": "Central (Poblacion)",
  ellaperal: "Ellaperal (Nonok)",
  "ellaperal (nonok)": "Ellaperal (Nonok)",
  nonok: "Ellaperal (Nonok)",
  ipil: "Ipil (Poblacion)",
  "ipil (poblacion)": "Ipil (Poblacion)",
  lakandula: "Lakandula",
  mabini: "Mabini",
  macalaya: "Macalaya",
  magsaysay: "Magsaysay (Poblacion)",
  "magsaysay (poblacion)": "Magsaysay (Poblacion)",
  magupange: "Magupange",
  "pananay-an": "Pananay-an",
  pananaayan: "Pananay-an",
  panhutongan: "Panhutongan",
  "san isidro": "San Isidro",
  sanisidro: "San Isidro",
  "sani-sani": "Sani-sani",
  sanisani: "Sani-sani",
  "santa cruz": "Santa Cruz",
  "sta.cruz": "Santa Cruz",
  stacruz: "Santa Cruz",
  suyoc: "Suyoc",
  tagbongabong: "Tagbongabong",
};

function matchBarangay(raw: string): string | null {
  if (!raw) return null;
  const k = raw.toLowerCase().trim().replace(/[.\s]+/g, " ").trim();
  if (KNOWN_BARANGAYS[k]) return KNOWN_BARANGAYS[k];
  const kNorm = k.replace(/[\s-]+/g, "");
  for (const [key, val] of Object.entries(KNOWN_BARANGAYS)) {
    if (key.replace(/[\s-]+/g, "") === kNorm) return val;
  }
  for (const [key, val] of Object.entries(KNOWN_BARANGAYS)) {
    if (kNorm.startsWith(key.replace(/[\s-]+/g, "").slice(0, 4)) && key.length >= 4) return val;
  }
  return null;
}

function barangayFromFilename(filename: string): string | null {
  const base = filename.replace(/\.(csv|xls|xlsx)$/i, "").replace(/_\d+$/, "").trim();
  const parts = base.split(/[,&_]+/);
  for (const part of parts) {
    const m = matchBarangay(part.trim());
    if (m) return m;
  }
  return null;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[\s_\-./]+/g, "").replace(/[^a-z0-9]/g, "");
}

const COL_SYNONYMS: Record<string, string[]> = {
  lastName:        ["lname", "lastname", "last_name", "surname", "familyname"],
  firstName:       ["fname", "firstname", "first_name", "givenname", "given_name"],
  barangay:        ["brgy", "barangay", "bgy", "barangayname"],
  dob:             ["dob", "dateofbirth", "birthdate", "date_of_birth", "birthday"],
  sex:             ["gender", "sex"],
  seniorCitizenId: ["idno", "id_no", "seniorid", "senior_id", "scid", "controlno", "idnumber"],
  addressLine:     ["purok", "address", "addressline", "address_line", "addr"],
  phone:           ["phone", "cellphone", "mobile", "contact", "phoneno", "tel"],
  civilStatus:     ["stat", "civilstatus", "civil_status", "maritalstatus", "civilstat", "marital_status"],
};

function detectCol(headers: string[], field: string): number {
  const synonyms = COL_SYNONYMS[field].map(norm);
  for (let i = 0; i < headers.length; i++) {
    if (headers[i] != null && synonyms.includes(norm(String(headers[i])))) return i;
  }
  return -1;
}

function normalizeSex(raw: string): string | null {
  const v = raw.trim().toUpperCase();
  if (v === "M" || v === "MALE") return "M";
  if (v === "F" || v === "FEMALE") return "F";
  return null;
}

function normalizeCivilStatus(raw: string): string | null {
  const v = raw.trim().toUpperCase();
  if (v === "MARRIED" || v === "KASAL") return "Married";
  if (v === "WIDOW") return "Widow";
  if (v === "WIDOWER") return "Widower";
  if (v === "SINGLE" || v === "BINATA" || v === "DALAGA") return "Single";
  if (v === "SEPARATED" || v === "HIWALAY") return "Separated";
  if (v === "ANNULLED") return "Annulled";
  if (v) return raw.trim().charAt(0).toUpperCase() + raw.trim().slice(1).toLowerCase();
  return null;
}

function parseDob(val: unknown): { dob: string | null; age: number } {
  let dobStr: string | null = null;
  if (val instanceof Date) {
    dobStr = val.toISOString().split("T")[0];
  } else if (typeof val === "number") {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) dobStr = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  } else {
    const str = String(val ?? "").trim();
    if (str && str !== "N/A" && str !== "n/a" && str !== "-") {
      const parsed = new Date(str);
      if (!isNaN(parsed.getTime())) dobStr = parsed.toISOString().split("T")[0];
    }
  }
  let age = 60;
  if (dobStr) {
    const now = new Date();
    const birth = new Date(dobStr);
    age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    if (age < 0 || age > 120) { age = 60; dobStr = null; }
  }
  return { dob: dobStr, age };
}

function isNA(val: unknown): boolean {
  const s = String(val ?? "").trim();
  return !s || s === "N/A" || s === "n/a" || s === "-" || s === "null";
}

function processSheet(
  ws: XLSX.WorkSheet,
  filename: string,
  sheetName: string,
  filenameBarangay: string | null,
): { valid: SeniorImportRow[]; errors: SeniorParseError[]; totalRows: number } {
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
  const valid: SeniorImportRow[] = [];
  const errors: SeniorParseError[] = [];

  const nonEmpty = raw.filter(row => row.some(c => c !== null && String(c).trim() !== ""));
  if (nonEmpty.length < 2) return { valid, errors, totalRows: 0 };

  const headers = (nonEmpty[0] as unknown[]).map(h => String(h ?? ""));
  const dataRows = nonEmpty.slice(1);

  const lastNameIdx       = detectCol(headers, "lastName");
  const firstNameIdx      = detectCol(headers, "firstName");
  const barangayIdx       = detectCol(headers, "barangay");
  const dobIdx            = detectCol(headers, "dob");
  const sexIdx            = detectCol(headers, "sex");
  const seniorIdIdx       = detectCol(headers, "seniorCitizenId");
  const addressIdx        = detectCol(headers, "addressLine");
  const phoneIdx          = detectCol(headers, "phone");
  const civilStatusIdx    = detectCol(headers, "civilStatus");

  const fileLabel = `${filename}${sheetName && sheetName !== "Sheet1" ? ` [${sheetName}]` : ""}`;

  if (lastNameIdx === -1 && firstNameIdx === -1) {
    return { valid, errors, totalRows: 0 };
  }

  dataRows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const r = row as unknown[];

    const lastNameRaw = lastNameIdx !== -1 ? String(r[lastNameIdx] ?? "").trim() : "";
    const firstNameRaw = firstNameIdx !== -1 ? String(r[firstNameIdx] ?? "").trim() : "";

    if (!lastNameRaw && !firstNameRaw) {
      return;
    }
    if (isNA(lastNameRaw) && isNA(firstNameRaw)) return;

    const lastName = isNA(lastNameRaw) ? "" : lastNameRaw;
    const firstName = isNA(firstNameRaw) ? "" : firstNameRaw;

    if (!lastName && !firstName) {
      errors.push({ file: fileLabel, row: rowNum, reason: "Missing name" });
      return;
    }

    let barangay: string | null = null;
    if (barangayIdx !== -1 && !isNA(r[barangayIdx])) {
      barangay = matchBarangay(String(r[barangayIdx]).trim()) ?? String(r[barangayIdx]).trim();
    }
    if (!barangay && filenameBarangay) barangay = filenameBarangay;
    if (!barangay) {
      errors.push({ file: fileLabel, row: rowNum, reason: "Cannot determine barangay" });
      return;
    }

    const { dob, age } = parseDob(dobIdx !== -1 ? r[dobIdx] : null);

    const sexRaw = sexIdx !== -1 && !isNA(r[sexIdx]) ? String(r[sexIdx]).trim() : null;
    const sex = sexRaw ? normalizeSex(sexRaw) : null;

    const seniorIdRaw = seniorIdIdx !== -1 && !isNA(r[seniorIdIdx]) ? String(r[seniorIdIdx]).trim() : null;
    const seniorCitizenId = seniorIdRaw || null;

    const addressRaw = addressIdx !== -1 && !isNA(r[addressIdx]) ? String(r[addressIdx]).trim() : null;

    const phoneRaw = phoneIdx !== -1 && !isNA(r[phoneIdx]) ? String(r[phoneIdx]).trim() : null;

    const civilStatusRaw = civilStatusIdx !== -1 && !isNA(r[civilStatusIdx]) ? String(r[civilStatusIdx]).trim() : null;
    const civilStatus = civilStatusRaw ? normalizeCivilStatus(civilStatusRaw) : null;

    valid.push({
      firstName: firstName || lastName,
      lastName: lastName || firstName,
      dob,
      age,
      sex,
      barangay,
      addressLine: addressRaw,
      seniorCitizenId,
      phone: phoneRaw,
      civilStatus,
    });
  });

  return { valid, errors, totalRows: dataRows.length };
}

export async function parseSeniorFile(file: File): Promise<SeniorParseResult> {
  const filename = file.name;
  const isCSV = /\.csv$/i.test(filename);
  const filenameBarangay = barangayFromFilename(filename);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: isCSV ? "string" : "binary", cellDates: true });

        const allValid: SeniorImportRow[] = [];
        const allErrors: SeniorParseError[] = [];
        let totalRows = 0;

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
    reader.onerror = () => reject(new Error(`Failed to read: ${filename}`));
    isCSV ? reader.readAsText(file) : reader.readAsBinaryString(file);
  });
}
