import { buildTreeFromFlatList, flattenTreeToList } from './configManager';
import { getPhoneDigitCount, normalizeImportHeaderText } from './importFieldFormat';

export type ImportIssue = {
  level: 'error' | 'warning';
  rowNumber?: number;
  message: string;
};

export type ImportValidationSummary = {
  sourceLabel: string;
  rowCount: number;
  validPersonCount: number;
  relationCount: number;
  spouseCount: number;
  virtualChildrenCount: number;
  duplicateNames: string[];
  errors: ImportIssue[];
  warnings: ImportIssue[];
};

export type ImportSyncMode = 'overwrite' | 'merge';

export type AnalyzeImportRowsOptions = {
  syncMode: ImportSyncMode;
  existingTreeToMerge?: any;
};

export function normalizeImportHeader(value: string) {
  return normalizeImportHeaderText(value);
}

export function normalizeImportText(value: string) {
  return normalizeImportHeader(value).replace(/[^\w\s-]/g, "");
}

export function getRowValueByAliases(row: any, aliases: string[]) {
  const normalizedAliases = aliases.map(normalizeImportHeader);
  const headers = Array.isArray(row?._headers) && row._headers.length > 0
    ? row._headers
    : Object.keys(row || {}).filter((key) => !key.startsWith("_"));

  for (const [index, header] of headers.entries()) {
    const normalizedHeader = normalizeImportHeader(header);
    if (normalizedAliases.some((alias) => normalizedHeader === alias || normalizedHeader.includes(alias))) {
      const value = Array.isArray(row?._rawValues) ? row._rawValues[index] : row[header];
      if (value !== undefined && value !== null && String(value).trim()) {
        return String(value).trim();
      }
    }
  }

  return "";
}

export function extractImportNumber(value: string) {
  const match = String(value || "").match(/\d+/);
  return match ? Number.parseInt(match[0], 10) : NaN;
}

function countRelations(node: any): number {
  if (!node || !Array.isArray(node.children)) return 0;
  return node.children.length + node.children.reduce((sum: number, child: any) => sum + countRelations(child), 0);
}

export function analyzeImportRows(
  rows: any[],
  sourceLabel: string,
  options: AnalyzeImportRowsOptions
) {
  const { syncMode, existingTreeToMerge } = options;
  let treeData: any = null;
  const errors: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];

  if (rows.length === 0) {
    errors.push({ level: 'error', message: "File rỗng hoặc không có dòng dữ liệu sau tiêu đề." });
  } else {
    try {
      treeData = buildTreeFromFlatList(rows, existingTreeToMerge);
    } catch (err: any) {
      errors.push({
        level: 'error',
        message: err?.message || "Không thể dựng cây phả hệ từ dữ liệu vừa nhập."
      });
    }
  }

  if (!treeData || !treeData.id) {
    errors.push({ level: 'error', message: "Không thể dựng cây phả hệ từ dữ liệu vừa nhập." });
  }

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const name = getRowValueByAliases(row, ["name", "ho va ten", "họ và tên", "ten", "tên"]);
    const generation = getRowValueByAliases(row, ["generation", "doi", "đời", "the he", "thế hệ"]);
    const birth = getRowValueByAliases(row, ["ngay sinh", "ngày sinh", "nam sinh", "năm sinh", "birthYear", "birth year"]);
    const residence = getRowValueByAliases(row, ["noi o", "nơi ở", "noi cu tru", "nơi cư trú", "residence", "dia chi", "địa chỉ"]);
    const phone = getRowValueByAliases(row, ["so dien thoai", "số điện thoại", "sdt", "sđt", "phone"]);
    const generationNumber = extractImportNumber(generation);

    if (!name) {
      errors.push({ level: 'error', rowNumber, message: "Thiếu họ tên." });
    }
    if (!generation || Number.isNaN(generationNumber)) {
      errors.push({ level: 'error', rowNumber, message: "Thiếu đời/generation hoặc đời không phải số." });
    }

    if (syncMode === 'overwrite' && !birth) {
      warnings.push({ level: 'warning', rowNumber, message: `${name || "Dòng chưa có tên"}: thiếu ngày/năm sinh.` });
    }
    if (syncMode === 'overwrite' && !residence) {
      warnings.push({ level: 'warning', rowNumber, message: `${name || "Dòng chưa có tên"}: thiếu nơi ở/nơi cư trú.` });
    }

    if (phone && getPhoneDigitCount(phone) === 7) {
      warnings.push({ level: 'warning', rowNumber, message: `${name || "Dòng chưa có tên"}: số điện thoại chỉ có 7 số, cần kiểm tra lại.` });
    }
  });

  const importDiagnostics = treeData?._diagnostics || {};
  const unlinkedNodes = Array.isArray(importDiagnostics.unlinkedNodes) ? importDiagnostics.unlinkedNodes : [];
  unlinkedNodes.forEach((node: any) => {
    const issue = {
      level: syncMode === 'merge' ? 'warning' as const : 'error' as const,
      message: `${node.name || node.id}: chưa xác định được cha/mẹ để nối vào cây.`
    };
    if (syncMode === 'merge') {
      warnings.push(issue);
    } else {
      errors.push(issue);
    }
  });

  const flattened = treeData?.id ? flattenTreeToList(treeData) : [];
  const relationCount = treeData?.id ? countRelations(treeData) : 0;
  const spouseNames = new Set<string>();

  flattened.forEach((node: any) => {
    if (node.spouse) {
      String(node.spouse).split(/[,/;+\-]+/).forEach((spouse) => {
        const normalized = normalizeImportText(spouse);
        if (normalized) spouseNames.add(normalized);
      });
    }
    if (Array.isArray(node.spouseDetails)) {
      node.spouseDetails.forEach((spouse: any) => {
        const normalized = normalizeImportText(spouse?.name || "");
        if (normalized) spouseNames.add(normalized);
      });
    }
  });

  const duplicateNames = Array.isArray(importDiagnostics.duplicateNames) ? importDiagnostics.duplicateNames : [];
  if (duplicateNames.length > 0) {
    const duplicateGroups = new Map<string, Array<{ id: string; parentId: string }>>();
    rows.forEach((row) => {
      const rowName = getRowValueByAliases(row, ["name", "ho va ten", "họ và tên", "ten", "tên"]);
      const normalized = normalizeImportText(rowName);
      if (!normalized) return;
      if (!duplicateGroups.has(normalized)) duplicateGroups.set(normalized, []);
      duplicateGroups.get(normalized)!.push({
        id: getRowValueByAliases(row, ["mã định danh cá nhân", "ma dinh danh ca nhan", "mã số", "ma so", "id"]),
        parentId: getRowValueByAliases(row, ["mã số cha", "ma so cha", "mã cha", "ma cha", "parentId", "parent id"])
      });
    });

    const hasAmbiguousDuplicate = Array.from(duplicateGroups.values()).some((group) =>
      group.length > 1 && group.some((item) => !item.id || !item.parentId)
    );

    warnings.push({
      level: 'warning',
      message: hasAmbiguousDuplicate
        ? `Có tên gần trùng: ${duplicateNames.join(", ")}. Một số dòng còn thiếu mã định danh hoặc mã cha, nên bổ sung để tránh ghép nhầm.`
        : `Có tên gần trùng: ${duplicateNames.join(", ")}. Các dòng đã có mã định danh và mã cha; hãy kiểm tra lại nếu đây là những người khác nhau.`
    });
  }

  const summary: ImportValidationSummary = {
    sourceLabel,
    rowCount: rows.length,
    validPersonCount: flattened.length,
    relationCount,
    spouseCount: spouseNames.size,
    virtualChildrenCount: importDiagnostics.virtualChildrenCount || 0,
    duplicateNames,
    errors,
    warnings
  };

  return { treeData, summary };
}
