import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Calendar, MapPin, User, Plus, FileText, CheckCircle, Clock, AlertCircle, X, Coins, Trash2, Search } from "lucide-react";
import { ClanEvent, FamilyMember } from "../types";

interface EventsProps {
  events: ClanEvent[];
  onAddEvent: (event: ClanEvent) => void;
  onSetActiveTab: (tab: string) => void;
  onSetAIInitialPrompt?: (prompt: string, type: string) => void;
  members?: FamilyMember[];
}

export default function Events({ events, onAddEvent, onSetActiveTab, onSetAIInitialPrompt, members = [] }: EventsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("Tất cả");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deceasedSearch, setDeceasedSearch] = useState("");

  // Form states
  const [newTitle, setNewTitle] = useState("");
  const [newLunarDate, setNewLunarDate] = useState("");
  const [newSolarDate, setNewSolarDate] = useState("");
  const [newLocation, setNewLocation] = useState("Từ Đường Dòng Họ Cao Ninh Bình");
  const [newOrganizer, setNewOrganizer] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCost, setNewCost] = useState(5000000);
  const [newCategory, setNewCategory] = useState<"Cúng Giỗ" | "Họp Họ" | "Khánh Thành" | "Khuyến Học" | "Khác">("Cúng Giỗ");

  const categories = ["Tất cả", "Cúng Giỗ", "Họp Họ", "Khánh Thành", "Khuyến Học", "Khác"];

  // Filtered events
  const filteredEvents = events.filter(e => {
    return selectedCategory === "Tất cả" || e.category === selectedCategory;
  });

  // Calculate stats
  const pendingCount = events.filter(e => e.status !== "Đã hoàn thành").length;
  const completedCount = events.length - pendingCount;
  const totalCostOfYear = events.reduce((sum, e) => sum + e.estimatedCost, 0);

  const formatVND = (value: number) => {
    return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
  };

  const handleCreateAISpeech = (event: ClanEvent) => {
    if (onSetAIInitialPrompt) {
      const customPrompt = `Hãy soạn thảo một bài sớ văn cúng khấn bái trang nghiêm, trang kính bằng tiếng Việt truyền thống cho sự kiện: "${event.title}".
      Được tổ chức vào ngày Âm lịch: ${event.lunarDate} (Dương lịch tương ứng là ${event.solarDate}).
      Nơi hành đàn tế lễ: ${event.location}.
      Thừa tế chủ trì tuyên sớ: ${event.organizer}.
      Mục đích dâng lễ tế: ${event.description}.
      Chúc cầu cho gia sự cát lợi, con cháu dồi dào sức khỏe, khai trí tuệ học hành hanh thông cát báo.`;
      
      onSetAIInitialPrompt(customPrompt, "ceremony");
      onSetActiveTab("ai");
    }
  };

  const handleSubmitted = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const event: ClanEvent = {
      id: "ev_" + Date.now(),
      title: newTitle,
      lunarDate: newLunarDate,
      solarDate: newSolarDate,
      location: newLocation,
      organizer: newOrganizer,
      description: newDescription,
      estimatedCost: Number(newCost),
      status: "Đang chuẩn bị",
      category: newCategory
    };

    onAddEvent(event);
    
    // Reset Form
    setNewTitle("");
    setNewLunarDate("");
    setNewSolarDate("");
    setNewOrganizer("");
    setNewDescription("");
    setNewCost(5000000);
    setIsAddOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Event Stats grid details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* KPI 1 */}
        <div className="bg-white p-4.5 rounded-xl border border-stone-150 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-stone-400 font-semibold block text-[11px] uppercase tracking-wider">Đang Chuẩn Bị</span>
            <p className="text-2xl font-bold font-serif text-amber-900">{pendingCount} Nghi lễ</p>
            <span className="text-[10px] text-stone-500 block">Tiến lễ sắm lễ chuẩn bị nghiêm khang</span>
          </div>
          <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100 shrink-0">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white p-4.5 rounded-xl border border-stone-150 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-stone-400 font-semibold block text-[11px] uppercase tracking-wider">Lễ Sự Hoàn Thành</span>
            <p className="text-2xl font-bold font-serif text-stone-800">{completedCount} Sự kiện</p>
            <span className="text-[10px] text-stone-500 block">Hương khói tạ tổ ấm êm nhân tâm</span>
          </div>
          <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 shrink-0">
            <CheckCircle className="h-5 w-5" />
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white p-4.5 rounded-xl border border-stone-150 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-stone-400 font-semibold block text-[11px] uppercase tracking-wider">Tổng Chi Sự Nghiệp Lễ</span>
            <p className="text-lg font-mono font-extrabold text-stone-800">{formatVND(totalCostOfYear)}</p>
            <span className="text-[10px] text-stone-500 block">Dự toán cả niên độ cúng bái dòng tộc</span>
          </div>
          <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100 shrink-0">
            <Coins className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Main Events list screen */}
      <div className="bg-white rounded-xl border border-stone-150 shadow-sm p-4.5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
          <div>
            <h2 className="text-lg font-serif font-semibold text-stone-850">
              Lịch Sự Kiện & Tế Lễ Tổ Từ
            </h2>
            <p className="text-xs text-stone-500">
              Toàn bộ lịch họp mặt dòng họ, ngày tạ thế kỵ giỗ của tổ tông ba chi.
            </p>
          </div>
          <button 
            onClick={() => setIsAddOpen(true)}
            className="inline-flex self-start sm:self-center items-center gap-1 bg-red-800 hover:bg-red-950 text-white rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer shadow transition-all"
          >
            <Plus className="h-3.5 w-3.5" /> Ghi Lịch Sự Kiện
          </button>
        </div>

        {/* Filters and List */}
        <div className="flex flex-wrap gap-1 border-b border-stone-50 pb-2.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer transition-all ${
                selectedCategory === cat 
                  ? "bg-red-900 border-red-900 text-white shadow-sm"
                  : "bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-150"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Display Events and Announcements */}
        <div className="space-y-4">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-10 bg-stone-50 rounded-lg border border-dashed border-stone-250">
              <AlertCircle className="h-8 w-8 text-stone-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-stone-700">Chưa có lịch tế lễ, họp tộc tương ứng</p>
              <p className="text-xs text-stone-400 mt-1">Xin mời Quý trị sự tuyển lập thêm lịch sự kiện mới.</p>
            </div>
          ) : (
            filteredEvents.map((e) => (
              <div 
                key={e.id}
                className="group border border-stone-150 rounded-xl bg-stone-50/50 hover:bg-white p-5 hover:shadow-md transition-all flex flex-col md:flex-row gap-5 items-start justify-between"
              >
                {/* Event core info */}
                <div className="space-y-3.5 grow">
                  {/* Category badget & status badget */}
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold">
                    <span className="rounded-full bg-red-50 text-red-800 border border-red-100 px-2.5 py-0.5 uppercase tracking-wide">
                      {e.category}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 ${
                      e.status === "Đã hoàn thành" 
                        ? "bg-emerald-50 text-emerald-800 border-emerald-100" 
                        : e.status === "Đang chuẩn bị"
                        ? "bg-amber-50 text-amber-800 border-amber-100"
                        : "bg-blue-50 text-blue-800 border-blue-100"
                    }`}>
                      {e.status}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div className="space-y-1.5">
                    <h3 className="text-base font-bold font-serif text-stone-850 group-hover:text-red-900 transition-colors">
                      {e.title}
                    </h3>
                    <p className="text-xs text-stone-600 leading-relaxed max-w-3xl">
                      {e.description}
                    </p>
                  </div>

                  {/* Metadata coordinates */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs text-stone-600 font-medium">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-amber-800" />
                      <div>
                        <p className="text-[10px] text-stone-400 leading-none">Lịch Âm / Dương:</p>
                        <span className="text-stone-800 font-semibold">{e.lunarDate}</span> / <span className="text-stone-500 text-[11px] font-mono">{e.solarDate}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-stone-500" />
                      <div>
                        <p className="text-[10px] text-stone-400 leading-none">Địa điểm tổ tiên:</p>
                        <span className="text-stone-850 line-clamp-1">{e.location}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <User className="h-4 w-4 text-stone-500" />
                      <div>
                        <p className="text-[10px] text-stone-400 leading-none">Trực Sự điều phối:</p>
                        <span className="text-stone-800 line-clamp-1">{e.organizer}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Event budget and fast AI action buttons */}
                <div className="shrink-0 w-full md:w-48 bg-stone-50 p-4 rounded-xl border border-stone-150 flex flex-col justify-between self-stretch gap-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-stone-400 uppercase font-bold text-center block leading-none">Giá trị dự toán</span>
                    <p className="text-base text-stone-850 font-bold font-mono text-center leading-snug">
                      {formatVND(e.estimatedCost)}
                    </p>
                  </div>
                  
                  <button 
                    onClick={() => handleCreateAISpeech(e)}
                    className="w-full inline-flex items-center justify-center gap-1.5 bg-red-800 hover:bg-neutral-900 hover:text-white text-white border border-red-800 hover:border-neutral-900 rounded-lg py-2 text-xs font-bold transition-all cursor-pointer shadow-sm group"
                  >
                    <FileText className="h-3.5 w-3.5 text-amber-400 group-hover:scale-105 transition-all" /> Soạn Sớ Văn tế AI
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* SỔ LỊCH GIỖ HUYẾT THỐNG TIÊN LINH */}
      <div className="bg-white rounded-xl border-2 border-amber-900/10 shadow-sm p-4.5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
          <div>
            <h2 className="text-lg font-serif font-bold text-amber-950 flex items-center gap-1.5">
              <Calendar className="h-5 w-5 text-amber-800" />
              Sổ Kỳ Giỗ Gia Tộc & Đại Thờ Thần Chủ
            </h2>
            <p className="text-xs text-stone-500">
              Danh sớ kỵ nhật của hương linh tổ khảo ba phái giúp ban phụ tế chuẩn kỵ soạn sớ kịp kỵ thần lễ.
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-stone-400 pointer-events-none" />
            <input 
              type="text" 
              placeholder="Sách tra ngày giỗ tổ..." 
              value={deceasedSearch}
              onChange={(e) => setDeceasedSearch(e.target.value)}
              className="bg-stone-50 border border-stone-200 rounded-lg pl-9 pr-3.5 py-1.5 text-xs text-stone-800 focus:outline-none focus:border-amber-400 w-48 sm:w-56"
            />
          </div>
        </div>

        {/* List ancestral deaths */}
        {(() => {
          const deceasedInTree = members.filter(m => m.isDeceased && m.deathAnniversaryLunar);
          const filteredDeceased = deceasedInTree.filter(m => 
            m.name.toLowerCase().includes(deceasedSearch.toLowerCase()) ||
            (m.deathAnniversaryLunar && m.deathAnniversaryLunar.toLowerCase().includes(deceasedSearch.toLowerCase()))
          );

          if (filteredDeceased.length === 0) {
            return (
              <div className="text-center py-8 text-stone-400 font-serif italic text-xs">
                Chưa có sớ linh kỵ nhật trùng khớp với thông số tra cứu.
              </div>
            );
          }

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-72 overflow-y-auto pr-1">
              {filteredDeceased.map((m) => (
                <div 
                  key={m.id}
                  className="p-3.5 rounded-lg border border-amber-200/50 bg-amber-50/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left hover:bg-amber-50/25 transition-all text-xs"
                >
                  <div className="space-y-1">
                    <p className="font-serif font-black text-red-950 flex items-center gap-1.5">
                      {m.name} 
                      <span className="rounded bg-amber-100 text-amber-900 border border-amber-250 font-sans font-bold text-[8.5px] px-1 py-0.2 shrink-0">
                        ĐỜI {m.generation}
                      </span>
                    </p>
                    <p className="text-[11px] text-stone-600 font-medium">Chi phái: <strong className="text-stone-850 font-bold">{m.branch}</strong></p>
                    <p className="text-[11px] font-bold text-amber-850">
                      🗓️ Kỵ bát nhật: <strong className="font-extrabold">{m.deathAnniversaryLunar}</strong> {m.deathYear ? `(Mất năm ${m.deathYear})` : ""}
                    </p>
                    {m.graveLocation && (
                      <p className="text-[10px] text-stone-400 font-mono">📍 Huyệt thần: {m.graveLocation}</p>
                    )}
                  </div>

                  <button 
                    type="button"
                    onClick={() => {
                      if (onSetAIInitialPrompt) {
                        const customPrompt = `Hãy kính soạn bài văn sớ cúng kỵ nhật trang trọng, cầu kỳ bằng Quốc ngữ tôn kính chân thành bày tỏ tấm lòng thành nhang khói dâng lên đức tiên tổ:\n\nVọng linh: Cụ \${m.name} (Đời thứ \${m.generation}, thuộc chi phái \${m.branch}).\nNgày giỗ tế tạ Âm lịch cổ truyền: \${m.deathAnniversaryLunar}.\nMộ lăng yên táng tại địa dốc: \${m.graveLocation || "Long huyệt quê đường"}.\n\nNguyện cầu vong linh đức Tiền bối phò hộ độ trì gia tông con hiền cháu thảo, đỗ đạt cử khoa, đời đời hương khói không vơi lẻ.`;
                        onSetAIInitialPrompt(customPrompt, "ceremony");
                        onSetActiveTab("ai");
                      }
                    }}
                    className="self-start sm:self-center bg-red-900 hover:bg-neutral-900 hover:text-white border border-red-900 hover:border-neutral-900 text-white rounded text-[10px] sm:text-xs px-2.5 py-1.5 font-bold cursor-pointer transition-all shrink-0"
                  >
                    Soạn sớ cúng Giỗ AI
                  </button>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      {/* Add Event Modal overlay */}
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
                  Lập Ghi Chép Sự Kiện Họ Tộc Mới
                </h3>
                <button 
                  onClick={() => setIsAddOpen(false)}
                  className="rounded-full hover:bg-white/10 p-1 text-stone-300 transition-all cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form body */}
              <form onSubmit={handleSubmitted} className="p-5 overflow-y-auto space-y-4 text-xs">
                {/* Title */}
                <div className="space-y-1">
                  <label className="font-semibold text-stone-700 block">Tiêu đề sự kiện tế lễ / Đại liên:*</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ví dụ: Lễ hạ sơn tảo mộ rặng trâm Hoa Lư" 
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 text-xs"
                  />
                </div>

                {/* Lunar versus Solar Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Ngày Âm lịch truyền thống:*</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Mùng 10 xuân niên" 
                      value={newLunarDate}
                      onChange={(e) => setNewLunarDate(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Ngày Dương lịch tương ứng:*</label>
                    <input 
                      type="text" 
                      required
                      placeholder="dd/mm/yyyy" 
                      value={newSolarDate}
                      onChange={(e) => setNewSolarDate(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 text-xs"
                    />
                  </div>
                </div>

                {/* Category & Cost */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Phân loại danh phẩm:*</label>
                    <select 
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as any)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800"
                    >
                      <option value="Cúng Giỗ">Cúng Giỗ</option>
                      <option value="Họp Họ">Họp Họ</option>
                      <option value="Khánh Thành">Khánh Thành</option>
                      <option value="Khuyến Học">Khuyến Học</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Dự toán kinh phí đóng góp (VND):*</label>
                    <input 
                      type="number" 
                      required
                      placeholder="5000000" 
                      value={newCost}
                      onChange={(e) => setNewCost(Number(e.target.value))}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850"
                    />
                  </div>
                </div>

                {/* Location & Organizer */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Tế tại tọa lạc (Địa điểm):</label>
                    <input 
                      type="text" 
                      placeholder="Từ đường dòng họ Cao Hoa Lư" 
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Thừa tự điều phối chính:*</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ông Cao Xuân Viết" 
                      value={newOrganizer}
                      onChange={(e) => setNewOrganizer(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850 text-xs"
                    />
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="font-semibold text-stone-700 block">Chi tiết ý chí sự việc cúng khấn dâng kính:*</label>
                  <textarea 
                    rows={3}
                    required
                    placeholder="Tóm tắt chương trình tế bái dâng trướng lễ vật cầu an, công bố báo khuyến học niên tự..." 
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
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
                    Bỏ qua
                  </button>
                  <button 
                    type="submit" 
                    className="bg-red-800 hover:bg-red-950 text-white rounded-lg px-4 py-2 font-semibold transition-all cursor-pointer flex items-center gap-1"
                  >
                    Lập Thể Sớ sự kiện
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
