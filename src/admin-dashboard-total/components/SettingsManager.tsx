import React, { useState } from "react";
import { motion } from "motion/react";
import { Settings, Sliders, Palette, ShieldCheck, Sparkles, AlertTriangle, Key, Cpu, HelpCircle, Save, CheckCircle, Users, ToggleLeft, ToggleRight } from "lucide-react";
import { WebThemeConfig, AIModelConfig, UserSession } from "../types";

type UserRole = "admin" | "user" | "writer" | "treasurer" | "secretary";
const MANAGEMENT_ROLES: UserRole[] = ["admin", "writer", "treasurer", "secretary"];

interface SettingsManagerProps {
  themeConfig: WebThemeConfig;
  onThemeConfigChange: (config: WebThemeConfig) => void;
  aiConfig: AIModelConfig;
  onAIConfigChange: (config: AIModelConfig) => void;
  currentUser: UserSession;
  usersList: UserSession[];
  onAddUser: (user: UserSession) => void;
  onUpdateUserRole: (userId: string, newRole: UserRole, newRoles?: string[]) => void;
  onUpdateUserKYC: (userId: string, isKYCed: boolean) => void;
}

export default function SettingsManager({ 
  themeConfig, 
  onThemeConfigChange, 
  aiConfig, 
  onAIConfigChange,
  currentUser,
  usersList,
  onAddUser,
  onUpdateUserRole,
  onUpdateUserKYC
}: SettingsManagerProps) {
  
  const [activeSegment, setActiveSegment] = useState<"appearance" | "ai" | "roles">("appearance");
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Buffer states for appearance settings
  const [siteName, setSiteName] = useState(themeConfig.siteName);
  const [slogan, setSlogan] = useState(themeConfig.slogan);
  const [primaryColor, setPrimaryColor] = useState(themeConfig.primaryColor);
  const [fontFamily, setFontFamily] = useState(themeConfig.fontFamily);
  const [showBanner, setShowBanner] = useState(themeConfig.showBanner);
  const [logoText, setLogoText] = useState(themeConfig.logoText);

  // Buffer states for AI settings
  const [modelName, setModelName] = useState(aiConfig.modelName);
  const [temperature, setTemperature] = useState(aiConfig.temperature);
  const [systemPrompt, setSystemPrompt] = useState(aiConfig.systemPrompt);
  const [engineCeremony, setEngineCeremony] = useState(aiConfig.engineCeremony || "chatgpt");
  const [engineArticles, setEngineArticles] = useState(aiConfig.engineArticles || "chatgpt");
  const [engineChat, setEngineChat] = useState(aiConfig.engineChat || "gemini");
  const [engineZalo, setEngineZalo] = useState(aiConfig.engineZalo || "gemini");
  const [newUserFullName, setNewUserFullName] = useState("");
  const [newUserPhone, setNewUserPhone] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("writer");

  const isManagementUser = (user: UserSession) => {
    const roles = user.roles || [user.role];
    return roles.some((role) => MANAGEMENT_ROLES.includes(role as UserRole));
  };

  const managementUsers = usersList.filter(isManagementUser);
  const userSuggestions = usersList.filter((user) => !isManagementUser(user));

  const findSuggestedUser = (value: string) => {
    const needle = value.trim().toLowerCase();
    if (!needle) return undefined;
    return usersList.find((user) => (
      user.fullName.toLowerCase() === needle ||
      user.username.toLowerCase() === needle ||
      String(user.email || "").toLowerCase() === needle ||
      String(user.phone || "").toLowerCase() === needle
    ));
  };

  const handleUserSearchChange = (value: string) => {
    setNewUserFullName(value);
    const selectedUser = findSuggestedUser(value);
    if (!selectedUser) return;
    setNewUserPhone(selectedUser.phone || "");
    setNewUserEmail(selectedUser.email || "");
  };

  const handleSaveAppearance = (e: React.FormEvent) => {
    e.preventDefault();
    onThemeConfigChange({
      siteName,
      slogan,
      primaryColor,
      fontFamily,
      showBanner,
      bannerImage: themeConfig.bannerImage || "/images/ancient_temple_roof_1779856049722.png",
      logoText
    });
    triggerSaveAlert("Đã lưu cấu hình diện mạo website thành công.");
  };

  const handleSaveAI = (e: React.FormEvent) => {
    e.preventDefault();
    onAIConfigChange({
      modelName,
      temperature,
      systemPrompt,
      engineCeremony,
      engineArticles,
      engineChat,
      engineZalo
    });
    triggerSaveAlert("Đã lưu cấu hình Trợ lý AI thành công.");
  };

  const triggerSaveAlert = (msg: string) => {
    setSaveSuccess(msg);
    setTimeout(() => {
      setSaveSuccess(null);
    }, 2500);
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserFullName.trim()) return;
    const selectedUser = findSuggestedUser(newUserFullName);
    if (selectedUser) {
      const currentRoles = selectedUser.roles || [selectedUser.role];
      const nextRoles = Array.from(new Set([...currentRoles.filter((role) => role !== "user"), newUserRole]));
      const primary = nextRoles.includes("admin") ? "admin" : newUserRole;
      onUpdateUserRole(selectedUser.id, primary, nextRoles);
      setNewUserFullName("");
      setNewUserPhone("");
      setNewUserEmail("");
      setNewUserRole("writer");
      triggerSaveAlert(`Đã thêm ${selectedUser.fullName} vào ban quản trị.`);
      return;
    }

    const normalizedName = newUserFullName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    onAddUser({
      id: `usr_${Date.now()}`,
      username: normalizedName || `user_${Date.now()}`,
      fullName: newUserFullName.trim(),
      role: newUserRole,
      roles: [newUserRole],
      isKYCed: false,
      phone: newUserPhone.trim(),
      email: newUserEmail.trim(),
      regDate: new Date().toLocaleDateString("vi-VN"),
      loginType: newUserPhone.trim() ? "zalo" : "username",
    });
    setNewUserFullName("");
    setNewUserPhone("");
    setNewUserEmail("");
    setNewUserRole("writer");
    triggerSaveAlert("Đã thêm thành viên mới vào ban quản trị.");
  };

  return (
    <div className="space-y-6 max-w-4xl text-left">
      {/* Overview Intro banner */}
      <div className="bg-white p-5 rounded-xl border border-stone-150 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-serif font-bold text-stone-950 flex items-center gap-1.5">
            <Settings className="h-4.5 w-4.5 text-stone-700" />
            Cổng Thiết Lập Hệ Thống Cao Gia Tộc
          </h2>
          <p className="text-xs text-stone-500 max-w-xl">
            Cấu hình giao diện website, màu sắc, thương hiệu dòng họ và tham số điều phối trợ lý AI.
          </p>
        </div>
        
        {/* Active section toggle button */}
        <div className="flex bg-stone-100 p-1 rounded-lg border border-stone-200 select-none text-[11px] shrink-0 self-start md:self-center font-semibold">
          <button 
            onClick={() => setActiveSegment("appearance")}
            type="button"
            className={`px-2.5 py-1.5 rounded-md cursor-pointer transition-all flex items-center gap-1.5 ${
              activeSegment === "appearance" 
                ? "bg-white text-red-900 font-bold shadow-xs border border-stone-200/50" 
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            <Palette className="h-3.5 w-3.5" /> Diện mạo Web
          </button>
          <button 
            onClick={() => setActiveSegment("ai")}
            type="button"
            className={`px-2.5 py-1.5 rounded-md cursor-pointer transition-all flex items-center gap-1.5 ${
              activeSegment === "ai" 
                ? "bg-white text-red-900 font-bold shadow-xs border border-stone-200/50" 
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" /> Cấu hình AI
          </button>
          <button 
            onClick={() => setActiveSegment("roles")}
            type="button"
            className={`px-2.5 py-1.5 rounded-md cursor-pointer transition-all flex items-center gap-1.5 ${
              activeSegment === "roles" 
                ? "bg-white text-red-900 font-bold shadow-xs border border-stone-200/50" 
                : "text-stone-500 hover:text-stone-900"
            }`}
          >
            <Users className="h-3.5 w-3.5" /> Định quyền Thành viên
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-250 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          <span className="font-semibold">{saveSuccess}</span>
        </div>
      )}

      {/* Segment 1: Web configuration */}
      {activeSegment === "appearance" && (
        <form onSubmit={handleSaveAppearance} className="bg-white border border-stone-150 rounded-xl shadow-sm overflow-hidden text-xs">
          <div className="px-5 py-4 border-b border-stone-100 bg-stone-50/50">
            <h3 className="font-serif font-bold text-sm text-stone-850 flex items-center gap-1.5">
              <Sliders className="h-4 w-4 text-red-800" />
              Chỉnh Sửa Giao Diện & Màu Sắc Website
            </h3>
            <p className="text-[11px] text-stone-500">Thiết lập tham số thương hiệu, slogan hiển thị và màu chủ đạo của trang gia phả.</p>
          </div>

          <div className="p-5 space-y-4">
            {/* Row 1: Site name & Slogan */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-stone-700 block">Tên hiển thị Website:*</label>
                <input 
                  type="text" 
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-stone-700 block">Tiêu biểu Gia tộc (Slogan hiển thị):*</label>
                <input 
                  type="text" 
                  value={slogan}
                  onChange={(e) => setSlogan(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-855"
                  required
                />
              </div>
            </div>

            {/* Row 2: Primay Colors, fonts and show patterns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Primary Color selection */}
              <div className="space-y-1.5">
                <label className="font-bold text-stone-700 block">Tông màu chủ đạo hệ thống:*</label>
                <select 
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value as any)}
                  className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800"
                >
                  <option value="royal-red">Hoàng gia Đỏ (Royal Red)</option>
                  <option value="ebony-slate">Trầm đen vân đá (Ebony Slate)</option>
                  <option value="amber-warm">Nhang ấm trầm hương (Amber)</option>
                  <option value="temple-moss">Rừng tre am thờ (Temple Moss)</option>
                </select>
                <span className="text-[10px] text-stone-400 italic block">Sắc màu chủ đạo cho nút bấm và tiêu đề.</span>
              </div>

              {/* Fonts Selection */}
              <div className="space-y-1.5">
                <label className="font-bold text-stone-700 block">Phông chữ hiển thị tiêu đề:*</label>
                <select 
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value as any)}
                  className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800"
                >
                  <option value="Inter">Sạch sẽ hiện đại (Inter Sans)</option>
                  <option value="Space Grotesk">Hơi hướng thư mục (Space Grotesk)</option>
                  <option value="Playfair Display">Truyền thống trang trọng (Playfair Display Serif)</option>
                </select>
                <span className="text-[10px] text-stone-400 italic block">Áp dụng cho tiêu đề lớn và cuốn thư gia phả.</span>
              </div>

              {/* Text Logo seal */}
              <div className="space-y-1.5">
                <label className="font-bold text-stone-700 block">Ký tự triện thư Logo dòng họ:*</label>
                <input 
                  type="text" 
                  value={logoText}
                  onChange={(e) => setLogoText(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850 font-serif font-black"
                  required
                />
              </div>
            </div>

            {/* Row 3: Image / banner toggles */}
            <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-stone-700 font-semibold gap-4">
              <div className="space-y-0.5">
                <p>Kích hoạt ảnh băng reo lớn (Hero Visual Banner):</p>
                <p className="text-[10px] text-stone-400 font-normal">Hiển thị ảnh trang trí đầu trang.</p>
              </div>
              <div className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showBanner}
                  onChange={(e) => setShowBanner(e.target.checked)}
                  id="toggleBanner" 
                  className="sr-only peer cursor-pointer" 
                />
                <label htmlFor="toggleBanner" className="w-9 h-5 bg-stone-250 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 cursor-pointer"></label>
              </div>
            </div>

            {/* Preview Theme color badge blocks */}
            <div className="p-3.5 bg-[#fbfaf6] border border-amber-500/10 rounded-lg space-y-1.5 select-none">
              <span className="text-[10px] font-black uppercase text-stone-400 tracking-wider">Chế độ xem mẫu tông màu đã chọn:</span>
              <div className="flex gap-2">
                {primaryColor === "royal-red" && (
                  <div className="flex items-center gap-1.5 bg-red-950 text-amber-200 border border-red-900 rounded px-2.5 py-1 text-[10px]" style={{ fontFamily: fontFamily === 'Inter' ? 'sans-serif' : fontFamily === 'Space Grotesk' ? 'monospace' : 'serif' }}>
                    <span className="h-2 w-2 rounded-full bg-red-650" /> Sắc màu Hoàng gia Ninh Bình {logoText}
                  </div>
                )}
                {primaryColor === "ebony-slate" && (
                  <div className="flex items-center gap-1.5 bg-stone-900 text-stone-100 border border-stone-700 rounded px-2.5 py-1 text-[10px]" style={{ fontFamily: fontFamily === 'Inter' ? 'sans-serif' : fontFamily === 'Space Grotesk' ? 'monospace' : 'serif' }}>
                    <span className="h-2 w-2 rounded-full bg-stone-500" /> Sắc trầm tôn nghiêm {logoText}
                  </div>
                )}
                {primaryColor === "amber-warm" && (
                  <div className="flex items-center gap-1.5 bg-amber-50 text-amber-900 border border-amber-300 rounded px-2.5 py-1 text-[10px]" style={{ fontFamily: fontFamily === 'Inter' ? 'sans-serif' : fontFamily === 'Space Grotesk' ? 'monospace' : 'serif' }}>
                    <span className="h-2 w-2 rounded-full bg-amber-500" /> Bản nhang đèn ấm phụng cung {logoText}
                  </div>
                )}
                {primaryColor === "temple-moss" && (
                  <div className="flex items-center gap-1.5 bg-emerald-950 text-emerald-200 border border-emerald-900 rounded px-2.5 py-1 text-[10px]" style={{ fontFamily: fontFamily === 'Inter' ? 'sans-serif' : fontFamily === 'Space Grotesk' ? 'monospace' : 'serif' }}>
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> Sắc mộc rêu am thờ an nhàn {logoText}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="px-5 py-3 border-t border-stone-100 bg-stone-50 text-right shrink-0">
            <button 
              type="submit"
              className="inline-flex items-center gap-1.5 bg-red-800 hover:bg-neutral-900 border border-red-800 hover:border-neutral-900 text-white rounded px-3 py-1.5 font-bold cursor-pointer shadow-sm transition-all text-xs"
            >
              <Save className="h-3.5 w-3.5" /> Lưu giữ Cấu hình Giao diện
            </button>
          </div>
        </form>
      )}

      {/* Segment 2: AI model configuration */}
      {activeSegment === "ai" && (
        <form onSubmit={handleSaveAI} className="bg-white border border-stone-150 rounded-xl shadow-sm overflow-hidden text-xs">
          <div className="px-5 py-4 border-b border-stone-100 bg-stone-50/50">
            <h3 className="font-serif font-bold text-sm text-stone-850 flex items-center gap-1.5">
              <Sliders className="h-4 w-4 text-amber-700" />
              Cấu hình Trợ lý AI & điều phối mô hình
            </h3>
            <p className="text-[11px] text-stone-500">Thiết lập mô hình, độ sáng tạo, lời hiệu dụ và cách phân luồng AI theo từng tác vụ.</p>
          </div>

          <div className="p-5 space-y-4">
            {/* Warnings warning banner */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-850 leading-relaxed flex gap-2.5 items-start">
              <AlertTriangle className="h-4.5 w-4.5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold flex items-center gap-1">Thông tri bảo mật khóa API Gemini</p>
                <p className="text-[10px] text-stone-500 mt-0.5">Khóa API được quản lý an toàn từ file cấu hình máy chủ. Quản trị viên không cần nhập lộ khóa bảo mật trên giao diện.</p>
              </div>
            </div>

            {/* Row 1: Model names & temp inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-bold text-stone-700 block">Mô hình AI đàm thoại chọn lựa:*</label>
                <select 
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850 font-mono font-bold"
                >
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (khuyến nghị)</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (suy luận sâu)</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash (phản hồi nhanh)</option>
                </select>
                <span className="text-[10px] text-stone-400 block italic">Dùng để phân tích văn bản, lập sớ và hỗ trợ tra cứu nội dung gia phả.</span>
              </div>

              {/* Temperature slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between font-bold text-stone-700">
                  <label>Độ sáng tạo văn bản (Temperature):*</label>
                  <span className="text-red-800 font-mono">{temperature} / 1.0</span>
                </div>
                <input 
                  type="range" 
                  min="0.0" 
                  max="1.0" 
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full cursor-pointer accent-red-800 mt-1"
                />
                <span className="text-[10px] text-stone-400 block italic leading-normal">Số thấp giúp kết quả ổn định; số cao giúp văn phong phong phú hơn.</span>
              </div>
            </div>

            {/* Row 2: custom AI System prompt text area */}
            <div className="space-y-1.5">
              <label className="font-bold text-stone-700 block">Lời hiệu dụ căn cốt (System Prompt):*</label>
              <textarea 
                rows={5}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 font-serif leading-relaxed"
                required
              />
              <span className="text-[10px] text-stone-450 block italic">Chỉ thị gốc giúp Trợ lý AI giữ đúng văn phong và phạm vi trả lời.</span>
            </div>

            {/* Row 2.5: AI purpose routing selectors */}
            <div className="bg-amber-500/5 p-4 rounded-xl border border-amber-500/10 space-y-3.5">
              <h4 className="font-serif font-black text-amber-950 text-xs flex items-center gap-1">
                <Cpu className="h-4 w-4 text-amber-700 font-bold" />
                ĐIỀU PHỐI MÔ HÌNH THEO MỤC ĐÍCH
              </h4>
              <p className="text-[10px] text-stone-500">
                Lựa chọn mô hình xử lý tương ứng với từng tác vụ nội dung của gia tộc:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* 1. Văn sớ */}
                <div className="space-y-1">
                  <label className="font-bold text-stone-700 block">1. Tạo văn sớ cúng bái:*</label>
                  <select 
                    value={engineCeremony}
                    onChange={(e) => setEngineCeremony(e.target.value as any)}
                    className="w-full bg-white border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850 font-medium text-xs"
                  >
                    <option value="chatgpt">ChatGPT (tối ưu văn sớ trang nghiêm)</option>
                    <option value="gemini">Gemini (phân tích văn phong cổ)</option>
                    <option value="local">Local AI (mô hình nội bộ)</option>
                  </select>
                </div>

                {/* 2. Viết bài sử ký */}
                <div className="space-y-1">
                  <label className="font-bold text-stone-700 block">2. Viết bài / sử ký tộc phả:*</label>
                  <select 
                    value={engineArticles}
                    onChange={(e) => setEngineArticles(e.target.value as any)}
                    className="w-full bg-white border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850 font-medium text-xs"
                  >
                    <option value="chatgpt">ChatGPT (mô tả tự nhiên, dễ đọc)</option>
                    <option value="gemini">Gemini (cấu trúc chặt chẽ)</option>
                    <option value="local">Local AI (tóm tắt nội bộ)</option>
                  </select>
                </div>

                {/* 3. Hỏi đáp trợ lý Hán Nôm */}
                <div className="space-y-1">
                  <label className="font-bold text-stone-700 block">3. Trò chuyện & đối chiếu Hán Nôm:*</label>
                  <select 
                    value={engineChat}
                    onChange={(e) => setEngineChat(e.target.value as any)}
                    className="w-full bg-white border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850 font-medium text-xs"
                  >
                    <option value="gemini">Gemini (phân tích tư liệu tốt)</option>
                    <option value="chatgpt">ChatGPT (dẫn chuyện mạch lạc)</option>
                    <option value="local">Local AI (trả lời ngắn nhanh)</option>
                  </select>
                </div>

                {/* 4. Chatbot Zalo OA */}
                <div className="space-y-1">
                  <label className="font-bold text-stone-700 block">4. Zalo OA Chatbot trả lời tự động:*</label>
                  <select 
                    value={engineZalo}
                    onChange={(e) => setEngineZalo(e.target.value as any)}
                    className="w-full bg-white border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850 font-medium text-xs"
                  >
                    <option value="gemini">Gemini (xử lý đa dạng câu hỏi)</option>
                    <option value="chatgpt">ChatGPT (trả lời lịch sự, mạch lạc)</option>
                    <option value="local">Local AI (phản hồi tiết kiệm)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* API key state indications */}
            <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-[10.5px] text-stone-500 space-y-2 select-none font-bold">
              <p className="uppercase text-stone-400 text-[10px] tracking-wider flex items-center gap-1">
                <Cpu className="h-3.5 w-3.5 text-stone-500" />
                Tổng quan kiểm định SDK máy chủ hiện hành:
              </p>
              <div className="grid grid-cols-2 gap-2 text-stone-650 font-normal">
                <p>Khóa GEMINI_API_KEY: <strong className="text-emerald-700">Đã nạp an toàn từ máy chủ</strong></p>
                <p>Dịch vụ truyền tải: <strong className="text-emerald-700">Trực tuyến</strong></p>
                <p>Thành phần hỏi đáp: <strong className="text-stone-700">Chữ Hán, phả ký, văn sớ</strong></p>
                <p>Timeout mặc định: <strong className="text-stone-700">30,000ms</strong></p>
              </div>
            </div>
          </div>

          <div className="px-5 py-3 border-t border-stone-100 bg-stone-50 text-right shrink-0">
            <button 
              type="submit"
              className="inline-flex items-center gap-1.5 bg-red-800 hover:bg-neutral-900 border border-red-800 hover:border-neutral-900 text-white rounded px-3 py-1.5 font-bold cursor-pointer shadow-sm transition-all text-xs"
            >
              <Save className="h-3.5 w-3.5" /> Lưu giữ Cấu hình AI Assistant
            </button>
          </div>
        </form>
      )}

      {/* Segment 3: Role allocation management (Only for admins, view-locked for others) */}
      {activeSegment === "roles" && (
        <div className="bg-white border border-stone-150 rounded-xl shadow-sm overflow-hidden text-xs text-left">
          <div className="px-5 py-4 border-b border-stone-100 bg-stone-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-serif font-bold text-sm text-stone-850 flex items-center gap-1.5">
                <Sliders className="h-4 w-4 text-red-900" />
                Sắc phong & Quản lý phân quyền thành viên
              </h3>
              <p className="text-[11px] text-stone-500">
                Chỉ hiển thị các thành viên đã được thêm vào ban quản trị; có thể gán vai trò, KYC hoặc xóa khỏi ban quản trị.
              </p>
            </div>
            {currentUser.role === "admin" && (
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded px-2.5 py-1 text-[10px] font-bold shrink-0 self-start sm:self-center">
                Quyền Admin trực hàng
              </span>
            )}
          </div>

          <div className="p-5">
            {currentUser.role !== "admin" ? (
              /* Security view-lock visual placeholder */
              <div className="py-8 px-4 text-center max-w-lg mx-auto space-y-4">
                <div className="h-14 w-14 rounded-full bg-red-50 text-red-750 border border-red-200/60 shadow-inner flex items-center justify-center mx-auto">
                  <Key className="h-7 w-7 text-red-800" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="font-serif font-bold text-stone-850 text-sm uppercase tracking-wide">
                    Ổ khóa quyền hạn
                  </h4>
                  <p className="text-stone-500 leading-relaxed text-[11px]">
                    Chỉ có <strong className="text-red-900">Admin</strong> mới được sắc phong vai trò và duyệt trạng thái KYC thành viên.
                  </p>
                  <p className="text-[10px] text-stone-400 bg-stone-50 p-3 rounded-lg border border-stone-150 italic mt-3">
                    Tài khoản hiện tại: <strong className="text-stone-700">{currentUser.fullName}</strong>, quyền <strong className="text-red-900">[{currentUser.role}]</strong>.
                  </p>
                </div>
              </div>
            ) : (
              /* Admin User Matrix Interface */
              <div className="space-y-4">
                <div className="bg-[#fcfbf9] border border-stone-150 p-3.5 rounded-lg text-[11px] leading-relaxed text-stone-600">
                  <p className="font-semibold text-stone-800">Chỉ dẫn quản trị phân quyền:</p>
                  <p className="mt-0.5">Gõ tên để chọn thành viên đã đăng ký, sau đó gán vai trò quản trị. Xóa khỏi ban quản trị chỉ đưa tài khoản về quyền thành viên, không xóa tài khoản.</p>
                </div>

                <form onSubmit={handleAddUser} className="bg-white border border-stone-200 rounded-lg p-3.5 grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-stone-500 uppercase">Họ tên</label>
                    <input value={newUserFullName} onChange={(e) => handleUserSearchChange(e.target.value)} list="admin-user-suggestions" placeholder="Gõ tên, tài khoản, SĐT..." className="w-full bg-stone-50 border border-stone-200 rounded px-2 py-1.5 text-[11px] focus:outline-none focus:border-red-800" required />
                    <datalist id="admin-user-suggestions">
                      {userSuggestions.map((user) => (
                        <option key={user.id} value={user.fullName}>
                          {user.username} {user.phone ? `- ${user.phone}` : ""} {user.email ? `- ${user.email}` : ""}
                        </option>
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-stone-500 uppercase">SĐT/Zalo</label>
                    <input value={newUserPhone} onChange={(e) => setNewUserPhone(e.target.value)} placeholder="09..." className="w-full bg-stone-50 border border-stone-200 rounded px-2 py-1.5 text-[11px] focus:outline-none focus:border-red-800" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-stone-500 uppercase">Email</label>
                    <input value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="email@..." className="w-full bg-stone-50 border border-stone-200 rounded px-2 py-1.5 text-[11px] focus:outline-none focus:border-red-800" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-stone-500 uppercase">Vai trò</label>
                    <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value as any)} className="w-full bg-stone-50 border border-stone-200 rounded px-2 py-1.5 text-[11px] focus:outline-none focus:border-red-800">
                      
                      <option value="writer">Biên tập viên</option>
                      <option value="secretary">Thư ký họ</option>
                      <option value="treasurer">Thủ quỹ</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <button type="submit" className="bg-red-800 text-white rounded px-3 py-1.5 text-[11px] font-bold hover:bg-red-950">
                    Thêm vào ban quản trị
                  </button>
                </form>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-stone-700">
                    <thead>
                      <tr className="text-stone-400 border-b border-stone-100 pb-2">
                        <th className="py-2.5 px-3 font-semibold">Thành viên</th>
                        <th className="py-2.5 font-semibold">Tài khoản liên kết</th>
                        <th className="py-2.5 font-semibold">Số điện thoại Zalo</th>
                        <th className="py-2.5 font-semibold">Vai trò</th>
                        <th className="py-2.5 font-semibold">Trạng thái KYC</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {managementUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-stone-50/50 transition-all">
                          <td className="py-3 px-3">
                            <p className="font-bold text-stone-800">{u.fullName}</p>
                            <p className="text-[10px] text-stone-400">Đăng ký ngày: {u.regDate}</p>
                          </td>
                          <td className="py-3 font-mono text-stone-500">{u.username} <span className="text-[9px] bg-stone-100 text-stone-450 px-1 rounded">({u.loginType})</span></td>
                          <td className="py-3 font-mono text-[11px] text-stone-605">{u.phone || "Chưa bổ sung"}</td>
                          <td className="py-3">
                            <div className="flex flex-col gap-1 py-1">
                              {[
                                { val: "admin", label: "Chánh Tổng Quản (Admin)" },
                                { val: "treasurer", label: "Thủ Quỹ Gia Tộc (Treasurer)" },
                                { val: "writer", label: "Sử Biên Ký (Writer)" },
                                { val: "secretary", label: "Thư Ký Họ (Secretary)" },
                                { val: "user", label: "Đinh Viên (User)" }
                              ].map(item => {
                                const currentRoles = u.roles || [u.role];
                                const isChecked = currentRoles.includes(item.val);
                                return (
                                  <label key={item.val} className="inline-flex items-center gap-1.5 cursor-pointer text-[10.5px] text-stone-700 hover:text-red-900 transition-all font-medium py-0.5">
                                    <input 
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        let updatedRoles = [...currentRoles];
                                        if (isChecked) {
                                          if (updatedRoles.length > 1) {
                                            updatedRoles = updatedRoles.filter(r => r !== item.val);
                                          } else {
                                            alert("Thành viên phải có ít nhất một chức sự!");
                                            return;
                                          }
                                        } else {
                                          updatedRoles.push(item.val);
                                        }
                                        const primary = updatedRoles.includes("admin") ? "admin" : updatedRoles[0] || "user";
                                        onUpdateUserRole(u.id, primary as any, updatedRoles);
                                      }}
                                      className="rounded text-red-800 focus:ring-red-800 h-3 w-3 accent-red-800"
                                    />
                                    {item.label}
                                  </label>
                                );
                              })}
                            </div>
                          </td>
                          <td className="py-3">
                            <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold cursor-pointer select-none ${
                              u.isKYCed 
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-150" 
                                : "bg-stone-100 text-stone-450 border border-stone-200"
                            }`}
                            onClick={() => onUpdateUserKYC(u.id, !u.isKYCed)}
                            >
                              {u.isKYCed ? "Đã xác thực KYC" : "Chưa xác thực"}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex flex-col items-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdateUserKYC(u.id, !u.isKYCed);
                                  alert(`Đã ${!u.isKYCed ? "xác nhận KYC" : "gỡ xác thực KYC"} cho ${u.fullName}.`);
                                }}
                                className={`rounded px-2 md:px-2.5 py-1 text-[10px] font-bold cursor-pointer ${
                                  u.isKYCed
                                    ? "bg-stone-100 text-stone-600 hover:bg-stone-200"
                                    : "bg-red-800 text-white hover:bg-red-900"
                                }`}
                              >
                                {u.isKYCed ? "Gỡ KYC" : "Duyệt KYC"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!window.confirm(`Xóa ${u.fullName} khỏi ban quản trị? Tài khoản thành viên vẫn được giữ lại.`)) return;
                                  onUpdateUserRole(u.id, "user", ["user"]);
                                  triggerSaveAlert(`Đã xóa ${u.fullName} khỏi ban quản trị.`);
                                }}
                                className="rounded border border-red-200 bg-white px-2 md:px-2.5 py-1 text-[10px] font-bold text-red-800 hover:bg-red-50"
                              >
                                Xóa khỏi ban quản trị
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
