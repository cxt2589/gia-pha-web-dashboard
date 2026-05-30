export function normalizeImportHeaderText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function isDateLikeHeader(header: string) {
  const normalized = normalizeImportHeaderText(header);
  return normalized.includes("ngay sinh")
    || normalized.includes("nam sinh")
    || normalized.includes("ngay thang nam mat")
    || normalized.includes("ngay mat")
    || normalized.includes("nam mat")
    || normalized.includes("birth")
    || normalized.includes("death");
}

export function formatExcelDateSerial(value: number) {
  if (!Number.isFinite(value)) return "";
  const wholeDays = Math.floor(value);
  const date = new Date(Date.UTC(1899, 11, 30 + wholeDays));
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getUTCDate()}/${date.getUTCMonth() + 1}/${date.getUTCFullYear()}`;
}

export function normalizeDateDisplayValue(value: string) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (!match) return raw;

  const first = Number.parseInt(match[1], 10);
  const second = Number.parseInt(match[2], 10);
  let year = Number.parseInt(match[3], 10);
  if (year < 100) year += year >= 30 ? 1900 : 2000;

  if (first > 12 && second <= 12) return `${first}/${second}/${year}`;
  if (second > 12 && first <= 12) return `${second}/${first}/${year}`;
  return `${first}/${second}/${year}`;
}

export function extractYearOnly(value?: string) {
  const raw = String(value || "").trim();
  if (!raw) return undefined;

  const fourDigitYear = raw.match(/\b(1[5-9]\d{2}|20\d{2}|21\d{2})\b/);
  if (fourDigitYear) return fourDigitYear[0];

  const dateMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/);
  if (dateMatch) {
    const twoDigitYear = Number.parseInt(dateMatch[3], 10);
    return String(twoDigitYear >= 30 ? 1900 + twoDigitYear : 2000 + twoDigitYear);
  }

  return raw;
}

export function normalizeImportedPhone(value?: string) {
  const raw = String(value || "").trim();
  if (!raw) return undefined;
  if (raw.startsWith("+")) return raw.replace(/[^\d+]/g, "");

  const digits = raw.replace(/\D/g, "");
  if (!digits) return undefined;

  if (digits.length === 8) return `+84${digits}`;
  if (digits.length === 9) return digits.startsWith("0") ? `+84${digits.slice(1)}` : `+84${digits}`;
  if (digits.length === 10 && digits.startsWith("0")) return `+84${digits.slice(1)}`;
  return raw;
}

export function getPhoneDigitCount(value?: string) {
  return String(value || "").replace(/\D/g, "").length;
}
