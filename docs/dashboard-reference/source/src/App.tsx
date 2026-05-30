import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import Overview from "./components/Overview";
import Genealogy from "./components/Genealogy";
import Events from "./components/Events";
import Treasury from "./components/Treasury";
import AIHelper from "./components/AIHelper";
import ZaloManager from "./components/ZaloManager";
import ArticlesManager from "./components/ArticlesManager";
import SettingsManager from "./components/SettingsManager";
import { mockFamilyMembers, mockEvents, mockTransactions, mockOutstandingMembers } from "./data/mockData";
import { FamilyMember, ClanEvent, TreasuryTx, OutstandingMember, WebThemeConfig, AIModelConfig, UserSession, KnowledgeBaseDocument } from "./types";
import { MapPin, HelpCircle, Activity, Sun, Moon, CalendarDays } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [serverHealth, setServerHealth] = useState<boolean>(false);

  // States initialized from high-fidelity mock datasets page-level
  const [members, setMembers] = useState<FamilyMember[]>(mockFamilyMembers);
  const [events, setEvents] = useState<ClanEvent[]>(mockEvents);
  const [transactions, setTransactions] = useState<TreasuryTx[]>(mockTransactions);
  const [outstandingMembers, setOutstandingMembers] = useState<OutstandingMember[]>(mockOutstandingMembers);

  // Pre-seeded system users list for simulating Member KYC matching & OTP checks
  const [usersList, setUsersList] = useState<UserSession[]>([
    {
      id: "usr_1",
      username: "caotien_ninhbinh",
      fullName: "Cao Tiến Trung",
      role: "admin",
      isKYCed: true,
      phone: "0912345678",
      email: "caotientrung@gmail.com",
      regDate: "12/03/2026",
      loginType: "username"
    },
    {
      id: "usr_2",
      username: "bichngoc_882",
      fullName: "Cao Bích Ngọc",
      role: "writer",
      isKYCed: true,
      phone: "0982211333",
      email: "bichngoc@zalo.vn",
      regDate: "14/05/2026",
      loginType: "zalo"
    },
    {
      id: "usr_3",
      username: "caominh_thuyquy",
      fullName: "Cao Minh Vương",
      role: "treasurer",
      isKYCed: true,
      phone: "0901239999",
      email: "vuongcao@gmail.com",
      regDate: "18/05/2026",
      loginType: "email"
    },
    {
      id: "usr_4",
      username: "zalo_770122",
      fullName: "Cao Vũ Phong",
      role: "user",
      isKYCed: false,
      phone: "0888777122",
      email: "vuphong@zalo.vn",
      regDate: "20/05/2026",
      loginType: "zalo"
    }
  ]);

  const [currentUser, setCurrentUser] = useState<UserSession>(usersList[0]);

  // Preloads genealogy references and documents for AI brain contextual querying
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeBaseDocument[]>([
    {
      id: "doc_1",
      title: "Sắc Phong Niên Hiệu Cảnh Hưng Thứ 4",
      category: "Tích cổ triều Lê",
      content: "Tờ sắc chỉ dụ Lê Chiêu Thống phê chiếu cho Cụ Cao Quý Công (Cao Văn Lãm) trấn giữ đạo binh Trường Yên Hoa Lư, phong hàm Thiên Hộ Điện chỉ huy dũng cảm giữ núi sông Ninh Bình.",
      contributor: "Hội Đồng Trị Sự",
      lastUpdated: "12/03/2026"
    },
    {
      id: "doc_2",
      title: "Phả Chí Quyển 3 - Bản Chi Gia Viễn",
      category: "Gia phả học",
      content: "Chép gia phả chi họ Cao tại Thung Lá Gia Viễn khai khẩn ruộng từ triều Lê, hiện phân đinh ra ba nhánh nhỏ, gồm 18 đinh nam tề tựu sơn lăng hàng năm bái Giỗ Tổ.",
      contributor: "Hội Đồng Trị Sự",
      lastUpdated: "25/04/2026"
    }
  ]);

  // Cross-component forwarding pipelines for redirecting quick actions to AI Helper
  const [aiInitialPrompt, setAiInitialPrompt] = useState<string>("");
  const [aiInitialType, setAiInitialType] = useState<string>("");

  // Configuration Settings State
  const [themeConfig, setThemeConfig] = useState<WebThemeConfig>({
    siteName: "Họ Cao Ninh Bình",
    slogan: "Uống nước nhớ nguồn - Lê triều khởi thủy",
    primaryColor: "royal-red",
    fontFamily: "Playfair Display",
    showBanner: true,
    bannerImage: "https://images.unsplash.com/photo-1596436889106-be35e843f974?auto=format&fit=crop&w=800&q=80",
    logoText: "Cao"
  });

  const [aiConfig, setAiConfig] = useState<AIModelConfig>({
    modelName: "gemini-2.5-flash",
    temperature: 0.35,
    systemPrompt: "Bạn là một Trợ lý AI Hán Nôm am hiểu phong tục tập quán lễ nghĩa bái cổ truyền của dòng họ Cao Ninh Bình, chuyên soạn thảo văn sớ và văn hiến gia tự...",
    engineCeremony: "chatgpt",
    engineArticles: "chatgpt",
    engineChat: "gemini",
    engineZalo: "gemini"
  });

  // Check backend server synchronization on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch("/api/health");
        const data = await response.json();
        if (data.status === "healthy") {
          setServerHealth(true);
          console.log("Full-stack administrative Express sync active: OK.");
        }
      } catch (err) {
        console.warn("Express endpoint missing, falling back to local simulation.", err);
        setServerHealth(false);
      }
    };
    checkHealth();
  }, []);

  // CRUD callback triggers
  const handleAddMember = (newMem: FamilyMember) => {
    setMembers((prev) => [newMem, ...prev]);
  };

  const handleBulkImport = (newMems: FamilyMember[], mode: "replace" | "append") => {
    if (mode === "replace") {
      setMembers(newMems);
    } else {
      setMembers((prev) => [...prev, ...newMems]);
    }
  };

  const handleAddEvent = (newEv: ClanEvent) => {
    setEvents((prev) => [newEv, ...prev]);
  };

  const handleAddTransaction = (newTx: TreasuryTx) => {
    setTransactions((prev) => [newTx, ...prev]);
  };

  const handleAddOutstandingMember = (newSch: OutstandingMember) => {
    setOutstandingMembers((prev) => [newSch, ...prev]);
  };

  // Cross-component prompt trigger pipelines
  const handleSetAIInitialPrompt = (prompt: string, type: string) => {
    setAiInitialPrompt(prompt);
    setAiInitialType(type);
  };

  const handleClearAIInitialPrompt = () => {
    setAiInitialPrompt("");
    setAiInitialType("");
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#faf9f5] text-stone-850 h-screen overflow-hidden">
      
      {/* Sidebar navigation */}
      <Sidebar 
        activeTab={activeTab} 
        onSelectTab={setActiveTab} 
        serverHealth={serverHealth} 
        currentUser={currentUser}
      />

      {/* Main content body canvas */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden h-full">
        
        {/* Top Header details containing ancestral coordinates */}
        <header className="bg-white border-b border-amber-900/10 px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            {/* Ninh Binh Location Coordinates */}
            <MapPin className="h-4 w-4 text-red-800" />
            <span className="font-serif font-bold text-stone-880">
              Trụ sở Từ đường: Thôn Trung, xã Trường Yên, Hoa Lư, Ninh Bình
            </span>
          </div>
          
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            {/* Lunar Calendar Placeholder Widget */}
            <div className="flex items-center gap-1.5 bg-[#fbfaf6] px-2.5 py-1 rounded border border-amber-100">
              <CalendarDays className="h-3.5 w-3.5 text-amber-700" />
              <span className="text-stone-700">Tiết Thanh Minh - Hoa Lư linh khí</span>
            </div>

            {/* Simulating active roleplay session switch - EXTREMELY POWERFUL */}
            <div className="flex items-center gap-1.5 bg-red-950/10 p-1 rounded-md border border-amber-900/10 text-[10px] sm:text-[10.5px]">
              <span className="text-red-950 font-black uppercase text-[10px] pl-1.5">🎭 Thử vai sớ:</span>
              <select
                value={currentUser.id}
                onChange={(e) => {
                  const selectedU = usersList.find(u => u.id === e.target.value);
                  if (selectedU) {
                    setCurrentUser(selectedU);
                  }
                }}
                className="bg-white border border-amber-900/20 rounded px-1 text-[10px] text-stone-850 font-bold focus:outline-none cursor-pointer"
              >
                {usersList.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.role.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            {/* Status Sync */}
            <div className="hidden md:flex items-center gap-1 text-[10px]">
              <span className={`h-1.5 w-1.5 rounded-full ${serverHealth ? "bg-emerald-600 animate-pulse" : "bg-amber-500"}`} />
              <span className="text-stone-500 uppercase tracking-widest text-[8.5px] font-bold">
                {serverHealth ? "Máy chủ: MỞ" : "Máy chủ: KHUÝN"}
              </span>
            </div>
          </div>
        </header>

        {/* Dynamic Inner Tab Viewport */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-12">
          <div className="max-w-7xl mx-auto h-full">
            {activeTab === "overview" && (
              <Overview 
                onSetActiveTab={setActiveTab} 
                onSetAIInitialPrompt={handleSetAIInitialPrompt}
                members={members}
                events={events}
                transactions={transactions}
                outstandingMembers={outstandingMembers}
              />
            )}

            {activeTab === "tree" && (
              <Genealogy 
                members={members} 
                onAddMember={handleAddMember} 
                onBulkImport={handleBulkImport}
              />
            )}

            {activeTab === "events" && (
              <Events 
                events={events} 
                onAddEvent={handleAddEvent}
                onSetActiveTab={setActiveTab}
                onSetAIInitialPrompt={handleSetAIInitialPrompt}
                members={members}
              />
            )}

            {activeTab === "finance" && (
              <Treasury 
                transactions={transactions} 
                outstandingMembers={outstandingMembers}
                onAddTransaction={handleAddTransaction}
                onAddOutstandingMember={handleAddOutstandingMember}
                currentUser={currentUser}
              />
            )}

            {activeTab === "ai" && (
              <AIHelper 
                initialPrompt={aiInitialPrompt}
                initialType={aiInitialType}
                onClearInitialPrompt={handleClearAIInitialPrompt}
                currentUser={currentUser}
                knowledgeDocs={knowledgeDocs}
                onKnowledgeDocsChange={setKnowledgeDocs}
              />
            )}

            {activeTab === "zalo" && (
              <ZaloManager 
                members={members} 
                currentUser={currentUser}
                usersList={usersList}
                onUpdateUsersList={setUsersList}
              />
            )}

            {activeTab === "articles" && (
              <ArticlesManager aiConfig={aiConfig} />
            )}

            {activeTab === "settings" && (
              <SettingsManager 
                themeConfig={themeConfig}
                onThemeConfigChange={setThemeConfig}
                aiConfig={aiConfig}
                onAIConfigChange={setAiConfig}
                currentUser={currentUser}
                usersList={usersList}
                onUpdateUserRole={(userId, newRole, newRoles) => {
                  const updated = usersList.map(u => u.id === userId ? { ...u, role: newRole, roles: newRoles } : u);
                  setUsersList(updated);
                  const updatedCU = updated.find(u => u.id === currentUser.id);
                  if (updatedCU) setCurrentUser(updatedCU);
                }}
                onUpdateUserKYC={(userId, isKYCed) => {
                  const updated = usersList.map(u => u.id === userId ? { ...u, isKYCed } : u);
                  setUsersList(updated);
                  const updatedCU = updated.find(u => u.id === currentUser.id);
                  if (updatedCU) setCurrentUser(updatedCU);
                }}
              />
            )}
          </div>
        </div>
      </main>

    </div>
  );
}
