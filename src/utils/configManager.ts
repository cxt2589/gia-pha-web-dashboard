/**
 * Configuration Manager for GiaPha NinhBinh
 * Manages custom appearance, sizes, button names, APIs, and Google Sheets connectors.
 */

import { extractYearOnly, normalizeDateDisplayValue, normalizeImportedPhone } from './importFieldFormat';

export interface AppConfig {
  // General details
  homeTitle: string;
  homeSubtitle: string;
  footerText: string;

  // Colors & Visual themes
  backgroundImageUrl: string;
  backgroundBlendMode: string;
  primaryColor: string; // Hex for primary button/borders e.g. #8b1c1c
  backgroundColorTint: string; // Solid background tint e.g. #fafaf5
  accentColor: string; // Secondary/Highlights e.g. #7b5800
  textColor: string; // Main text color e.g. #271900

  // Dimensions & Spacing
  treeNodeWidth: number; // e.g., 170
  treeLineThickness: number; // e.g., 2
  treeLineColor: string; // e.g., #7b5800
  treeSpacingX: number; // e.g., 185
  nodeBorderRadius: string; // 'rounded-none' | 'rounded-sm' | 'rounded-md' | 'rounded-full'

  // Button labels & Navigation tabs
  tabTintucLabel: string;
  tabGiaphaLabel: string;
  tabPhakyLabel: string;
  tabTocuocLabel: string;
  tabLichgioLabel: string;
  tabLichamLabel: string;
  tabDashboardLabel: string;

  // Custom branding icon
  brandChar: string; // The character '高' or custom branding logo SVG/URL
  brandLogoUrl: string; // URL for custom branding image if any

  // API Configs
  geminiApiKey: string;
  geminiModelName: string;
  zaloWebhookUrl: string;

  // Google Sheet integration
  googleSheetId: string;
  googleSheetSyncEnabled: boolean;
  googleSheetLastSynced: string;
}

export const DEFAULT_CONFIG: AppConfig = {
  homeTitle: "Họ Cao Ninh Bình",
  homeSubtitle: "Ninh Bình",
  footerText: "Ban trị sự họ Cao Ninh Bình",

  backgroundImageUrl: "", // Revert to solid, elegant silk-paper background as requested by user
  backgroundBlendMode: "multiply", // multiply / normal / overlay / luminosity
  primaryColor: "#8b1c1c", // traditional red
  backgroundColorTint: "#fafaf5", // pure paper rice
  accentColor: "#7b5800", // brass gold
  textColor: "#271900", // dark ink charcoal

  treeNodeWidth: 170,
  treeLineThickness: 2,
  treeLineColor: "#7b5800",
  treeSpacingX: 185,
  nodeBorderRadius: "rounded-md",

  tabTintucLabel: "Tin tức",
  tabGiaphaLabel: "Gia phả",
  tabPhakyLabel: "Phả ký",
  tabTocuocLabel: "Tộc ước",
  tabLichgioLabel: "Lịch giỗ",
  tabLichamLabel: "Đổi lịch âm",
  tabDashboardLabel: "Quản trị",

  brandChar: "高",
  brandLogoUrl: "",

  geminiApiKey: "",
  geminiModelName: "gemini-2.5-flash",
  zaloWebhookUrl: "",

  googleSheetId: "",
  googleSheetSyncEnabled: false,
  googleSheetLastSynced: ""
};

const LOCAL_STORAGE_KEY = "caogia_app_settings_cfg";
const APP_SETTINGS_API_URL = "/api/state/app-settings";

export const getAppSettings = (): AppConfig => {
  try {
    const savedString = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!savedString) return DEFAULT_CONFIG;
    const parsed = JSON.parse(savedString);
    const merged = { ...DEFAULT_CONFIG, ...parsed };
    // Clear old unrequested background image URLs from cached states
    if (merged.backgroundImageUrl === "https://images.unsplash.com/photo-1605721911519-3dfeb3be25e7?q=80&w=1000") {
      merged.backgroundImageUrl = "";
    }
    return merged;
  } catch (err) {
    console.error("Failed to load settings from localStorage, using defaults:", err);
    return DEFAULT_CONFIG;
  }
};

export const saveAppSettings = (settings: AppConfig): void => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(settings));
    void persistAppSettingsToBackend(settings);
    // Dispatch a custom event so other components know configs updated
    window.dispatchEvent(new Event("caogia_settings_updated"));
  } catch (err) {
    console.error("Failed to save settings to localStorage:", err);
  }
};

export const resetAppSettings = (): AppConfig => {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_CONFIG));
    void persistAppSettingsToBackend(DEFAULT_CONFIG);
    window.dispatchEvent(new Event("caogia_settings_updated"));
    return DEFAULT_CONFIG;
  } catch (err) {
    console.error("Failed to reset settings:", err);
    return DEFAULT_CONFIG;
  }
};

const persistAppSettingsToBackend = async (settings: AppConfig): Promise<void> => {
  try {
    const response = await fetch(APP_SETTINGS_API_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: settings })
    });
    if (!response.ok) throw new Error(`Settings API returned ${response.status}`);
  } catch (err) {
    console.warn("Backend settings save failed; localStorage fallback retained:", err);
  }
};

export const hydrateAppSettingsFromBackend = async (): Promise<AppConfig> => {
  try {
    const response = await fetch(APP_SETTINGS_API_URL, { headers: { Accept: "application/json" } });
    if (response.status === 404) return getAppSettings();
    if (!response.ok) throw new Error(`Settings API returned ${response.status}`);
    const payload = await response.json();
    const merged = { ...DEFAULT_CONFIG, ...(payload?.value || {}) };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(merged));
    window.dispatchEvent(new Event("caogia_settings_updated"));
    return merged;
  } catch (err) {
    console.warn("Backend settings load failed; using localStorage fallback:", err);
    return getAppSettings();
  }
};

/**
 * Utility to inject styles on-the-fly dynamically into document head
 */
export const applyConfigToStyles = (config: AppConfig) => {
  const cssId = "caogia-custom-styles-injected";
  let styleEl = document.getElementById(cssId) as HTMLStyleElement;
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = cssId;
    document.head.appendChild(styleEl);
  }

  // Generate dynamic overrides for brand colors and background
  styleEl.innerHTML = `
    :root {
      --primary-color: ${config.primaryColor};
      --bg-tint-color: ${config.backgroundColorTint};
      --accent-color: ${config.accentColor};
      --text-ink-color: ${config.textColor};
    }
    
    /* Override primary background tint */
    #app-root-frame {
      background-color: ${config.backgroundColorTint} !important;
      color: ${config.textColor} !important;
    }
    
    #app-root-frame::before {
      content: "";
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 0;
      pointer-events: none;
      opacity: 0.08;
      ${config.backgroundImageUrl ? `background-image: url('${config.backgroundImageUrl}');` : 'display: none !important;'}
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      mix-blend-mode: ${config.backgroundBlendMode};
    }
    
    /* Buttons and text colors */
    .bg-primary {
      background-color: ${config.primaryColor} !important;
    }
    .hover\\:bg-primary-hover:hover {
      background-color: ${config.primaryColor}dd !important;
    }
    .text-primary {
      color: ${config.primaryColor} !important;
    }
    .text-secondary {
      color: ${config.accentColor} !important;
    }
    .bg-secondary {
      background-color: ${config.accentColor} !important;
    }
    .border-primary {
      border-color: ${config.primaryColor} !important;
    }
    .text-ink-charcoal {
      color: ${config.textColor} !important;
    }
  `;
};

// --- Linage tree local persistence ---
// Bump this key when persisted browser copies can diverge from the backend tree.
const TREE_DATA_STORAGE_KEY = "caogia_persisted_tree_database_v3";
const TREE_API_URL = "/api/tree";
const GENERATED_PLACEHOLDER_VALUES = new Set([
  "Thủy nguyên, Hải Phòng",
  "Thủy nguyên, Hải Phòng (Gốc tổ)",
  "Khu mộ chi họ Cao gia bản xứ",
  "Cao gia lăng viên",
  "Đang cập nhật hành trạng gia phả.",
  "Hành trạng cổ dã của cụ hiền chưa thể hiện chi tiết, ban liên lạc đang mướn dịch gia thư chi chép tạc biên mục.",
  "Hành trạng tiên nhân chưa thể hiện chi tiết, ban tôn tộc đang dốc sức dịch phả chép tạc biên niên."
]);

const removeGeneratedPlaceholders = (node: any): any => {
  if (!node || typeof node !== "object") return node;

  const cleaned = { ...node };
  ["residence", "burialPlace", "description"].forEach((key) => {
    if (GENERATED_PLACEHOLDER_VALUES.has(String(cleaned[key] || ""))) {
      delete cleaned[key];
    }
  });

  if (Array.isArray(cleaned.spouseDetails)) {
    cleaned.spouseDetails = cleaned.spouseDetails.map((spouse: any) => {
      const cleanedSpouse = { ...spouse };
      ["residence", "burialPlace", "deathPlace"].forEach((key) => {
        if (GENERATED_PLACEHOLDER_VALUES.has(String(cleanedSpouse[key] || ""))) {
          delete cleanedSpouse[key];
        }
      });
      return cleanedSpouse;
    });
  }

  if (Array.isArray(cleaned.children)) {
    cleaned.children = cleaned.children.map(removeGeneratedPlaceholders);
  }

  return cleaned;
};

/**
 * Fetch Custom Tree Data from localStorage or fallback to standard system file
 */
export const getPersistedTreeData = (fallbackTree: any): any => {
  try {
    const saved = localStorage.getItem(TREE_DATA_STORAGE_KEY);
    if (!saved) return removeGeneratedPlaceholders(fallbackTree);
    return removeGeneratedPlaceholders(JSON.parse(saved));
  } catch (err) {
    console.error("Failed to load persisted family tree data:", err);
    return removeGeneratedPlaceholders(fallbackTree);
  }
};

export const hydratePersistedTreeDataFromBackend = async (fallbackTree: any): Promise<any> => {
  try {
    const response = await fetch(TREE_API_URL, {
      cache: "no-store",
      headers: {
        "Accept": "application/json",
        "Cache-Control": "no-cache"
      }
    });
    if (response.status === 404) {
      return getPersistedTreeData(fallbackTree);
    }
    if (!response.ok) {
      throw new Error(`Tree API returned ${response.status}`);
    }

    const backendTree = removeGeneratedPlaceholders(await response.json());
    localStorage.setItem(TREE_DATA_STORAGE_KEY, JSON.stringify(backendTree));
    window.dispatchEvent(new Event("caogia_tree_data_updated"));
    return backendTree;
  } catch (err) {
    console.warn("Backend tree storage unavailable, using local fallback:", err);
    return getPersistedTreeData(fallbackTree);
  }
};

const persistTreeDataToBackend = async (treeData: any, rethrow = false): Promise<void> => {
  try {
    const response = await fetch(TREE_API_URL, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(removeGeneratedPlaceholders(treeData))
    });
    if (!response.ok) {
      throw new Error(`Tree API returned ${response.status}`);
    }
  } catch (err) {
    console.warn("Backend tree save failed; localStorage fallback retained:", err);
    if (rethrow) throw err;
  }
};

export const savePersistedTreeDataAsync = async (treeData: any): Promise<void> => {
  const cleanedTree = removeGeneratedPlaceholders(treeData);
  await persistTreeDataToBackend(cleanedTree, true);
  localStorage.setItem(TREE_DATA_STORAGE_KEY, JSON.stringify(cleanedTree));
  window.dispatchEvent(new Event("caogia_tree_data_updated"));
};

/**
 * Persist Custom Tree Data to localStorage
 */
export const savePersistedTreeData = (treeData: any): void => {
  try {
    const cleanedTree = removeGeneratedPlaceholders(treeData);
    localStorage.setItem(TREE_DATA_STORAGE_KEY, JSON.stringify(cleanedTree));
    void persistTreeDataToBackend(cleanedTree);
    window.dispatchEvent(new Event("caogia_tree_data_updated"));
  } catch (err) {
    console.error("Failed to persist family tree data:", err);
  }
};

/**
 * Hard Reset Tree back to Vietnamese Default lineage file
 */
export const resetPersistedTreeData = (): void => {
  try {
    localStorage.removeItem(TREE_DATA_STORAGE_KEY);
    void fetch(TREE_API_URL, { method: "DELETE" }).catch((err) => {
      console.warn("Backend tree reset failed; localStorage reset completed:", err);
    });
    window.dispatchEvent(new Event("caogia_tree_data_updated"));
  } catch (err) {
    console.error("Failed to reset tree data:", err);
  }
};

export const normalizeName = (name: string): string => {
  if (!name) return "";
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ");
};

/**
 * Super robust name normalizer for strict family tree matching.
 * Removes accents, capitalizations, trailing spaces, parentheses (e.g. (Thường gọi)),
 * and common Vietnamese honorific titles like "Cụ", "Ông", "Bà", "Trưởng chi"...
 */
export const cleanNameForMatching = (name: string): string => {
  if (!name) return "";
  let clean = name.trim().toLowerCase();
  
  // Remove content in brackets / parentheses
  clean = clean.replace(/\([^)]*\)/g, "");
  
  // Replace dashes/slashes with space
  clean = clean.replace(/[-–—/]/g, " ");
  
  // Normalize accents
  clean = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  
  // Remove titles & honorific prefixes as they can differ between records
  const prefixRegex = /\b(ong|ba|cu|co|ong cu|ba cu|bien nien|co nhan|tien khoi|truong chi|truong toc|phu nhân|ba ca|ba hai|ba ba)\b/g;
  clean = clean.replace(prefixRegex, " ");
  
  // Clean double spaces
  clean = clean.replace(/\s+/g, " ").trim();
  
  return clean;
};

/**
 * Measure similarity between two Vietnamese names (0 to 1).
 * Excellent for suggesting potential parent matches in the spreadsheet setup!
 */
export function getNameSimilarity(name1: string, name2: string): number {
  const n1 = cleanNameForMatching(name1);
  const n2 = cleanNameForMatching(name2);
  if (!n1 || !n2) return 0;
  if (n1 === n2) return 1.0;
  if (n1.includes(n2) || n2.includes(n1)) return 0.85;
  
  const words1 = n1.split(" ");
  const words2 = n2.split(" ");
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  let intersection = 0;
  for (const w of set1) {
    if (set2.has(w)) intersection++;
  }
  const union = new Set([...words1, ...words2]).size;
  return union > 0 ? intersection / union : 0;
}

export function buildTreeFromFlatList(flatList: any[], existingTreeToMerge?: any): any {
  if (flatList.length === 0) return null;

  // Track raw diagnostics
  let totalParsed = 0;
  let virtualChildrenCount = 0;
  const duplicateNameSet = new Set<string>();
  const seenNames = new Map<string, number>();
  const existingNodeById = new Map<string, any>();
  if (existingTreeToMerge) {
    flattenTreeToList(existingTreeToMerge).forEach((node: any) => {
      const id = String(node?.id || "").trim();
      if (id) existingNodeById.set(id, node);
    });
  }

  // Extract columns based on sequence regions (to handle duplicate "Nơi ở" / "Số điện thoại" correctly)
  const mapVietnameseKeys = (rowObj: Record<string, any>, index: number) => {
    // Already a processed tree node, return it
    if (rowObj.id && rowObj.children && rowObj.generation !== undefined && "gender" in rowObj) {
      return rowObj;
    }

    const getVal = (keys: string[]) => {
      const normalizeForLookup = (value: unknown) => String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .replace(/[:：?()]/g, "")
        .replace(/[._-]+/g, " ")
        .replace(/[^a-z0-9/ ]+/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      const exactKeys = keys.map((key) => String(key || "").trim().toLowerCase());
      const normalizedKeys = keys.map(normalizeForLookup);

      if (Array.isArray(rowObj._technicalHeaders) && Array.isArray(rowObj._rawValues)) {
        for (let i = 0; i < rowObj._technicalHeaders.length; i++) {
          const technicalHeader = String(rowObj._technicalHeaders[i] || "").trim().toLowerCase();
          if (exactKeys.includes(technicalHeader) || normalizedKeys.includes(normalizeForLookup(technicalHeader))) {
            return String(rowObj._rawValues[i] || "").trim();
          }
        }
      }

      // 1st pass: exact match (after cleaning colons/whitespace and lowercasing)
      for (const k of Object.keys(rowObj)) {
        const cleanK = k.replace(/[:：?()]/g, '').trim().toLowerCase();
        if (keys.includes(cleanK) || normalizedKeys.includes(normalizeForLookup(cleanK))) {
          return rowObj[k];
        }
      }
      // 2nd pass: substring/containment match with smart guard against matching relative columns
      for (const k of Object.keys(rowObj)) {
        const cleanK = k.replace(/[:：?()]/g, '').trim().toLowerCase();
        const normalizedCleanK = normalizeForLookup(cleanK);
        if (keys.some(key => cleanK.includes(key)) || normalizedKeys.some(key => normalizedCleanK.includes(key))) {
          // Guard: if checking main member attributes, avoid matching relative columns (like "cha", "mẹ", "vợ", "chồng", "con")
          const checkingMain = !normalizedKeys.some(key => key.includes("cha") || key.includes("me") || key.includes("vo") || key.includes("chong") || key.includes("con") || key.includes("phoi ngau"));
          if (checkingMain) {
            const hasRelativeWord = normalizedCleanK.includes("cha") || normalizedCleanK.includes("me") || normalizedCleanK.includes("vo") || normalizedCleanK.includes("chong") || normalizedCleanK.includes("con") || normalizedCleanK.includes("phoi ngau");
            if (hasRelativeWord) continue; // Skip to avoid mis-attributing parents' data as child's
          }
          return rowObj[k];
        }
      }
      return "";
    };

    const normalizeHeaderForMatch = (value: string) => value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[:：?()]/g, "")
      .replace(/[^a-z0-9/ ]+/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

    // Helper to query columns inside a specified index boundary in the row headers
    const getValInBounds = (keys: string[], start: number, end: number) => {
      const normalizedKeys = keys.map(normalizeHeaderForMatch);
      if (!rowObj._headers || !rowObj._rawValues) {
        return getVal(keys); // fallback
      }
      // Exact match bounds first
      for (let i = start; i < end; i++) {
        if (i >= rowObj._headers.length) break;
        const cleanH = normalizeHeaderForMatch(rowObj._headers[i]);
        if (normalizedKeys.includes(cleanH)) {
          return String(rowObj._rawValues[i] || "").trim();
        }
      }
      // Substring match bounds with smart guard
      for (let i = start; i < end; i++) {
        if (i >= rowObj._headers.length) break;
        const cleanH = normalizeHeaderForMatch(rowObj._headers[i]);
        if (normalizedKeys.some(key => cleanH.includes(key))) {
          const checkingMain = !normalizedKeys.some(key => key.includes("cha") || key.includes("me") || key.includes("vo") || key.includes("chong") || key.includes("con") || key.includes("phoi ngau"));
          if (checkingMain) {
            const hasRelativeWord = cleanH.includes("cha") || cleanH.includes("me") || cleanH.includes("vo") || cleanH.includes("chong") || cleanH.includes("con") || cleanH.includes("phoi ngau");
            if (hasRelativeWord) continue;
          }
          return String(rowObj._rawValues[i] || "").trim();
        }
      }
      return "";
    };

    const getTechnicalRawValue = (field: string) => {
      if (!Array.isArray(rowObj._technicalHeaders) || !Array.isArray(rowObj._rawValues)) return "";
      const index = rowObj._technicalHeaders.findIndex((header: unknown) => String(header || "").trim().toLowerCase() === field.toLowerCase());
      if (index < 0) return "";
      return String(rowObj._rawValues[index] || "").trim();
    };

    const explicitIdVal = getVal(["mã số", "id", "person.id", "mã thành viên", "mã", "ma ma", "ma so", "mã định danh cá nhân", "mã định danh người chồng/người có phối ngẫu", "mã số định danh", "ma dinh danh", "mã số định danh cá nhân", "ma so dinh dan ca nhan"]);
    const explicitId = (explicitIdVal && explicitIdVal !== "undefined" && explicitIdVal.trim().length > 0)
      ? String(explicitIdVal).trim()
      : (rowObj.id ? String(rowObj.id).trim() : "");
    const existingNodeForRow = explicitId ? existingNodeById.get(explicitId) : undefined;
    const technicalPersonName = getTechnicalRawValue("person.name");
    const hasTechnicalHeaders = Array.isArray(rowObj._technicalHeaders);
    const nameVal = hasTechnicalHeaders
      ? (technicalPersonName || existingNodeForRow?.name || "")
      : (getVal(["họ và tên đầy đủ", "họ tên", "tên đầy đủ", "name", "person.name", "họ và tên"]) || existingNodeForRow?.name || "");
    if (!nameVal || !String(nameVal).trim()) return null; // Skip empty rows that cannot be linked to existing tree

    totalParsed++;

    // Track duplicates
    const cleanN = cleanNameForMatching(nameVal);
    if (seenNames.has(cleanN)) {
      seenNames.set(cleanN, (seenNames.get(cleanN) || 0) + 1);
      duplicateNameSet.add(nameVal.trim());
    } else {
      seenNames.set(cleanN, 1);
    }

    // Determine boundaries for duplicated headers like "Nơi ở", "Số điện thoại", "Tình trạng"
    let fatherIdx = -1;
    let motherIdx = -1;
    let spouseIdx = -1;
    let child1Idx = -1;

    if (rowObj._headers) {
      for (let i = 0; i < rowObj._headers.length; i++) {
        const cleanH = rowObj._headers[i].trim().toLowerCase();
        if (cleanH.includes("cha ruột") || cleanH === "cha") {
          fatherIdx = i;
        } else if (cleanH.includes("mẹ ruột") || cleanH === "mẹ") {
          motherIdx = i;
        } else if (cleanH.includes("vợ/chồng") || cleanH === "vợ chồng" || cleanH === "vợ" || cleanH === "chồng" || cleanH === "phối ngẫu") {
          spouseIdx = i;
        } else if (cleanH.includes("con ruột 1") || cleanH.startsWith("con 1") || cleanH.includes("con thứ 1")) {
          child1Idx = i;
        }
      }
    }

    // Re-detect the first column of each section using accent-insensitive headers.
    // The broad detection above can otherwise be overwritten by detail columns such
    // as "Số điện thoại của Vợ/Chồng", causing the spouse name to be skipped.
    if (rowObj._headers) {
      const normalizeHeader = (value: string) => value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      let firstFatherIdx = -1;
      let firstMotherIdx = -1;
      let firstSpouseIdx = -1;
      let firstChildIdx = -1;

      for (let i = 0; i < rowObj._headers.length; i++) {
        const cleanH = normalizeHeader(rowObj._headers[i]);
        if (
          firstFatherIdx === -1 &&
          (cleanH.includes("ho va ten cha ruot") || cleanH === "cha" || cleanH === "cha ruot")
        ) {
          firstFatherIdx = i;
        }
        if (
          firstMotherIdx === -1 &&
          (cleanH.includes("ho va ten me ruot") || cleanH === "me" || cleanH === "me ruot")
        ) {
          firstMotherIdx = i;
        }
        if (
          firstSpouseIdx === -1 &&
          (
            cleanH.includes("ho va ten vo/chong") ||
            cleanH === "vo/chong" ||
            cleanH === "vo chong" ||
            cleanH === "vo" ||
            cleanH === "chong" ||
            cleanH === "phoi ngau"
          )
        ) {
          firstSpouseIdx = i;
        }
        if (
          firstChildIdx === -1 &&
          (cleanH.includes("con ruot 1") || cleanH.startsWith("con 1") || cleanH.includes("con thu 1"))
        ) {
          firstChildIdx = i;
        }
      }

      if (firstFatherIdx !== -1) fatherIdx = firstFatherIdx;
      if (firstMotherIdx !== -1) motherIdx = firstMotherIdx;
      if (firstSpouseIdx !== -1) spouseIdx = firstSpouseIdx;
      if (firstChildIdx !== -1) child1Idx = firstChildIdx;
    }

    // If limits aren't found in succession, default boundaries to full width
    const totalHeaders = rowObj._headers ? rowObj._headers.length : 100;
    const fLimit = fatherIdx !== -1 ? fatherIdx : totalHeaders;
    const mLimit = motherIdx !== -1 ? motherIdx : totalHeaders;
    const sLimit = spouseIdx !== -1 ? spouseIdx : totalHeaders;
    const cLimit = child1Idx !== -1 ? child1Idx : totalHeaders;

    // A. Parse properties of main member
    const genRaw = getVal(["đời thứ mấy", "đời", "thế hệ", "generation", "đời thứ"]);
    let genNum: number | undefined = undefined;
    const genMatch = String(genRaw).match(/\d+/);
    if (genMatch) {
      genNum = parseInt(genMatch[0]);
    } else {
      const num = parseInt(genRaw);
      if (!isNaN(num)) genNum = num;
    }

    // Tình trạng & Status
    const statusVal = getValInBounds(["tình trạng", "status", "con song", "con song/da mat", "mất", "sống/mất"], 0, fLimit);
    let isLiving = true;
    if (statusVal) {
      const lowerStatus = String(statusVal).toLowerCase();
      if (lowerStatus.includes("mất") || lowerStatus.includes("đã mất") || lowerStatus.includes("qua đời") || lowerStatus.includes("khuất") || lowerStatus.includes("tử") || lowerStatus.includes("tạ thế") || lowerStatus.includes("qua doi")) {
        isLiving = false;
      }
    }

    // Years & Birth Date
    const birthYearRaw = getValInBounds(["ngày sinh", "ngày sinh (trên giấy tờ)", "năm sinh", "birthyear", "birth", "ngay sinh", "nam sinh"], 0, fLimit);
    const deathYearRaw = getValInBounds(["ngày tháng năm mất", "năm mất", "ngày mất", "deathyear", "death", "ngày tháng năm mất (dương lịch)", "qua đời ngày"], 0, fLimit);
    const lunarDeathRaw = getValInBounds(["ngày mất theo âm lịch", "ngày mất âm lịch", "ngày giỗ", "kỵ nhật", "lunar anniversary", "lunaranniversary", "ngay mat theo am lich", "ngay mat am lich", "ngay gio", "ky nhat"], 0, fLimit);
    const deathLunarYearTextRaw = getValInBounds(["năm mất âm lịch", "năm mất âm lịch / can chi", "can chi năm mất", "năm mất can chi", "nam mat am lich", "can chi nam mat", "death.lunaryeartext", "death lunaryeartext", "death lunar year text", "death lunar year"], 0, fLimit);
    
    const solarBirthDate = birthYearRaw ? normalizeDateDisplayValue(birthYearRaw.trim()) : undefined;
    const solarDeathDate = deathYearRaw ? normalizeDateDisplayValue(deathYearRaw.trim()) : undefined;

    const birthYear = extractYearOnly(solarBirthDate || birthYearRaw);
    const deathYear = extractYearOnly(solarDeathDate || deathYearRaw);

    if (
      (deathYear && deathYear.trim().length > 0 && deathYear.trim() !== "undefined") ||
      (lunarDeathRaw && lunarDeathRaw.trim().length > 0) ||
      (deathLunarYearTextRaw && deathLunarYearTextRaw.trim().length > 0)
    ) {
      isLiving = false;
    }

    const genderRaw = String(getValInBounds(["giới tính", "gender"], 0, fLimit)).toLowerCase();
    const gender = (genderRaw.includes("nữ") || genderRaw.includes("nu") || genderRaw === "female") ? "nữ" : "nam";

    // Standard properties
    const phone1 = normalizeImportedPhone(getValInBounds(["số điện thoại", "sđt", "phone", "so dien thoai"], 0, fLimit));
    const phone2 = normalizeImportedPhone(getValInBounds(["số điện thoại phụ", "sđt phụ", "sđt 2", "phone 2", "phone2"], 0, fLimit));
    const residence = getValInBounds(["nơi ở", "địa chỉ", "residence", "noi o", "dia chi"], 0, fLimit) || undefined;
    const email = getValInBounds(["email"], 0, fLimit) || undefined;
    const burialPlace = getValInBounds(["nơi an táng", "an táng", "burialplace", "mo phan", "mộ phần"], 0, fLimit) || undefined;
    const title = getValInBounds(["tên thường gọi / bí danh / tên tự (nếu có)", "bí danh", "tên thường gọi", "bi danh", "tên tự", "title"], 0, fLimit) || undefined;

    // B. Parse relative family member names
    const fatherName = fatherIdx !== -1 ? getValInBounds(["họ và tên cha ruột", "cha", "father"], fatherIdx, mLimit) || undefined : undefined;
    const motherName = motherIdx !== -1 ? getValInBounds(["họ và tên mẹ ruột", "mẹ", "mother"], motherIdx, sLimit) || undefined : undefined;
    const spouseName = spouseIdx !== -1 ? getValInBounds(["họ và tên vợ/chồng", "vợ/chồng", "vợ", "chồng", "spouse"], spouseIdx, cLimit) || undefined : undefined;

    const getRelativeDetailVal = (keys: string[], start: number, end: number) => {
      if (!rowObj._headers || !rowObj._rawValues) return "";
      const normalizeHeader = (value: string) => value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .replace(/[^a-z0-9/ ]+/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      for (let i = start; i < end; i++) {
        if (i >= rowObj._headers.length) break;
        const cleanH = normalizeHeader(rowObj._headers[i]);
        if (keys.some(key => cleanH.includes(key))) {
          return String(rowObj._rawValues[i] || "").trim();
        }
      }
      return "";
    };

    // Additional relative details parsed directly from child's row
    let _fatherDetails = undefined;
    if (fatherName && fatherName.trim() && fatherIdx !== -1) {
      const fatherResidence = getValInBounds(["nơi ở", "địa chỉ"], fatherIdx, mLimit);
      const fatherPhone = getValInBounds(["số điện thoại", "sđt", "điện thoại"], fatherIdx, mLimit);
      const fatherStatus = getValInBounds(["tình trạng", "trạng thái"], fatherIdx, mLimit);
      const fatherBirth = getValInBounds(["ngày sinh", "năm sinh"], fatherIdx, mLimit);
      const fatherDeath = getValInBounds(["ngày tháng năm mất", "năm mất", "ngày mất"], fatherIdx, mLimit);
      const fatherLunarDeath = getValInBounds(["ngày mất theo âm lịch", "ngày mất âm lịch", "ngày giỗ", "kỵ nhật", "lunar anniversary", "lunaranniversary", "ngay mat theo am lich", "ngay mat am lich", "ngay gio", "ky nhat"], fatherIdx, mLimit);
      const fatherDeathLunarYearText = getValInBounds(["năm mất âm lịch", "năm mất âm lịch / can chi", "can chi năm mất", "năm mất can chi", "nam mat am lich", "can chi nam mat", "death lunaryeartext", "death lunar year text"], fatherIdx, mLimit);
      const fatherBurial = getValInBounds(["nơi an táng", "an táng"], fatherIdx, mLimit);

      let fatherIsLiving = true;
      if (fatherStatus) {
        const lowerS = fatherStatus.toLowerCase();
        if (lowerS.includes("mất") || lowerS.includes("đã mất") || lowerS.includes("qua đời") || lowerS.includes("khuất") || lowerS.includes("tử")) {
          fatherIsLiving = false;
        }
      }
      if ((fatherDeath && fatherDeath.trim()) || (fatherLunarDeath && fatherLunarDeath.trim()) || (fatherDeathLunarYearText && fatherDeathLunarYearText.trim())) {
        fatherIsLiving = false;
      }

      const fatherSolarBirthDate = fatherBirth ? normalizeDateDisplayValue(fatherBirth.trim()) : undefined;
      const fatherSolarDeathDate = fatherDeath ? normalizeDateDisplayValue(fatherDeath.trim()) : undefined;
      const fatherBirthYear = extractYearOnly(fatherSolarBirthDate || fatherBirth);
      const fatherDeathYear = extractYearOnly(fatherSolarDeathDate || fatherDeath);

      _fatherDetails = {
        name: fatherName.trim(),
        birthYear: fatherBirthYear || undefined,
        solarBirthDate: fatherSolarBirthDate,
        isLiving: fatherIsLiving,
        deathYear: fatherDeathYear || undefined,
        solarDeathDate: fatherSolarDeathDate,
        lunarAnniversary: fatherLunarDeath || undefined,
        deathLunarYearText: fatherDeathLunarYearText || undefined,
        burialPlace: fatherBurial || undefined,
        deathPlace: fatherBurial || undefined,
        residence: fatherResidence || undefined,
        phone1: normalizeImportedPhone(fatherPhone)
      };
    }

    let _motherDetails = undefined;
    if (motherName && motherName.trim() && motherIdx !== -1) {
      const motherResidence = getValInBounds(["nơi ở", "địa chỉ"], motherIdx, sLimit);
      const motherPhone = getValInBounds(["số điện thoại", "sđt", "điện thoại"], motherIdx, sLimit);
      const motherStatus = getValInBounds(["tình trạng", "trạng thái"], motherIdx, sLimit);
      const motherBirth = getValInBounds(["ngày sinh", "năm sinh"], motherIdx, sLimit);
      const motherDeath = getValInBounds(["ngày tháng năm mất", "năm mất", "ngày mất"], motherIdx, sLimit);
      const motherLunarDeath = getValInBounds(["ngày mất theo âm lịch", "ngày mất âm lịch", "ngày giỗ", "kỵ nhật", "lunar anniversary", "lunaranniversary", "ngay mat theo am lich", "ngay mat am lich", "ngay gio", "ky nhat"], motherIdx, sLimit);
      const motherDeathLunarYearText = getValInBounds(["năm mất âm lịch", "năm mất âm lịch / can chi", "can chi năm mất", "năm mất can chi", "nam mat am lich", "can chi nam mat", "death lunaryeartext", "death lunar year text"], motherIdx, sLimit);
      const motherBurial = getValInBounds(["nơi an táng", "an táng"], motherIdx, sLimit);

      let motherIsLiving = true;
      if (motherStatus) {
        const lowerS = motherStatus.toLowerCase();
        if (lowerS.includes("mất") || lowerS.includes("đã mất") || lowerS.includes("qua đời") || lowerS.includes("khuất") || lowerS.includes("tử")) {
          motherIsLiving = false;
        }
      }
      if ((motherDeath && motherDeath.trim()) || (motherLunarDeath && motherLunarDeath.trim()) || (motherDeathLunarYearText && motherDeathLunarYearText.trim())) {
        motherIsLiving = false;
      }

      const motherSolarBirthDate = motherBirth ? normalizeDateDisplayValue(motherBirth.trim()) : undefined;
      const motherSolarDeathDate = motherDeath ? normalizeDateDisplayValue(motherDeath.trim()) : undefined;
      const motherBirthYear = extractYearOnly(motherSolarBirthDate || motherBirth);
      const motherDeathYear = extractYearOnly(motherSolarDeathDate || motherDeath);

      _motherDetails = {
        name: motherName.trim(),
        birthYear: motherBirthYear || undefined,
        solarBirthDate: motherSolarBirthDate,
        isLiving: motherIsLiving,
        deathYear: motherDeathYear || undefined,
        solarDeathDate: motherSolarDeathDate,
        lunarAnniversary: motherLunarDeath || undefined,
        deathLunarYearText: motherDeathLunarYearText || undefined,
        burialPlace: motherBurial || undefined,
        deathPlace: motherBurial || undefined,
        residence: motherResidence || undefined,
        phone1: normalizeImportedPhone(motherPhone)
      };
    }

    const getColumnValueByTechnicalField = (field: string) => {
      return getTechnicalRawValue(field);
    };

    const getIndexedSpouseDetailVal = (spouseNumber: number, field: "id" | "name" | "birthDate" | "status" | "deathDate" | "lunarAnniversary" | "graveLocation" | "note") => {
      const technicalValue = getColumnValueByTechnicalField(`spouse.${spouseNumber}.${field}`);
      if (technicalValue) return technicalValue;
      if (!Array.isArray(rowObj._headers) || !Array.isArray(rowObj._rawValues)) return "";
      const normalizedFieldLabels: Record<typeof field, string[]> = {
        id: ["ma dinh danh", "ma vo", "ma chong", "ma phoi ngau", "id"],
        name: ["ho va ten", "vo/chong", "vo chong", "phoi ngau"],
        birthDate: ["ngay sinh", "nam sinh"],
        status: ["tinh trang", "trang thai"],
        deathDate: ["ngay thang nam mat", "ngay mat", "nam mat"],
        lunarAnniversary: ["ngay gio", "ky nhat", "ngay mat am lich", "lunar anniversary", "lunaranniversary"],
        graveLocation: ["noi an tang", "an tang", "mo phan"],
        note: ["ghi chu", "thu tu"]
      };
      const spouseNeedles = [`vo/chong ${spouseNumber}`, `vo chong ${spouseNumber}`, `phoi ngau ${spouseNumber}`];
      for (let i = 0; i < rowObj._headers.length; i++) {
        const cleanH = normalizeHeaderForMatch(rowObj._headers[i]);
        if (!spouseNeedles.some((needle) => cleanH.includes(needle))) continue;
        if (normalizedFieldLabels[field].some((label) => cleanH.includes(label))) {
          return String(rowObj._rawValues[i] || "").trim();
        }
      }
      return "";
    };

    // C. Process spouse details
    let spouseDetails: any[] = [];
    for (const spouseNumber of [1, 2, 3]) {
      const indexedSpouseId = getIndexedSpouseDetailVal(spouseNumber, "id");
      const indexedSpouseName = getIndexedSpouseDetailVal(spouseNumber, "name");
      if (!indexedSpouseName || indexedSpouseName === "undefined") continue;
      const indexedSpouseBirth = getIndexedSpouseDetailVal(spouseNumber, "birthDate");
      const indexedSpouseStatus = getIndexedSpouseDetailVal(spouseNumber, "status");
      const indexedSpouseDeath = getIndexedSpouseDetailVal(spouseNumber, "deathDate");
      const indexedSpouseLunarDeath = getIndexedSpouseDetailVal(spouseNumber, "lunarAnniversary");
      const indexedSpouseBurial = getIndexedSpouseDetailVal(spouseNumber, "graveLocation");
      const indexedSpouseNote = getIndexedSpouseDetailVal(spouseNumber, "note");
      const indexedSpouseSolarBirthDate = indexedSpouseBirth ? normalizeDateDisplayValue(indexedSpouseBirth.trim()) : undefined;
      const indexedSpouseSolarDeathDate = indexedSpouseDeath ? normalizeDateDisplayValue(indexedSpouseDeath.trim()) : undefined;
      const indexedSpouseBirthYear = extractYearOnly(indexedSpouseSolarBirthDate || indexedSpouseBirth);
      const indexedSpouseDeathYear = extractYearOnly(indexedSpouseSolarDeathDate || indexedSpouseDeath);
      const normalizedStatus = indexedSpouseStatus.toLowerCase();
      const indexedSpouseIsLiving = indexedSpouseDeath || indexedSpouseLunarDeath
        ? false
        : normalizedStatus
          ? !(normalizedStatus.includes("mất") || normalizedStatus.includes("mat") || normalizedStatus.includes("khuất") || normalizedStatus.includes("khuat"))
          : undefined;
      spouseDetails.push({
        id: indexedSpouseId || undefined,
        name: indexedSpouseName.trim(),
        birthYear: indexedSpouseBirthYear || undefined,
        solarBirthDate: indexedSpouseSolarBirthDate,
        isLiving: indexedSpouseIsLiving,
        deathYear: indexedSpouseDeathYear || undefined,
        solarDeathDate: indexedSpouseSolarDeathDate,
        lunarAnniversary: indexedSpouseLunarDeath || undefined,
        burialPlace: indexedSpouseBurial || undefined,
        deathPlace: indexedSpouseBurial || undefined,
        note: indexedSpouseNote || undefined
      });
    }
    if (spouseName && spouseName.trim()) {
      const spouseResidence = spouseIdx !== -1 ? getValInBounds(["nơi ở", "địa chỉ"], spouseIdx, cLimit) : "";
      const spousePhone = spouseIdx !== -1 ? getValInBounds(["số điện thoại", "sđt"], spouseIdx, cLimit) : "";
      const spouseStatus = spouseIdx !== -1 ? getValInBounds(["tình trạng", "trạng thái"], spouseIdx, cLimit) : "";
      const spouseBirth = spouseIdx !== -1 ? getValInBounds(["ngày sinh", "năm sinh"], spouseIdx, cLimit) : "";
      const spouseDeath = spouseIdx !== -1 ? getValInBounds(["ngày tháng năm mất", "năm mất", "ngày mất"], spouseIdx, cLimit) : "";
      const spouseLunarDeath = spouseIdx !== -1 ? getValInBounds(["ngày mất theo âm lịch", "ngày mất âm lịch", "ngày giỗ", "kỵ nhật", "lunar anniversary", "lunaranniversary", "ngay mat theo am lich", "ngay mat am lich", "ngay gio", "ky nhat"], spouseIdx, cLimit) : "";
      const spouseBurial = spouseIdx !== -1 ? getValInBounds(["nơi an táng", "an táng"], spouseIdx, cLimit) : "";
      
      let spouseIsLiving = true;
      if (spouseStatus) {
        const lowerStatus = spouseStatus.toLowerCase();
        if (lowerStatus.includes("mất") || lowerStatus.includes("đã mất") || lowerStatus.includes("qua đời") || lowerStatus.includes("khuất")) {
          spouseIsLiving = false;
        }
      }
      if ((spouseDeath && spouseDeath.trim()) || (spouseLunarDeath && spouseLunarDeath.trim())) {
        spouseIsLiving = false;
      }

      const spouseSolarBirthDate = spouseBirth ? normalizeDateDisplayValue(spouseBirth.trim()) : undefined;
      const spouseSolarDeathDate = spouseDeath ? normalizeDateDisplayValue(spouseDeath.trim()) : undefined;
      const spouseBirthYr = extractYearOnly(spouseSolarBirthDate || spouseBirth);
      const spouseDeathYr = extractYearOnly(spouseSolarDeathDate || spouseDeath);

      const spouseDetailResidence = spouseResidence || (spouseIdx !== -1 ? getRelativeDetailVal(["noi o", "dia chi", "residence"], spouseIdx, cLimit) : "");
      const spouseDetailPhone = spousePhone || (spouseIdx !== -1 ? getRelativeDetailVal(["so dien thoai", "sdt", "phone"], spouseIdx, cLimit) : "");
      const spouseDetailStatus = spouseStatus || (spouseIdx !== -1 ? getRelativeDetailVal(["tinh trang", "trang thai", "status"], spouseIdx, cLimit) : "");
      const spouseDetailBirth = normalizeDateDisplayValue(spouseBirth || (spouseIdx !== -1 ? getRelativeDetailVal(["ngay sinh", "nam sinh", "birth"], spouseIdx, cLimit) : ""));
      const spouseDetailDeath = normalizeDateDisplayValue(spouseDeath || (spouseIdx !== -1 ? getRelativeDetailVal(["ngay thang nam mat", "ngay mat", "nam mat", "death"], spouseIdx, cLimit) : ""));
      const spouseDetailLunarDeath = spouseLunarDeath || (spouseIdx !== -1 ? getRelativeDetailVal(["ngay mat theo am lich", "ngay mat am lich", "ngay gio", "ky nhat", "lunar anniversary", "lunaranniversary"], spouseIdx, cLimit) : "");
      const spouseDetailBurial = spouseBurial || (spouseIdx !== -1 ? getRelativeDetailVal(["noi an tang", "an tang", "burial"], spouseIdx, cLimit) : "");
      const spouseDetailIsLiving = spouseDetailStatus
        ? !spouseDetailStatus.toLowerCase().includes("mat") && !spouseDetailStatus.toLowerCase().includes("khuat")
        : spouseIsLiving;
      const spouseDetailBirthYear = extractYearOnly(spouseDetailBirth) || spouseBirthYr;
      const spouseDetailDeathYear = extractYearOnly(spouseDetailDeath) || spouseDeathYr;

      const hasIndexedSpouse = spouseDetails.some((spouse) => cleanNameForMatching(spouse.name) === cleanNameForMatching(spouseName));
      if (!hasIndexedSpouse) spouseDetails.push({
        name: spouseName.trim(),
        residence: spouseDetailResidence || undefined,
        phone1: normalizeImportedPhone(spouseDetailPhone),
        birthYear: spouseDetailBirthYear || undefined,
        solarBirthDate: spouseDetailBirth || undefined,
        isLiving: (spouseDetailDeath || spouseDetailLunarDeath) ? false : spouseDetailIsLiving,
        deathYear: spouseDetailDeathYear || undefined,
        solarDeathDate: spouseDetailDeath || undefined,
        lunarAnniversary: spouseDetailLunarDeath || undefined,
        burialPlace: spouseDetailBurial || undefined,
        deathPlace: spouseDetailBurial || undefined
      });
    }

    // D. Parse explicit linking IDs
    const id = (explicitId && explicitId !== "undefined" && explicitId.trim().length > 0) 
      ? String(explicitId).trim() 
      : (rowObj.id ? String(rowObj.id).trim() : `tv-${index + 1}`);

    const explicitParentVal = getVal(["mã cha", "mã số cha", "mã cha ruột", "mã người giám hộ", "parent id", "mã số cha ruột", "ma so cha", "ma cha", "parentid", "mã mẹ", "ma me", "ma so cha ruot"]);
    const parentId = (explicitParentVal && explicitParentVal !== "undefined" && explicitParentVal.trim().length > 0)
      ? String(explicitParentVal).trim()
      : (rowObj.parentId ? String(rowObj.parentId).trim() : undefined);

    return {
      id,
      name: nameVal.trim(),
      generation: genNum, // might be undefined initially, resolved topologically!
      _explicitGeneration: genNum, // Explicitly keep parsed generation for topological safety
      gender,
      birthYear: (birthYear && birthYear !== "undefined") ? birthYear : undefined,
      deathYear: (deathYear && deathYear !== "undefined") ? deathYear : undefined,
      solarBirthDate,
      solarDeathDate,
      lunarAnniversary: lunarDeathRaw || undefined,
      deathLunarYearText: deathLunarYearTextRaw || undefined,
      isLiving,
      title,
      spouse: spouseDetails.length > 0 ? spouseDetails.map((spouse) => spouse.name).filter(Boolean).join(", ") : spouseName,
      spouseDetails,
      phone1,
      phone2,
      email,
      residence,
      burialPlace,
      parentId,
      fatherName,
      motherName,
      children: [],
      _fatherDetails,
      _motherDetails,
      _headers: rowObj._headers,
      _rawValues: rowObj._rawValues
    };
  };

  let normalizedNodes: any[] = [];
  flatList.forEach((r, idx) => {
    const node = mapVietnameseKeys(r, idx);
    if (node) {
      normalizedNodes.push(node);
    }
  });

  if (existingTreeToMerge) {
    const existingFlat = flattenTreeToList(existingTreeToMerge);
    normalizedNodes = mergeFlatLists(existingFlat, normalizedNodes);
  }

  const nodeMap: Record<string, any> = {};
  normalizedNodes.forEach((node) => {
    nodeMap[node.id] = node;
  });

  // Guard against spreadsheet cycles or reversed links. A parent must be from an
  // earlier generation than the child; otherwise root detection can collapse to
  // the first row and hide the actual ancestral tree.
  normalizedNodes.forEach((node) => {
    if (!node.parentId || !nodeMap[node.parentId]) return;

    const parentNode = nodeMap[node.parentId];
    const nodeGen = Number(node._explicitGeneration ?? node.generation);
    const parentGen = Number(parentNode._explicitGeneration ?? parentNode.generation);

    if (
      Number.isFinite(nodeGen) &&
      Number.isFinite(parentGen) &&
      (nodeGen <= 0 || parentGen >= nodeGen)
    ) {
      node._ignoredParentId = node.parentId;
      node.parentId = undefined;
      return;
    }

    if (
      parentNode.parentId === node.id &&
      (!Number.isFinite(nodeGen) || !Number.isFinite(parentGen) || nodeGen <= parentGen)
    ) {
      node._ignoredParentId = node.parentId;
      node.parentId = undefined;
    }
  });

  // Extract nested children from standard "Họ và tên con ruột X" columns
  normalizedNodes.forEach((node) => {
    if (!node._headers || !node._rawValues) return;
    
    node._headers.forEach((h: string, colIdx: number) => {
      const cleanHeader = h
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      const isNormalizedChildNameColumn =
        (cleanHeader.includes("con ruot") || cleanHeader.startsWith("con ")) &&
        !cleanHeader.includes("gioi tinh") &&
        !cleanHeader.includes("gender") &&
        !cleanHeader.includes("ngay sinh") &&
        !cleanHeader.includes("nam sinh") &&
        !cleanHeader.includes("so dien thoai") &&
        !cleanHeader.includes("tinh trang");

      if (isNormalizedChildNameColumn) {
        const childName = (node._rawValues[colIdx] || "").trim();
        // Skip placeholders
        if (childName && childName !== "undefined" && !childName.toLowerCase().includes("con ruột") && !childName.includes("Họ và tên")) {
          // Find next column's value if it's "giới tính" or "gender"
          let childGender = "nam";
          if (colIdx + 1 < node._headers.length) {
            const nextHeader = node._headers[colIdx + 1].trim().toLowerCase();
            if (nextHeader.includes("giới tính") || nextHeader === "gender") {
              const genderVal = (node._rawValues[colIdx + 1] || "").trim().toLowerCase();
              if (genderVal.includes("nữ") || genderVal.includes("nu") || genderVal === "female") {
                childGender = "nữ";
              }
            }
          }

          const spouseNames = Array.isArray(node.spouseDetails) && node.spouseDetails.length > 0
            ? node.spouseDetails.map((spouse: any) => String(spouse?.name || "").trim()).filter(Boolean)
            : String(node.spouse || "").split(/[,\/;\-\+]+/).map((spouse: string) => spouse.trim()).filter(Boolean);
          const inferredMotherName = node.gender !== "nữ" && spouseNames.length === 1 ? spouseNames[0] : undefined;

          // Check if this child already has their OWN row in the database
          const existingChildNode = normalizedNodes.find(n => 
            cleanNameForMatching(n.name) === cleanNameForMatching(childName) &&
            (n.generation === undefined || Math.abs(n.generation - ((node.generation ?? 1) + 1)) <= 1)
          );
          const alreadyHasOwnRow = !!existingChildNode;

          if (!alreadyHasOwnRow) {
            const virtualChildId = `virtual-${node.id}-child-${colIdx}`;
            
            // Check to avoid duplicate virtual child nodes
            if (!nodeMap[virtualChildId]) {
              const virtualChildNode = {
                id: virtualChildId,
                name: childName,
                generation: node.generation !== undefined ? node.generation + 1 : undefined,
                gender: childGender,
                parentId: node.id,
                motherName: inferredMotherName,
                isLiving: true,
                children: []
              };
              
              nodeMap[virtualChildId] = virtualChildNode;
              normalizedNodes.push(virtualChildNode);
              virtualChildrenCount++;
            }
          } else if (existingChildNode) {
            if (!existingChildNode.parentId || String(existingChildNode.id || "").startsWith("virtual-")) {
              existingChildNode.parentId = node.id;
            }
            if (!existingChildNode.gender || String(existingChildNode.id || "").startsWith("virtual-")) {
              existingChildNode.gender = childGender;
            }
            if (!existingChildNode.motherName && inferredMotherName) {
              existingChildNode.motherName = inferredMotherName;
            }
          }
        }
      }
    });
  });

  // Resolve parentId using fatherName or motherName if parentId is absent
  normalizedNodes.forEach((node) => {
    if (!node.parentId) {
      const father = node.fatherName ? String(node.fatherName).trim() : "";
      const mother = node.motherName ? String(node.motherName).trim() : "";

      if (father) {
        // Find father candidate with best name match of previous generation (or closest)
        let parentCandidate = normalizedNodes.find(p => 
          cleanNameForMatching(p.name) === cleanNameForMatching(father) && 
          p.generation !== undefined && node.generation !== undefined && p.generation === node.generation - 1
        );
        if (!parentCandidate && node.generation === undefined) {
          parentCandidate = normalizedNodes.find(p => 
            cleanNameForMatching(p.name) === cleanNameForMatching(father)
          );
        }
        if (parentCandidate) {
          node.parentId = parentCandidate.id;
        }
      } else if (mother) {
        let parentCandidate = normalizedNodes.find(p => 
          cleanNameForMatching(p.name) === cleanNameForMatching(mother) && 
          p.generation !== undefined && node.generation !== undefined && p.generation === node.generation - 1
        );
        if (!parentCandidate && node.generation === undefined) {
          parentCandidate = normalizedNodes.find(p => 
            cleanNameForMatching(p.name) === cleanNameForMatching(mother)
          );
        }
        if (parentCandidate) {
          node.parentId = parentCandidate.id;
        }
      }
    }
  });

  // Post-processing: Merge parent & spouse details from child rows to parent nodes
  normalizedNodes.forEach((node) => {
    const parentId = node.parentId;
    if (parentId && nodeMap[parentId]) {
      const fatherNode = nodeMap[parentId];

      // 1. Merge Father details parsed from child row
      if (node._fatherDetails && node._fatherDetails.name) {
        const fd = node._fatherDetails;
        if (!fatherNode.birthYear && fd.birthYear) {
          fatherNode.birthYear = fd.birthYear;
        }
        if (!fatherNode.solarBirthDate && fd.solarBirthDate) {
          fatherNode.solarBirthDate = fd.solarBirthDate;
        }
        if (fatherNode.isLiving === true && fd.isLiving === false) {
          fatherNode.isLiving = false;
        }
        if (!fatherNode.deathYear && fd.deathYear) {
          fatherNode.deathYear = fd.deathYear;
        }
        if (!fatherNode.solarDeathDate && fd.solarDeathDate) {
          fatherNode.solarDeathDate = fd.solarDeathDate;
        }
        if (!fatherNode.deathLunarYearText && fd.deathLunarYearText) {
          fatherNode.deathLunarYearText = fd.deathLunarYearText;
        }
        if (!fatherNode.burialPlace && fd.burialPlace) {
          fatherNode.burialPlace = fd.burialPlace;
        }
        if (!fatherNode.residence && fd.residence) {
          fatherNode.residence = fd.residence;
        }
        if (!fatherNode.phone1 && fd.phone1) {
          fatherNode.phone1 = fd.phone1;
        }
      }

      // 2. Merge Mother details parsed from child row into father's spouseDetails
      if (node._motherDetails && node._motherDetails.name) {
        const md = node._motherDetails;
        if (!fatherNode.spouseDetails) {
          fatherNode.spouseDetails = [];
        }

        const cleanMName = md.name.toLowerCase().replace(/\s*\(.*\)\s*/g, '').trim();
        let existingSpouse = fatherNode.spouseDetails.find((s: any) => {
          const sName = s.name.toLowerCase().replace(/\s*\(.*\)\s*/g, '').trim();
          return sName === cleanMName || sName.includes(cleanMName) || cleanMName.includes(sName);
        });

        if (existingSpouse) {
          if (!existingSpouse.birthYear && md.birthYear) {
            existingSpouse.birthYear = md.birthYear;
          }
          if (!existingSpouse.solarBirthDate && md.solarBirthDate) {
            existingSpouse.solarBirthDate = md.solarBirthDate;
          }
          if (existingSpouse.isLiving !== false && md.isLiving === false) {
            existingSpouse.isLiving = false;
          }
          if (!existingSpouse.deathYear && md.deathYear) {
            existingSpouse.deathYear = md.deathYear;
          }
          if (!existingSpouse.solarDeathDate && md.solarDeathDate) {
            existingSpouse.solarDeathDate = md.solarDeathDate;
          }
          if (!existingSpouse.deathLunarYearText && md.deathLunarYearText) {
            existingSpouse.deathLunarYearText = md.deathLunarYearText;
          }
          if (!existingSpouse.burialPlace && md.burialPlace) {
            existingSpouse.burialPlace = md.burialPlace;
            existingSpouse.deathPlace = md.burialPlace;
          }
          if (!existingSpouse.residence && md.residence) {
            existingSpouse.residence = md.residence;
          }
          if (!existingSpouse.phone1 && md.phone1) {
            existingSpouse.phone1 = md.phone1;
          }
        } else {
          fatherNode.spouseDetails.push({
            name: md.name,
            birthYear: md.birthYear,
            solarBirthDate: md.solarBirthDate,
            isLiving: md.isLiving,
            deathYear: md.deathYear,
            solarDeathDate: md.solarDeathDate,
            deathLunarYearText: md.deathLunarYearText,
            burialPlace: md.burialPlace,
            deathPlace: md.burialPlace,
            residence: md.residence,
            phone1: md.phone1
          });

          if (!fatherNode.spouse) {
            fatherNode.spouse = md.name;
          } else {
            const spousesList = fatherNode.spouse.split(/[,\/;\-\+]+/).map((s: string) => s.trim()).filter(Boolean);
            if (!spousesList.some((s: string) => s.toLowerCase() === md.name.toLowerCase())) {
              fatherNode.spouse = `${fatherNode.spouse}, ${md.name}`;
            }
          }
        }
      }
    }
  });

  // Clear existing children lists to rebuild clean hierarchical connections
  normalizedNodes.forEach(node => {
    node.children = [];
  });

  // Build parent-child tree hierarchy
  const leavesTrack = new Set<string>(); // Tracks nodes that are children of someone
  
  normalizedNodes.forEach((node) => {
    const parentId = node.parentId;
    if (parentId && nodeMap[parentId]) {
      // Ensure child list elements are fully unique
      const exists = nodeMap[parentId].children.some((c: any) => c.id === node.id || cleanNameForMatching(c.name) === cleanNameForMatching(node.name));
      if (!exists) {
        nodeMap[parentId].children.push(node);
      }
      leavesTrack.add(node.id);
    }
  });

  // Helper: Is a node listed as a spouse of another node in the flat array?
  const isSpouseOfSomeone = (candidate: any) => {
    return normalizedNodes.some(n => 
      n.id !== candidate.id && 
      (cleanNameForMatching(n.spouse || "") === cleanNameForMatching(candidate.name) ||
       (n.spouseDetails && n.spouseDetails.some((s: any) => cleanNameForMatching(s.name) === cleanNameForMatching(candidate.name))))
    );
  };

  // Find absolute roots: nodes that have no parents and are NOT spouses of someone else
  let absoluteRoots = normalizedNodes.filter(node => 
    (!node.parentId || !nodeMap[node.parentId]) && 
    !isSpouseOfSomeone(node)
  );

  if (absoluteRoots.length === 0 && normalizedNodes.length > 0) {
    const rootCandidate = [...normalizedNodes]
      .filter(node => !isSpouseOfSomeone(node))
      .sort((a, b) => {
        const aGen = Number(a._explicitGeneration ?? a.generation);
        const bGen = Number(b._explicitGeneration ?? b.generation);
        const safeAGen = Number.isFinite(aGen) ? aGen : Number.MAX_SAFE_INTEGER;
        const safeBGen = Number.isFinite(bGen) ? bGen : Number.MAX_SAFE_INTEGER;
        return safeAGen - safeBGen;
      })[0];

    if (rootCandidate) {
      rootCandidate._ignoredParentId = rootCandidate.parentId;
      rootCandidate.parentId = undefined;
      normalizedNodes.forEach((node) => {
        if (Array.isArray(node.children)) {
          node.children = node.children.filter((child: any) => child.id !== rootCandidate.id);
        }
      });
      leavesTrack.delete(rootCandidate.id);
      absoluteRoots = [rootCandidate];
    }
  }

  // Topological Generation propagation: Automatically compute missing generations
  const visitedNodes = new Set<string>();
  const propagateGeneration = (node: any, currentGen: number) => {
    if (!node || visitedNodes.has(node.id)) return;
    visitedNodes.add(node.id);
    
    // Prioritize explicit generation from sheet if present and valid
    if (node._explicitGeneration !== undefined && node._explicitGeneration >= 0) {
      node.generation = node._explicitGeneration;
    } else if (node.generation !== undefined && node.generation >= 0) {
      // already set
    } else {
      node.generation = currentGen;
    }
    
    const nextGen = (node.generation ?? 1) + 1;
    if (node.children && node.children.length > 0) {
      node.children.forEach((child: any) => {
        const childStartGen = (child._explicitGeneration !== undefined && child._explicitGeneration >= 0)
          ? child._explicitGeneration
          : nextGen;
        propagateGeneration(child, childStartGen);
      });
    }
  };

  // Propagate generations starting from our absolute roots
  absoluteRoots.forEach((rootNode) => {
    const parentParsedGen = rootNode._explicitGeneration ?? rootNode.generation;
    const startGen = (parentParsedGen !== undefined && parentParsedGen >= 0) ? parentParsedGen : 1;
    propagateGeneration(rootNode, startGen);
  });

  // Re-verify that all nodes have a generation assigned (topological fallback for any orphans)
  normalizedNodes.forEach((node) => {
    if (node.generation === undefined) {
      node.generation = (node._explicitGeneration !== undefined && node._explicitGeneration >= 0) ? node._explicitGeneration : 1;
    }
  });

  // Select a singular finalRoot
  let finalRoot: any = null;
  if (absoluteRoots.length > 1) {
    // Elegant Multi-branch support! Create a virtual Ancestral root to link disconnected branches.
    const virtualGrandRoot = {
      id: "virtual-grand-root",
      name: "Khởi Tổ / Đồng Tông",
      generation: 1,
      gender: "nam",
      title: "HỘI ĐỒNG GIA TỘC DÒNG HỌ",
      isLiving: false,
      children: absoluteRoots,
      _isVirtualRoot: true
    };
    
    // Intelligent shift: do NOT collapse G9 roots down to G2! 
    const shiftedVisited = new Set<string>();
    const shiftGen = (n: any, parentGen: number) => {
      if (!n || shiftedVisited.has(n.id)) return;
      shiftedVisited.add(n.id);
      
      // If node already has a valid explicit/computed generation that is greater than parentGen, protect it!
      if (n.generation === undefined || n.generation <= parentGen) {
        n.generation = parentGen + 1;
      }
      
      if (n.children) {
        n.children.forEach((c: any) => shiftGen(c, n.generation));
      }
    };
    absoluteRoots.forEach((rootNode) => {
      shiftGen(rootNode, 1); // virtualGrandRoot is generation 1, so roots should be at least generation 2
    });
    
    finalRoot = virtualGrandRoot;
  } else {
    finalRoot = absoluteRoots[0] || normalizedNodes[0];
  }

  // E. DIAGNOSTICS GENERATOR (Linked to raw original data validation)
  const unlinkedNodes: any[] = [];
  normalizedNodes.forEach(node => {
    // If the node is not the root, and not linked as a child, and not the virtual root itself
    if (node.id !== finalRoot.id && !leavesTrack.has(node.id) && !node.id.startsWith("virtual-") && !isSpouseOfSomeone(node)) {
      const potentialParents = normalizedNodes
        .filter(p => p.generation === node.generation - 1)
        .map(p => ({
          id: p.id,
          name: p.name,
          similarity: getNameSimilarity(p.name, node.fatherName || node.motherName || "")
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 3);

      unlinkedNodes.push({
        id: node.id,
        name: node.name,
        generation: node.generation,
        fatherName: node.fatherName,
        motherName: node.motherName,
        potentialParents: potentialParents.filter(p => p.similarity > 0.1 || potentialParents.indexOf(p) === 0)
      });
    }
  });

  const countActualVirtualChildren = (node: any): number => {
    if (!node) return 0;
    const selfCount = String(node.id || "").startsWith("virtual-") ? 1 : 0;
    const childCount = Array.isArray(node.children)
      ? node.children.reduce((sum: number, child: any) => sum + countActualVirtualChildren(child), 0)
      : 0;
    return selfCount + childCount;
  };

  finalRoot._diagnostics = {
    totalParsed,
    virtualChildrenCount: countActualVirtualChildren(finalRoot),
    duplicateNames: Array.from(duplicateNameSet),
    unlinkedNodes
  };

  return finalRoot;
}

/**
 * Custom Simple CSV Row parser supporting commas, tabs, semicolons, and quotes
 */
export function parseCSVToObjects(csvText: string): any[] {
  // Strip UTF-8 Byte Order Mark (BOM) if present from Excel files
  if (csvText.startsWith("\ufeff")) {
    csvText = csvText.slice(1);
  }

  const lines: string[] = [];
  let isInsideQuote = false;
  let currentLine = "";

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    if (char === '"') {
      isInsideQuote = !isInsideQuote;
    } else if ((char === '\n' || char === '\r') && !isInsideQuote) {
      if (char === '\r' && csvText[i+1] === '\n') {
        i++; // skip LF
      }
      lines.push(currentLine);
      currentLine = "";
    } else {
      currentLine += char;
    }
  }
  if (currentLine) lines.push(currentLine);

  if (lines.length < 2) return [];

  // Determine actual delimiter dynamically based on header frequency
  let delimiter = ",";
  const firstLine = lines[0];
  if (firstLine.includes("\t") && firstLine.split("\t").length > firstLine.split(",").length) {
    delimiter = "\t";
  } else if (firstLine.includes(";") && firstLine.split(";").length > firstLine.split(",").length) {
    delimiter = ";";
  }

  // Parse row cells taking care of quotes and custom delimiter
  const parseRowCells = (lineStr: string): string[] => {
    const cells: string[] = [];
    let cell = "";
    let insideQuote = false;
    for (let c = 0; c < lineStr.length; c++) {
      const char = lineStr[c];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === delimiter && !insideQuote) {
        cells.push(cell.replace(/^["']|["']$/g, '').trim());
        cell = "";
      } else {
        cell += char;
      }
    }
    cells.push(cell.replace(/^["']|["']$/g, '').trim());
    return cells;
  };

  const headers = parseRowCells(lines[0]);

  const results: any[] = [];
  for (let l = 1; l < lines.length; l++) {
    const line = lines[l].trim();
    if (!line) continue;

    const values = parseRowCells(line);

    // Map columns to raw string map object
    const rowObj: Record<string, any> = {};
    headers.forEach((header, index) => {
      const val = values[index] || "";
      rowObj[header] = val;
    });

    // Store raw headers and values for index-safe querying
    rowObj._headers = headers;
    rowObj._rawValues = values;

    results.push(rowObj);
  }

  return results;
}

/**
 * Traverses a hierarchical family tree and flattens it back into an array of member node objects.
 */
export function flattenTreeToList(root: any): any[] {
  if (!root) return [];
  const list: any[] = [];
  const visited = new Set<string>();

  const traverse = (node: any) => {
    if (!node || visited.has(node.id)) return;
    visited.add(node.id);

    // Create a flat representation of this node, excluding visual and recursive structures
    const { children, _diagnostics, ...rest } = node;
    
    // Skip virtual root node from entering the database
    if (node.id !== "virtual-grand-root") {
      list.push(rest);
    }

    if (children && Array.isArray(children)) {
      children.forEach((c: any) => traverse(c));
    }
  };

  traverse(root);
  return list;
}

/**
 * Intelligent list-merging algorithm: merges newly fetched Google Sheet / CSV rows
 * with existing ones. It updates existing members (identified by ID or name) and appends new ones.
 */
export function mergeFlatLists(existingList: any[], newList: any[]): any[] {
  const mergedList = newList.map((node) => ({ ...node }));

  existingList.forEach((oldNode) => {
    if (!oldNode || !oldNode.name) return;

    // Find index of matching imported node. Imported rows are authoritative for
    // IDs, parent links, and generations; existing data only fills missing cells.
    const matchIdx = mergedList.findIndex((importedNode) => {
      // Prioritize explicit ID match if available and not virtual
      if (
        oldNode.id &&
        importedNode.id &&
        !String(oldNode.id).startsWith("virtual-") &&
        !String(importedNode.id).startsWith("virtual-") &&
        oldNode.id === importedNode.id
      ) {
        return true;
      }
      // Fallback: match by normalized names
      return cleanNameForMatching(oldNode.name) === cleanNameForMatching(importedNode.name);
    });

    if (matchIdx !== -1) {
      const importedNode = mergedList[matchIdx];
      const mergedObj = { ...importedNode };

      Object.keys(oldNode).forEach((key) => {
        const oldVal = oldNode[key];
        const importedVal = mergedObj[key];
        
        if (oldVal === undefined || oldVal === null || String(oldVal).trim() === "" || oldVal === "undefined") {
          return;
        }

        if (key === "spouseDetails" && Array.isArray(oldVal) && oldVal.length > 0) {
          const currentSpouses = Array.isArray(mergedObj.spouseDetails) ? [...mergedObj.spouseDetails] : [];
          oldVal.forEach((oldSpouse) => {
            const sMatchIdx = currentSpouses.findIndex(os => {
              const oldId = String(oldSpouse?.id || "").trim();
              const currentId = String(os?.id || "").trim();
              if (oldId && currentId && oldId === currentId) return true;
              return cleanNameForMatching(os.name) === cleanNameForMatching(oldSpouse.name);
            });
            if (sMatchIdx !== -1) {
              currentSpouses[sMatchIdx] = { ...oldSpouse, ...currentSpouses[sMatchIdx] };
            } else {
              currentSpouses.push(oldSpouse);
            }
          });
          mergedObj.spouseDetails = currentSpouses;
          return;
        }

        // Keep imported structure authoritative.
        if (["id", "parentId", "generation", "_explicitGeneration", "fatherName", "motherName", "children"].includes(key)) {
          return;
        }

        if (importedVal === undefined || importedVal === null || String(importedVal).trim() === "" || importedVal === "undefined") {
          mergedObj[key] = oldVal;
        }
      });

      if (Array.isArray(mergedObj.spouseDetails) && mergedObj.spouseDetails.length > 0) {
        mergedObj.spouse = mergedObj.spouseDetails
          .map((spouse: any) => String(spouse?.name || "").trim())
          .filter(Boolean)
          .join(", ");
      }

      mergedList[matchIdx] = mergedObj;
    } else {
      mergedList.push(oldNode);
    }
  });

  return mergedList;
}

