import React, { useState } from "react";
import { Landmark, Users, Calendar, Award, ShieldCheck, Heart, Menu, X, HelpCircle, Activity, MessageSquare, FileText, Settings } from "lucide-react";
import { UserSession } from "../types";

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  serverHealth: boolean;
  currentUser: UserSession;
}

export default function Sidebar({ activeTab, onSelectTab, serverHealth, currentUser }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    { id: "overview", name: "Tổng quan điện thờ", icon: Landmark },
    { id: "tree", name: "Gia phả phả hệ tộc đồ", icon: Users },
    { id: "events", name: "Lịch lễ nghi cúng giỗ", icon: Calendar },
    { id: "finance", name: "Sổ sách thu chi thủ quỹ", icon: Award },
    { id: "ai", name: "Văn tế & Hán Nôm AI", icon: Heart },
    { id: "zalo", name: "Quản lý Zalo Bot", icon: MessageSquare },
    { id: "articles", name: "Quản lý Bài viết", icon: FileText },
    { id: "settings", name: "Cấu hình chung", icon: Settings },
  ];

  const handleNavClick = (id: string) => {
    onSelectTab(id);
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="lg:hidden bg-red-950 text-white px-4 py-3 flex items-center justify-between border-b border-amber-900/40 shrink-0">
        <div className="flex items-center gap-2">
          {/* Circular Seal Icon SVG */}
          <div className="h-8 w-8 rounded-full bg-amber-500 flex items-center justify-center text-red-950 font-serif font-extrabold text-xs border border-amber-300">
            Cao
          </div>
          <span className="font-serif font-bold text-xs tracking-wide text-amber-100">
            Họ Cao Ninh Bình
          </span>
        </div>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="rounded-lg p-1 hover:bg-white/10 text-stone-200 transition-all cursor-pointer"
        >
          {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile background overlay when sidebar is open */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/60 z-35 backdrop-blur-xs"
        />
      )}

      {/* Main Sidebar Container (collapsible on mobile, persistent on desktop) */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 transform ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      } lg:translate-x-0 transition-transform duration-300 ease-in-out w-64 bg-[#121212] text-[#e0dacb] border-r border-amber-950/40 flex flex-col justify-between shrink-0 h-full`}>
        
        {/* Upper Part */}
        <div className="space-y-6 px-4 py-6">
          {/* Logo / seal branding section */}
          <div className="text-center space-y-2.5 pb-5 border-b border-stone-800/40">
            {/* Inline SVG Traditional family seal logo */}
            <div className="mx-auto h-16 w-16 rounded-full bg-red-900 border-2 border-amber-500 flex items-center justify-center text-amber-400 font-serif font-black text-xl hover:scale-105 transition-all shadow-md">
              <svg width="40" height="40" viewBox="0 0 100 100" fill="currentColor" className="text-amber-400">
                <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2" />
                <circle cx="50" cy="50" r="41" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2" />
                <text x="50" y="58" fontSize="26" textAnchor="middle" fontWeight="bold" fontFamily="serif">Cao</text>
                {/* Traditional lotus or dragon petal SVG details */}
                <path d="M50 15 A5 5 0 0 1 50 25 A5 5 0 0 1 50 15 Z" />
                <path d="M50 75 A5 5 0 0 1 50 85 A5 5 0 0 1 50 75 Z" />
              </svg>
            </div>
            <div>
              <h1 className="font-serif font-extrabold text-sm tracking-widest text-amber-450 text-center uppercase">
                Gia Tộc Cao Ninh Bình
              </h1>
              <p className="text-[10px] text-stone-500 font-medium">Uống nước nhớ nguồn - Lê triều khởi thủy</p>
            </div>
          </div>

          {/* Navigation Links list */}
          <nav className="space-y-1 text-xs">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg border text-left font-semibold tracking-wide cursor-pointer transition-all ${
                    isActive 
                      ? "bg-red-950 border-amber-900/60 text-amber-200 shadow-md font-bold"
                      : "bg-transparent border-transparent text-stone-400 hover:text-white hover:bg-stone-900/30"
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 ${isActive ? "text-amber-400" : "text-stone-500 group-hover:text-stone-300"}`} />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Lower Part / Profile Account widgets */}
        <div className="p-4 space-y-3.5 border-t border-stone-800/40">
          {/* User profile identifier metadata */}
          <div className="bg-red-950/20 p-3 rounded-lg border border-red-900/30 flex gap-2.5 items-center">
            {/* Dynamic avatar letter */}
            <div className="h-8.5 w-8.5 rounded-full bg-red-950 border border-amber-500 text-amber-200 flex items-center justify-center font-bold text-xs shrink-0 select-none">
              {currentUser.fullName ? currentUser.fullName.split(" ").slice(-1)[0]?.substring(0, 2) : "C"}
            </div>
            <div className="text-[10.5px] text-stone-400 leading-tight overflow-hidden">
              <span className="text-amber-100 font-bold block truncate" title={currentUser.fullName}>
                {currentUser.fullName}
              </span>
              <span className="text-[9.5px] text-amber-200 block mt-0.5 truncate font-semibold">
                {(() => {
                  const roles = currentUser.roles || [currentUser.role];
                  const labels = roles.map(r => {
                    if (r === "admin") return "👑 Chánh Tổng Quản";
                    if (r === "writer") return "✍️ Sử Biên Ký";
                    if (r === "treasurer") return "💰 Thủ Quỹ Gia Tộc";
                    if (r === "secretary") return "📝 Thư Ký Họ";
                    return "";
                  }).filter(Boolean);

                  if (labels.length > 0) return labels.join(" & ");
                  return currentUser.isKYCed ? "✓ Đinh Viên Tuyên Đức" : "⏳ Hương Đinh Tự Do";
                })()}
              </span>
            </div>
          </div>

          {/* Server sync status & telemetry alerts */}
          <div className="flex items-center justify-between text-[10px] text-stone-500 px-1 select-none">
            <span className="flex items-center gap-1">
              <Activity className={`h-3 w-3 ${serverHealth ? "text-emerald-500" : "text-amber-500"}`} />
              Đồng bộ dữ tự: {serverHealth ? "Bình khang" : "Khuyết"}
            </span>
            <span>Múi vế: UTC+7</span>
          </div>
        </div>

      </aside>
    </>
  );
}
