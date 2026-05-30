import React, { useState } from "react";
import { motion } from "motion/react";
import { Settings, Sliders, Palette, ShieldCheck, Sparkles, AlertTriangle, Key, Cpu, HelpCircle, Save, CheckCircle, Users, ToggleLeft, ToggleRight } from "lucide-react";
import { WebThemeConfig, AIModelConfig, UserSession } from "../types";

interface SettingsManagerProps {
  themeConfig: WebThemeConfig;
  onThemeConfigChange: (config: WebThemeConfig) => void;
  aiConfig: AIModelConfig;
  onAIConfigChange: (config: AIModelConfig) => void;
  currentUser: UserSession;
  usersList: UserSession[];
  onUpdateUserRole: (userId: string, newRole: "admin" | "user" | "writer" | "treasurer" | "secretary", newRoles?: string[]) => void;
  onUpdateUserKYC: (userId: string, isKYCed: boolean) => void;
}

export default function SettingsManager({ 
  themeConfig, 
  onThemeConfigChange, 
  aiConfig, 
  onAIConfigChange,
  currentUser,
  usersList,
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

  const handleSaveAppearance = (e: React.FormEvent) => {
    e.preventDefault();
    onThemeConfigChange({
      siteName,
      slogan,
      primaryColor,
      fontFamily,
      showBanner,
      bannerImage: "https://images.unsplash.com/photo-1596436889106-be35e843f974?auto=format&fit=crop&w=800&q=80",
      logoText
    });
    triggerSaveAlert("Đã đăng ký đồng bộ Cấu hình Diện mạo Website Thành công.");
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
    triggerSaveAlert("Đã lưu tham chiếu Cấu hình Trợ lý Hán Nôm AI & Trực phái điều chuyển thành công.");
  };

  const triggerSaveAlert = (msg: string) => {
    setSaveSuccess(msg);
    setTimeout(() => {
      setSaveSuccess(null);
    }, 2500);
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
            Cấu hình giao phong diện mạo (chủ đề sắc màu, triện thư hiệu dòng họ) và nâng hạ tham số điều tiết mô hình Trợ lý Hán Nôm sớ lễ AI.
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
            <Palette className="h-3.5 w-3.5" /> Diện Mạo Web
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
            <Sparkles className="h-3.5 w-3.5" /> Cấu Hình AI
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
            <Users className="h-3.5 w-3.5" /> Định Quyền Thành Viên
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
              Chỉnh Sửa Giao Phong & Màu Sắc Dòng Họ Website
            </h3>
            <p className="text-[11px] text-stone-500">Thiết lập tham số triện họa, slogan hiển thị của trang tin bài tộc phả Cao tộc.</p>
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
                <label className="font-bold text-stone-700 block">Tiêu biểu Gia tôn (Slogan hiển thị):*</label>
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
                  <option value="ebony-slate">Trầm đen ván đá (Ebony Slate)</option>
                  <option value="amber-warm">Nhang ấm trầm hương (Amber)</option>
                  <option value="temple-moss">Rừng tre am thờ (Temple Moss)</option>
                </select>
                <span className="text-[10px] text-stone-400 italic block">Sắc màu chủ tố cho nút bấm và tiêu đề.</span>
              </div>

              {/* Fonts Selection */}
              <div className="space-y-1.5">
                <label className="font-bold text-stone-700 block">Phông chữ hiển thị tiêu bối:*</label>
                <select 
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value as any)}
                  className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800"
                >
                  <option value="Inter">Sạch sẽ hiện đại (Inter Sans)</option>
                  <option value="Space Grotesk">Hơi hướng Thư mục (Space Grotesk)</option>
                  <option value="Playfair Display">Truyền thống Thăng hoa (Playfair Display Serif)</option>
                </select>
                <span className="text-[10px] text-stone-400 italic block">Áp dụng cho tiêu đề lớn, cuốn thư gia phả.</span>
              </div>

              {/* Text Logo seal */}
              <div className="space-y-1.5">
                <label className="font-bold text-stone-700 block">Ký tự Triện thư Logo dòng họ:*</label>
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
                <p>Kích hoạt Ảnh Băng Reo lớn (Hero Visual Banner):</p>
                <p className="text-[10px] text-stone-400 font-normal">Hiển thị ảnh mây rồng tổ đường hoàng tráng đầu trang.</p>
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
                    <span className="h-2 w-2 rounded-full bg-stone-500" /> Sắc âm Trầm tối tôn nghiêm {logoText}
                  </div>
                )}
                {primaryColor === "amber-warm" && (
                  <div className="flex items-center gap-1.5 bg-amber-50 text-amber-900 border border-amber-300 rounded px-2.5 py-1 text-[10px]" style={{ fontFamily: fontFamily === 'Inter' ? 'sans-serif' : fontFamily === 'Space Grotesk' ? 'monospace' : 'serif' }}>
                    <span className="h-2 w-2 rounded-full bg-amber-500" /> Bản nhang đèn ấm phụng cung {logoText}
                  </div>
                )}
                {primaryColor === "temple-moss" && (
                  <div className="flex items-center gap-1.5 bg-emerald-950 text-emerald-200 border border-emerald-900 rounded px-2.5 py-1 text-[10px]" style={{ fontFamily: fontFamily === 'Inter' ? 'sans-serif' : fontFamily === 'Space Grotesk' ? 'monospace' : 'serif' }}>
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> Sắc mộc rêu Am cỏ an nhàn {logoText}
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
              Cấu Hình Trợ Lý Hán Nôm & Sớ Tộc Gia AI (Gemini SDK)
            </h3>
            <p className="text-[11px] text-stone-500">Thiết lập các khóa bảo mật, hệ tư sự model bái cúng để tăng cường tính học thuật cho sớ đối chiếu.</p>
          </div>

          <div className="p-5 space-y-4">
            {/* Warnings warning banner */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-850 leading-relaxed flex gap-2.5 items-start">
              <AlertTriangle className="h-4.5 w-4.5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold flex items-center gap-1">Thông tri Bảo Mật Khóa API Gemini</p>
                <p className="text-[10px] text-stone-500 mt-0.5">Khóa API được quản lý an toàn từ tệp cấu hình `.env` máy chủ của hệ thống. Quý bối KHÔNG cần nhập lộ thiên khoá bảo mật để chống việc sao lén bất hợp hiếu.</p>
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
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Bản chính - Khuyến nghị học thuật cao)</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (Suy luận sâu sắc, biên biên chữ Hán siêu việt)</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash (Phản hồi truyền tải nhanh)</option>
                </select>
                <span className="text-[10px] text-stone-400 block italic">Dùng để thông dịch văn bia chữ Nho, lập sớ bái phục hỷ cúng cổ truyền.</span>
              </div>

              {/* Temperature slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between font-bold text-stone-700">
                  <label>Độ bay bổng tư văn (Temperature):*</label>
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
                <span className="text-[10px] text-stone-400 block italic leading-normal">Số thấp (0.1 - 0.4) giúp kết quả cứng nghị trung thành phả kí cổ. Số cao (0.7 - 1.0) viết sớ thâm thúy dồi dào hoa văn.</span>
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
              <span className="text-[10px] text-stone-450 block italic">Đây là chỉ thị gốc ép buộc Trợ lý Hán Nôm AI phải hành xử nghiêm trang, đùng cách văn bia người Ninh Bình cung tổ.</span>
            </div>

            {/* Row 2.5: AI purpose routing selectors */}
            <div className="bg-amber-500/5 p-4 rounded-xl border border-amber-500/10 space-y-3.5">
              <h4 className="font-serif font-black text-amber-950 text-xs flex items-center gap-1">
                <Cpu className="h-4 w-4 text-amber-700 font-bold" />
                ĐIỀU PHÁI NHẬN THỨC MÔ HÌNH THEO MỤC ĐÍCH (MODEL ENGINE ROUTING)
              </h4>
              <p className="text-[10px] text-stone-500">
                Lựa chọn nhân tố trí tuệ xử lý tương ứng với từng tác vụ phả sự, bái tế dâng văn của gia tộc:
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
                    <option value="chatgpt">ChatGPT (Tối ưu sớ trạng trang nghiêm)</option>
                    <option value="gemini">Gemini (Ngôn phong cổ, dịch Hán Nôm sắc sảo)</option>
                    <option value="local">Local AI (Mô hình họ tộc bản địa hóa)</option>
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
                    <option value="chatgpt">ChatGPT (Mô tả hào sảng, trôi chảy tự nhiên)</option>
                    <option value="gemini">Gemini (Văn phong sử ký, cấu trúc chặt chẽ)</option>
                    <option value="local">Local AI (Tóm tắt nhanh gọn nội bộ)</option>
                  </select>
                </div>

                {/* 3. Hỏi đáp trợ lý Hán nôm */}
                <div className="space-y-1">
                  <label className="font-bold text-stone-700 block">3. Trò chuyện & đối chiếu Hán Nôm:*</label>
                  <select 
                    value={engineChat}
                    onChange={(e) => setEngineChat(e.target.value as any)}
                    className="w-full bg-white border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850 font-medium text-xs"
                  >
                    <option value="gemini">Gemini (Phân tích mộc bản, điển tích tốt nhất)</option>
                    <option value="chatgpt">ChatGPT (Lôi cuốn, dẫn chuyện phong cách)</option>
                    <option value="local">Local AI (Trả lời ngắn nhanh)</option>
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
                    <option value="gemini">Gemini (Xử lý đa dạng câu hỏi con cháu)</option>
                    <option value="chatgpt">ChatGPT (Trả lời mạch lạc, lịch sự tột bậc)</option>
                    <option value="local">Local AI (Phản hồi mộc mạc tiết kiệm)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* API key state indications */}
            <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-[10.5px] text-stone-500 space-y-2 select-none font-bold">
              <p className="uppercase text-stone-400 text-[10px] tracking-wider flex items-center gap-1">
                <Cpu className="h-3.5 w-3.5 text-stone-500" />
                Tổng quan Kiểm định SDK Máy Chủ hiện hành:
              </p>
              <div className="grid grid-cols-2 gap-2 text-stone-650 font-normal">
                <p>Khóa GEMINI_API_KEY: <strong className="text-emerald-700">✓ Đã tiêm nạp an toàn (.env.example)</strong></p>
                <p>Dịch vụ truyền tải: <strong className="text-emerald-700">✓ Trực tuyến (Active)</strong></p>
                <p>Thành diệu hồi đáp: <strong className="text-stone-700">Chữ Hán phả, chữ quốc âm, văn sớ</strong></p>
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
                Sắc Phong & Quản Lý Phân Quyền Thành Viên
              </h3>
              <p className="text-[11px] text-stone-500">
                Lập danh sắc phái thọ, sắc phong vai trò trị sự (Admin, Thủ Quỹ, Biên Tập Viên, Đinh Viên) và duyệt trạng thái KYC con cháu dòng tộc.
              </p>
            </div>
            {currentUser.role === "admin" && (
              <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded px-2.5 py-1 text-[10px] font-bold shrink-0 self-start sm:self-center">
                👑 Quyền Admin Trực Hàng
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
                    ⚠️ Ổ khóa Cấm Sử - Quyền Hạn Khuyết Vị
                  </h4>
                  <p className="text-stone-500 leading-relaxed text-[11px]">
                    Cực kỳ bảo mật! Chỉ có <strong className="text-red-900">Ban Trị Sự Chánh Tổng Quản (Admin)</strong> mới sở hữu đặc cách sắc gán phong vai trò, duyệt trạng thái đồng bộ số Zalo gia tộc.
                  </p>
                  <p className="text-[10px] text-stone-400 bg-stone-50 p-3 rounded-lg border border-stone-150 italic mt-3">
                    Bản tôn hiện đang đăng sớ trải nghiệm dưới danh phận <strong className="text-stone-700">{currentUser.fullName}</strong> có đặc quyền <strong className="text-red-900">[{currentUser.role}]</strong>. Hãy nhấn dùng thanh gạt "Mô phỏng Phân Quyền" ở sát đầu trang để nhập vai Admin để mở khóa tính năng đặc cách này!
                  </p>
                </div>
              </div>
            ) : (
              /* Admin User Matrix Interface */
              <div className="space-y-4">
                <div className="bg-[#fcfbf9] border border-stone-150 p-3.5 rounded-lg text-[11px] leading-relaxed text-stone-600">
                  <p className="font-semibold text-stone-800">💡 Chỉ dẫn Chánh quản sự dòng họ:</p>
                  <p className="mt-0.5">Trực tiếp gán vai trò sự vụ cho từng thành viên đinh bối. Mỗi vai trò quy định quyền hạn biên tu sớ tế riêng biệt. Hãy nhấn gạt trạng thái để kích hoạt hoặc hủy liên kết Zalo KYC nhanh cho con cháu.</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-stone-700">
                    <thead>
                      <tr className="text-stone-400 border-b border-stone-100 pb-2">
                        <th className="py-2.5 px-3 font-semibold">Bản Đinh / Tộc nhân</th>
                        <th className="py-2.5 font-semibold">Tài khoản liên kết</th>
                        <th className="py-2.5 font-semibold">Số điện thoại Zalo</th>
                        <th className="py-2.5 font-semibold">Vai trò gán sắc</th>
                        <th className="py-2.5 font-semibold">Trạng thái KYC</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Thao tác trị sự</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {usersList.map((u) => (
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
                                { val: "admin", label: "👑 Chánh Tổng Quản (Admin)" },
                                { val: "treasurer", label: "💰 Thủ Quỹ Gia Tộc (Treasurer)" },
                                { val: "writer", label: "✍️ Sử Biên Ký (Writer)" },
                                { val: "secretary", label: "📝 Thư Ký Họ (Secretary)" },
                                { val: "user", label: "👥 Đinh Viên (User)" }
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
                                            alert("⚠️ Tộc nhân phải có ít nhất một chức sự!");
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
                              {u.isKYCed ? "✓ Đã Xác thực KYC" : "○ Chưa Xác thực"}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateUserKYC(u.id, !u.isKYCed);
                                alert(`Đã ${!u.isKYCed ? "Xác nhận duyệt KYC thành công liên kết Zalo" : "Gỡ bỏ xác thực KYC"} cho quý bối ${u.fullName}!`);
                              }}
                              className={`rounded px-2 md:px-2.5 py-1 text-[10px] font-bold cursor-pointer ${
                                u.isKYCed 
                                  ? "bg-stone-100 text-stone-600 hover:bg-stone-200" 
                                  : "bg-red-800 text-white hover:bg-red-900"
                              }`}
                            >
                              {u.isKYCed ? "Gỡ KYC" : "Duyệt KYC phả đồ"}
                            </button>
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
