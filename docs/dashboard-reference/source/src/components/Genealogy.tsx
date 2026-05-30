import React, { useState, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { motion, AnimatePresence } from "motion/react";
import { Search, Filter, ShieldAlert, User, UserCheck, Award, Heart, Edit3, Plus, ArrowRight, X, Calendar, MapPin, Eye, Database, Copy, Check, Upload, Download, AlertCircle } from "lucide-react";
import { FamilyMember } from "../types";

interface GenealogyProps {
  members: FamilyMember[];
  onAddMember: (member: FamilyMember) => void;
  onBulkImport?: (newMembers: FamilyMember[], mode: "replace" | "append") => void;
}

export default function Genealogy({ members, onAddMember, onBulkImport }: GenealogyProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("Tất cả chi");
  const [selectedGen, setSelectedGen] = useState<number | "Tất cả đời">("Tất cả đời");
  const [activeBioMemberId, setActiveBioMemberId] = useState<string | null>("m1"); // Default to Progenitor
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isExcelOpen, setIsExcelOpen] = useState(false);

  // Bulk parser spreadsheet states
  const [bulkText, setBulkText] = useState("");
  const [parsedPreview, setParsedPreview] = useState<any[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [excelActiveTab, setExcelActiveTab] = useState<"paste" | "script">("paste");
  
  // Custom states for premium Excel upload & 55 column matching
  const [importMode, setImportMode] = useState<"append" | "replace">("append");
  const [uploadFileName, setUploadFileName] = useState("");
  const [validationScore, setValidationScore] = useState<number | null>(null);
  const [columnMatches, setColumnMatches] = useState<{name: string, status: "matched" | "mismatched" | "empty", sampleValue?: string}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const [newSpouse, setNewSpouse] = useState("");
  const [newBio, setNewBio] = useState("");
  const [newAchievement, setNewAchievement] = useState("");
  const branches = ["Tất cả chi", "Chi Trưởng (Trường Yên)", "Chi Thứ Hai (Yên Khánh)", "Thủy Tổ Gia Tộc"];
  const generations = ["Tất cả đời", 1, 2, 3, 4, 5, 6, 7, 8];

  // Active bio ancestor item
  const bioAncestor = useMemo(() => {
    return members.find(m => m.id === activeBioMemberId) || members[0];
  }, [members, activeBioMemberId]);

  // Handle addition of member
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newMember: FamilyMember = {
      id: "m_custom_" + Date.now(),
      name: newName,
      generation: Number(newGen),
      branch: newBranch,
      gender: newGender,
      isDeceased: newIsDeceased,
      birthYear: newBirthYear || undefined,
      deathYear: newIsDeceased ? (newDeathYear || undefined) : undefined,
      deathAnniversaryLunar: newIsDeceased ? (newDeathLunar || undefined) : undefined,
      graveLocation: newGrave || undefined,
      spouse: newSpouse || undefined,
      parentId: newParentId || undefined,
      bio: newBio || undefined,
      achievements: newAchievement ? [newAchievement] : [],
      children: []
    };

    onAddMember(newMember);
    
    // Auto inspect the newly added member
    setActiveBioMemberId(newMember.id);
    
    // Reset form & Close
    setNewName("");
    setNewBirthYear("");
    setNewDeathYear("");
    setNewDeathLunar("");
    setNewGrave("");
    setNewSpouse("");
    setNewParentId("");
    setNewBio("");
    setNewAchievement("");
    setIsAddOpen(false);
  };

  // Excel formatting assessment generator
  const runFormatVerification = (detectedHeaders: string[], firstDataRow: any[]) => {
    let matchedCount = 0;
    const matches = FAMILY_COLUMNS_SPEC.map((specName, specIdx) => {
      const incomingHeader = detectedHeaders[specIdx] ? String(detectedHeaders[specIdx]).trim() : "";
      const sampleCell = firstDataRow && firstDataRow[specIdx] !== undefined ? String(firstDataRow[specIdx]).trim() : "";
      
      let status: "matched" | "mismatched" | "empty" = "empty";
      
      if (incomingHeader) {
        const simplifiedSpec = specName.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g, "");
        const simplifiedIncoming = incomingHeader.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g, "");
        if (simplifiedIncoming.includes(simplifiedSpec) || simplifiedSpec.includes(simplifiedIncoming)) {
          status = "matched";
          matchedCount++;
        } else {
          status = "mismatched";
        }
      } else {
        status = "empty";
      }
      
      return {
        name: specName,
        status,
        sampleValue: sampleCell || undefined
      };
    });

    const score = Math.round((matchedCount / FAMILY_COLUMNS_SPEC.length) * 100);
    setValidationScore(score);
    setColumnMatches(matches);
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
      headers = [...FAMILY_COLUMNS_SPEC];
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

  // Upload trigger reading binary sheet
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFileName(file.name);
    
    const fileReader = new FileReader();
    fileReader.onload = (event) => {
      try {
        const binData = event.target?.result;
        let workbook;
        if (file.name.endsWith(".csv")) {
          const arrBuffer = new Uint8Array(binData as ArrayBuffer);
          const decodedText = new TextDecoder("utf-8").decode(arrBuffer);
          workbook = XLSX.read(decodedText, { type: "string" });
        } else {
          const arrBuffer = new Uint8Array(binData as ArrayBuffer);
          workbook = XLSX.read(arrBuffer, { type: "array" });
        }
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        parseSheetRows(rawRows);
      } catch (err: any) {
        setImportError("Lỗi đọc tệp Excel: " + (err.message || "Xin nạp tệp Excel (.xlsx, .xls) hoặc .csv đúng đặc tả."));
      }
    };
    fileReader.readAsArrayBuffer(file);
  };

  // Direct clipboard text blocks parsing
  const handleParseBulk = () => {
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
      parseSheetRows(sheetRows);
    } catch (err: any) {
      setImportError(err.message || "Phân mảnh dòng dán lỗi cấu trúc.");
    }
  };

  // Push results into main state
  const handleCommitBulkImport = () => {
    if (parsedPreview.length === 0) return;
    
    const newMembersToCommit: FamilyMember[] = parsedPreview.map((p, idx) => ({
      id: p.id || ("m_bulk_" + Date.now() + "_" + idx),
      name: p.name,
      generation: p.generation || 8,
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
    setIsExcelOpen(false);
  };

  // Build standard blank template workbook for users
  const downloadExcelTemplate = () => {
    try {
      const headers = [...FAMILY_COLUMNS_SPEC];
      
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
    return members.filter((member) => {
      const matchSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (member.bio && member.bio.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchBranch = selectedBranch === "Tất cả chi" || member.branch === selectedBranch;
      const matchGen = selectedGen === "Tất cả đời" || member.generation === Number(selectedGen);

      return matchSearch && matchBranch && matchGen;
    });
  }, [members, searchTerm, selectedBranch, selectedGen]);

  // Parent names resolver helper
  const getParentName = (parentId?: string) => {
    if (!parentId) return null;
    const parent = members.find(m => m.id === parentId);
    return parent ? parent.name : null;
  };

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
              placeholder="Tìm theo quý danh..." 
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
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Selector Generations */}
          <div className="relative flex items-center">
            <span className="absolute left-3 text-stone-400"><Eye className="h-3.5 w-3.5" /></span>
            <select 
              value={selectedGen}
              onChange={(e) => setSelectedGen(e.target.value === "Tất cả đời" ? "Tất cả đời" : Number(e.target.value))}
              className="w-full appearance-none bg-stone-50 border border-stone-200 rounded-lg pl-9 pr-3.5 py-2 text-stone-800 focus:outline-none focus:border-amber-400"
            >
              {generations.map(g => (
                <option key={g} value={g}>{g === "Tất cả đời" ? g : `Thế hệ Gia tộc - Đời ${g}`}</option>
              ))}
            </select>
          </div>
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
                        ĐỜI THỨ {gen}
                      </span>
                      <span className="h-[1px] bg-stone-200 grow" />
                      <span className="text-[10px] text-stone-400 uppercase font-bold select-none">{membersInGen.length} Người</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {membersInGen.map(m => (
                        <div 
                          key={m.id}
                          onClick={() => setActiveBioMemberId(m.id)}
                          className={`flex items-center justify-between p-3 rounded-lg border text-left cursor-pointer transition-all ${
                            m.id === activeBioMemberId 
                              ? "bg-red-50 border-red-300 ring-1 ring-red-300" 
                              : "bg-stone-50 border-stone-150 hover:bg-stone-100/70"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                              m.gender === "Nghị" 
                                ? "bg-red-100 text-red-800"
                                : "bg-teal-100 text-teal-800"
                            }`}>
                              <User className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-stone-850 flex items-center gap-1.5">
                                {m.name}
                                {m.isDeceased && (
                                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-stone-400" title="Đã tạ thế" />
                                )}
                              </p>
                              <span className="text-[10px] text-stone-500 block truncate max-w-[170px] sm:max-w-xs">{m.branch}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 text-[10px] text-stone-400">
                            {m.birthYear && (
                              <span>{m.birthYear} - {m.isDeceased ? (m.deathYear || "khuyết") : "Nay"}</span>
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
            <div>
              <span className="text-[10px] text-amber-300 uppercase font-bold tracking-wider">Đại Tộc Gia Chiêu</span>
              <h3 className="font-serif font-bold text-base text-amber-100 line-clamp-1">{bioAncestor?.name}</h3>
            </div>
          </div>

          <div className="p-5.5 space-y-4.5 text-xs text-stone-700 relative z-10">
            {/* Round Avatar badge */}
            <div className="absolute right-5 top-[-30px] h-14 w-14 rounded-full bg-[#fbfaf6] border-2 border-amber-400 shadow-md flex items-center justify-center text-red-900">
              <span className="font-serif text-lg font-bold">Cao</span>
            </div>

            {/* Quick Metadata */}
            <div className="grid grid-cols-2 gap-3 bg-stone-50 p-3 rounded-lg border border-stone-100 text-[11px]">
              <div>
                <span className="text-stone-400 block font-medium">Thế hệ triều</span>
                <p className="font-bold text-stone-800">Đời thứ {bioAncestor?.generation}</p>
              </div>
              <div>
                <span className="text-stone-400 block font-medium">Quản phận môn</span>
                <p className="font-bold text-stone-800 line-clamp-1">{bioAncestor?.branch}</p>
              </div>
              <div>
                <span className="text-stone-400 block font-medium">Giới sắc định</span>
                <p className="font-bold text-stone-800">{bioAncestor?.gender === "Nghị" ? "Nam tử" : "Nữ sinh"}</p>
              </div>
              <div>
                <span className="text-stone-400 block font-medium">Trạng sinh tế</span>
                <p className={`font-bold ${bioAncestor?.isDeceased ? "text-stone-500" : "text-emerald-700"}`}>
                  {bioAncestor?.isDeceased ? "Cụ Đã mất" : "Con cháu Đang sống"}
                </p>
              </div>
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
                    <span className="text-stone-400 block font-medium">Bố thượng phụ</span>
                    <p className="font-semibold text-stone-700 line-clamp-1">{getParentName(bioAncestor.parentId)}</p>
                  </div>
                )}
                {bioAncestor?.spouse && (
                  <div className="p-2 border border-stone-100 rounded bg-stone-50/50">
                    <span className="text-stone-400 block font-medium">Tộc phối phối thất</span>
                    <p className="font-semibold text-stone-700 line-clamp-1">{bioAncestor.spouse}</p>
                  </div>
                )}
              </div>

              {/* Biography historical narratives */}
              {bioAncestor?.bio && (
                <div className="space-y-1">
                  <span className="text-stone-400 font-medium block">Sự nghiệp, tích trạng & công lao di sản:</span>
                  <p className="text-stone-600 leading-relaxed text-[11px] italic pr-1 bg-stone-50 p-2.5 rounded border border-stone-100">
                    "{bioAncestor.bio}"
                  </p>
                </div>
              )}

              {/* Achievements vinh danh */}
              {bioAncestor?.achievements && bioAncestor.achievements.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-stone-400 font-medium block">Khen thưởng tích lục vinh danh:</span>
                  <div className="flex flex-wrap gap-1">
                    {bioAncestor.achievements.map((ach, idx) => (
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

      {/* Add New Member Modal Overlay */}
      <AnimatePresence>
        {isAddOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl overflow-hidden shadow-2xl max-w-lg w-full border border-stone-200 flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="bg-red-950 px-5 py-4 text-white flex items-center justify-between border-b border-amber-900/40">
                <h3 className="font-serif font-bold text-base text-amber-100">
                  Ghi chép Tộc nhân Gia Phả mới
                </h3>
                <button 
                  onClick={() => setIsAddOpen(false)}
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
                    <label className="font-semibold text-stone-700 block">Thế hệ đời: *</label>
                    <select 
                      value={newGen}
                      onChange={(e) => setNewGen(Number(e.target.value))}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 text-xs"
                    >
                      {[1,2,3,4,5,6,7,8,9,10].map(n => (
                        <option key={n} value={n}>Đời thứ {n}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Branch & Gender */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Chi họ sở thuộc: *</label>
                    <select 
                      value={newBranch}
                      onChange={(e) => setNewBranch(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 text-xs"
                    >
                      <option value="Chi Trưởng (Trường Yên)">Chi Trưởng (Trường Yên)</option>
                      <option value="Chi Thứ Hai (Yên Khánh)">Chi Thứ Hai (Yên Khánh)</option>
                      <option value="Chi Thứ Ba (Gia Sinh)">Chi Thứ Ba (Gia Sinh)</option>
                    </select>
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
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Bố đẻ (Thừa phụ phụ hệ):</label>
                    <select 
                      value={newParentId}
                      onChange={(e) => setNewParentId(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 text-xs"
                    >
                      <option value="">-- Không rõ / Khuyết --</option>
                      {members.filter(m => m.gender === "Nghị").map(m => (
                        <option key={m.id} value={m.id}>{m.name} (Đời {m.generation})</option>
                      ))}
                    </select>
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
                        <label className="text-stone-600 block">Năm tạ thế (Dương lịch):</label>
                        <input 
                          type="text" 
                          placeholder="Ví dụ: 1985" 
                          value={newDeathYear}
                          onChange={(e) => setNewDeathYear(e.target.value)}
                          className="w-full bg-white border border-stone-200 rounded px-2.5 py-1 focus:outline-none focus:border-red-800 text-stone-850"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-stone-600 block">Lễ kỵ ngày ngày (Âm lịch):</label>
                        <input 
                          type="text" 
                          placeholder="Ví dụ: mùng 5 tháng Giêng" 
                          value={newDeathLunar}
                          onChange={(e) => setNewDeathLunar(e.target.value)}
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
                    onClick={() => setIsAddOpen(false)}
                    className="bg-stone-100 border border-stone-200 hover:bg-stone-200 rounded-lg px-4 py-2 font-semibold transition-all cursor-pointer text-stone-800"
                  >
                    Hạ sớ Hủy
                  </button>
                  <button 
                    type="submit" 
                    className="bg-red-800 hover:bg-red-950 text-white rounded-lg px-4 py-2 font-semibold transition-all cursor-pointer flex items-center gap-1"
                  >
                    Kính lập Biên phả
                  </button>
                </div>
              </form>
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
                          <span className="text-[9.5px] text-stone-500 block">Độ tương thích định dạng file nạp</span>
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
                      <span className="font-bold text-stone-750 block text-[10px]">Sơ đồ đối chiếu cột mẫu dòng họ phả đồ:</span>
                      
                      <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-36 overflow-y-auto p-1.5 border border-stone-150 rounded bg-white text-[9px]">
                        {columnMatches.map((col, idx) => (
                          <div key={idx} className={`p-1.5 rounded border flex flex-col justify-between truncate ${
                            col.status === "matched" 
                              ? "bg-emerald-500/5 border-emerald-200 text-emerald-900" 
                              : col.status === "mismatched"
                              ? "bg-amber-500/5 border-amber-200 text-amber-950"
                              : "bg-stone-50 border-stone-200 text-stone-400"
                          }`}>
                            <div className="flex items-center justify-between">
                              <span className="font-semibold block text-[8px] opacity-60">Cột {idx + 1}</span>
                              {col.status === "matched" ? (
                                <span className="text-[7.5px] bg-emerald-100 px-1 py-0.2 rounded font-semibold text-emerald-900">Khớp</span>
                              ) : col.status === "mismatched" ? (
                                <span className="text-[7.5px] bg-amber-100 px-1 py-0.2 rounded font-semibold text-amber-900">Mới</span>
                              ) : (
                                <span className="text-[7.5px] bg-stone-150 px-1 py-0.2 rounded font-semibold text-stone-500">Khuyết</span>
                              )}
                            </div>
                            <span className="text-[9.5px] font-bold block mt-1 line-clamp-1" title={col.name}>{col.name}</span>
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
                              <td className="p-1.5 font-mono">Đời thứ {p.generation}</td>
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
                        className={`font-black px-5 py-2.5 rounded-lg text-xs cursor-pointer shadow-md transition-all text-white ${
                          importMode === "replace" ? "bg-red-700 hover:bg-red-950" : "bg-emerald-700 hover:bg-emerald-950"
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

