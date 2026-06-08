import * as XLSX from 'xlsx';
import { formatExcelDateSerial, isDateLikeHeader, normalizeDateDisplayValue } from './importFieldFormat';

function formatCellForImport(cell: XLSX.CellObject | undefined, header: string) {
  if (!cell) return "";

  if (
    cell.t === 'n'
    && typeof cell.v === 'number'
    && isDateLikeHeader(header)
    && (cell.v > 20000 || /[/-]/.test(String(cell.w || "")))
  ) {
    const formattedDate = formatExcelDateSerial(cell.v);
    if (formattedDate) return formattedDate;
  }

  if (cell.t === 'd' && cell.v instanceof Date) {
    return `${cell.v.getDate()}/${cell.v.getMonth() + 1}/${cell.v.getFullYear()}`;
  }

  return isDateLikeHeader(header)
    ? normalizeDateDisplayValue(String(cell.w ?? cell.v ?? "").trim())
    : String(cell.w ?? cell.v ?? "").trim();
}

function isTechnicalHeaderValue(value: unknown) {
  return /^[a-z][a-z0-9]*(?:\.\d+|\.[a-z][a-z0-9]*)+$/i.test(String(value || "").trim());
}

function isTechnicalHeaderRow(values: unknown[]) {
  const filled = values.map((value) => String(value || "").trim()).filter(Boolean);
  if (filled.length < 3) return false;
  const technicalCount = filled.filter(isTechnicalHeaderValue).length;
  return technicalCount >= Math.max(3, Math.ceil(filled.length * 0.45));
}

export function parseWorksheetToRows(worksheet: XLSX.WorkSheet): any[] {
  const rangeRef = worksheet['!ref'];
  if (!rangeRef) return [];

  const range = XLSX.utils.decode_range(rangeRef);
  const headers: string[] = [];
  for (let column = range.s.c; column <= range.e.c; column++) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r, c: column })];
    headers.push(String(cell?.w ?? cell?.v ?? "").trim());
  }

  if (headers.every((header) => !header)) return [];

  const secondRowValues: string[] = [];
  for (let column = range.s.c; column <= range.e.c; column++) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: range.s.r + 1, c: column })];
    secondRowValues.push(String(cell?.w ?? cell?.v ?? "").trim());
  }
  const hasTechnicalHeaderRow = isTechnicalHeaderRow(secondRowValues);
  const dataStartRow = hasTechnicalHeaderRow ? range.s.r + 2 : range.s.r + 1;

  const rows: any[] = [];
  for (let rowIndex = dataStartRow; rowIndex <= range.e.r; rowIndex++) {
    const rawValues = headers.map((header, index) => {
      const cell = worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: range.s.c + index })];
      return formatCellForImport(cell, header);
    });
    if (rawValues.every((value) => !value)) continue;

    const rowObj: Record<string, any> = {};
    headers.forEach((header, index) => {
      rowObj[header] = rawValues[index] || "";
    });

    rowObj._headers = headers;
    if (hasTechnicalHeaderRow) {
      rowObj._technicalHeaders = secondRowValues;
    }
    rowObj._rawValues = rawValues;
    rows.push(rowObj);
  }

  return rows;
}
