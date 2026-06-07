import React, { useEffect, useState, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { motion, AnimatePresence } from "motion/react";
import { Search, Filter, ShieldAlert, User, UserCheck, Award, Heart, Edit3, Plus, ArrowRight, X, Calendar, MapPin, Eye, Database, Copy, Check, Upload, Download, AlertCircle, RefreshCw } from "lucide-react";
import { FamilyMember } from "../types";
import { analyzeImportRows } from "../../utils/importValidation";
import { flattenTreeToList, parseCSVToObjects, savePersistedTreeData } from "../../utils/configManager";
import { parseWorksheetToRows } from "../../utils/spreadsheetImport";
import { mapLineageNodesToDashboardMembers } from "../data/lineageBridge";
import { convertSolarToLunarText, convertSolarToLunarTextFromLich247, deriveLunarAnniversaryFromSolarDeathDate, deriveLunarAnniversaryFromSolarDeathDateViaLich247 } from "../../utils/lunarConverter";
import { parseGenealogyDateText } from "../../utils/genealogyDate.mjs";

const parseStructuredGenealogyDate = (...args: Parameters<typeof parseGenealogyDateText>): FamilyMember["birthDateStructured"] =>
  parseGenealogyDateText(...args) as FamilyMember["birthDateStructured"];

interface GenealogyProps {
  members: FamilyMember[];
  onAddMember: (member: FamilyMember) => void;
  onUpdateMember?: (member: FamilyMember) => void;
  onBulkImport?: (newMembers: FamilyMember[], mode: "replace" | "append") => void;
}

type ManagedBranch = {
  name: string;
  leaderId?: string;
  memberIds?: string[];
  note?: string;
};

type ComputedBranch = {
  name: string;
  founderId: string;
  leaderId?: string;
  memberIds: string[];
  parentId?: string;
  isAuto: true;
};

type ExcelImportSession = {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileHash: string;
  status: string;
  rowCount: number;
  columnCount: number;
  warnings: { severity?: string; message?: string; type?: string }[];
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
};

type ExcelImportMapping = {
  id: string;
  sessionId: string;
  columnIndex: number;
  columnLetter: string;
  originalHeader: string;
  mappedField: string;
  confidence: number;
  warning: string;
  approved: boolean;
};

type ExcelImportIssue = {
  id: string;
  rowIndex: number;
  columnIndex: number;
  issueType: string;
  severity: string;
  message: string;
  suggestedFix?: string;
};

type MemberEvidenceChecklistItem = {
  key: string;
  label: string;
  field: string;
  fieldLabel: string;
  status: "complete" | "missing";
  currentValue?: string;
  hasAppliedEvidence?: boolean;
  hasPendingEvidence?: boolean;
};

type MemberEvidenceItem = {
  id: string;
  candidateId?: string;
  logId?: string;
  auditId?: string;
  kind: string;
  field: string;
  fieldLabel: string;
  oldValue?: string;
  newValue?: string;
  status: string;
  reconcileStatus?: string;
  matchConfidence?: string;
  sourceId?: string;
  chunkId?: string;
  sourceTitle?: string;
  headingPath?: string;
  evidenceQuote?: string;
  evidenceWindow?: string;
  evidenceType?: string;
  appliedBy?: string;
  appliedAt?: string;
  rolledBackAt?: string;
};

type MemberEvidenceDisplayItem = MemberEvidenceItem & {
  evidenceGroup: "applied" | "pending" | "rolled_back" | "drift";
  evidenceGroupLabel: string;
};

type MemberEvidenceResponse = {
  ok: boolean;
  member?: {
    id: string;
    name: string;
    displayName: string;
    generation?: number;
    branch?: string;
  };
  summary?: {
    activeApplied: number;
    rolledBack: number;
    drift: number;
    pending: number;
    approvedNotApplied: number;
    checklistMissing: number;
    checklistComplete: number;
  };
  checklist?: MemberEvidenceChecklistItem[];
  activeEvidence?: MemberEvidenceItem[];
  rollbackEvidence?: MemberEvidenceItem[];
  driftEvidence?: MemberEvidenceItem[];
  pendingEvidence?: MemberEvidenceItem[];
};

export default function Genealogy({ members, onAddMember, onUpdateMember, onBulkImport }: GenealogyProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [selectedGen, setSelectedGen] = useState<number | "T\u1ea5t c\u1ea3 \u0111\u1eddi">("T\u1ea5t c\u1ea3 \u0111\u1eddi");
  const [activeBioMemberId, setActiveBioMemberId] = useState<string | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [isExcelOpen, setIsExcelOpen] = useState(false);
  const [isBranchManagerOpen, setIsBranchManagerOpen] = useState(false);
  const [branchFilterMode, setBranchFilterMode] = useState<"allMembers" | "leadersOnly">("allMembers");
  const [managedBranches, setManagedBranches] = useState<ManagedBranch[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("caogia_admin_branch_registry_v1") || "[]");
      return Array.isArray(saved) ? saved.map((item) => ({
        name: String(item?.name || "").trim(),
        leaderId: item?.leaderId,
        memberIds: Array.isArray(item?.memberIds) ? item.memberIds : [],
        note: item?.note
      })).filter((item) => item.name) : [];
    } catch {
      return [];
    }
  });
  const [activeManagedBranchName, setActiveManagedBranchName] = useState("");
  const [newBranchDraft, setNewBranchDraft] = useState("");
  const [branchMemberSearch, setBranchMemberSearch] = useState("");

  // Bulk parser spreadsheet states
  const [bulkText, setBulkText] = useState("");
  const [parsedPreview, setParsedPreview] = useState<any[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [excelActiveTab, setExcelActiveTab] = useState<"paste" | "script">("paste");
  
  // Custom states for premium Excel upload & 55 column matching
  const [importMode, setImportMode] = useState<"append" | "replace">("append");
  const [uploadFileName, setUploadFileName] = useState("");
  const [validationScore, setValidationScore] = useState<number | null>(null);
  const [columnMatches, setColumnMatches] = useState<{
    name: string;
    dashboardField: string;
    status: "matched" | "mismatched" | "empty";
    incomingHeader?: string;
    excelAddress: string;
    sampleValue?: string;
  }[]>([]);
  const [columnFieldOverrides, setColumnFieldOverrides] = useState<Record<number, string>>({});
  const [validatedImportTree, setValidatedImportTree] = useState<any | null>(null);
  const [excelImportSession, setExcelImportSession] = useState<ExcelImportSession | null>(null);
  const [excelImportMappings, setExcelImportMappings] = useState<ExcelImportMapping[]>([]);
  const [excelImportIssues, setExcelImportIssues] = useState<ExcelImportIssue[]>([]);
  const [excelImportSessions, setExcelImportSessions] = useState<ExcelImportSession[]>([]);
  const [excelImportBusy, setExcelImportBusy] = useState(false);
  const [excelImportGateNote, setExcelImportGateNote] = useState("");
  const [memberEvidence, setMemberEvidence] = useState<MemberEvidenceResponse | null>(null);
  const [memberEvidenceLoading, setMemberEvidenceLoading] = useState(false);
  const [memberEvidenceNote, setMemberEvidenceNote] = useState("");
  const [isMemberEvidenceDrawerOpen, setIsMemberEvidenceDrawerOpen] = useState(false);
  const [selectedMemberEvidenceKey, setSelectedMemberEvidenceKey] = useState("");
  const [memberEvidenceStatusFilter, setMemberEvidenceStatusFilter] = useState<"all" | "applied" | "pending" | "approved" | "rolled_back" | "drift">("all");
  const [memberEvidenceFieldFilter, setMemberEvidenceFieldFilter] = useState("all");
  const [memberEvidenceActionBusy, setMemberEvidenceActionBusy] = useState("");
  const [memberEvidenceActionNote, setMemberEvidenceActionNote] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Standard 55-column layout template sent yesterday 
  const FAMILY_COLUMNS_SPEC = useMemo(() => [
    "Mã định danh cá nhân",
    "Họ và tên đầy đủ",
    "Giới tính",
    "Tên thường gọi / Bí danh / Tên tự (nếu có)",
    "Số điện thoại",
    "Số điện thoại phụ",
    "Nơi ở",
    "Email",
    "Ngày sinh (Trên giấy tờ)",
    "Tình trạng (còn sống/đã mất)",
    "(Nếu đã mất) Ngày tháng năm mất (dương lịch)",
    "(Nếu đã mất) Ngày mất theo âm lịch / Kỵ nhật",
    "(Nếu đã mất) Nơi an táng",
    "Đời thứ mấy",
    "Họ và tên Cha ruột",
    "Nơi ở của cha ruột",
    "Số điện thoại của cha",
    "Ngày sinh (Trên giấy tờ) của cha",
    "Tình trạng (còn sống/đã mất) của cha",
    "(Nếu đã mất) Ngày tháng năm mất (dương lịch) của cha",
    "(Nếu đã mất) Ngày mất theo âm lịch / Kỵ nhật của cha",
    "(Nếu đã mất) Nơi an táng của cha",
    "Mã số cha",
    "Họ và tên Mẹ ruột",
    "Nơi ở của mẹ",
    "Số điện thoại của mẹ",
    "Ngày sinh (Trên giấy tờ) của mẹ",
    "Tình trạng của mẹ (còn sống/đã mất)",
    "(Nếu đã mất) Ngày tháng năm mất (dương lịch) của mẹ",
    "(Nếu đã mất) Ngày mất theo âm lịch / Kỵ nhật của mẹ",
    "(Nếu đã mất) Nơi an táng của mẹ",
    "Họ và tên Vợ/Chồng",
    "Nơi ở của Vợ/Chồng",
    "Số điện thoại của Vợ/Chồng",
    "Ngày sinh (Trên giấy tờ) Vợ/Chồng",
    "Tình trạng (còn sống/đã mất) Vợ/Chồng",
    "(Nếu đã mất) Ngày tháng năm mất (dương lịch) Vợ/Chồng",
    "(Nếu đã mất) Ngày mất theo âm lịch / Kỵ nhật Vợ/Chồng",
    "(Nếu đã mất) Nơi an táng Vợ/Chồng",
    "Con ruột 1",
    "Giới tính con ruột 1",
    "Con ruột 2",
    "Giới tính con ruột 2",
    "Con ruột 3",
    "Giới tính con ruột 3",
    "Con ruột 4",
    "Giới tính con ruột 4",
    "Con ruột 5",
    "Giới tính con ruột 5",
    "Con ruột 6",
    "Giới tính con ruột 6",
    "Con ruột 7",
    "Giới tính con ruột 7",
    "Con ruột 8",
    "Giới tính con ruột 8"
  ], []);

  const FAMILY_COLUMN_REFERENCE = useMemo(() => [
    { excelColumn: "Mã định danh cá nhân", dashboardField: "id" },
    { excelColumn: "Họ và tên đầy đủ", dashboardField: "name" },
    { excelColumn: "Giới tính", dashboardField: "gender" },
    { excelColumn: "Tên thường gọi / Bí danh / Tên tự", dashboardField: "bio.alias" },
    { excelColumn: "Số điện thoại", dashboardField: "phone1" },
    { excelColumn: "Số điện thoại phụ", dashboardField: "phone2" },
    { excelColumn: "Nơi ở", dashboardField: "residence" },
    { excelColumn: "Email", dashboardField: "email" },
    { excelColumn: "Ngày sinh trên giấy tờ", dashboardField: "solarBirthDate / birthYear" },
    { excelColumn: "Tình trạng còn sống/đã mất", dashboardField: "isLiving / isDeceased" },
    { excelColumn: "Ngày mất dương lịch", dashboardField: "solarDeathDate / deathYear" },
    { excelColumn: "Ngày mất âm lịch / Kỵ nhật", dashboardField: "lunarAnniversary / deathAnniversaryLunar" },
    { excelColumn: "Nơi an táng", dashboardField: "burialPlace / graveLocation" },
    { excelColumn: "Đời thứ mấy", dashboardField: "generation" },
    { excelColumn: "Họ và tên Cha ruột", dashboardField: "father.name" },
    { excelColumn: "Nơi ở của cha ruột", dashboardField: "father.residence" },
    { excelColumn: "Số điện thoại của cha", dashboardField: "father.phone" },
    { excelColumn: "Ngày sinh của cha", dashboardField: "father.birthDate" },
    { excelColumn: "Tình trạng của cha", dashboardField: "father.isLiving" },
    { excelColumn: "Ngày mất dương lịch của cha", dashboardField: "father.deathDate" },
    { excelColumn: "Ngày kỵ âm lịch của cha", dashboardField: "father.lunarAnniversary" },
    { excelColumn: "Nơi an táng của cha", dashboardField: "father.burialPlace" },
    { excelColumn: "Mã số cha", dashboardField: "parentId" },
    { excelColumn: "Họ và tên Mẹ ruột", dashboardField: "motherName" },
    { excelColumn: "Nơi ở của mẹ", dashboardField: "mother.residence" },
    { excelColumn: "Số điện thoại của mẹ", dashboardField: "mother.phone" },
    { excelColumn: "Ngày sinh của mẹ", dashboardField: "mother.birthDate" },
    { excelColumn: "Tình trạng của mẹ", dashboardField: "mother.isLiving" },
    { excelColumn: "Ngày mất dương lịch của mẹ", dashboardField: "mother.deathDate" },
    { excelColumn: "Ngày kỵ âm lịch của mẹ", dashboardField: "mother.lunarAnniversary" },
    { excelColumn: "Nơi an táng của mẹ", dashboardField: "mother.burialPlace" },
    { excelColumn: "Họ và tên Vợ/Chồng", dashboardField: "spouse / spouseDetails[0].name" },
    { excelColumn: "Nơi ở của Vợ/Chồng", dashboardField: "spouseDetails[0].residence" },
    { excelColumn: "Số điện thoại của Vợ/Chồng", dashboardField: "spouseDetails[0].phone1" },
    { excelColumn: "Ngày sinh Vợ/Chồng", dashboardField: "spouseDetails[0].solarBirthDate" },
    { excelColumn: "Tình trạng Vợ/Chồng", dashboardField: "spouseDetails[0].isLiving" },
    { excelColumn: "Ngày mất dương lịch Vợ/Chồng", dashboardField: "spouseDetails[0].solarDeathDate" },
    { excelColumn: "Ngày kỵ âm lịch Vợ/Chồng", dashboardField: "spouseDetails[0].lunarAnniversary" },
    { excelColumn: "Nơi an táng Vợ/Chồng", dashboardField: "spouseDetails[0].burialPlace" },
    { excelColumn: "Con ruột 1", dashboardField: "children[0].name" },
    { excelColumn: "Giới tính con ruột 1", dashboardField: "children[0].gender" },
    { excelColumn: "Con ruột 2", dashboardField: "children[1].name" },
    { excelColumn: "Giới tính con ruột 2", dashboardField: "children[1].gender" },
    { excelColumn: "Con ruột 3", dashboardField: "children[2].name" },
    { excelColumn: "Giới tính con ruột 3", dashboardField: "children[2].gender" },
    { excelColumn: "Con ruột 4", dashboardField: "children[3].name" },
    { excelColumn: "Giới tính con ruột 4", dashboardField: "children[3].gender" },
    { excelColumn: "Con ruột 5", dashboardField: "children[4].name" },
    { excelColumn: "Giới tính con ruột 5", dashboardField: "children[4].gender" },
    { excelColumn: "Con ruột 6", dashboardField: "children[5].name" },
    { excelColumn: "Giới tính con ruột 6", dashboardField: "children[5].gender" },
    { excelColumn: "Con ruột 7", dashboardField: "children[6].name" },
    { excelColumn: "Giới tính con ruột 7", dashboardField: "children[6].gender" },
    { excelColumn: "Con ruột 8", dashboardField: "children[7].name" },
    { excelColumn: "Giới tính con ruột 8", dashboardField: "children[7].gender" }
  ], []);

  const dashboardColumnHeaders = useMemo(() => FAMILY_COLUMN_REFERENCE.map((column) => column.excelColumn), [FAMILY_COLUMN_REFERENCE]);
  const dashboardFieldLabels: Record<string, string> = {
    "id": "Mã định danh cá nhân",
    "name": "Họ và tên đầy đủ",
    "gender": "Giới tính",
    "bio.alias": "Tên thường gọi / Bí danh / Tên tự",
    "phone1": "Số điện thoại chính",
    "phone2": "Số điện thoại phụ",
    "residence": "Nơi ở / địa chỉ cư trú",
    "email": "Email liên hệ",
    "solarBirthDate / birthYear": "Ngày sinh hoặc năm sinh của cá nhân",
    "isLiving / isDeceased": "Tình trạng còn sống / đã mất của cá nhân",
    "solarDeathDate / deathYear": "Ngày mất dương lịch của cá nhân",
    "lunarAnniversary / deathAnniversaryLunar": "Ngày giỗ / Kỵ nhật âm lịch của cá nhân",
    "burialPlace / graveLocation": "Nơi an táng / Mộ phần của cá nhân",
    "generation": "Đời / Thế hệ của cá nhân",
    "father.name": "Họ tên cha ruột",
    "father.residence": "Nơi ở của cha",
    "father.phone": "Số điện thoại của cha",
    "father.birthDate": "Ngày sinh dương lịch của cha",
    "father.isLiving": "Tình trạng của cha",
    "father.deathDate": "Ngày mất dương lịch của cha",
    "father.lunarAnniversary": "Ngày kỵ âm lịch của cha",
    "father.burialPlace": "Nơi an táng của cha",
    "parentId": "Mã định danh của cha",
    "motherName": "Họ tên mẹ ruột",
    "mother.residence": "Nơi ở của mẹ",
    "mother.phone": "Số điện thoại của mẹ",
    "mother.birthDate": "Ngày sinh dương lịch của mẹ",
    "mother.isLiving": "Tình trạng của mẹ",
    "mother.deathDate": "Ngày mất dương lịch của mẹ",
    "mother.lunarAnniversary": "Ngày kỵ âm lịch của mẹ",
    "mother.burialPlace": "Nơi an táng của mẹ",
    "spouse / spouseDetails[0].name": "Họ tên vợ/chồng",
    "spouseDetails[0].residence": "Nơi ở của vợ/chồng",
    "spouseDetails[0].phone1": "Số điện thoại của vợ/chồng",
    "spouseDetails[0].solarBirthDate": "Ngày sinh dương lịch của vợ/chồng",
    "spouseDetails[0].isLiving": "Tình trạng của vợ/chồng",
    "spouseDetails[0].solarDeathDate": "Ngày mất dương lịch của vợ/chồng",
    "spouseDetails[0].lunarAnniversary": "Ngày kỵ âm lịch của vợ/chồng",
    "spouseDetails[0].burialPlace": "Nơi an táng của vợ/chồng",
    "children[0].name": "Họ tên con thứ 1",
    "children[0].gender": "Giới tính con thứ 1",
    "children[1].name": "Họ tên con thứ 2",
    "children[1].gender": "Giới tính con thứ 2",
    "children[2].name": "Họ tên con thứ 3",
    "children[2].gender": "Giới tính con thứ 3",
    "children[3].name": "Họ tên con thứ 4",
    "children[3].gender": "Giới tính con thứ 4",
    "children[4].name": "Họ tên con thứ 5",
    "children[4].gender": "Giới tính con thứ 5",
    "children[5].name": "Họ tên con thứ 6",
    "children[5].gender": "Giới tính con thứ 6",
    "children[6].name": "Họ tên con thứ 7",
    "children[6].gender": "Giới tính con thứ 7",
    "children[7].name": "Họ tên con thứ 8",
    "children[7].gender": "Giới tính con thứ 8"
  };

  const dashboardFieldOptions = useMemo(
    () => Array.from(new Set<string>(FAMILY_COLUMN_REFERENCE.map((column) => column.dashboardField))).map((field) => ({
      value: field,
      label: dashboardFieldLabels[field] || field
    })),
    [FAMILY_COLUMN_REFERENCE]
  );

  const getResolvedDashboardField = (columnIndex: number, fallbackField: string) => {
    return columnFieldOverrides[columnIndex] || fallbackField;
  };

  const getDashboardFieldLabel = (field: string) => dashboardFieldLabels[field] || field;

  const displayText = (value: unknown) => {
    const text = String(value ?? "");
    if (!/[\u00c3\u00c2\u00c6\u00c4\u00e1]/.test(text)) return text;
    try {
      return decodeURIComponent(escape(text));
    } catch {
      return text;
    }
  };

  const normalizeGenealogyLookupText = (value: unknown) => displayText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const uniqueDisplayTexts = (values: unknown[]) => {
    const seen = new Set<string>();
    return values
      .map((value) => displayText(value).trim())
      .filter((value) => {
        if (!value) return false;
        const key = normalizeGenealogyLookupText(value);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  };

  const textContainsNormalized = (container: unknown, value: unknown) => {
    const containerKey = normalizeGenealogyLookupText(container);
    const valueKey = normalizeGenealogyLookupText(value);
    return Boolean(containerKey && valueKey && containerKey.includes(valueKey));
  };

  const getMemberTitleLine = (member?: FamilyMember) => {
    if (!member) return "";
    const title = displayText(member.rankRole || member.title || "").trim();
    const suffix = displayText(member.customSuffix || "").trim();
    if (!title) return suffix;
    if (!suffix || textContainsNormalized(title, suffix)) return title;
    return `${title} - ${suffix}`;
  };

  const getMemberAchievementItems = (member?: FamilyMember) => {
    if (!member?.achievements?.length) return [];
    return uniqueDisplayTexts(member.achievements).filter((item) => {
      if (member.customSuffix && normalizeGenealogyLookupText(item) === normalizeGenealogyLookupText(member.customSuffix)) return false;
      if (member.title && textContainsNormalized(member.title, item)) return false;
      if (member.rankRole && textContainsNormalized(member.rankRole, item)) return false;
      return true;
    });
  };

  const compactEvidenceText = (value: unknown, maxLength = 96) => {
    const text = displayText(value).replace(/\s+/g, " ").trim();
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
  };

  const getMemberEvidenceCandidateEndpoint = (item: MemberEvidenceDisplayItem) => {
    const id = encodeURIComponent(item.candidateId || item.id);
    if (item.kind === "profile") return `/api/knowledge/profile-candidates/${id}`;
    if (item.kind === "relationship") return `/api/knowledge/relationship-candidates/${id}`;
    return `/api/knowledge/extracted-anniversaries/${id}`;
  };

  const buildMemberEvidenceApplyItem = (item: MemberEvidenceDisplayItem, confirmOverwrite = false) => {
    const payload: Record<string, any> = {
      kind: item.kind,
      id: item.candidateId || item.id,
      memberId: bioAncestor?.id,
      confirmOverwrite,
      confirmIdentity: true,
      confirmSourceCheck: true,
      confirmFieldMapping: true,
      confirmRelationshipReview: true
    };
    if (item.kind === "anniversary" && item.field) payload.fieldTypes = [item.field];
    if (item.kind === "profile") {
      payload.targetField = item.field;
      if (item.newValue) payload.reviewedText = item.newValue;
    }
    if (item.kind === "relationship") payload.relationshipType = item.field;
    return payload;
  };

  const loadMemberEvidence = async (memberId: string) => {
    if (!memberId) return;
    setMemberEvidenceLoading(true);
    setMemberEvidenceNote("");
    try {
      const res = await fetch(`/api/lineage/members/${encodeURIComponent(memberId)}/evidence`, {
        credentials: "include"
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Không tải được nguồn đối soát hồ sơ.");
      setMemberEvidence(data);
    } catch (err: any) {
      setMemberEvidence(null);
      setMemberEvidenceNote(err.message || "Không tải được nguồn đối soát hồ sơ.");
    } finally {
      setMemberEvidenceLoading(false);
    }
  };

  const openMemberEvidenceDrawer = (itemKey = "") => {
    setSelectedMemberEvidenceKey(itemKey);
    setIsMemberEvidenceDrawerOpen(true);
  };

  const updateMemberEvidenceCandidateStatus = async (item: MemberEvidenceDisplayItem, status: "approved" | "rejected") => {
    if (!item.candidateId && !item.id) return;
    const actionKey = `${status}:${item.evidenceGroup}:${item.id}`;
    setMemberEvidenceActionBusy(actionKey);
    setMemberEvidenceActionNote(status === "approved" ? "Đang duyệt nguồn..." : "Đang từ chối nguồn...");
    try {
      const res = await fetch(getMemberEvidenceCandidateEndpoint(item), {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Không cập nhật được trạng thái nguồn.");
      setMemberEvidenceActionNote(status === "approved" ? "Đã duyệt nguồn. Có thể áp dụng vào hồ sơ." : "Đã từ chối nguồn.");
      if (bioAncestor?.id) await loadMemberEvidence(bioAncestor.id);
    } catch (err: any) {
      setMemberEvidenceActionNote(err.message || "Không cập nhật được trạng thái nguồn.");
    } finally {
      setMemberEvidenceActionBusy("");
    }
  };

  const applyMemberEvidenceCandidate = async (item: MemberEvidenceDisplayItem, confirmOverwrite = false, autoApproved = false): Promise<any> => {
    const body = {
      datasetKey: "cao_toc_txt_knowledge_base_v3",
      confirmPilotApply: true,
      items: [buildMemberEvidenceApplyItem(item, confirmOverwrite)],
      note: "Phase 2W.2P member evidence drawer apply"
    };
    const res = await fetch("/api/knowledge/v3-pilot-apply/apply", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false || data.results?.some((result: any) => !result.ok)) {
      const failed = data.results?.find((result: any) => !result.ok);
      const error = new Error(failed?.error || data.error || "Không áp dụng được nguồn vào hồ sơ.") as Error & {
        status?: number;
        data?: any;
      };
      error.status = res.status || failed?.statusCode;
      error.data = failed || data;
      throw error;
    }
    setMemberEvidenceActionNote(autoApproved ? "Đã duyệt và áp dụng nguồn vào hồ sơ." : "Đã áp dụng nguồn vào hồ sơ.");
    if (bioAncestor?.id) await loadMemberEvidence(bioAncestor.id);
    setSelectedMemberEvidenceKey("");
    return data;
  };

  const handleMemberEvidenceApply = async (item: MemberEvidenceDisplayItem) => {
    if (!item.candidateId && !item.id) return;
    const isPending = item.status === "pending";
    const confirmMessage = isPending
      ? "Nguồn này đang chờ duyệt. Bạn muốn duyệt và áp dụng nguồn này vào hồ sơ không?"
      : "Áp dụng nguồn này vào hồ sơ nhân vật hiện tại?";
    if (!window.confirm(confirmMessage)) return;

    const actionKey = `apply:${item.evidenceGroup}:${item.id}`;
    setMemberEvidenceActionBusy(actionKey);
    setMemberEvidenceActionNote(isPending ? "Đang duyệt và áp dụng nguồn..." : "Đang áp dụng nguồn...");
    try {
      if (isPending) {
        const reviewRes = await fetch(getMemberEvidenceCandidateEndpoint(item), {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "approved" })
        });
        const reviewData = await reviewRes.json().catch(() => ({}));
        if (!reviewRes.ok) throw new Error(reviewData.error || "Không duyệt được nguồn trước khi áp dụng.");
      }
      await applyMemberEvidenceCandidate({ ...item, status: "approved" }, false, isPending);
    } catch (err: any) {
      const message = err.message || "Không áp dụng được nguồn.";
      const conflicts = err.data?.conflicts || err.data?.result?.conflicts || [];
      const needsOverwrite = err.status === 409 && (/overwrite|ghi đè|không rỗng|not empty/i.test(message) || conflicts.length);
      if (needsOverwrite && window.confirm(`${message}\n\nTrường hiện tại có thể đã có dữ liệu. Bạn có muốn ghi đè không?`)) {
        try {
          await applyMemberEvidenceCandidate({ ...item, status: "approved" }, true, isPending);
        } catch (overwriteErr: any) {
          setMemberEvidenceActionNote(overwriteErr.message || "Không áp dụng được sau khi xác nhận ghi đè.");
        }
      } else {
        setMemberEvidenceActionNote(message);
      }
    } finally {
      setMemberEvidenceActionBusy("");
    }
  };

  const handleMemberEvidenceRollback = async (item: MemberEvidenceDisplayItem) => {
    if (!item.logId) return;
    if (!window.confirm("Rollback nguồn đã áp dụng này? Dữ liệu hồ sơ sẽ quay về trạng thái trước khi apply nếu cây phả chưa thay đổi lệch.")) return;
    const actionKey = `rollback:${item.evidenceGroup}:${item.id}`;
    setMemberEvidenceActionBusy(actionKey);
    setMemberEvidenceActionNote("Đang rollback nguồn đã áp dụng...");
    try {
      const res = await fetch(`/api/knowledge/v3-pilot-apply/${encodeURIComponent(item.logId)}/rollback`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmRollback: true })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Không rollback được nguồn.");
      setMemberEvidenceActionNote("Đã rollback nguồn đã áp dụng.");
      if (bioAncestor?.id) await loadMemberEvidence(bioAncestor.id);
      setSelectedMemberEvidenceKey("");
    } catch (err: any) {
      setMemberEvidenceActionNote(err.message || "Không rollback được nguồn.");
    } finally {
      setMemberEvidenceActionBusy("");
    }
  };

  const loadExcelImportSessions = async () => {
    try {
      const res = await fetch("/api/excel-import/sessions?limit=8", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setExcelImportSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch {
      // Import gate is an admin convenience panel; parsing can still show local errors if API is unavailable.
    }
  };

  useEffect(() => {
    if (isExcelOpen) void loadExcelImportSessions();
  }, [isExcelOpen]);

  const applyExcelImportDetail = (detail: any) => {
    setExcelImportSession(detail?.session || null);
    setExcelImportMappings(Array.isArray(detail?.mappings) ? detail.mappings : []);
    setExcelImportIssues(Array.isArray(detail?.issues) ? detail.issues : []);
    void loadExcelImportSessions();
  };

  const createExcelImportGateSession = async (payload: {
    fileName: string;
    fileSize: number;
    fileType: string;
    headers: string[];
    previewRows: any[][];
    rowCount: number;
    columnCount: number;
  }) => {
    setExcelImportBusy(true);
    setExcelImportGateNote("Đang tạo phiên duyệt cấu trúc Excel/CSV...");
    try {
      const res = await fetch("/api/excel-import/sessions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, importMode })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Không tạo được phiên duyệt Excel.");
      applyExcelImportDetail(data);
      setExcelImportGateNote("Đã tạo phiên duyệt. Cần duyệt mapping và validate trước khi import.");
      return data;
    } catch (err: any) {
      setExcelImportGateNote(err.message || "Không tạo được phiên duyệt Excel.");
      setExcelImportSession(null);
      setExcelImportMappings([]);
      setExcelImportIssues([]);
      throw err;
    } finally {
      setExcelImportBusy(false);
    }
  };

  const approveExcelImportMappings = async () => {
    if (!excelImportSession) return;
    setExcelImportBusy(true);
    setExcelImportGateNote("Đang duyệt mapping và validate dữ liệu xem trước...");
    try {
      const mapped = excelImportMappings.map((mapping) => ({
        columnIndex: mapping.columnIndex,
        mappedField: mapping.mappedField || "__skip",
        confidence: mapping.confidence || 1,
        warning: mapping.warning || "",
        approved: Boolean(mapping.mappedField)
      }));
      const patchRes = await fetch(`/api/excel-import/sessions/${excelImportSession.id}/mappings`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings: mapped })
      });
      const patchData = await patchRes.json().catch(() => ({}));
      if (!patchRes.ok) throw new Error(patchData.error || "Không duyệt được mapping.");
      const validateRes = await fetch(`/api/excel-import/sessions/${excelImportSession.id}/validate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "full" })
      });
      const validateData = await validateRes.json().catch(() => ({}));
      if (!validateRes.ok) throw new Error(validateData.error || "Validate phiên import thất bại.");
      applyExcelImportDetail(validateData);
      setExcelImportGateNote(validateData.session?.status === "ready_to_import"
        ? "Phiên đã sẵn sàng. Cần bấm xác nhận cổng import trước khi ghi vào cây phả."
        : "Phiên còn lỗi/cảnh báo. Hãy kiểm tra danh sách issue trước khi import.");
    } catch (err: any) {
      setExcelImportGateNote(err.message || "Không validate được phiên import.");
    } finally {
      setExcelImportBusy(false);
    }
  };

  const rejectExcelImportSession = async () => {
    if (!excelImportSession) return;
    setExcelImportBusy(true);
    try {
      const res = await fetch(`/api/excel-import/sessions/${excelImportSession.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Không từ chối được phiên import.");
      applyExcelImportDetail(data);
      setExcelImportGateNote("Đã từ chối phiên import. Không ghi dữ liệu vào cây phả.");
    } catch (err: any) {
      setExcelImportGateNote(err.message || "Không từ chối được phiên import.");
    } finally {
      setExcelImportBusy(false);
    }
  };

  const confirmExcelImportGate = async () => {
    if (!excelImportSession) return;
    setExcelImportBusy(true);
    setExcelImportGateNote("Đang xác nhận cổng import an toàn...");
    try {
      const res = await fetch(`/api/excel-import/sessions/${excelImportSession.id}/import`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmImport: true })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Phiên chưa đủ điều kiện import.");
      applyExcelImportDetail({ ...data, mappings: excelImportMappings, issues: excelImportIssues });
      setExcelImportGateNote("Cổng duyệt đã xác nhận. Có thể bấm nút đồng bộ để ghi dữ liệu đã xem trước.");
    } catch (err: any) {
      setExcelImportGateNote(err.message || "Không xác nhận được cổng import.");
    } finally {
      setExcelImportBusy(false);
    }
  };

  // Form states
  const [newName, setNewName] = useState("");
  const [newGen, setNewGen] = useState(8);
  const [newBranch, setNewBranch] = useState("Chi Trưởng (Trường Yên)");
  const [newGender, setNewGender] = useState<"Nghị" | "Nữ">("Nghị");
  const [newIsDeceased, setNewIsDeceased] = useState(false);
  const [newBirthYear, setNewBirthYear] = useState("");
  const [newDeathYear, setNewDeathYear] = useState("");
  const [newDeathLunar, setNewDeathLunar] = useState("");
  const [newGrave, setNewGrave] = useState("");
  const [newParentId, setNewParentId] = useState("");
  const [newParentSearch, setNewParentSearch] = useState("");
  const [newRankRole, setNewRankRole] = useState("");
  const [newCustomSuffix, setNewCustomSuffix] = useState("");
  const [newMotherName, setNewMotherName] = useState("");
  const [newResidence, setNewResidence] = useState("");
  const [newBirthPlace, setNewBirthPlace] = useState("");
  const [newDeathPlace, setNewDeathPlace] = useState("");
  const [newSolarBirthDate, setNewSolarBirthDate] = useState("");
  const [newSolarDeathDate, setNewSolarDeathDate] = useState("");
  const [newPhone1, setNewPhone1] = useState("");
  const [newPhone2, setNewPhone2] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhoto, setNewPhoto] = useState("");
  const [newSpouse, setNewSpouse] = useState("");
  const [newBio, setNewBio] = useState("");
  const [newAchievement, setNewAchievement] = useState("");
  const [apiBirthLunarText, setApiBirthLunarText] = useState("");
  const [apiDeathLunarText, setApiDeathLunarText] = useState("");
  const isMaleMember = (member: FamilyMember) => member.gender !== "Nữ";
  const isActiveLineageMember = (member: FamilyMember, childrenByParent: Map<string, FamilyMember[]>): boolean => {
    if (!member.isDeceased) return true;
    return (childrenByParent.get(member.id) || [])
      .filter(isMaleMember)
      .some((child) => isActiveLineageMember(child, childrenByParent));
  };

  const computedBranches = useMemo<ComputedBranch[]>(() => {
    const childrenByParent = new Map<string, FamilyMember[]>();
    members.forEach((member) => {
      if (!member.parentId) return;
      const next = childrenByParent.get(member.parentId) || [];
      next.push(member);
      childrenByParent.set(member.parentId, next);
    });

    const collectDescendantIds = (rootId: string): string[] => {
      const ids: string[] = [];
      const walk = (memberId: string) => {
        ids.push(memberId);
        (childrenByParent.get(memberId) || []).forEach((child) => walk(child.id));
      };
      walk(rootId);
      return ids;
    };

    const resolveLeader = (root: FamilyMember): FamilyMember => {
      if (!root.isDeceased) return root;
      const sons = (childrenByParent.get(root.id) || []).filter(isMaleMember);
      const heir = sons.find((son) => isActiveLineageMember(son, childrenByParent));
      return heir ? resolveLeader(heir) : root;
    };

    return members
      .filter((member) => member.parentId && isMaleMember(member))
      .map((member) => ({
        name: `Chi ${displayText(member.name)}`,
        founderId: member.id,
        parentId: member.parentId,
        leaderId: resolveLeader(member).id,
        memberIds: collectDescendantIds(member.id),
        isAuto: true as const
      }));
  }, [members]);

  const computedBranchByName = useMemo(
    () => new Map(computedBranches.map((branch) => [branch.name, branch])),
    [computedBranches]
  );

  const branchNamesByMemberId = useMemo(() => {
    const map = new Map<string, string[]>();
    computedBranches.forEach((branch) => {
      branch.memberIds.forEach((memberId) => {
        map.set(memberId, [...(map.get(memberId) || []), branch.name]);
      });
    });
    managedBranches.forEach((branch) => {
      (branch.memberIds || []).forEach((memberId) => {
        map.set(memberId, [...(map.get(memberId) || []), branch.name]);
      });
    });
    members.forEach((member) => {
      if (member.branch) map.set(member.id, [...(map.get(member.id) || []), member.branch]);
    });
    return map;
  }, [computedBranches, managedBranches, members]);

  const branches = useMemo(() => {
    const dynamicBranches = Array.from(new Set([
      ...computedBranches.map((branch) => branch.name),
      ...managedBranches.map((branch) => branch.name),
      ...members.map((member) => member.branch).filter(Boolean)
    ]));
    return [{ label: "T\u1ea5t c\u1ea3 chi", value: "all" }, ...dynamicBranches.map((branch) => ({ label: branch, value: branch }))];
  }, [computedBranches, managedBranches, members]);
  const branchNames = useMemo(
    () => branches.filter((branch) => branch.value !== "all").map((branch) => String(branch.value)),
    [branches]
  );
  const generations = ["T\u1ea5t c\u1ea3 \u0111\u1eddi", 0, 1, 2, 3, 4, 5, 6, 7, 8];

  const getGenerationLabel = (generation: number | undefined) => {
    if (generation === 0) return "Cao T\u1ed5";
    if (generation === 1) return "Th\u1ee7y T\u1ed5";
    return `\u0110\u1eddi th\u1ee9 ${generation ?? "-"}`;
  };

  const getGenerationFilterLabel = (generation: number | string) => {
    if (generation === "T\u1ea5t c\u1ea3 \u0111\u1eddi") return generation;
    return getGenerationLabel(Number(generation));
  };

  React.useEffect(() => {
    if (!members.length) {
      setActiveBioMemberId(null);
      return;
    }

    if (!activeBioMemberId || !members.some((member) => member.id === activeBioMemberId)) {
      setActiveBioMemberId(members[0].id);
    }
  }, [members, activeBioMemberId]);

  React.useEffect(() => {
    localStorage.setItem("caogia_admin_branch_registry_v1", JSON.stringify(managedBranches));
    window.dispatchEvent(new CustomEvent("caogia_branch_registry_updated"));
  }, [managedBranches]);

  React.useEffect(() => {
    if (!branchNames.length) {
      setActiveManagedBranchName("");
      return;
    }
    if (!activeManagedBranchName || !branchNames.includes(activeManagedBranchName)) {
      setActiveManagedBranchName(branchNames[0]);
    }
  }, [activeManagedBranchName, branchNames]);

  const getManagedBranch = (branchName: string) => {
    return managedBranches.find((branch) => branch.name === branchName);
  };

  const getBranchLeaderId = (branchName: string) => {
    return getManagedBranch(branchName)?.leaderId || computedBranchByName.get(branchName)?.leaderId;
  };

  const getMembersInBranch = (branchName: string) => {
    const config = getManagedBranch(branchName);
    const computed = computedBranchByName.get(branchName);
    const explicitIds = new Set(config?.memberIds || []);
    const computedIds = new Set(computed?.memberIds || []);
    return members.filter((member) => member.branch === branchName || explicitIds.has(member.id) || computedIds.has(member.id));
  };

  const upsertManagedBranch = (branchName: string, patch: Partial<ManagedBranch> = {}) => {
    const name = branchName.trim();
    if (!name) return;
    setManagedBranches((prev) => {
      const exists = prev.some((branch) => branch.name === name);
      if (exists) {
        return prev.map((branch) => branch.name === name ? { ...branch, ...patch, name } : branch);
      }
      return [...prev, { name, memberIds: [], ...patch }];
    });
    setActiveManagedBranchName(name);
  };

  const addMemberToManagedBranch = (branchName: string, memberId: string) => {
    upsertManagedBranch(branchName);
    setManagedBranches((prev) => prev.map((branch) => {
      if (branch.name !== branchName) return branch;
      const nextIds = new Set(branch.memberIds || []);
      nextIds.add(memberId);
      return { ...branch, memberIds: Array.from(nextIds) };
    }));
  };

  const removeExplicitMemberFromManagedBranch = (branchName: string, memberId: string) => {
    setManagedBranches((prev) => prev.map((branch) => (
      branch.name === branchName
        ? { ...branch, memberIds: (branch.memberIds || []).filter((id) => id !== memberId) }
        : branch
    )));
  };

  React.useEffect(() => {
    if (!newIsDeceased || !newSolarDeathDate) return;
    const converted = deriveLunarAnniversaryFromSolarDeathDate(newSolarDeathDate);
    if (converted) setNewDeathLunar(converted);
  }, [newIsDeceased, newSolarDeathDate]);

  React.useEffect(() => {
    let cancelled = false;
    if (!newSolarBirthDate) {
      setApiBirthLunarText("");
      return;
    }
    convertSolarToLunarTextFromLich247(newSolarBirthDate).then((value) => {
      if (!cancelled) setApiBirthLunarText(value);
    });
    return () => {
      cancelled = true;
    };
  }, [newSolarBirthDate]);

  React.useEffect(() => {
    let cancelled = false;
    if (!newSolarDeathDate) {
      setApiDeathLunarText("");
      return;
    }
    convertSolarToLunarTextFromLich247(newSolarDeathDate).then((value) => {
      if (!cancelled) setApiDeathLunarText(value);
    });
    if (newIsDeceased) {
      deriveLunarAnniversaryFromSolarDeathDateViaLich247(newSolarDeathDate).then((value) => {
        if (!cancelled && value) setNewDeathLunar(value);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [newIsDeceased, newSolarDeathDate]);

  // Active bio ancestor item
  const bioAncestor = useMemo(() => {
    return members.find(m => m.id === activeBioMemberId) || members[0];
  }, [members, activeBioMemberId]);

  useEffect(() => {
    if (!bioAncestor?.id) {
      setMemberEvidence(null);
      setMemberEvidenceNote("");
      return;
    }
    void loadMemberEvidence(bioAncestor.id);
  }, [bioAncestor?.id]);

  const selectedParentForNewMember = useMemo(
    () => members.find((member) => member.id === newParentId),
    [members, newParentId]
  );

  const effectiveNewGeneration = selectedParentForNewMember ? selectedParentForNewMember.generation + 1 : Number(newGen);
  const originalEditingMember = useMemo(
    () => editingMemberId ? members.find((member) => member.id === editingMemberId) : undefined,
    [editingMemberId, members]
  );
  const isCaoToParentInfoOptional = useMemo(() => {
    const draftGeneration = editingMemberId
      ? (originalEditingMember?.generation ?? effectiveNewGeneration)
      : effectiveNewGeneration;
    const draftName = normalizeGenealogyLookupText(newName || originalEditingMember?.name || "");
    return Number(draftGeneration) === 0 && (
      originalEditingMember?.id === "3" ||
      draftName.includes("cao dinh thuat")
    );
  }, [editingMemberId, effectiveNewGeneration, newName, originalEditingMember]);

  const getParentOptionLabel = (member: FamilyMember) => {
    return `${displayText(member.name)} - ${getGenerationLabel(member.generation)} - ${member.gender === "Nữ" ? "Mẹ" : "Bố"}`;
  };

  const parentSearchMatches = useMemo(() => {
    const normalizedQuery = String(newParentSearch || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    return members
      .filter((member) => {
        if (!normalizedQuery) return true;
        return getParentOptionLabel(member)
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .slice(0, 12);
  }, [members, newParentSearch]);

  const applySelectedParent = (parent: FamilyMember) => {
    setNewParentId(parent.id);
    setNewParentSearch(getParentOptionLabel(parent));
    setNewGen(parent.generation + 1);
    setNewBranch(parent.branch || newBranch);
    setNewRankRole(parent.gender === "Nữ" ? "Ngoại tôn" : newRankRole);
  };

  const resetMemberForm = () => {
    setEditingMemberId(null);
    setNewName("");
    setNewBirthYear("");
    setNewDeathYear("");
    setNewDeathLunar("");
    setNewGrave("");
    setNewParentId("");
    setNewParentSearch("");
    setNewRankRole("");
    setNewCustomSuffix("");
    setNewMotherName("");
    setNewResidence("");
    setNewBirthPlace("");
    setNewDeathPlace("");
    setNewSolarBirthDate("");
    setNewSolarDeathDate("");
    setNewPhone1("");
    setNewPhone2("");
    setNewEmail("");
    setNewPhoto("");
    setNewSpouse("");
    setNewBio("");
    setNewAchievement("");
    setNewIsDeceased(false);
  };

  const openEditMember = (member: FamilyMember) => {
    setEditingMemberId(member.id);
    setNewName(member.name || "");
    setNewGen(member.generation ?? 1);
    setNewBranch(member.branch || "");
    setNewGender(member.gender);
    setNewIsDeceased(member.isDeceased);
    setNewBirthYear(member.birthYear || "");
    setNewDeathYear(member.deathYear || "");
    setNewDeathLunar(member.deathAnniversaryLunar || "");
    setNewGrave(member.graveLocation || "");
    setNewParentId(member.parentId || "");
    const parent = member.parentId ? members.find((item) => item.id === member.parentId) : undefined;
    setNewParentSearch(parent ? getParentOptionLabel(parent) : "");
    setNewRankRole(member.rankRole || "");
    setNewCustomSuffix(member.customSuffix || "");
    setNewMotherName(member.motherName || "");
    setNewResidence(member.residence || "");
    setNewBirthPlace(member.birthPlace || "");
    setNewDeathPlace(member.deathPlace || "");
    setNewSolarBirthDate(member.solarBirthDate || "");
    setNewSolarDeathDate(member.solarDeathDate || "");
    setNewPhone1(member.phone1 || "");
    setNewPhone2(member.phone2 || "");
    setNewEmail(member.email || "");
    setNewPhoto(member.photo || "");
    setNewSpouse(member.spouse || "");
    setNewBio(member.bio || "");
    setNewAchievement(getMemberAchievementItems(member).join("; "));
    setIsAddOpen(true);
  };

  // Handle addition of member
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const originalMember = originalEditingMember;
    if (!newParentId && !editingMemberId && !isCaoToParentInfoOptional) {
      alert("Cần chọn bố đẻ để ghi phả thành viên mới theo đúng cơ chế web view.");
      return;
    }
    const birthDateStructured = parseStructuredGenealogyDate(newSolarBirthDate || newBirthYear, "solar");
    const deathDateStructured = parseStructuredGenealogyDate(newSolarDeathDate || newDeathYear, "solar");
    const deathAnniversaryLunarStructured = parseStructuredGenealogyDate(newDeathLunar, "lunar");
    const parentId = isCaoToParentInfoOptional
      ? (newParentId || undefined)
      : (newParentId || originalMember?.parentId || undefined);
    const achievementItems = uniqueDisplayTexts(newAchievement.split(/[;\n]+/))
      .filter((item) => !newCustomSuffix || normalizeGenealogyLookupText(item) !== normalizeGenealogyLookupText(newCustomSuffix))
      .filter((item) => !newRankRole || !textContainsNormalized(newRankRole, item));

    const newMember: FamilyMember = {
      id: editingMemberId || "custom-gen-" + Date.now(),
      name: newName,
      generation: editingMemberId ? (originalMember?.generation ?? effectiveNewGeneration) : effectiveNewGeneration,
      title: newRankRole || newCustomSuffix || undefined,
      rankRole: selectedParentForNewMember?.gender === "Nữ" ? "Ngoại tôn" : (newRankRole || undefined),
      customSuffix: newCustomSuffix || undefined,
      branch: newBranch || selectedParentForNewMember?.branch || "",
      gender: newGender,
      isDeceased: newIsDeceased,
      birthYear: newBirthYear || undefined,
      deathYear: newIsDeceased ? (newDeathYear || undefined) : undefined,
      birthPlace: newBirthPlace || undefined,
      deathPlace: newIsDeceased ? (newDeathPlace || undefined) : undefined,
      solarBirthDate: newSolarBirthDate || undefined,
      solarDeathDate: newIsDeceased ? (newSolarDeathDate || undefined) : undefined,
      deathAnniversaryLunar: newIsDeceased ? (newDeathLunar || undefined) : undefined,
      birthDateStructured: birthDateStructured.precision !== "unknown" ? birthDateStructured : undefined,
      deathDateStructured: newIsDeceased && deathDateStructured.precision !== "unknown" ? deathDateStructured : undefined,
      deathAnniversaryLunarStructured: newIsDeceased && deathAnniversaryLunarStructured.precision !== "unknown" ? deathAnniversaryLunarStructured : undefined,
      graveLocation: newGrave || undefined,
      motherName: newMotherName || undefined,
      residence: newResidence || undefined,
      phone1: newPhone1 || undefined,
      phone2: newPhone2 || undefined,
      email: newEmail || undefined,
      spouse: newSpouse || undefined,
      parentId,
      bio: newBio || undefined,
      photo: newPhoto || undefined,
      achievements: achievementItems,
      children: []
    };

    if (editingMemberId && onUpdateMember) {
      onUpdateMember(newMember);
    } else {
      onAddMember(newMember);
    }
    
    // Auto inspect the newly added member
    setActiveBioMemberId(newMember.id);
    
    // Reset form & Close
    resetMemberForm();
    setIsAddOpen(false);
  };

  // Excel formatting assessment generator
  const runFormatVerification = (detectedHeaders: string[], firstDataRow: any[]) => {
    let matchedCount = 0;
    const getExcelColumnName = (index: number) => {
      let columnName = "";
      let current = index + 1;
      while (current > 0) {
        const remainder = (current - 1) % 26;
        columnName = String.fromCharCode(65 + remainder) + columnName;
        current = Math.floor((current - 1) / 26);
      }
      return columnName;
    };
    const normalizeColumnText = (value: string) => String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\u0111/g, "d")
      .replace(/\u0110/g, "d")
      .replace(/[^a-zA-Z0-9]+/g, "")
      .toLowerCase();

    const matches = FAMILY_COLUMN_REFERENCE.map((column, specIdx) => {
      const incomingHeader = detectedHeaders[specIdx] ? String(detectedHeaders[specIdx]).trim() : "";
      const sampleCell = firstDataRow && firstDataRow[specIdx] !== undefined ? String(firstDataRow[specIdx]).trim() : "";
      let status: "matched" | "mismatched" | "empty" = "empty";

      if (incomingHeader) {
        const simplifiedSpec = normalizeColumnText(column.excelColumn);
        const simplifiedIncoming = normalizeColumnText(incomingHeader);
        if (simplifiedIncoming.includes(simplifiedSpec) || simplifiedSpec.includes(simplifiedIncoming)) {
          status = "matched";
          matchedCount++;
        } else {
          status = "mismatched";
        }
      }

      return {
        name: column.excelColumn,
        dashboardField: column.dashboardField,
        status,
        incomingHeader: incomingHeader || undefined,
        excelAddress: `${getExcelColumnName(specIdx)}1`,
        sampleValue: sampleCell || undefined
      };
    });

    const score = Math.round((matchedCount / FAMILY_COLUMN_REFERENCE.length) * 100);
    setValidationScore(score);
    setColumnMatches(matches);
    setColumnFieldOverrides({});
  };

  // Convert raw row array matrix into standardized objects
  const parseSheetRows = (sheetRows: any[][]) => {
    if (!sheetRows || sheetRows.length === 0) {
      throw new Error("Không phát hiện hàng dữ liệu hợp lệ trong bảng tính.");
    }

    // Determine if the first row is a header row
    const firstRowCells = sheetRows[0].map(c => c ? String(c).trim().toLowerCase() : "");
    const headerIndicators = ["định danh", "họ và tên", "ngày sinh", "giới tính", "tình trạng", "đời thứ"];
    const isHeaderRow = firstRowCells.some(cell => headerIndicators.some(indicator => cell.includes(indicator)));

    let headers: string[] = [];
    let dataStartIndex = 0;

    if (isHeaderRow) {
      headers = sheetRows[0].map(c => c ? String(c).trim() : "");
      dataStartIndex = 1;
    } else {
      headers = [...dashboardColumnHeaders];
      dataStartIndex = 0;
    }

    const sampleRow = sheetRows[dataStartIndex] || [];
    runFormatVerification(headers, sampleRow);

    const parsedMembers: any[] = [];
    const timestampSeed = Date.now();

    for (let r = dataStartIndex; r < sheetRows.length; r++) {
      const row = sheetRows[r];
      if (!row || row.length < 2) continue;
      
      const rawName = row[1] ? String(row[1]).trim() : "";
      if (!rawName) continue; // Name is required

      const rawId = row[0] ? String(row[0]).trim() : "";
      const finalId = rawId || `m_excel_${timestampSeed}_${r}`;

      const rawGender = row[2] ? String(row[2]).trim().toLowerCase() : "nam";
      const gender: "Nghị" | "Nữ" = (rawGender === "nữ" || rawGender.includes("nữ") || rawGender === "female") ? "Nữ" : "Nghị";

      const alias = row[3] ? String(row[3]).trim() : "";
      const phone = row[4] ? String(row[4]).trim() : "";
      const phonePhu = row[5] ? String(row[5]).trim() : "";
      const residency = row[6] ? String(row[6]).trim() : "";
      const email = row[7] ? String(row[7]).trim() : "";
      
      const birthYear = row[8] ? String(row[8]).trim() : "";
      const statusText = row[9] ? String(row[9]).trim().toLowerCase() : "còn sống";
      const isDeceased = statusText.includes("mất") || statusText.includes("đã mất") || statusText.includes("qua đời") || statusText.includes("deceased");

      const deathYear = row[10] ? String(row[10]).trim() : "";
      const deathAnniversaryLunar = row[11] ? String(row[11]).trim() : "";
      const graveLocation = row[12] ? String(row[12]).trim() : "";
      const birthDateStructured = parseStructuredGenealogyDate(birthYear, "solar");
      const deathDateStructured = parseStructuredGenealogyDate(deathYear, "solar");
      const deathAnniversaryLunarStructured = parseStructuredGenealogyDate(deathAnniversaryLunar, "lunar");

      const generationVal = parseInt(String(row[13])) || 8;
      const fatherName = row[14] ? String(row[14]).trim() : "";
      const fatherAddress = row[15] ? String(row[15]).trim() : "";
      const parentId = row[22] ? String(row[22]).trim() : undefined;
      const motherName = row[23] ? String(row[23]).trim() : "";

      const spouse = row[31] ? String(row[31]).trim() : undefined;
      const spouseAddress = row[32] ? String(row[32]).trim() : "";

      // Gather child names
      const childrenList: string[] = [];
      for (let colIdx = 39; colIdx < 55; colIdx += 2) {
        const childName = row[colIdx] ? String(row[colIdx]).trim() : "";
        if (childName) {
          const childGender = row[colIdx + 1] ? String(row[colIdx + 1]).trim() : "";
          childrenList.push(`${childName}${childGender ? ` (${childGender})` : ""}`);
        }
      }

      let bioParts: string[] = [];
      if (alias) bioParts.push(`Bí danh/Tên tự: ${alias}`);
      if (phone) bioParts.push(`Liên hệ: ${phone}${phonePhu ? ` - ${phonePhu}` : ""}`);
      if (residency) bioParts.push(`Trú quán: ${residency}`);
      if (email) bioParts.push(`Thư điện tử: ${email}`);
      if (fatherName) bioParts.push(`Phụ thân: ${fatherName}${fatherAddress ? ` (${fatherAddress})` : ""}`);
      if (motherName) bioParts.push(`Mẫu thân: ${motherName}`);
      if (spouse) bioParts.push(`Bạn đời: ${spouse}${spouseAddress ? ` (${spouseAddress})` : ""}`);
      if (childrenList.length > 0) {
        bioParts.push(`Cháu con gồm: ${childrenList.join(", ")}`);
      }

      parsedMembers.push({
        id: finalId,
        name: rawName,
        generation: generationVal,
        branch: "Chi Trưởng (Trường Yên)",
        gender,
        isDeceased,
        birthYear: birthYear || undefined,
        deathYear: isDeceased ? (deathYear || undefined) : undefined,
        deathAnniversaryLunar: isDeceased ? (deathAnniversaryLunar || undefined) : undefined,
        birthDateStructured: birthDateStructured.precision !== "unknown" ? birthDateStructured : undefined,
        deathDateStructured: isDeceased && deathDateStructured.precision !== "unknown" ? deathDateStructured : undefined,
        deathAnniversaryLunarStructured: isDeceased && deathAnniversaryLunarStructured.precision !== "unknown" ? deathAnniversaryLunarStructured : undefined,
        graveLocation: graveLocation || undefined,
        spouse: spouse || undefined,
        parentId: parentId || undefined,
        bio: bioParts.join(" | ") || undefined,
        children: [],
        achievements: []
      });
    }

    if (parsedMembers.length === 0) {
      throw new Error("Không có quý danh nhân đinh hợp lệ nào khớp tiêu chuẩn trong bảng dữ liệu!");
    }

    setParsedPreview(parsedMembers);
    setImportError(null);
  };

  const prepareStandardImportRows = (rows: any[], sourceLabel: string) => {
    const { treeData, summary } = analyzeImportRows(rows, sourceLabel, {
      syncMode: importMode === "replace" ? "overwrite" : "merge"
    });

    if (summary.errors.length > 0) {
      setValidatedImportTree(null);
      setParsedPreview([]);
      setImportError(
        `${sourceLabel}: phát hiện ${summary.errors.length} lỗi nghiêm trọng. ${summary.errors
          .slice(0, 3)
          .map((issue) => issue.rowNumber ? `Dòng ${issue.rowNumber}: ${issue.message}` : issue.message)
          .join(" | ")}`
      );
      return;
    }

    const dashboardMembers = mapLineageNodesToDashboardMembers(flattenTreeToList(treeData));
    setValidatedImportTree(treeData);
    setParsedPreview(dashboardMembers);
    setImportError(summary.warnings.length > 0
      ? `${sourceLabel}: có ${summary.warnings.length} cảnh báo. Có thể tiếp tục nhập sau khi đã kiểm tra.`
      : null
    );
  };

  // Upload trigger reading binary sheet
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    const maxFileBytes = 10 * 1024 * 1024;
    if (!["csv", "xlsx", "xls"].includes(extension)) {
      setImportError("Cổng duyệt chỉ nhận .csv, .xlsx hoặc .xls.");
      return;
    }
    if (!file.size || file.size > maxFileBytes) {
      setImportError("File rỗng hoặc vượt giới hạn 10MB. Không tạo phiên import.");
      return;
    }
    setUploadFileName(file.name);
    setExcelImportSession(null);
    setExcelImportMappings([]);
    setExcelImportIssues([]);
    
    const fileReader = new FileReader();
    fileReader.onload = async (event) => {
      try {
        const binData = event.target?.result;
        if (file.name.toLowerCase().endsWith(".csv")) {
          const decodedText = new TextDecoder("utf-8").decode(new Uint8Array(binData as ArrayBuffer));
          const csvRows = parseCSVToObjects(decodedText);
          const previewHeaders = csvRows[0]?._headers || Object.keys(csvRows[0] || {});
          const previewValues = csvRows[0]?._rawValues || Object.values(csvRows[0] || {});
          await createExcelImportGateSession({
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type || "text/csv",
            headers: previewHeaders.map(String),
            previewRows: csvRows.slice(0, 30).map((row: any) => row._rawValues || previewHeaders.map((header: string) => row[header] || "")),
            rowCount: csvRows.length,
            columnCount: previewHeaders.length
          });
          runFormatVerification(previewHeaders, previewValues);
          prepareStandardImportRows(csvRows, file.name);
        } else {
          const workbook = XLSX.read(new Uint8Array(binData as ArrayBuffer), { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          await createExcelImportGateSession({
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers: (rawRows[0] || []).map(String),
            previewRows: rawRows.slice(1, 31),
            rowCount: Math.max(0, rawRows.length - 1),
            columnCount: (rawRows[0] || []).length
          });
          runFormatVerification(rawRows[0] || [], rawRows[1] || []);
          prepareStandardImportRows(parseWorksheetToRows(worksheet), `${file.name} / ${firstSheetName}`);
        }
      } catch (err: any) {
        setImportError("Lỗi đọc tệp Excel: " + (err.message || "Xin nạp tệp Excel (.xlsx, .xls) hoặc .csv đúng đặc tả."));
      }
    };
    fileReader.readAsArrayBuffer(file);
  };

  // Direct clipboard text blocks parsing
  const handleParseBulk = async () => {
    if (!bulkText.trim()) return;
    try {
      const lines = bulkText.split("\n");
      const sheetRows: any[][] = [];
      lines.forEach(line => {
        if (!line.trim()) return;
        const tokens = line.split("\t");
        sheetRows.push(tokens);
      });
      
      setUploadFileName("Vùng văn bản dán Excel (Clipboard Temp)");
      const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
      await createExcelImportGateSession({
        fileName: "clipboard-excel.csv",
        fileSize: new Blob([bulkText]).size,
        fileType: "text/csv",
        headers: (sheetRows[0] || []).map(String),
        previewRows: sheetRows.slice(1, 31),
        rowCount: Math.max(0, sheetRows.length - 1),
        columnCount: (sheetRows[0] || []).length
      });
      runFormatVerification(sheetRows[0] || [], sheetRows[1] || []);
      prepareStandardImportRows(parseWorksheetToRows(worksheet), "Vùng dán Excel");
    } catch (err: any) {
      setImportError(err.message || "Phân mảnh dòng dán lỗi cấu trúc.");
    }
  };

  // Push results into main state
  const handleCommitBulkImport = () => {
    if (parsedPreview.length === 0) return;
    if (!excelImportSession || excelImportSession.status !== "imported") {
      setImportError("Cần đi qua cổng duyệt Excel/CSV: tạo phiên, duyệt mapping, validate và xác nhận import trước khi ghi vào cây phả.");
      return;
    }
    if (validatedImportTree) {
      savePersistedTreeData(validatedImportTree);
    }
    
    const newMembersToCommit: FamilyMember[] = parsedPreview.map((p, idx) => ({
      id: p.id || ("m_bulk_" + Date.now() + "_" + idx),
      name: p.name,
      generation: p.generation ?? 8,
      branch: p.branch || "Chi Trưởng (Trường Yên)",
      gender: p.gender,
      isDeceased: p.isDeceased,
      birthYear: p.birthYear,
      deathYear: p.deathYear,
      deathAnniversaryLunar: p.deathAnniversaryLunar,
      graveLocation: p.graveLocation,
      spouse: p.spouse,
      parentId: p.parentId,
      bio: p.bio,
      achievements: p.achievements || [],
      children: p.children || []
    }));

    if (onBulkImport) {
      onBulkImport(newMembersToCommit, importMode);
      alert(
        `✓ Đồng bộ cát tường! Đã ${
          importMode === "replace" ? "Xoá sạch phả đồ cũ và Ghi mới" : "Bổ sung kế nối"
        } ${newMembersToCommit.length} tộc nhân vào Gia phả trung ương họ Cao Ninh Bính.`
      );
    } else {
      newMembersToCommit.forEach((bMember) => {
        onAddMember(bMember);
      });
      alert(`✓ Đã kết nối bổ sung ${newMembersToCommit.length} tộc nhân vào Gia phả.`);
    }

    setBulkText("");
    setParsedPreview([]);
    setUploadFileName("");
    setValidationScore(null);
    setColumnMatches([]);
    setValidatedImportTree(null);
    setExcelImportSession(null);
    setExcelImportMappings([]);
    setExcelImportIssues([]);
    setExcelImportGateNote("");
    setIsExcelOpen(false);
  };

  // Build standard blank template workbook for users
  const downloadExcelTemplate = () => {
    try {
      const headers = [...dashboardColumnHeaders];
      
      // Sample record containing dummy details for user orientation
      const sampleRow = [
        "CAONB_M_1",
        "Cao Văn Sinh",
        "Nam",
        "Tự Thúc Bảo",
        "0912111222",
        "0983111333",
        "Trung Yên, Hoa Lư, Ninh Bình",
        "sinhcao@ninhbinh.vn",
        "1948",
        "Đã mất",
        "2019",
        "12 tháng Giêng",
        "Nghĩa trang Trường Yên, Hoa Lư",
        "7",
        "Cao Văn Trọng",
        "Trường Yên",
        "",
        "1918",
        "Đã mất",
        "1992",
        "mùng 9 tháng năm",
        "Bia phần chi họ Trường Yên",
        "CAONB_M_0",
        "Nguyễn Thị Mận",
        "Hoa Lư",
        "",
        "1922",
        "Còn sống",
        "",
        "",
        "",
        "Lê Thị Thảo",
        "Yên Khánh",
        "",
        "1952",
        "Còn sống",
        "",
        "",
        "",
        "Cao Tiến Thành",
        "Nam",
        "Cao Bích Vân",
        "Nữ",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        ""
      ];
      
      const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Mau_Khao_Ta");
      XLSX.writeFile(wb, "Mau_Gia_Pha_Cao_Ninh_Binh_55_Cot.xlsx");
    } catch (err: any) {
      alert("⚠️ Lỗi thiết lập tải thư viện: " + err.message);
    }
  };


  // Filter members based on user choice
  const filteredMembers = useMemo(() => {
    const normalizedSearch = searchTerm
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    return members.filter((member) => {
      const memberBranchNames = branchNamesByMemberId.get(member.id) || [];
      const leaderNamesForMemberBranches = memberBranchNames
        .map((branchName) => {
          const leaderId = getBranchLeaderId(branchName);
          return leaderId ? members.find((item) => item.id === leaderId)?.name : "";
        })
        .filter(Boolean);
      const searchableText = [
        member.name,
        member.bio,
        member.branch,
        member.rankRole,
        member.title,
        ...memberBranchNames,
        ...leaderNamesForMemberBranches
      ].filter(Boolean).join(" ")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      const matchSearch = !normalizedSearch || searchableText.includes(normalizedSearch);
      const branchConfig = managedBranches.find((branch) => branch.name === selectedBranch);
      const computedBranch = computedBranchByName.get(selectedBranch);
      const explicitBranchMember = Boolean(branchConfig?.memberIds?.includes(member.id));
      const computedBranchMember = Boolean(computedBranch?.memberIds.includes(member.id));
      const branchLeaderId = branchConfig?.leaderId || computedBranch?.leaderId;
      const matchBranch = selectedBranch === "all" || (
        branchFilterMode === "leadersOnly"
          ? member.id === branchLeaderId
          : member.branch === selectedBranch || explicitBranchMember || computedBranchMember
      );
      const matchGen = selectedGen === "T\u1ea5t c\u1ea3 \u0111\u1eddi" || member.generation === Number(selectedGen);

      return matchSearch && matchBranch && matchGen;
    });
  }, [branchFilterMode, branchNamesByMemberId, computedBranchByName, managedBranches, members, searchTerm, selectedBranch, selectedGen]);

  // Parent names resolver helper
  const getParentName = (parentId?: string) => {
    if (!parentId) return null;
    const parent = members.find(m => m.id === parentId);
    return parent ? parent.name : null;
  };

  const memberEvidenceSummary = memberEvidence?.summary;
  const missingEvidenceChecklist = (memberEvidence?.checklist || []).filter((item) => item.status === "missing");
  const completeEvidenceChecklist = (memberEvidence?.checklist || []).filter((item) => item.status === "complete");
  const recentAppliedEvidence = memberEvidence?.activeEvidence || [];
  const recentPendingEvidence = memberEvidence?.pendingEvidence || [];
  const hasEvidencePanelData = Boolean(memberEvidenceSummary || recentAppliedEvidence.length || recentPendingEvidence.length || missingEvidenceChecklist.length);
  const allMemberEvidenceItems = useMemo<MemberEvidenceDisplayItem[]>(() => {
    const rows: MemberEvidenceDisplayItem[] = [
      ...(memberEvidence?.activeEvidence || []).map((item) => ({
        ...item,
        evidenceGroup: "applied" as const,
        evidenceGroupLabel: "Đã áp dụng"
      })),
      ...(memberEvidence?.pendingEvidence || []).map((item) => ({
        ...item,
        evidenceGroup: "pending" as const,
        evidenceGroupLabel: item.status === "approved" ? "Đã duyệt, chưa áp dụng" : "Chờ duyệt"
      })),
      ...(memberEvidence?.rollbackEvidence || []).map((item) => ({
        ...item,
        evidenceGroup: "rolled_back" as const,
        evidenceGroupLabel: "Đã rollback"
      })),
      ...(memberEvidence?.driftEvidence || []).map((item) => ({
        ...item,
        evidenceGroup: "drift" as const,
        evidenceGroupLabel: "Cần đối soát lại"
      }))
    ];
    const seen = new Set<string>();
    return rows.filter((item) => {
      const key = `${item.evidenceGroup}:${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [memberEvidence]);
  const memberEvidenceFieldOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of allMemberEvidenceItems) {
      if (item.field) map.set(item.field, displayText(item.fieldLabel || item.field));
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], "vi"));
  }, [allMemberEvidenceItems]);
  const filteredMemberEvidenceItems = useMemo(() => {
    return allMemberEvidenceItems.filter((item) => {
      const statusMatch = memberEvidenceStatusFilter === "all"
        || item.evidenceGroup === memberEvidenceStatusFilter
        || item.status === memberEvidenceStatusFilter;
      const fieldMatch = memberEvidenceFieldFilter === "all" || item.field === memberEvidenceFieldFilter;
      return statusMatch && fieldMatch;
    });
  }, [allMemberEvidenceItems, memberEvidenceFieldFilter, memberEvidenceStatusFilter]);
  const selectedMemberEvidenceItem = filteredMemberEvidenceItems.find((item) => `${item.evidenceGroup}:${item.id}` === selectedMemberEvidenceKey)
    || filteredMemberEvidenceItems[0]
    || allMemberEvidenceItems[0]
    || null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* List / Selection filters (8 columns) */}
      <div className="lg:col-span-8 bg-white rounded-xl border border-stone-150 shadow-sm p-4.5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div>
            <h2 className="text-lg font-serif font-semibold text-stone-850">
              Biên Chép & Tra Cứu Gia Phả Bản Việt
            </h2>
            <p className="text-xs text-stone-500">
              Tổng số nhân đinh lưu trữ: <span className="font-semibold text-stone-800">{members.length} thành viên</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5 self-start sm:self-center">
            <button 
              onClick={() => setIsExcelOpen(true)}
              className="inline-flex items-center gap-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer shadow transition-all"
            >
              <Database className="h-3.5 w-3.5" /> Nhập từ Excel / Google Sheets
            </button>
            <button 
              onClick={() => setIsAddOpen(true)}
              className="inline-flex items-center gap-1 bg-red-800 hover:bg-red-950 text-white rounded-lg px-3 py-2 text-xs font-semibold cursor-pointer shadow transition-all"
            >
              <Plus className="h-3.5 w-3.5" /> Ghi phả thành viên mới
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-stone-400 pointer-events-none" />
            <input 
              type="text" 
              placeholder="Tìm theo quý danh, chi/ngành, trưởng chi..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-lg pl-9 pr-3.5 py-2 placeholder-stone-400 focus:outline-none focus:border-amber-400 text-stone-800"
            />
          </div>

          {/* Selector branch */}
          <div className="relative flex items-center">
            <span className="absolute left-3 text-stone-400"><Filter className="h-3.5 w-3.5" /></span>
            <select 
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full appearance-none bg-stone-50 border border-stone-200 rounded-lg pl-9 pr-3.5 py-2 text-stone-800 focus:outline-none focus:border-amber-400"
            >
              {branches.map(b => (
                <option key={b.value} value={b.value}>{displayText(b.label)}</option>
              ))}
            </select>
          </div>

          {/* Selector Generations */}
          <div className="relative flex items-center">
            <span className="absolute left-3 text-stone-400"><Eye className="h-3.5 w-3.5" /></span>
            <select 
              value={selectedGen}
              onChange={(e) => setSelectedGen(e.target.value === "T\u1ea5t c\u1ea3 \u0111\u1eddi" ? "T\u1ea5t c\u1ea3 \u0111\u1eddi" : Number(e.target.value))}
              className="w-full appearance-none bg-stone-50 border border-stone-200 rounded-lg pl-9 pr-3.5 py-2 text-stone-800 focus:outline-none focus:border-amber-400"
            >
              {generations.map(g => (
                <option key={g} value={g}>{getGenerationFilterLabel(g)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2 rounded-lg border border-stone-150 bg-stone-50 p-2.5 text-[11px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-stone-700">Hiển thị chi/ngành:</span>
            <button
              type="button"
              onClick={() => setBranchFilterMode("allMembers")}
              className={`px-2.5 py-1 rounded border ${branchFilterMode === "allMembers" ? "bg-emerald-700 text-white border-emerald-700" : "bg-white text-stone-600 border-stone-200"}`}
            >
              Toàn bộ thành viên
            </button>
            <button
              type="button"
              onClick={() => setBranchFilterMode("leadersOnly")}
              className={`px-2.5 py-1 rounded border ${branchFilterMode === "leadersOnly" ? "bg-red-800 text-white border-red-800" : "bg-white text-stone-600 border-stone-200"}`}
            >
              Chỉ trưởng chi
            </button>
          </div>
          <button
            type="button"
            onClick={() => setIsBranchManagerOpen(true)}
            className="self-start lg:self-auto rounded border border-red-200 bg-white px-3 py-1.5 font-bold text-red-900 hover:bg-red-50"
          >
            Quản lý chi/ngành
          </button>
        </div>

        {/* List Grid sorted grouped by generations */}
        <div className="space-y-4 max-h-[580px] overflow-y-auto pr-1">
          {filteredMembers.length === 0 ? (
            <div className="text-center py-10 bg-stone-50 rounded-lg border border-dashed border-stone-200">
              <ShieldAlert className="h-8 w-8 text-stone-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-stone-700">Không tìm thấy tộc phả nhân đinh phù hợp</p>
              <p className="text-xs text-stone-400 mt-1">Xin vui lòng kiểm tra lại bộ lọc hoặc từ khóa tìm kiếm.</p>
            </div>
          ) : (
            // Group by generation
            Array.from(new Set(filteredMembers.map(m => m.generation)))
              .sort((a, b) => (a as number) - (b as number))
              .map(gen => {
                const membersInGen = filteredMembers.filter(m => m.generation === gen);
                return (
                  <div key={gen} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-amber-100 text-amber-900 border border-amber-200 font-serif font-bold text-xs px-2.5 py-1">
                        {getGenerationLabel(Number(gen)).toUpperCase()}
                      </span>
                      <span className="h-[1px] bg-stone-200 grow" />
                      <span className="text-[10px] text-stone-400 uppercase font-bold select-none">{membersInGen.length} Người</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {membersInGen.map(m => (
                        <div 
                          key={m.id}
                          onClick={() => setActiveBioMemberId(m.id)}
                          className={`flex items-center justify-between min-w-0 overflow-hidden gap-2 p-3 rounded-lg border text-left cursor-pointer transition-all ${
                            m.id === activeBioMemberId 
                              ? "bg-red-50 border-red-300 ring-1 ring-red-300" 
                              : "bg-stone-50 border-stone-150 hover:bg-stone-100/70"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                              m.gender !== "Nữ" 
                                ? "bg-red-100 text-red-800"
                                : "bg-teal-100 text-teal-800"
                            }`}>
                              <User className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-stone-850 flex items-center gap-1.5 min-w-0">
                                <span className="truncate">{displayText(m.name)}</span>
                                {m.isDeceased && (
                                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-stone-400" title="Đã tạ thế" />
                                )}
                              </p>
                              <span className="text-[10px] text-stone-500 block truncate max-w-full">
                                {displayText(m.rankRole || m.title || m.branch)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-end gap-1.5 text-[10px] text-stone-400 shrink-0 w-[92px] overflow-hidden">
                            {m.birthYear && (
                              <span className="truncate">{m.birthYear} - {m.isDeceased ? (m.deathYear || "khuyết") : "Nay"}</span>
                            )}
                            <ArrowRight className="h-3 w-3 text-stone-300 shrink-0" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>

      {/* Profile details / Visual card (4 columns) */}
      <div className="lg:col-span-4 space-y-4">
        {/* Profile Card view */}
        <div className="bg-white rounded-xl border border-stone-150 shadow-sm overflow-hidden relative">
          <div className="h-20 bg-gradient-to-r from-red-900 to-red-950 px-5 flex items-end pb-3 text-white">
            <div className="min-w-0 pr-20">
              <span className="text-[10px] text-amber-300 uppercase font-bold tracking-wider">Đại Tộc Gia Chiêu</span>
              <h3 className="font-serif font-bold text-base text-amber-100 line-clamp-1">{displayText(bioAncestor?.name)}</h3>
            </div>
            {bioAncestor && (
              <button
                type="button"
                onClick={() => openEditMember(bioAncestor)}
                className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-md bg-white/10 hover:bg-white/20 px-2 py-1 text-[10px] font-bold text-amber-100"
              >
                <Edit3 className="h-3 w-3" /> Sửa
              </button>
            )}
          </div>

          <div className="p-5.5 space-y-4.5 text-xs text-stone-700 relative z-10">
            {/* Round Avatar badge */}
            <div className="absolute right-5 top-[-30px] h-14 w-14 rounded-full bg-[#fbfaf6] border-2 border-amber-400 shadow-md flex items-center justify-center text-red-900 overflow-hidden">
              {bioAncestor?.photo ? (
                <img src={bioAncestor.photo} alt={displayText(bioAncestor.name)} className="h-full w-full object-cover" />
              ) : (
                <span className="font-serif text-lg font-bold">{displayText(bioAncestor?.name).trim().charAt(0) || "Cao"}</span>
              )}
            </div>

            {/* Quick Metadata */}
            <div className="grid grid-cols-2 gap-3 bg-stone-50 p-3 rounded-lg border border-stone-100 text-[11px]">
              {getMemberTitleLine(bioAncestor) && (
                <div className="col-span-2">
                  <span className="text-stone-400 block font-medium">Tước vị / Danh xưng</span>
                  <p className="font-bold text-stone-800 leading-snug">{getMemberTitleLine(bioAncestor)}</p>
                </div>
              )}
              <div>
                <span className="text-stone-400 block font-medium">Thế hệ triều</span>
                <p className="font-bold text-stone-800">{getGenerationLabel(bioAncestor?.generation)}</p>
              </div>
              <div>
                <span className="text-stone-400 block font-medium">Quản phận môn</span>
                <p className="font-bold text-stone-800 line-clamp-1">{displayText(bioAncestor?.branch)}</p>
              </div>
              <div>
                <span className="text-stone-400 block font-medium">Giới sắc định</span>
                <p className="font-bold text-stone-800">{bioAncestor?.gender === "Nghị" ? "Nam tử" : "Nữ sinh"}</p>
              </div>
              {bioAncestor?.isDeceased && (
                <div>
                  <span className="text-stone-400 block font-medium">Tình trạng</span>
                  <p className="font-bold text-stone-500">Đã mất</p>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2 text-[11px]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-stone-850 flex items-center gap-1.5">
                    <Database className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                    Nguồn đối soát hồ sơ
                  </p>
                  <p className="text-[10px] text-stone-500 leading-snug">
                    Dữ liệu đã áp dụng, nguồn đang chờ duyệt và checklist còn thiếu cho nhân vật này.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => bioAncestor?.id && loadMemberEvidence(bioAncestor.id)}
                  disabled={memberEvidenceLoading || !bioAncestor?.id}
                  className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-white px-2 py-1 text-[10px] font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
                >
                  <RefreshCw className={`h-3 w-3 ${memberEvidenceLoading ? "animate-spin" : ""}`} />
                  Tải lại
                </button>
              </div>

              {memberEvidenceNote && (
                <div className="rounded border border-red-100 bg-red-50 px-2 py-1.5 text-[10px] font-semibold text-red-800">
                  {displayText(memberEvidenceNote)}
                </div>
              )}

              {memberEvidenceLoading && !hasEvidencePanelData ? (
                <div className="rounded border border-amber-100 bg-white/70 px-2 py-2 text-[10px] text-stone-500">
                  Đang tải nguồn đối soát...
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      ["Đã áp dụng", memberEvidenceSummary?.activeApplied || 0, "text-emerald-800 bg-emerald-50 border-emerald-100"],
                      ["Chờ duyệt", (memberEvidenceSummary?.pending || 0) + (memberEvidenceSummary?.approvedNotApplied || 0), "text-amber-900 bg-white border-amber-100"],
                      ["Thiếu mục", memberEvidenceSummary?.checklistMissing || 0, "text-red-800 bg-red-50 border-red-100"],
                      ["Lệch/rollback", (memberEvidenceSummary?.drift || 0) + (memberEvidenceSummary?.rolledBack || 0), "text-stone-700 bg-stone-50 border-stone-150"]
                    ].map(([label, count, cls]) => (
                      <div key={String(label)} className={`rounded border px-2 py-1 ${cls}`}>
                        <span className="block text-[9px] uppercase tracking-wide font-bold opacity-70">{label}</span>
                        <strong className="text-sm leading-none">{count}</strong>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => openMemberEvidenceDrawer()}
                    disabled={!allMemberEvidenceItems.length && !memberEvidence?.checklist?.length}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-amber-200 bg-white px-2 py-1.5 text-[10px] font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Xem chi tiết nguồn & checklist
                  </button>

                  {(missingEvidenceChecklist.length > 0 || completeEvidenceChecklist.length > 0) && (
                    <div className="rounded-md border border-stone-150 bg-white p-2">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-bold text-stone-800">Checklist dữ liệu</span>
                        <span className="text-[10px] text-stone-500">
                          {completeEvidenceChecklist.length}/{memberEvidence?.checklist?.length || 0} đủ
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {missingEvidenceChecklist.slice(0, 7).map((item) => (
                          <span key={item.key} className="inline-flex items-center gap-1 rounded border border-red-100 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-800">
                            <AlertCircle className="h-3 w-3" />
                            {item.label}
                          </span>
                        ))}
                        {missingEvidenceChecklist.length === 0 && (
                          <span className="inline-flex items-center gap-1 rounded border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                            <Check className="h-3 w-3" />
                            Hồ sơ đã đủ các mục chính
                          </span>
                        )}
                        {missingEvidenceChecklist.length > 7 && (
                          <span className="rounded border border-stone-150 bg-stone-50 px-1.5 py-0.5 text-[10px] text-stone-600">
                            +{missingEvidenceChecklist.length - 7} mục
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {(recentAppliedEvidence.length > 0 || recentPendingEvidence.length > 0) && (
                    <div className="max-h-52 overflow-y-auto pr-1 space-y-1.5">
                      {recentAppliedEvidence.slice(0, 3).map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => openMemberEvidenceDrawer(`applied:${item.id}`)}
                          className="w-full text-left rounded-md border border-emerald-100 bg-white px-2 py-1.5 hover:border-emerald-300 hover:bg-emerald-50/40"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-emerald-800 line-clamp-1">{displayText(item.fieldLabel)}</span>
                            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-700">applied</span>
                          </div>
                          <p className="text-stone-700 line-clamp-1">{compactEvidenceText(item.newValue || item.evidenceQuote, 112)}</p>
                          <p className="text-[10px] text-stone-400 line-clamp-1">{compactEvidenceText(item.sourceTitle || item.headingPath || item.sourceId, 100)}</p>
                        </button>
                      ))}
                      {recentPendingEvidence.slice(0, 3).map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => openMemberEvidenceDrawer(`pending:${item.id}`)}
                          className="w-full text-left rounded-md border border-amber-100 bg-white px-2 py-1.5 hover:border-amber-300 hover:bg-amber-50/60"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-amber-900 line-clamp-1">{displayText(item.fieldLabel)}</span>
                            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700">{displayText(item.status)}</span>
                          </div>
                          <p className="text-stone-700 line-clamp-1">{compactEvidenceText(item.newValue || item.evidenceQuote, 112)}</p>
                          <p className="text-[10px] text-stone-400 line-clamp-1">{compactEvidenceText(item.sourceTitle || item.headingPath || item.sourceId, 100)}</p>
                        </button>
                      ))}
                    </div>
                  )}

                  {!memberEvidenceLoading && !hasEvidencePanelData && (
                    <div className="rounded border border-stone-150 bg-white px-2 py-2 text-[10px] text-stone-500">
                      Chưa có nguồn đã áp dụng hoặc candidate chờ duyệt cho hồ sơ này.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Biological Timeline text */}
            <div className="space-y-4">
              <div className="space-y-1 bg-amber-500/5 p-3 rounded-md border border-amber-500/10/40">
                <p className="font-semibold text-stone-800 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                  Sinh thần & Quy tiên
                </p>
                <div className="pl-4.5 text-stone-600 block leading-relaxed space-y-0.5 text-[11px]">
                  {bioAncestor?.birthYear && <p>Năm sinh dương lịch: <strong className="text-stone-800">{bioAncestor.birthYear}</strong></p>}
                  {bioAncestor?.isDeceased && bioAncestor.deathYear && (
                    <p>Năm tạ thế dương lịch: <strong className="text-stone-800">{bioAncestor.deathYear}</strong></p>
                  )}
                  {bioAncestor?.isDeceased && bioAncestor.deathAnniversaryLunar && (
                    <p>Giỗ Tổ Âm lịch hàng năm: <strong className="text-amber-800 font-extrabold">{bioAncestor.deathAnniversaryLunar}</strong></p>
                  )}
                </div>
              </div>

              {/* Grave Location */}
              {bioAncestor?.isDeceased && bioAncestor.graveLocation && (
                <div className="space-y-1 bg-stone-50 p-2.5 rounded-md border border-stone-150">
                  <p className="font-semibold text-stone-800 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-stone-500 shrink-0" />
                    Bia chí phần mộ tọa lạc
                  </p>
                  <p className="pl-5 text-stone-600 text-[11px] leading-relaxed">{bioAncestor.graveLocation}</p>
                </div>
              )}

              {/* Parents & Spouses */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                {bioAncestor?.parentId && (
                  <div className="p-2 border border-stone-100 rounded bg-stone-50/50">
                    <span className="text-stone-400 block font-medium">{bioAncestor.rankRole === "Ngoại tôn" ? "Mẹ trong phả hệ" : "Bố/Mẹ trong phả hệ"}</span>
                    <p className="font-semibold text-stone-700 line-clamp-1">{getParentName(bioAncestor.parentId)}</p>
                  </div>
                )}
                {bioAncestor?.motherName && (
                  <div className="p-2 border border-stone-100 rounded bg-stone-50/50">
                    <span className="text-stone-400 block font-medium">Mẫu thân</span>
                    <p className="font-semibold text-stone-700 line-clamp-1">{displayText(bioAncestor.motherName)}</p>
                  </div>
                )}
                {bioAncestor?.spouse && (
                  <div className="p-2 border border-stone-100 rounded bg-stone-50/50">
                    <span className="text-stone-400 block font-medium">Tộc phối phối thất</span>
                    <p className="font-semibold text-stone-700 line-clamp-1">{displayText(bioAncestor.spouse)}</p>
                  </div>
                )}
              </div>

              {(bioAncestor?.residence || bioAncestor?.phone1 || bioAncestor?.email || bioAncestor?.birthPlace || bioAncestor?.deathPlace || bioAncestor?.solarBirthDate || bioAncestor?.solarDeathDate) && (
                <div className="space-y-1 bg-stone-50 p-2.5 rounded-md border border-stone-150 text-[11px]">
                  <p className="font-semibold text-stone-800">Thông tin chi tiết</p>
                  <div className="grid grid-cols-1 gap-1 text-stone-600">
                    {bioAncestor.residence && <p>Nơi ở: <strong>{displayText(bioAncestor.residence)}</strong></p>}
                    {bioAncestor.birthPlace && <p>Nơi sinh: <strong>{displayText(bioAncestor.birthPlace)}</strong></p>}
                    {bioAncestor.solarBirthDate && <p>Ngày sinh dương lịch: <strong>{displayText(bioAncestor.solarBirthDate)}</strong></p>}
                    {bioAncestor.deathPlace && <p>Nơi mất: <strong>{displayText(bioAncestor.deathPlace)}</strong></p>}
                    {bioAncestor.solarDeathDate && <p>Ngày mất dương lịch: <strong>{displayText(bioAncestor.solarDeathDate)}</strong></p>}
                    {bioAncestor.phone1 && <p>Điện thoại: <strong>{displayText(bioAncestor.phone1)}{bioAncestor.phone2 ? ` / ${displayText(bioAncestor.phone2)}` : ""}</strong></p>}
                    {bioAncestor.email && <p>Email: <strong>{displayText(bioAncestor.email)}</strong></p>}
                  </div>
                </div>
              )}

              {/* Biography historical narratives */}
              {bioAncestor?.bio && (
                <div className="space-y-1">
                  <span className="text-stone-400 font-medium block">Sự nghiệp, tích trạng & công lao di sản:</span>
                  <p className="text-stone-600 leading-relaxed text-[11px] italic pr-1 bg-stone-50 p-2.5 rounded border border-stone-100">
                    "{displayText(bioAncestor.bio)}"
                  </p>
                </div>
              )}

              {/* Achievements vinh danh */}
              {getMemberAchievementItems(bioAncestor).length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-stone-400 font-medium block">Khen thưởng tích lục vinh danh:</span>
                  <div className="flex flex-wrap gap-1">
                    {getMemberAchievementItems(bioAncestor).map((ach, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 rounded bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 text-[10px] font-medium scale-95 origin-left">
                        <Award className="h-3 w-3 shrink-0" /> {ach}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isMemberEvidenceDrawerOpen && (
          <div className="fixed inset-0 bg-black/55 backdrop-blur-xs z-50 flex items-stretch justify-center p-3 sm:p-5">
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.98 }}
              className="bg-[#fbfaf6] rounded-xl shadow-2xl border border-amber-200 w-full max-w-6xl overflow-hidden flex flex-col max-h-[94vh]"
            >
              <div className="bg-red-950 text-amber-50 px-4 sm:px-5 py-3.5 flex items-start justify-between gap-3 border-b border-amber-900/50">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-amber-300 font-bold">Phase 2W.2O · Hồ sơ có nguồn</p>
                  <h3 className="font-serif font-bold text-lg leading-tight truncate">
                    Nguồn đối soát: {displayText(bioAncestor?.name)}
                  </h3>
                  <p className="text-[11px] text-amber-100/80 leading-snug">
                    Xem trích dẫn, nguồn, trạng thái apply và checklist dữ liệu thiếu của từng trường hồ sơ.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMemberEvidenceDrawerOpen(false)}
                  className="rounded-full hover:bg-white/10 p-1 text-amber-100 transition-all shrink-0"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 min-h-0 flex-1">
                <aside className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-amber-100 bg-white/70 min-h-0 flex flex-col">
                  <div className="p-3 border-b border-amber-100 space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <label className="space-y-1">
                        <span className="font-bold text-stone-600">Trạng thái</span>
                        <select
                          value={memberEvidenceStatusFilter}
                          onChange={(event) => {
                            setMemberEvidenceStatusFilter(event.target.value as typeof memberEvidenceStatusFilter);
                            setSelectedMemberEvidenceKey("");
                          }}
                          className="w-full rounded-md border border-stone-200 bg-white px-2 py-1.5 text-[11px] text-stone-800 focus:outline-none focus:border-amber-400"
                        >
                          <option value="all">Tất cả</option>
                          <option value="applied">Đã áp dụng</option>
                          <option value="pending">Chờ duyệt</option>
                          <option value="approved">Đã duyệt, chưa áp dụng</option>
                          <option value="rolled_back">Đã rollback</option>
                          <option value="drift">Cần đối soát lại</option>
                        </select>
                      </label>
                      <label className="space-y-1">
                        <span className="font-bold text-stone-600">Trường</span>
                        <select
                          value={memberEvidenceFieldFilter}
                          onChange={(event) => {
                            setMemberEvidenceFieldFilter(event.target.value);
                            setSelectedMemberEvidenceKey("");
                          }}
                          className="w-full rounded-md border border-stone-200 bg-white px-2 py-1.5 text-[11px] text-stone-800 focus:outline-none focus:border-amber-400"
                        >
                          <option value="all">Tất cả</option>
                          {memberEvidenceFieldOptions.map(([field, label]) => (
                            <option key={field} value={field}>{label}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 text-center text-[10px]">
                      {[
                        ["Applied", memberEvidenceSummary?.activeApplied || 0, "text-emerald-800"],
                        ["Pending", (memberEvidenceSummary?.pending || 0) + (memberEvidenceSummary?.approvedNotApplied || 0), "text-amber-800"],
                        ["Thiếu", memberEvidenceSummary?.checklistMissing || 0, "text-red-800"],
                        ["Rollback", (memberEvidenceSummary?.rolledBack || 0) + (memberEvidenceSummary?.drift || 0), "text-stone-700"]
                      ].map(([label, value, cls]) => (
                        <div key={String(label)} className="rounded-md border border-stone-150 bg-stone-50 px-1.5 py-1">
                          <strong className={`block text-sm ${cls}`}>{value}</strong>
                          <span className="uppercase tracking-wide text-stone-400">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-y-auto p-3 space-y-2 min-h-0">
                    {filteredMemberEvidenceItems.length > 0 ? (
                      filteredMemberEvidenceItems.map((item) => {
                        const itemKey = `${item.evidenceGroup}:${item.id}`;
                        const isSelected = selectedMemberEvidenceKey
                          ? selectedMemberEvidenceKey === itemKey
                          : selectedMemberEvidenceItem?.id === item.id && selectedMemberEvidenceItem?.evidenceGroup === item.evidenceGroup;
                        const tone = item.evidenceGroup === "applied"
                          ? "border-emerald-200 bg-emerald-50/60"
                          : item.evidenceGroup === "rolled_back" || item.evidenceGroup === "drift"
                            ? "border-red-200 bg-red-50/60"
                            : "border-amber-200 bg-amber-50/60";
                        return (
                          <button
                            type="button"
                            key={`${item.evidenceGroup}:${item.id}`}
                            onClick={() => setSelectedMemberEvidenceKey(itemKey)}
                            className={`w-full text-left rounded-lg border px-3 py-2 transition-all ${isSelected ? "ring-2 ring-amber-400 " : ""}${tone}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-bold text-stone-850 line-clamp-1">{displayText(item.fieldLabel)}</p>
                                <p className="text-[10px] text-stone-500 line-clamp-1">{displayText(item.evidenceGroupLabel)} · {displayText(item.kind)}</p>
                              </div>
                              <span className="rounded bg-white/80 px-1.5 py-0.5 text-[9px] font-bold uppercase text-stone-600 shrink-0">
                                {displayText(item.status)}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] text-stone-700 line-clamp-2">
                              {compactEvidenceText(item.newValue || item.evidenceQuote || item.evidenceWindow, 150)}
                            </p>
                          </button>
                        );
                      })
                    ) : (
                      <div className="rounded-lg border border-stone-150 bg-stone-50 px-3 py-4 text-center text-[11px] text-stone-500">
                        Không có nguồn phù hợp với bộ lọc hiện tại.
                      </div>
                    )}
                  </div>
                </aside>

                <main className="lg:col-span-8 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
                  {selectedMemberEvidenceItem ? (
                    <>
                      <div className="rounded-xl border border-stone-150 bg-white p-4 space-y-3">
                        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-[0.16em] text-stone-400 font-bold">
                              {displayText(selectedMemberEvidenceItem.evidenceGroupLabel)}
                            </p>
                            <h4 className="font-serif text-xl font-bold text-red-950 leading-tight">
                              {displayText(selectedMemberEvidenceItem.fieldLabel)}
                            </h4>
                            <p className="text-[11px] text-stone-500">
                              Loại: {displayText(selectedMemberEvidenceItem.kind)} · Trạng thái: {displayText(selectedMemberEvidenceItem.status)}
                              {selectedMemberEvidenceItem.reconcileStatus ? ` · Đối soát: ${displayText(selectedMemberEvidenceItem.reconcileStatus)}` : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {selectedMemberEvidenceItem.evidenceGroup === "pending" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => updateMemberEvidenceCandidateStatus(selectedMemberEvidenceItem, "approved")}
                                  disabled={Boolean(memberEvidenceActionBusy)}
                                  className="inline-flex items-center justify-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  Duyệt
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateMemberEvidenceCandidateStatus(selectedMemberEvidenceItem, "rejected")}
                                  disabled={Boolean(memberEvidenceActionBusy)}
                                  className="inline-flex items-center justify-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-800 hover:bg-red-100 disabled:opacity-50"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Từ chối
                                </button>
                              </>
                            )}
                            {["pending", "approved"].includes(selectedMemberEvidenceItem.status) && selectedMemberEvidenceItem.candidateId && (
                              <button
                                type="button"
                                onClick={() => handleMemberEvidenceApply(selectedMemberEvidenceItem)}
                                disabled={Boolean(memberEvidenceActionBusy)}
                                className="inline-flex items-center justify-center gap-1 rounded-md border border-red-200 bg-red-950 px-2.5 py-1.5 text-[11px] font-bold text-amber-50 hover:bg-red-900 disabled:opacity-50"
                              >
                                <ArrowRight className="h-3.5 w-3.5" />
                                Áp dụng
                              </button>
                            )}
                            {selectedMemberEvidenceItem.evidenceGroup === "applied" && selectedMemberEvidenceItem.logId && (
                              <button
                                type="button"
                                onClick={() => handleMemberEvidenceRollback(selectedMemberEvidenceItem)}
                                disabled={Boolean(memberEvidenceActionBusy)}
                                className="inline-flex items-center justify-center gap-1 rounded-md border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-[11px] font-bold text-stone-700 hover:bg-stone-100 disabled:opacity-50"
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                                Rollback
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                const copyText = [
                                  selectedMemberEvidenceItem.sourceTitle,
                                  selectedMemberEvidenceItem.headingPath,
                                  selectedMemberEvidenceItem.evidenceQuote || selectedMemberEvidenceItem.evidenceWindow,
                                  selectedMemberEvidenceItem.candidateId ? `candidate: ${selectedMemberEvidenceItem.candidateId}` : ""
                                ].filter(Boolean).join("\n");
                                void navigator.clipboard?.writeText(copyText);
                              }}
                              className="inline-flex items-center justify-center gap-1 rounded-md border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-[11px] font-bold text-stone-700 hover:bg-stone-100"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Sao chép nguồn
                            </button>
                          </div>
                        </div>

                        {memberEvidenceActionNote && (
                          <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900">
                            {memberEvidenceActionBusy ? "Đang xử lý... " : ""}{memberEvidenceActionNote}
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                          <div className="rounded-lg border border-stone-100 bg-stone-50 p-3">
                            <span className="block text-stone-400 font-bold uppercase tracking-wide">Giá trị hiện tại/cũ</span>
                            <p className="mt-1 text-stone-700 whitespace-pre-wrap break-words">
                              {displayText(selectedMemberEvidenceItem.oldValue || "Không có dữ liệu cũ")}
                            </p>
                          </div>
                          <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3">
                            <span className="block text-emerald-700 font-bold uppercase tracking-wide">Giá trị từ nguồn</span>
                            <p className="mt-1 text-stone-800 whitespace-pre-wrap break-words">
                              {displayText(selectedMemberEvidenceItem.newValue || selectedMemberEvidenceItem.evidenceQuote || "Chưa có giá trị tách riêng")}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-bold text-stone-850">Trích dẫn tài liệu</p>
                            <p className="text-[11px] text-stone-500">Ưu tiên quote/evidence quanh đúng trường đang xem.</p>
                          </div>
                          <span className="rounded-full border border-amber-200 bg-white px-2 py-1 text-[10px] font-bold text-amber-900">
                            {displayText(selectedMemberEvidenceItem.evidenceType || selectedMemberEvidenceItem.field)}
                          </span>
                        </div>
                        <blockquote className="rounded-lg border border-amber-200 bg-white p-3 text-[12px] leading-relaxed text-stone-800 whitespace-pre-wrap break-words">
                          {displayText(selectedMemberEvidenceItem.evidenceQuote || selectedMemberEvidenceItem.evidenceWindow || "Chưa có trích dẫn nguồn cho mục này.")}
                        </blockquote>
                        {selectedMemberEvidenceItem.evidenceWindow && selectedMemberEvidenceItem.evidenceWindow !== selectedMemberEvidenceItem.evidenceQuote && (
                          <details className="rounded-lg border border-stone-150 bg-white p-3 text-[11px] text-stone-700">
                            <summary className="cursor-pointer font-bold text-stone-800">Mở đoạn nguồn rộng hơn</summary>
                            <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed">
                              {displayText(selectedMemberEvidenceItem.evidenceWindow)}
                            </p>
                          </details>
                        )}
                      </div>

                      <div className="rounded-xl border border-stone-150 bg-white p-4">
                        <p className="font-bold text-stone-850 mb-2">Thông tin nguồn</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-stone-600">
                          {[
                            ["Tài liệu", selectedMemberEvidenceItem.sourceTitle],
                            ["Heading", selectedMemberEvidenceItem.headingPath],
                            ["Source ID", selectedMemberEvidenceItem.sourceId],
                            ["Chunk ID", selectedMemberEvidenceItem.chunkId],
                            ["Candidate ID", selectedMemberEvidenceItem.candidateId],
                            ["Log/Audit", selectedMemberEvidenceItem.logId || selectedMemberEvidenceItem.auditId],
                            ["Người áp dụng", selectedMemberEvidenceItem.appliedBy],
                            ["Thời điểm", selectedMemberEvidenceItem.appliedAt || selectedMemberEvidenceItem.rolledBackAt]
                          ].map(([label, value]) => (
                            <div key={label} className="rounded border border-stone-100 bg-stone-50 px-2 py-1.5 min-w-0">
                              <span className="block text-[9px] uppercase tracking-wide text-stone-400 font-bold">{label}</span>
                              <strong className="block text-stone-700 break-words">{displayText(value || "Chưa có")}</strong>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-xl border border-stone-150 bg-white p-4">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <p className="font-bold text-stone-850">Checklist hồ sơ</p>
                          <span className="text-[10px] text-stone-500">
                            {completeEvidenceChecklist.length}/{memberEvidence?.checklist?.length || 0} mục đủ
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {(memberEvidence?.checklist || []).map((item) => (
                            <div
                              key={item.key}
                              className={`rounded-lg border px-2.5 py-2 text-[11px] ${item.status === "complete" ? "border-emerald-100 bg-emerald-50/50" : "border-red-100 bg-red-50/50"}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <strong className={item.status === "complete" ? "text-emerald-800" : "text-red-800"}>{item.label}</strong>
                                <span className="text-[9px] uppercase font-bold">{item.status === "complete" ? "đủ" : "thiếu"}</span>
                              </div>
                              <p className="mt-1 text-stone-600 line-clamp-2">
                                {displayText(item.currentValue || (item.hasPendingEvidence ? "Có nguồn chờ duyệt" : "Chưa có dữ liệu"))}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="h-full min-h-[320px] flex items-center justify-center rounded-xl border border-dashed border-stone-200 bg-white text-center p-8">
                      <div>
                        <Database className="h-8 w-8 text-stone-300 mx-auto mb-2" />
                        <p className="font-bold text-stone-700">Chưa có nguồn để hiển thị</p>
                        <p className="text-[11px] text-stone-500">Hãy chọn hồ sơ khác hoặc apply/candidate dữ liệu từ kho tri thức.</p>
                      </div>
                    </div>
                  )}
                </main>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add New Member Modal Overlay */}
      <AnimatePresence>
        {isAddOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl overflow-hidden shadow-2xl max-w-2xl w-full border border-stone-200 flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="bg-red-950 px-5 py-4 text-white flex items-center justify-between border-b border-amber-900/40">
                <h3 className="font-serif font-bold text-base text-amber-100">
                  {editingMemberId ? "Sửa thông tin Tộc nhân" : "Ghi chép Tộc nhân Gia Phả mới"}
                </h3>
                <button 
                  onClick={() => {
                    resetMemberForm();
                    setIsAddOpen(false);
                  }}
                  className="rounded-full hover:bg-white/10 p-1 text-stone-300 transition-all cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form body */}
              <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
                {/* Name & Generation */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Quý danh thành viên (Tên húy/tôn): *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ví dụ: Cao Xuân Hùng" 
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Thế hệ đời:</label>
                    <select 
                      value={effectiveNewGeneration}
                      onChange={(e) => setNewGen(Number(e.target.value))}
                      disabled={Boolean(selectedParentForNewMember)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 text-xs disabled:text-stone-500 disabled:bg-stone-100"
                    >
                      {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
                        <option key={n} value={n}>{getGenerationLabel(n)}</option>
                      ))}
                    </select>
                    <span className="text-[9px] text-stone-400 block">
                      {selectedParentForNewMember ? "Tự tính theo bố đẻ đã chọn" : "Chọn bố đẻ để tự tính đời"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Tước vị / Vai vế:</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Trưởng chi, Ngoại tôn, Đích tôn..."
                      value={selectedParentForNewMember?.gender === "Nữ" ? "Ngoại tôn" : newRankRole}
                      onChange={(e) => setNewRankRole(e.target.value)}
                      disabled={selectedParentForNewMember?.gender === "Nữ"}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 text-xs disabled:bg-stone-100 disabled:text-stone-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Chức danh / học vị / hậu tố:</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Đại tướng quân, Giáo sư..."
                      value={newCustomSuffix}
                      onChange={(e) => setNewCustomSuffix(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 text-xs"
                    />
                  </div>
                </div>

                {/* Branch & Gender */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Chi họ sở thuộc: *</label>
                    <input
                      list="admin-branch-options"
                      value={newBranch}
                      onChange={(e) => setNewBranch(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 text-xs"
                    />
                    <datalist id="admin-branch-options">
                      {branches.filter((branch) => branch.value !== "all").map((branch) => (
                        <option key={branch.value} value={displayText(branch.label)} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Giới tính: *</label>
                    <div className="flex gap-4 pt-1">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input 
                          type="radio" 
                          name="gender" 
                          checked={newGender === "Nghị"}
                          onChange={() => setNewGender("Nghị")}
                          className="accent-red-800"
                        /> Nam
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input 
                          type="radio" 
                          name="gender" 
                          checked={newGender === "Nữ"}
                          onChange={() => setNewGender("Nữ")}
                          className="accent-red-800"
                        /> Nữ
                      </label>
                    </div>
                  </div>
                </div>

                {/* Parent & Wife */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1 relative">
                    <label className="font-semibold text-stone-700 block">
                      Bố/Mẹ trong phả hệ{isCaoToParentInfoOptional ? "" : ": *"}
                    </label>
                    <input
                      type="text"
                      required={!isCaoToParentInfoOptional}
                      value={newParentSearch}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNewParentSearch(value);
                        const exact = members.find((member) => getParentOptionLabel(member) === value || displayText(member.name) === value);
                        if (exact) applySelectedParent(exact);
                        else setNewParentId("");
                      }}
                      placeholder="Nhập tên để tìm Bố/Mẹ đã lưu..."
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 text-xs"
                    />
                    {newParentSearch && !newParentId && parentSearchMatches.length > 0 && (
                      <div className="absolute z-20 mt-1 w-full max-h-40 overflow-y-auto bg-white border border-stone-200 rounded-md shadow-lg">
                        {parentSearchMatches.map((member) => (
                          <button
                            type="button"
                            key={member.id}
                            onClick={() => applySelectedParent(member)}
                            className="w-full text-left px-2.5 py-2 hover:bg-stone-50 text-[11px] border-b border-stone-100 last:border-b-0"
                          >
                            <span className="font-semibold text-stone-800 block truncate">{displayText(member.name)}</span>
                            <span className="text-stone-500">{getGenerationLabel(member.generation)} - {member.gender === "Nữ" ? "Mẹ / ghi Ngoại tôn" : "Bố"}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedParentForNewMember && (
                      <span className="text-[9px] text-stone-400 block">
                        Đã chọn: {getParentOptionLabel(selectedParentForNewMember)}
                      </span>
                    )}
                    {isCaoToParentInfoOptional && !selectedParentForNewMember && (
                      <span className="text-[9px] text-amber-700 block">
                        Cao Tổ Cao Đình Thuật không rõ thân thế, có thể để trống trường này.
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Phối thất (Vợ / Chồng):</label>
                    <input 
                      type="text" 
                      placeholder="Ví dụ: Lê Thị Hiên" 
                      value={newSpouse}
                      onChange={(e) => setNewSpouse(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Mẹ ruột / Con của bà:</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Nguyễn Thị Lan"
                      value={newMotherName}
                      onChange={(e) => setNewMotherName(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Ảnh chân dung / avatar URL:</label>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => setNewPhoto(String(reader.result || ""));
                        reader.readAsDataURL(file);
                      }}
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="https://... hoặc tải ảnh lên"
                        value={newPhoto.startsWith("data:") ? "Đã tải ảnh chân dung từ máy" : newPhoto}
                        onChange={(e) => setNewPhoto(e.target.value)}
                        className="min-w-0 flex-1 bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        className="shrink-0 rounded border border-stone-300 bg-white px-2.5 py-1.5 font-semibold text-stone-700 hover:border-red-800"
                      >
                        Tải ảnh
                      </button>
                    </div>
                    {newPhoto && (
                      <div className="flex items-center gap-2 text-[10px] text-stone-500">
                        <img src={newPhoto} alt="Ảnh chân dung xem trước" className="h-8 w-8 rounded-full object-cover border border-stone-200" />
                        <span>{newPhoto.startsWith("data:") ? "Ảnh tải lên sẽ lưu cùng dữ liệu phả hệ." : "Đường dẫn ảnh chân dung."}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Nơi ở / cư trú:</label>
                    <input
                      type="text"
                      value={newResidence}
                      onChange={(e) => setNewResidence(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Email:</label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Điện thoại 1:</label>
                    <input
                      type="tel"
                      value={newPhone1}
                      onChange={(e) => setNewPhone1(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Điện thoại 2:</label>
                    <input
                      type="tel"
                      value={newPhone2}
                      onChange={(e) => setNewPhone2(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Nơi sinh:</label>
                    <input
                      type="text"
                      value={newBirthPlace}
                      onChange={(e) => setNewBirthPlace(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Ngày sinh dương lịch:</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: 12/03/1994"
                      value={newSolarBirthDate}
                      onChange={(e) => setNewSolarBirthDate(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 text-xs"
                    />
                    {newSolarBirthDate && (apiBirthLunarText || convertSolarToLunarText(newSolarBirthDate)) && (
                      <span className="text-[9px] text-amber-700 block">Âm lịch can chi: {apiBirthLunarText || convertSolarToLunarText(newSolarBirthDate)}</span>
                    )}
                  </div>
                </div>

                {/* Status Deceased */}
                <div className="p-3 bg-stone-50 rounded-lg border border-stone-150 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-stone-700">
                    <input 
                      type="checkbox" 
                      checked={newIsDeceased}
                      onChange={(e) => setNewIsDeceased(e.target.checked)}
                      className="accent-red-800"
                    /> Thành viên đã tạ thế (Mất hành lễ cúng giỗ)
                  </label>

                  {newIsDeceased && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1">
                        <label className="text-stone-600 block">Năm mất dương lịch nếu chỉ biết năm:</label>
                        <input 
                          type="text" 
                          placeholder="Ví dụ: 1985 hoặc khoảng 1985" 
                          value={newDeathYear}
                          onChange={(e) => setNewDeathYear(e.target.value)}
                          className="w-full bg-white border border-stone-200 rounded px-2.5 py-1 focus:outline-none focus:border-red-800 text-stone-850"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-stone-600 block">Ngày giỗ âm lịch (có thể thiếu năm):</label>
                        <input 
                          type="text" 
                          placeholder="Ví dụ: 15/5 âm lịch hoặc mùng 5 tháng Giêng" 
                          value={newDeathLunar}
                          onChange={(e) => setNewDeathLunar(e.target.value)}
                          className="w-full bg-white border border-stone-200 rounded px-2.5 py-1 focus:outline-none focus:border-red-800 text-stone-850"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-stone-600 block">Ngày mất dương lịch đầy đủ:</label>
                        <input
                          type="text"
                          placeholder="Ví dụ: 12/03/1985"
                          value={newSolarDeathDate}
                          onChange={(e) => {
                            const value = e.target.value;
                            setNewSolarDeathDate(value);
                            const converted = deriveLunarAnniversaryFromSolarDeathDate(value);
                            if (converted) setNewDeathLunar(converted);
                          }}
                          className="w-full bg-white border border-stone-200 rounded px-2.5 py-1 focus:outline-none focus:border-red-800 text-stone-850"
                        />
                        {newSolarDeathDate && (apiDeathLunarText || convertSolarToLunarText(newSolarDeathDate)) && (
                          <span className="text-[9px] text-amber-700 block">Âm lịch can chi: {apiDeathLunarText || convertSolarToLunarText(newSolarDeathDate)}</span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <label className="text-stone-600 block">Nơi mất:</label>
                        <input
                          type="text"
                          value={newDeathPlace}
                          onChange={(e) => setNewDeathPlace(e.target.value)}
                          className="w-full bg-white border border-stone-200 rounded px-2.5 py-1 focus:outline-none focus:border-red-800 text-stone-850"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-stone-600 block">{newIsDeceased ? "Mộ phần đặt tại cát địa:" : "Năm sinh (Dương lịch):"}</label>
                    {newIsDeceased ? (
                      <input 
                        type="text" 
                        placeholder="Nghĩa trang Trường Yên, Hoa Lư" 
                        value={newGrave}
                        onChange={(e) => setNewGrave(e.target.value)}
                        className="w-full bg-white border border-stone-200 rounded px-2.5 py-1 focus:outline-none focus:border-red-800 text-stone-850"
                      />
                    ) : (
                      <input 
                        type="text" 
                        placeholder="Ví dụ: 1994" 
                        value={newBirthYear}
                        onChange={(e) => setNewBirthYear(e.target.value)}
                        className="w-full bg-white border border-stone-200 rounded px-2.5 py-1 focus:outline-none focus:border-red-800 text-stone-850"
                      />
                    )}
                  </div>
                </div>

                {/* Achievements */}
                <div className="space-y-1">
                  <label className="font-semibold text-stone-700 block">Vinh danh sự nghiệp, học vị (Khuyến học):</label>
                  <input 
                    type="text" 
                    placeholder="Bắc Cực phong tặng Giáo sư Đại học Quốc gia, Thượng Tá..." 
                    value={newAchievement}
                    onChange={(e) => setNewAchievement(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 text-xs"
                  />
                </div>

                {/* Biography */}
                <div className="space-y-1">
                  <label className="font-semibold text-stone-700 block">Tích trạng & Lược lịch cổ nhân tự truyện:</label>
                  <textarea 
                    rows={3}
                    placeholder="Lược sử cuộc đời, tấm lòng vì dòng họ, gia tông rèn luyện đạo đức..." 
                    value={newBio}
                    onChange={(e) => setNewBio(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 text-xs resize-none"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="flex gap-2 justify-end pt-3 border-t border-stone-100">
                  <button 
                    type="button" 
                    onClick={() => {
                      resetMemberForm();
                      setIsAddOpen(false);
                    }}
                    className="bg-stone-100 border border-stone-200 hover:bg-stone-200 rounded-lg px-4 py-2 font-semibold transition-all cursor-pointer text-stone-800"
                  >
                    Hạ sớ Hủy
                  </button>
                  <button 
                    type="submit" 
                    className="bg-red-800 hover:bg-red-950 text-white rounded-lg px-4 py-2 font-semibold transition-all cursor-pointer flex items-center gap-1"
                  >
                    {editingMemberId ? "Lưu chỉnh sửa" : "Kính lập Biên phả"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isBranchManagerOpen && (
          <div className="fixed inset-0 bg-black/55 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white rounded-xl shadow-2xl max-w-5xl w-full border border-stone-200 overflow-hidden"
            >
              <div className="bg-red-950 px-5 py-4 text-white flex items-center justify-between">
                <div>
                  <h3 className="font-serif font-bold text-base text-amber-100">Quản lý chi/ngành</h3>
                  <p className="text-[11px] text-amber-100/75 mt-0.5">Chi tự động theo con trai, trưởng chi kế thừa theo nam hệ; nhóm công việc có thể nhập tay.</p>
                </div>
                <button type="button" onClick={() => setIsBranchManagerOpen(false)} className="rounded-full hover:bg-white/10 p-1">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-5 text-xs">
                <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
                  <div className="space-y-3">
                    <div className="rounded-lg border border-stone-150 bg-stone-50 p-3 space-y-2">
                      <label className="font-bold text-stone-750 block">Thêm chi/ngành hoặc nhóm công việc</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newBranchDraft}
                          placeholder="Ví dụ: Ngành trưởng, Ngành thứ, Ban khánh tiết..."
                          onChange={(event) => setNewBranchDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter") return;
                            upsertManagedBranch(newBranchDraft);
                            setNewBranchDraft("");
                          }}
                          className="min-w-0 flex-1 bg-white border border-stone-200 rounded px-3 py-2 focus:outline-none focus:border-red-800"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            upsertManagedBranch(newBranchDraft);
                            setNewBranchDraft("");
                          }}
                          className="rounded bg-red-800 px-3 py-2 font-bold text-white hover:bg-red-950"
                        >
                          Thêm
                        </button>
                      </div>
                    </div>

                    <div className="rounded-lg border border-stone-150 overflow-hidden">
                      <div className="px-3 py-2 bg-stone-100 border-b border-stone-150 flex items-center justify-between">
                        <span className="font-bold text-stone-800">Danh sách chi/ngành</span>
                        <span className="text-[10px] text-stone-500">{branchNames.length} mục</span>
                      </div>
                      <div className="max-h-[420px] overflow-y-auto divide-y divide-stone-100">
                        {branchNames.map((branchName) => {
                          const config = getManagedBranch(branchName);
                          const computed = computedBranchByName.get(branchName);
                          const branchMembers = getMembersInBranch(branchName);
                          const leaderId = getBranchLeaderId(branchName);
                          const leader = leaderId ? members.find((member) => member.id === leaderId) : undefined;
                          return (
                            <button
                              type="button"
                              key={branchName}
                              onClick={() => setActiveManagedBranchName(branchName)}
                              className={`w-full text-left p-3 transition-all ${activeManagedBranchName === branchName ? "bg-red-50" : "bg-white hover:bg-stone-50"}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-bold text-stone-850 truncate">{displayText(branchName)}</p>
                                  <p className="text-[10px] text-stone-500 truncate">
                                    Trưởng chi: {leader ? displayText(leader.name) : "Chưa gán"}
                                  </p>
                                </div>
                                <div className="shrink-0 flex flex-col items-end gap-1">
                                  <span className="rounded bg-white border border-stone-200 px-1.5 py-0.5 text-[10px] font-bold text-stone-600">
                                    {branchMembers.length}
                                  </span>
                                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${computed ? "bg-emerald-50 text-emerald-800 border border-emerald-100" : "bg-amber-50 text-amber-800 border border-amber-100"}`}>
                                    {computed ? "Tự động" : "Nhập tay"}
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {activeManagedBranchName ? (() => {
                    const config = getManagedBranch(activeManagedBranchName);
                    const computed = computedBranchByName.get(activeManagedBranchName);
                    const branchMembers = getMembersInBranch(activeManagedBranchName);
                    const explicitIds = new Set(config?.memberIds || []);
                    const leaderId = getBranchLeaderId(activeManagedBranchName);
                    const founder = computed ? members.find((member) => member.id === computed.founderId) : undefined;
                    const parent = computed?.parentId ? members.find((member) => member.id === computed.parentId) : undefined;
                    const normalizedBranchMemberSearch = branchMemberSearch
                      .normalize("NFD")
                      .replace(/[\u0300-\u036f]/g, "")
                      .toLowerCase();
                    const addableMembers = members
                      .filter((member) => !branchMembers.some((item) => item.id === member.id))
                      .filter((member) => {
                        if (!normalizedBranchMemberSearch) return true;
                        return `${member.name} ${member.branch || ""}`
                          .normalize("NFD")
                          .replace(/[\u0300-\u036f]/g, "")
                          .toLowerCase()
                          .includes(normalizedBranchMemberSearch);
                      })
                      .slice(0, 8);

                    return (
                      <div className="rounded-lg border border-stone-150 overflow-hidden">
                        <div className="px-4 py-3 bg-stone-50 border-b border-stone-150 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <h4 className="font-serif font-bold text-stone-900 text-sm">{displayText(activeManagedBranchName)}</h4>
                            <p className="text-[10px] text-stone-500">
                              {branchMembers.length} thành viên
                              {computed && founder ? ` · Chi phát sinh từ ${displayText(founder.name)}` : " · Nhóm/chi nhập tay"}
                            </p>
                            {computed && parent && (
                              <p className="text-[10px] text-stone-400 mt-0.5">
                                Bố/Mẹ gốc: {displayText(parent.name)}. Nếu trưởng chi qua đời, hệ thống tự xét con trai kế thừa; nếu không còn nhánh nam hiệu lực mới chuyển theo anh em cùng bố.
                              </p>
                            )}
                          </div>
                          {!computed && (
                            <button
                              type="button"
                              onClick={() => {
                                setManagedBranches((prev) => prev.filter((item) => item.name !== activeManagedBranchName));
                                if (selectedBranch === activeManagedBranchName) setSelectedBranch("all");
                              }}
                              className="self-start sm:self-auto rounded border border-red-200 px-2.5 py-1.5 text-[11px] font-bold text-red-800 hover:bg-red-50"
                            >
                              Xóa mục quản lý
                            </button>
                          )}
                        </div>

                        <div className="p-4 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="font-bold text-stone-700 block">Trưởng chi/ngành</label>
                              <select
                                value={leaderId || ""}
                                disabled={Boolean(computed)}
                                onChange={(event) => {
                                  const leaderId = event.target.value || undefined;
                                  upsertManagedBranch(activeManagedBranchName, { leaderId });
                                  if (leaderId) addMemberToManagedBranch(activeManagedBranchName, leaderId);
                                }}
                                className="w-full bg-white border border-stone-200 rounded px-2.5 py-2 focus:outline-none focus:border-red-800 disabled:bg-stone-100 disabled:text-stone-500"
                              >
                                <option value="">{computed ? "Chưa xác định tự động" : "Chọn trưởng chi/ngành"}</option>
                                {branchMembers.map((member) => (
                                  <option key={member.id} value={member.id}>{displayText(member.name)} - {getGenerationLabel(member.generation)}</option>
                                ))}
                              </select>
                              {computed && (
                                <p className="text-[10px] text-stone-500">Trưởng chi này được tính tự động theo nguyên tắc kế thừa.</p>
                              )}
                            </div>
                            <div className="space-y-1">
                              <label className="font-bold text-stone-700 block">Ghi chú công việc</label>
                              <input
                                type="text"
                                value={config?.note || ""}
                                placeholder="Ví dụ: phụ trách lễ, quỹ, liên lạc..."
                                onChange={(event) => upsertManagedBranch(activeManagedBranchName, { note: event.target.value })}
                                className="w-full bg-white border border-stone-200 rounded px-2.5 py-2 focus:outline-none focus:border-red-800"
                              />
                            </div>
                          </div>

                          <div className="rounded-lg border border-stone-150 overflow-hidden">
                            <div className="px-3 py-2 bg-white border-b border-stone-100 flex items-center justify-between">
                              <span className="font-bold text-stone-800">Thành viên trong chi/ngành</span>
                              <button
                                type="button"
                                onClick={() => setSelectedBranch(activeManagedBranchName)}
                                className="rounded border border-stone-200 px-2 py-1 text-[10px] font-bold text-stone-600 hover:border-red-200 hover:text-red-800"
                              >
                                Lọc ở danh sách chính
                              </button>
                            </div>
                            <div className="max-h-52 overflow-y-auto divide-y divide-stone-100">
                              {branchMembers.length === 0 ? (
                                <p className="p-4 text-center text-stone-400">Chưa có thành viên trong mục này.</p>
                              ) : branchMembers.map((member) => (
                                <div key={member.id} className="p-3 flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="font-bold text-stone-850 truncate">{displayText(member.name)}</p>
                                    <p className="text-[10px] text-stone-500 truncate">
                                      {getGenerationLabel(member.generation)} · Chi gốc: {displayText(member.branch || "Chưa phân chi")}
                                      {member.id === leaderId ? " · Trưởng chi/ngành" : ""}
                                    </p>
                                  </div>
                                  {explicitIds.has(member.id) && member.branch !== activeManagedBranchName && (
                                    <button
                                      type="button"
                                      onClick={() => removeExplicitMemberFromManagedBranch(activeManagedBranchName, member.id)}
                                      className="shrink-0 rounded border border-stone-200 px-2 py-1 text-[10px] font-bold text-stone-500 hover:text-red-800 hover:border-red-200"
                                    >
                                      Gỡ khỏi nhóm
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {!computed && (
                          <div className="rounded-lg border border-stone-150 bg-stone-50 p-3 space-y-2">
                            <label className="font-bold text-stone-700 block">Thêm thành viên vào nhóm này</label>
                            <input
                              type="text"
                              value={branchMemberSearch}
                              placeholder="Tìm tên thành viên để thêm vào chi/ngành hoặc nhóm công việc..."
                              onChange={(event) => setBranchMemberSearch(event.target.value)}
                              className="w-full bg-white border border-stone-200 rounded px-3 py-2 focus:outline-none focus:border-red-800"
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {addableMembers.map((member) => (
                                <button
                                  key={member.id}
                                  type="button"
                                  onClick={() => {
                                    addMemberToManagedBranch(activeManagedBranchName, member.id);
                                    setBranchMemberSearch("");
                                  }}
                                  className="text-left rounded border border-stone-200 bg-white px-3 py-2 hover:border-red-200 hover:bg-red-50"
                                >
                                  <span className="font-bold text-stone-800 block truncate">{displayText(member.name)}</span>
                                  <span className="text-[10px] text-stone-500 block truncate">{getGenerationLabel(member.generation)} · {displayText(member.branch || "Chưa phân chi")}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                          )}
                        </div>
                      </div>
                    );
                  })() : (
                    <div className="rounded-lg border border-dashed border-stone-200 p-8 text-center text-stone-400">
                      Chưa có chi/ngành hoặc nhóm công việc để quản lý.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Excel / Google Sheets Importer Modal Drawer */}
      <AnimatePresence>
        {isExcelOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl overflow-hidden shadow-2xl max-w-2xl w-full border border-stone-200 flex flex-col max-h-[90vh]"
            >
              <div className="bg-emerald-900 px-5 py-4 text-white flex items-center justify-between border-b border-stone-150 shrink-0">
                <h3 className="font-serif font-bold text-base text-amber-100 flex items-center gap-1.5">
                  <Database className="h-5 w-5" />
                  Đồng Bộ & Nhập Gia Phả Tiên Linh Từ Bảng Tính
                </h3>
                <button 
                  onClick={() => {
                    setIsExcelOpen(false);
                    setBulkText("");
                    setParsedPreview([]);
                    setImportError(null);
                    setUploadFileName("");
                    setValidationScore(null);
                    setColumnMatches([]);
                    setExcelImportSession(null);
                    setExcelImportMappings([]);
                    setExcelImportIssues([]);
                    setExcelImportGateNote("");
                  }}
                  className="rounded-full hover:bg-white/10 p-1 text-stone-200 transition-all cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Subtabs for xls */}
              <div className="flex bg-stone-100 border-b border-stone-200 text-xs shrink-0 font-bold select-none text-stone-700">
                <button 
                  onClick={() => {
                    setExcelActiveTab("paste");
                    setImportError(null);
                  }}
                  className={`flex-1 py-3 text-center cursor-pointer transition-all ${
                    excelActiveTab === "paste" ? "bg-white border-b-2 border-emerald-700 text-emerald-800 font-extrabold" : "text-stone-550 hover:bg-stone-50"
                  }`}
                >
                  Tải Tệp Excel / CSV lên
                </button>
                <button 
                  onClick={() => {
                    setExcelActiveTab("script");
                    setImportError(null);
                  }}
                  className={`flex-2 py-3 text-center cursor-pointer transition-all ${
                    excelActiveTab === "script" ? "bg-white border-b-2 border-emerald-700 text-emerald-800 font-extrabold" : "text-stone-550 hover:bg-stone-50"
                  }`}
                >
                  Dán Dữ Liệu trực tiếp (Clipboard)
                </button>
                <button 
                  onClick={() => {
                    setExcelActiveTab("script_auto");
                    setImportError(null);
                  }}
                  className={`flex-1.5 py-3 text-center cursor-pointer transition-all ${
                    excelActiveTab === "script_auto" ? "bg-white border-b-2 border-emerald-700 text-emerald-800 font-extrabold" : "text-stone-550 hover:bg-stone-50"
                  }`}
                >
                  Tự động hóa Apps Script API
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4 text-xs grow text-left">
                
                {/* 1. DOWNLOAD SAMPLE AND IMPORT CONFIG SECTION */}
                <div className="bg-stone-50 p-4 border border-stone-200/80 rounded-xl space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-stone-700">
                    <div>
                      <h4 className="font-bold text-stone-850">Yêu cầu khuôn mẫu chuẩn:</h4>
                      <p className="text-[10.5px] text-stone-500 leading-normal mt-0.5">
                        Tải bảng mẫu 55 cột đặc tả dòng họ làm khung biên soạn chính thức để tránh sai lệch.
                      </p>
                    </div>
                    <button 
                      type="button"
                      onClick={downloadExcelTemplate}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-850 hover:bg-emerald-100 border border-emerald-250 rounded-lg text-xs font-black transition-all cursor-pointer shrink-0"
                    >
                      <Download className="h-4 w-4" />
                      Tải mẫu excel phả phả đồ
                    </button>
                  </div>

                  <div className="border-t border-stone-200/50 pt-3 text-stone-750">
                    <label className="font-black text-stone-800 block mb-1.5">Chế độ đồng bộ dữ liệu tải lên:*</label>
                    <div className="grid grid-cols-2 gap-4">
                      <label className="flex items-center gap-2 p-2.5 bg-white border border-stone-200 hover:border-emerald-550 rounded-lg cursor-pointer transition-all select-none">
                        <input 
                          type="radio" 
                          name="importMode" 
                          checked={importMode === "append"} 
                          onChange={() => setImportMode("append")}
                          className="accent-emerald-700"
                        />
                        <div>
                          <strong className="block text-[11px] text-stone-800">Bổ sung tiếp nối</strong>
                          <span className="text-[9px] text-stone-400">Chèn thêm mới tộc nhân, giữ phả hệ cũ.</span>
                        </div>
                      </label>

                      <label className="flex items-center gap-2 p-2.5 bg-white border border-stone-200 hover:border-red-650 rounded-lg cursor-pointer transition-all select-none">
                        <input 
                          type="radio" 
                          name="importMode" 
                          checked={importMode === "replace"} 
                          onChange={() => setImportMode("replace")}
                          className="accent-red-700"
                        />
                        <div>
                          <strong className="block text-[11px] text-red-800">Xóa hết làm mới</strong>
                          <span className="text-[9px] text-stone-400">Làm sạch phả phu hiện tại và nạp tệp mới.</span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                {/* TAB 1: FILE SELECT & DRAG-DROP */}
                {excelActiveTab === "paste" && (
                  <div className="space-y-3.5">
                    <label className="font-bold text-stone-700 block">Kéo thả hoặc duyệt chọn tài liệu:</label>
                    
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-stone-200 hover:border-emerald-600 bg-stone-50/50 hover:bg-emerald-50/10 rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2.5 select-none"
                    >
                      <Upload className="h-8 w-8 text-stone-400 animate-bounce" />
                      <span className="font-bold text-stone-700 text-xs">Hãy thả tệp tin Excel (.xlsx, .xls) hoặc CSV (.csv) vào đây</span>
                      <span className="text-[10px] text-stone-400">Hoặc click để chọn một tệp tiêu thức dòng họ từ thiết bị</span>
                      
                      {uploadFileName && (
                        <div className="mt-2 px-3 py-1 bg-emerald-50 text-emerald-800 rounded border border-emerald-150 flex items-center gap-1 font-bold">
                          <Check className="h-3 w-3" /> Đã chọn tệp: {uploadFileName}
                        </div>
                      )}
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      accept=".xlsx,.xls,.csv" 
                      className="hidden" 
                    />
                  </div>
                )}

                {/* TAB 2: COPY PASTE DIRECT TEXT BLOCK */}
                {excelActiveTab === "script" && (
                  <div className="space-y-3">
                    <div className="space-y-1.5/40 text-left">
                      <label className="font-bold text-stone-700 block">Dán các hàng dữ liệu sao chép từ Excel/Google Sheets vào đây:*</label>
                      <textarea 
                        rows={5}
                        value={bulkText}
                        onChange={(e) => setBulkText(e.target.value)}
                        placeholder="Quét chọn vùng dữ liệu từ Google Sheets/Excel (55 cột) rồi bấm Ctrl+V dán vào đây..."
                        className="w-full bg-stone-50 border border-stone-200 rounded-lg p-3 font-mono text-[10px] focus:outline-none focus:border-emerald-600 resize-none leading-relaxed text-stone-800"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button 
                        type="button" 
                        onClick={handleParseBulk}
                        disabled={!bulkText.trim()}
                        className="bg-emerald-800 hover:bg-emerald-950 disabled:bg-stone-150 disabled:text-stone-350 text-white rounded-lg px-4.5 py-2 font-bold cursor-pointer transition-all"
                      >
                        Kiểm chứng dòng dán
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          setBulkText(
                            "EX_NB01\tCao Hồng Sơn\tNam\tTự Minh\t0912111\t\tTrường Yên\ts@hn.vn\t1952\tĐã mất\t2021\t12 tháng 3\tNghĩa trang huyện\t7\t\t\t\t\t\t\t\t\tEX_NB00\n" +
                            "EX_NB02\tCao Bích Hà\tNữ\tCô Ba\t\t\tTrường Yên\t\t1983\tCòn sống\t\t\t\t8\tCao Hồng Sơn\t\t\t\t\t\t\t\tEX_NB01\tNguyễn Thị Lan"
                          );
                        }}
                        className="text-[10px] font-bold text-emerald-800 hover:underline cursor-pointer select-none"
                      >
                        [📎 Nạp mẫu dán nhanh]
                      </button>
                    </div>
                  </div>
                )}

                {/* TAB 3: REST API / APPS SCRIPT AUTOMATION */}
                {excelActiveTab === "script_auto" && (
                  <div className="space-y-3 text-left">
                    <div>
                      <h4 className="font-bold text-emerald-900 border-b border-stone-150 pb-1 flex items-center gap-1">
                        <Database className="h-4 w-4" />
                        Đồng Bộ Tự Động Qua Google Apps Script API
                      </h4>
                      <p className="text-[10px] text-stone-500 mt-1.5 leading-relaxed">
                        Bạn có thể kết hợp tự động hóa qua Google Sheets. Tạo một nút bấm trên Google Sheet của dòng họ bạn, liên kết với Google Apps Script để đẩy dữ liệu thẳng về REST API Họ Cao Ninh Bình:
                      </p>
                    </div>

                    <div className="space-y-1 relative">
                      <div className="flex justify-between items-center text-stone-400 font-bold uppercase text-[9px]">
                        <span>Mã nguồn Google Apps Script (Thư viện Javascript):</span>
                      </div>
                      <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg font-mono text-[9px] block overflow-x-auto select-all max-h-48 leading-relaxed">
{`function syncGenealogyToClanPortal() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var membersList = [];
  
  // Vòng lặp từ hàng 2 bỏ qua tiêu đề
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if(!row[1]) continue;
    membersList.push({
      id: row[0] || undefined,
      name: row[1],
      gender: row[2] === "Nữ" ? "Nữ" : "Nghị",
      bio: "Đồng bộ qua API Google Sheets"
    });
  }
  
  var url = "https://hocaoninhbinh.vn/api/genealogy/bulk-import";
  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ members: membersList })
  };
  UrlFetchApp.fetch(url, options);
  SpreadsheetApp.getUi().alert("Đồng bộ dữ liệu dòng họ Cao Ninh Bình cát tường!");
}`}
                      </pre>
                    </div>
                  </div>
                )}

                {/* STANDARD CHECKPOINT VALIDATION SCORE DASHBOARD */}
                {validationScore !== null && (
                  <div className="space-y-3 border border-amber-200 bg-amber-500/5 rounded-xl p-4 text-left">
                    <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-800 shrink-0">
                          <Check className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="font-bold text-stone-800 text-[11px] uppercase">Hệ Thống Kiểm Chứng 55 Cột Đặc Tả</h4>
                          <span className="text-[9.5px] text-stone-500 block">Độ tương thích định dạng file nạp và quy chiếu trường dashboard</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                          validationScore >= 80 ? "bg-emerald-100 border-emerald-250 text-emerald-850" : "bg-amber-100 border-amber-250 text-amber-850"
                        }`}>
                          Độ khớp cấu trúc: {validationScore}%
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="font-bold text-stone-750 block text-[10px]">Sơ đồ đối chiếu cột mẫu và trường thông tin trên dashboard:</span>
                      <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-48 overflow-y-auto p-1.5 border border-stone-150 rounded bg-white text-[9px]">
                        {columnMatches.map((col, idx) => (
                          <div key={idx} className={`p-1.5 rounded border flex flex-col justify-between min-w-0 ${
                            col.status === "matched"
                              ? "bg-emerald-500/5 border-emerald-200 text-emerald-900"
                              : col.status === "mismatched"
                              ? "bg-amber-500/5 border-amber-200 text-amber-950"
                              : "bg-stone-50 border-stone-200 text-stone-400"
                          }`}>
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-semibold block text-[8px] opacity-60">Cột {idx + 1}</span>
                              {col.status === "matched" ? (
                                <span className="text-[7.5px] bg-emerald-100 px-1 py-0.2 rounded font-semibold text-emerald-900">Khớp</span>
                              ) : col.status === "mismatched" ? (
                                <span className="text-[7.5px] bg-amber-100 px-1 py-0.2 rounded font-semibold text-amber-900">Lệch</span>
                              ) : (
                                <span className="text-[7.5px] bg-stone-150 px-1 py-0.2 rounded font-semibold text-stone-500">Khuyết</span>
                              )}
                            </div>
                            <div className="mt-1 space-y-1 min-w-0">
                              <span className="text-[9.5px] font-bold block leading-snug break-words" title={`Tên trên dashboard: ${col.name}`}>
                                Dashboard: {col.name}
                              </span>
                              <span
                                className="text-[8px] text-stone-500 block leading-snug break-words"
                                title={`Thông tin trên file Excel: Cột ${idx + 1} - ${col.excelAddress} - ${col.incomingHeader || "Không có tiêu đề"}`}
                              >
                                File Excel: Cột {idx + 1} - {col.excelAddress} - {col.incomingHeader || "Không có tiêu đề"}
                              </span>
                              <span
                                className="text-[8px] font-mono text-stone-500 block leading-snug break-words"
                                title={`Trường dashboard: ${getDashboardFieldLabel(getResolvedDashboardField(idx, col.dashboardField))}`}
                              >
                                Tham số: {getDashboardFieldLabel(getResolvedDashboardField(idx, col.dashboardField))}
                              </span>
                              {col.status !== "matched" && (
                                <select
                                  value={getResolvedDashboardField(idx, col.dashboardField)}
                                  onChange={(event) => {
                                    const nextField = event.target.value;
                                    setColumnFieldOverrides((prev) => ({
                                      ...prev,
                                      [idx]: nextField
                                    }));
                                  }}
                                  className="w-full min-w-0 bg-white border border-amber-200 rounded px-1.5 py-1 text-[8px] text-stone-700 font-mono focus:outline-none focus:border-amber-500"
                                  title="Quy chiếu thủ công sang trường dashboard"
                                >
                                  {dashboardFieldOptions.map((field) => (
                                    <option key={field.value} value={field.value}>{field.label}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                            {col.sampleValue && (
                              <span className="text-[8px] italic text-stone-450 truncate mt-0.5 block" title={`Giá trị mẫu: ${col.sampleValue}`}>
                                Mẫu: {col.sampleValue}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {(excelImportSession || excelImportSessions.length > 0) && (
                  <div className="space-y-3 border border-sky-200 bg-sky-50/60 rounded-xl p-4 text-left">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-sky-100 pb-2">
                      <div>
                        <h4 className="font-black text-sky-950 text-[12px] uppercase">Cổng duyệt Excel/CSV an toàn</h4>
                        <p className="text-[10px] text-sky-800">
                          File chỉ được ghi vào cây phả sau khi admin duyệt mapping, validate preview và xác nhận import.
                        </p>
                      </div>
                      {excelImportSession && (
                        <span className="self-start rounded-full border border-sky-200 bg-white px-2.5 py-1 text-[10px] font-black text-sky-900">
                          {excelImportSession.status}
                        </span>
                      )}
                    </div>

                    {excelImportSession && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                        <div className="rounded-lg bg-white border border-sky-100 p-2">
                          <span className="block text-stone-450 font-bold">File</span>
                          <strong className="text-stone-850 break-words">{excelImportSession.fileName}</strong>
                        </div>
                        <div className="rounded-lg bg-white border border-sky-100 p-2">
                          <span className="block text-stone-450 font-bold">Dòng / cột</span>
                          <strong className="text-stone-850">{excelImportSession.rowCount} / {excelImportSession.columnCount}</strong>
                        </div>
                        <div className="rounded-lg bg-white border border-sky-100 p-2">
                          <span className="block text-stone-450 font-bold">Mapping</span>
                          <strong className="text-stone-850">{excelImportMappings.filter((m) => m.approved).length}/{excelImportMappings.length} đã duyệt</strong>
                        </div>
                        <div className="rounded-lg bg-white border border-sky-100 p-2">
                          <span className="block text-stone-450 font-bold">Issue</span>
                          <strong className="text-stone-850">{excelImportIssues.length} mục</strong>
                        </div>
                      </div>
                    )}

                    {excelImportSession?.warnings?.length ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[10px] text-amber-900">
                        {excelImportSession.warnings.slice(0, 3).map((warning, index) => (
                          <div key={index}>• {warning.message}</div>
                        ))}
                      </div>
                    ) : null}

                    {excelImportMappings.length > 0 && (
                      <div className="max-h-44 overflow-y-auto rounded-lg border border-sky-100 bg-white">
                        <table className="w-full text-[9.5px]">
                          <thead className="bg-sky-50 text-sky-950">
                            <tr>
                              <th className="p-1.5 text-left">Cột</th>
                              <th className="p-1.5 text-left">Header</th>
                              <th className="p-1.5 text-left">Field</th>
                              <th className="p-1.5 text-left">Tin cậy</th>
                              <th className="p-1.5 text-left">Duyệt</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100">
                            {excelImportMappings.slice(0, 16).map((mapping) => (
                              <tr key={mapping.id}>
                                <td className="p-1.5 font-mono">{mapping.columnLetter}</td>
                                <td className="p-1.5 font-semibold text-stone-800">{mapping.originalHeader || "Không tiêu đề"}</td>
                                <td className="p-1.5 text-stone-650">{mapping.mappedField || "Chưa map"}</td>
                                <td className="p-1.5 font-mono">{Math.round((mapping.confidence || 0) * 100)}%</td>
                                <td className="p-1.5">{mapping.approved ? "Đã duyệt" : "Chờ duyệt"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {excelImportIssues.length > 0 && (
                      <div className="max-h-32 overflow-y-auto rounded-lg border border-red-100 bg-white p-2 text-[10px]">
                        {excelImportIssues.slice(0, 8).map((issue) => (
                          <div key={issue.id} className="mb-1 text-stone-750">
                            <strong className={issue.severity === "error" || issue.severity === "critical" ? "text-red-800" : "text-amber-800"}>
                              {issue.severity}
                            </strong>
                            {" · "}{issue.rowIndex ? `Dòng ${issue.rowIndex}: ` : ""}{issue.message}
                          </div>
                        ))}
                      </div>
                    )}

                    {excelImportGateNote && (
                      <p className="text-[10px] font-semibold text-sky-900">{excelImportGateNote}</p>
                    )}

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={approveExcelImportMappings}
                        disabled={!excelImportSession || excelImportBusy || ["imported", "rejected"].includes(excelImportSession.status)}
                        className="rounded-lg bg-sky-800 px-3 py-1.5 text-[10px] font-black text-white disabled:bg-stone-200 disabled:text-stone-500"
                      >
                        Duyệt mapping & validate
                      </button>
                      <button
                        type="button"
                        onClick={confirmExcelImportGate}
                        disabled={!excelImportSession || excelImportSession.status !== "ready_to_import" || excelImportBusy}
                        className="rounded-lg bg-emerald-750 px-3 py-1.5 text-[10px] font-black text-white disabled:bg-stone-200 disabled:text-stone-500"
                      >
                        Xác nhận cổng import
                      </button>
                      <button
                        type="button"
                        onClick={rejectExcelImportSession}
                        disabled={!excelImportSession || excelImportBusy || excelImportSession.status === "rejected"}
                        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[10px] font-black text-red-800 disabled:text-stone-400"
                      >
                        Từ chối phiên
                      </button>
                    </div>

                    {excelImportSessions.length > 0 && (
                      <div className="text-[10px] text-stone-500">
                        Phiên gần đây: {excelImportSessions.slice(0, 4).map((session) => `${session.fileName} (${session.status})`).join(" · ")}
                      </div>
                    )}
                  </div>
                )}

                {importError && (
                  <div className="p-3 bg-red-50 border border-red-250 rounded-lg text-red-800 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-700 mt-0.5" />
                    <div className="text-[10.5px]">
                      <strong className="block font-bold">Lỗi trong quá trình kiểm tra định dạng:</strong>
                      {importError}
                    </div>
                  </div>
                )}

                {/* Parsed entries visualizer */}
                {parsedPreview.length > 0 && (
                  <div className="space-y-3.5 border border-stone-200 rounded-xl p-3 bg-stone-50 text-left">
                    <div className="flex justify-between items-center pb-1.5 border-b border-stone-200">
                      <p className="font-bold text-stone-800">✓ Đã tuyển trạch {parsedPreview.length} tộc nhân thành công:</p>
                      <span className="text-[10px] text-stone-400">Độ chuẩn thế thế triều</span>
                    </div>
                    
                    <div className="max-h-36 overflow-y-auto border border-stone-150 rounded bg-white text-[10px]">
                      <table className="w-full text-left">
                        <thead className="bg-stone-550 text-stone-750 border-b border-stone-200">
                          <tr>
                            <th className="p-1.5 font-bold">Quý danh</th>
                            <th className="p-1.5 font-bold">Đề vị Đời</th>
                            <th className="p-1.5 font-bold">Giới tính</th>
                            <th className="p-1.5 font-bold">Năm sinh</th>
                            <th className="p-1.5 font-bold">Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 text-stone-700">
                          {parsedPreview.map((p, i) => (
                            <tr key={i} className="hover:bg-stone-50/50">
                              <td className="p-1.5 font-bold text-stone-900">{p.name}</td>
                              <td className="p-1.5 font-mono">{getGenerationLabel(p.generation)}</td>
                              <td className="p-1.5">{p.gender}</td>
                              <td className="p-1.5 font-mono text-stone-500">{p.birthYear || "Không rõ"}</td>
                              <td className="p-1.5 font-semibold text-stone-500">
                                {p.isDeceased ? "Cụ Quy tiên" : "Đang sống"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="pt-2 text-right">
                      <button 
                        type="button"
                        onClick={handleCommitBulkImport}
                        disabled={excelImportSession?.status !== "imported"}
                        className={`font-black px-5 py-2.5 rounded-lg text-xs cursor-pointer shadow-md transition-all text-white ${
                          excelImportSession?.status !== "imported"
                            ? "bg-stone-250 text-stone-500 cursor-not-allowed"
                            : importMode === "replace" ? "bg-red-700 hover:bg-red-950" : "bg-emerald-700 hover:bg-emerald-950"
                        }`}
                      >
                        {importMode === "replace" ? "⚠️ XOÁ SẠCH PHẢ ĐỒ & GHI MỚI" : "ĐỒNG BỘ BỔ SUNG GIA PHẢ"} ({parsedPreview.length} TỘC NHÂN)
                      </button>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="px-5 py-3 border-t border-stone-150 bg-stone-50 text-right shrink-0">
                <button 
                  type="button" 
                  onClick={() => {
                    setIsExcelOpen(false);
                    setBulkText("");
                    setParsedPreview([]);
                    setImportError(null);
                    setUploadFileName("");
                    setValidationScore(null);
                    setColumnMatches([]);
                  }}
                  className="bg-stone-100 hover:bg-stone-200 border border-stone-250 rounded-lg px-4 py-1.5 transition-all text-stone-850 font-bold cursor-pointer"
                >
                  Đóng Hộp thoại
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

