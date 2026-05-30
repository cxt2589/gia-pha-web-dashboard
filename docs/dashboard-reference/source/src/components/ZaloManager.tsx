import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquare, Users, Send, Settings, Radio, CheckCircle, Zap, Clock, ShieldAlert, Bot, Plus, Trash2, Search, X, RefreshCw, Edit, Sparkles, AlertCircle } from "lucide-react";
import { ZaloUser, ZaloAutoReply, ZaloBroadcast, FamilyMember, UserSession, KnowledgeBaseDocument } from "../types";

interface ZaloManagerProps {
  members?: FamilyMember[];
  currentUser: UserSession;
  usersList: UserSession[];
  onUpdateUsersList: (users: UserSession[]) => void;
  knowledgeDocs?: KnowledgeBaseDocument[];
}

export default function ZaloManager({ 
  members = [], 
  currentUser, 
  usersList, 
  onUpdateUsersList,
  knowledgeDocs = []
}: ZaloManagerProps) {
  const [activeSubTab, setActiveSubTab] = useState<"subscribers" | "bot" | "broadcast" | "api">("subscribers");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Simulated Zalo Subscribers (with seeded links)
  const [subscribers, setSubscribers] = useState<ZaloUser[]>([
    { id: "z1", name: "Cao Văn Thịnh", phone: "0912345678", branch: "Chi Thứ Hai (Yên Khánh)", regDate: "28/05/2026", status: "Đang hoạt động", linkedMemberId: "m_11", relationship: "Con cháu trong họ", notes: "Trực hệ Chi Thứ Hai, cán bộ kỹ thuật nông nghiệp", group: "Thanh niên họ" },
    { id: "z2", name: "Cao Tiến Đạt", phone: "0987112345", branch: "Chi Trưởng (Trường Yên)", regDate: "25/05/2026", status: "Đang hoạt động", linkedMemberId: "m_1", relationship: "Bản thân", notes: "Thủ Quỹ, trưởng ban liên lạc Chi Trưởng", group: "Ngành trưởng" },
    { id: "z3", name: "Cao Thị Huyền Trang", phone: "0904432198", branch: "Chi Trưởng (Trường Yên)", regDate: "24/05/2026", status: "Đang hoạt động", notes: "Kế toán sự vụ, hỗ trợ tổng kê", group: "Thanh niên họ" },
    { id: "z4", name: "Cao Xuân Hưng", phone: "0888544332", branch: "Chi Thứ Ba (Gia Sinh)", regDate: "20/05/2026", status: "Đang hoạt động", notes: "Doanh nhân địa phương, tài trợ lăng bia", group: "Ngành cụ" },
    { id: "z5", name: "Cao Minh Nhật", phone: "0934111333", branch: "Chi Thứ Ba (Gia Sinh)", regDate: "29/05/2026", status: "Chờ duyệt", notes: "Sinh viên năm 3 ĐHQG Hà Nội", group: "Thanh niên họ" },
    { id: "z6", name: "Cao Thị Lan", phone: "0345123987", branch: "Chi Trưởng (Trường Yên)", regDate: "15/05/2026", status: "Đang hoạt động", notes: "Cháu gái tạ gia", group: "Khác" }
  ]);

  // Editing modal state buffers
  const [editingSub, setEditingSub] = useState<ZaloUser | null>(null);
  const [subEditName, setSubEditName] = useState("");
  const [subEditPhone, setSubEditPhone] = useState("");
  const [subEditBranch, setSubEditBranch] = useState("");
  const [subEditStatus, setSubEditStatus] = useState<"Đang hoạt động" | "Chờ duyệt" | "Đã chặn">("Đang hoạt động");
  const [subEditLinkedMemberId, setSubEditLinkedMemberId] = useState("");
  const [subEditRelationship, setSubEditRelationship] = useState("");
  const [subEditNotes, setSubEditNotes] = useState("");

  const openEditSubModal = (sub: ZaloUser) => {
    setEditingSub(sub);
    setSubEditName(sub.name);
    setSubEditPhone(sub.phone);
    setSubEditBranch(sub.branch);
    setSubEditStatus(sub.status);
    setSubEditLinkedMemberId(sub.linkedMemberId || "");
    setSubEditRelationship(sub.relationship || "Bản thân");
    setSubEditNotes(sub.notes || "");
    setSubEditGroup(sub.group || "Thanh niên họ");
  };

  const handleSaveSubEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSub) return;

    setSubscribers(prev => prev.map(s => {
      if (s.id === editingSub.id) {
        return {
          ...s,
          name: subEditName,
          phone: subEditPhone,
          branch: subEditBranch,
          status: subEditStatus,
          linkedMemberId: subEditLinkedMemberId || undefined,
          relationship: subEditRelationship || undefined,
          notes: subEditNotes || undefined,
          group: subEditGroup
        };
      }
      return s;
    }));

    setEditingSub(null);
  };

  // Chatbot Auto Reply Triggers
  const [rules, setRules] = useState<ZaloAutoReply[]>([
    { id: "r1", keyword: "lichsu", replyType: "text", replyContent: "Họ Cao Ninh Bình có khởi tổ từ Cụ Cao Quý Công (Húy Văn Lãm), tiền triều hầu đệ tam phẩm Lê triều. Cụ di cư lập trạch sinh nhân tại Trường Yên hơn 300 năm trước. Hiện nay con cháu đã truyền đến đời thứ 8...", usageCount: 142, isActive: true },
    { id: "r2", keyword: "giado", replyType: "card", replyContent: "Lịch lễ nghi Đại giỗ họ sắp tới: Lễ Giỗ tổ Thủy tổ Cao Quý Công diễn ra tại thượng điện Từ đường Thôn Trung, Trường Yên, Hoa Lư vào ngày rằm tháng 3 âm lịch (15/3 âm lịch). Kính mời toàn tộc đinh về tụ họp đông đủ.", usageCount: 94, isActive: true },
    { id: "r3", keyword: "donggop", replyType: "text", replyContent: "Kính thưa quý tộc đinh hào hiệp, quý vị có thể phát tâm quyên dâng trùng tu ngôi Từ đường hoặc ủng hộ quỹ khuyến học niên khóa mới qua Tài khoản dòng họ hoặc nộp trực tiếp tại Thủ Quỹ (Cụ Cao Tiến Đạt - Chi Trưởng).", usageCount: 65, isActive: true },
    { id: "r4", keyword: "lienhe", replyType: "text", replyContent: "Ban trị sự hội đồng gia tộc Cao Ninh Bình. Địa chỉ: Thôn Trung, xã Trường Yên, Hoa Lư, Ninh Bình. SĐT liên hệ Trưởng Ban tổ chức nghi lễ: Ông Cao Xuân Viết - Chi Trưởng.", usageCount: 22, isActive: true }
  ]);

  // Historical Broadcast notifications sent
  const [broadcasts, setBroadcasts] = useState<ZaloBroadcast[]>([
    { id: "b1", title: "Kêu gọi đóng góp ủng hộ Trùng tu Hữu vu", sentDate: "26/05/2026", recipientsCount: 125, content: "Kêu gọi con cháu ba chi chung tay phát tâm dâng gạch hiến cát trùng tu lại ngôi Hữu vu trưng bày thư viện di sản và bia mộc bản họ Cao Ninh Bình.", category: "Lời kêu gọi trùng tu" },
    { id: "b2", title: "Thông tri tập trung Tảo mộ tế xuân đầu khóa", sentDate: "10/05/2026", recipientsCount: 110, content: "Kế hoạch toàn bộ ban trị sự tụ họp tại Lăng Thủy Tổ Gia Viễn thắp nhang tạ mộ sắm sửa hương linh cho tuần tạ mộ mới khang trang.", category: "Thông báo cúng giỗ" }
  ]);

  // Form states
  const [newKeyword, setNewKeyword] = useState("");
  const [newReplyContent, setNewReplyContent] = useState("");
  const [isAddRuleOpen, setIsAddRuleOpen] = useState(false);

  // Broadcast campaign form
  const [bcTitle, setBcTitle] = useState("");
  const [bcCategory, setBcCategory] = useState<any>("Thông báo cúng giỗ");
  const [bcContent, setBcContent] = useState("");
  const [bcFrequency, setBcFrequency] = useState<"Gửi một lần" | "Hàng tuần" | "Hàng tháng">("Gửi một lần");
  const [bcScheduleTime, setBcScheduleTime] = useState("29/05/2026 18:00");
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isAiGeneratingCampaign, setIsAiGeneratingCampaign] = useState(false);
  
  // Custom Broadcast targeting states
  const [bcTargetType, setBcTargetType] = useState<"all" | "group" | "individual">("all");
  const [bcTargetGroup, setBcTargetGroup] = useState<string>("Thanh niên họ");
  const [bcTargetUserId, setBcTargetUserId] = useState<string>("");

  // Custom Groups state
  const [zaloGroups, setZaloGroups] = useState<string[]>(["Thanh niên họ", "Ngành trưởng", "Ngành cụ", "Ban trị sự", "Khác"]);
  const [newGroupNameInput, setNewGroupNameInput] = useState("");
  const [isGroupManagerOpen, setIsGroupManagerOpen] = useState(false);

  // Manual subscriber registration form states
  const [isAddSubOpen, setIsAddSubOpen] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [newSubPhone, setNewSubPhone] = useState("");
  const [newSubBranch, setNewSubBranch] = useState("Chi Trưởng (Trường Yên)");
  const [newSubGroup, setNewSubGroup] = useState("Thanh niên họ");
  const [newSubLinkedMemberId, setNewSubLinkedMemberId] = useState("");
  const [newSubRelationship, setNewSubRelationship] = useState("Bản thân");
  const [newSubNotes, setNewSubNotes] = useState("");

  const [subEditGroup, setSubEditGroup] = useState("Thanh niên họ");

  // Zalo Bot Simulator State
  const [simText, setSimText] = useState("");
  const [simChat, setSimChat] = useState<Array<{ sender: "user" | "bot"; text: string }>>([
    { sender: "bot", text: "Kính chào Quý bối! Đây là hộp cát mô phỏng Zalo Bot họ Cao. Hãy gõ từ khóa tự động như 'lichsu', 'giado', 'donggop', hoặc 'lienhe' để trải nghiệm phản hồi tự động." }
  ]);

  // Zalo config
  const [appId, setAppId] = useState("4589028471203");
  const [secretKey, setSecretKey] = useState("••••••••••••••••••••••••••••");
  const [oaId, setOaId] = useState("OA-982345100021-CaoNB");
  const [webhookUrl, setWebhookUrl] = useState("https://hocaoninhbinh.vn/api/zalo-webhook");
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Filter subscribers
  const filteredSubs = useMemo(() => {
    return subscribers.filter(s => 
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      s.branch.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [subscribers, searchTerm]);

  // Handle auto responding simulation
  const handleSimSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!simText.trim()) return;

    const input = simText.trim();
    const cleanInput = input.toLowerCase().replace(/[^a-z0-9]/g, "");
    
    // Add User message
    const updatedChat = [...simChat, { sender: "user", text: input }];
    setSimChat(updatedChat);
    setSimText("");

    // Look for keyword in rules
    setTimeout(() => {
      const matchedRule = rules.find(r => r.keyword.toLowerCase() === cleanInput && r.isActive);
      let reply = "";
      if (matchedRule) {
        reply = matchedRule.replyContent;
        // Increment usage count in rule state (simulate)
        setRules(prev => prev.map(r => r.id === matchedRule.id ? { ...r, usageCount: r.usageCount + 1 } : r));
      } else {
        reply = `Rất tiếc Zalo Bot chưa tìm thấy tài liệu phù hợp cho từ khóa "${input}". Quý bối hãy nhập một trong các từ khóa có sẵn để robot phục vụ: "lichsu", "giado" (lịch tế lễ), "donggop" (ủng hộ tạ tổ), "lienhe" (Ban trị sự).`;
      }
      setSimChat(prev => [...prev, { sender: "bot", text: reply }]);
    }, 600);
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim() || !newReplyContent.trim()) return;

    const newRule: ZaloAutoReply = {
      id: "r_" + Date.now(),
      keyword: newKeyword.trim().toLowerCase(),
      replyType: "text",
      replyContent: newReplyContent,
      usageCount: 0,
      isActive: true
    };

    setRules(prev => [newRule, ...prev]);
    setNewKeyword("");
    setNewReplyContent("");
    setIsAddRuleOpen(false);
  };

  const handleAddNewManualSub = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName.trim() || !newSubPhone.trim()) {
      alert("⚠️ Kính báo Trị sự, vui lòng điền đầy đủ Họ và tên con cháu kèm Số Zalo liên lạc!");
      return;
    }

    // Check telephone redundancy to ensure strict KYC checks:
    const isDuplicatePhone = subscribers.some(s => s.phone === newSubPhone.trim());
    if (isDuplicatePhone) {
      alert(`⚠️ Số điện thoại Zalo [${newSubPhone.trim()}] này đã đăng ký trên robot hệ thống!`);
      return;
    }

    const newSub: ZaloUser = {
      id: "z_" + Date.now(),
      name: newSubName.trim(),
      phone: newSubPhone.trim(),
      branch: newSubBranch,
      regDate: new Date().toLocaleDateString("vi-VN"),
      status: "Đang hoạt động",
      linkedMemberId: newSubLinkedMemberId || undefined,
      relationship: newSubRelationship || undefined,
      notes: newSubNotes.trim() || undefined,
      group: newSubGroup
    };

    setSubscribers(prev => [newSub, ...prev]);
    setIsAddSubOpen(false);

    // Reset Form fields
    setNewSubName("");
    setNewSubPhone("");
    setNewSubBranch("Chi Trưởng (Trường Yên)");
    setNewSubLinkedMemberId("");
    setNewSubRelationship("Bản thân");
    setNewSubNotes("");

    alert(`✓ Đăng ký thành công dâng số Zalo thủ công cho: ${newSub.name} (${newSub.phone}) - Liên kết lưu trữ gia hệ.`);
  };

  const handleGenerateCampaignWithAI = async () => {
    if (!bcTitle.trim()) {
      alert("⚠️ Kính trình Trị sự, xin vui lòng điền Tiêu đề phát tin trước để AI làm gốc sinh thư tín chính xác!");
      return;
    }
    setIsAiGeneratingCampaign(true);
    try {
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Hãy viết một bức thư thông tri tuyên tín dòng họ nghiêm cẩn của dòng họ Cao Ninh Bình với tiêu đề "${bcTitle}" và nhóm sự vụ văn bản "${bcCategory}". Lời văn gia nghiêm, chân phương cổ truyền, tôn kính lịch sử Hoa Lư Trường Yên, phù hợp để gửi tin nhắn Zalo hàng loạt tới đinh tôn tộc. Giản tiện, giàu tính đồng bào, hiếu học và đoàn kết dòng họ.`,
          type: "zalo_campaign",
          knowledgeDocs: knowledgeDocs // Inject uploaded clan knowledge docs
        })
      });
      const data = await response.json();
      if (data.text) {
        setBcContent(data.text);
      } else {
        throw new Error("Không lấy được sinh từ AI");
      }
    } catch (err) {
      console.warn("Máy chủ AI hán nôm offline, kích hoạt bộ biên soạn thư gia tộc mẫu...", err);
      setBcContent(`Kính gửi quý bối và con cháu họ Cao Ninh Bình,\n\nBan Trị Sự trân trọng thông lạp bản sớ sự vụ: "${bcTitle}".\n\nRất mong toàn tộc hào đinh bớt chút thời gian gia sự tề tựu cúng tiễn đầy đủ hương hoa lễ vật kính dâng lên Thủy Tổ.\n\nTần suất chiến dịch: ${bcFrequency}\nLịch phát sóng: ${bcScheduleTime}\n\nKính chúc gia quyến bình khang!`);
    } finally {
      setIsAiGeneratingCampaign(false);
    }
  };

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bcTitle.trim() || !bcContent.trim()) return;

    if (bcTargetType === "individual" && !bcTargetUserId) {
      alert("⚠️ Kính báo Trị sự, xin vui lòng chọn một đinh tộc nhân cụ thể nhận tin!");
      return;
    }

    setIsBroadcasting(true);
    
    // Simulate API push call with scheduling metrics
    setTimeout(() => {
      let activeSubsCount = 0;
      let targetDesc = "";

      if (bcTargetType === "all") {
        activeSubsCount = subscribers.filter(s => s.status === "Đang hoạt động").length;
        targetDesc = "toàn tổ dòng họ (Đang hoạt động)";
      } else if (bcTargetType === "group") {
        activeSubsCount = subscribers.filter(s => s.status === "Đang hoạt động" && s.group === bcTargetGroup).length;
        targetDesc = `nhóm đinh nhân: "${bcTargetGroup}"`;
      } else {
        const recipient = subscribers.find(s => s.id === bcTargetUserId);
        activeSubsCount = recipient ? 1 : 0;
        targetDesc = `tộc đinh riêng biệt: "${recipient?.name || "Ẩn danh"}"`;
      }

      const newBc: ZaloBroadcast = {
        id: "b_" + Date.now(),
        title: bcTitle + ` [Gửi: ${bcTargetType === "all" ? "Tất cả" : bcTargetType === "group" ? bcTargetGroup : "Cá nhân"}]`,
        sentDate: new Date().toLocaleDateString("vi-VN"),
        recipientsCount: activeSubsCount,
        content: `${bcContent}\n\n[Mục tiêu: ${targetDesc} | Tần suất: ${bcFrequency} | Hẹn giờ: ${bcScheduleTime}]`,
        category: bcCategory
      };

      setBroadcasts(prev => [newBc, ...prev]);
      setBcTitle("");
      setBcContent("");
      setBcTargetUserId("");
      setIsBroadcasting(false);
      alert(`✓ Kính báo! Phát chiến dịch thành công tới ${targetDesc}. Tổng số nhận tin trực tiếp học chế: ${activeSubsCount} đinh tộc nhân.`);
    }, 1500);
  };

  const toggleRuleActive = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r));
  };

  const deleteRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const handleVerifySync = () => {
    setSyncLoading(true);
    setSyncStatus(null);
    setTimeout(() => {
      setSyncLoading(false);
      setSyncStatus("Kết nối với Zalo OA API hoàn tất. Webhook nhận phản hồi bình khang (HTTP 200 OK).");
    }, 1800);
  };

  const toggleSubStatus = (id: string) => {
    setSubscribers(prev => prev.map(s => {
      if (s.id === id) {
        const nextStatus = s.status === "Đang hoạt động" ? "Đã chặn" : "Đang hoạt động";
        return { ...s, status: nextStatus };
      }
      return s;
    }));
  };

  const approveSubscriber = (id: string) => {
    setSubscribers(prev => prev.map(s => s.id === id ? { ...s, status: "Đang hoạt động" } : s));
  };

  const deleteSubscriber = (id: string) => {
    setSubscribers(prev => prev.filter(s => s.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* KPI banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white p-4.5 rounded-xl border border-stone-150 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-stone-400 font-bold block text-[10px] uppercase tracking-wider">Tổng Đăng Ký Bot</span>
            <p className="text-2xl font-bold font-serif text-slate-900">{subscribers.length} Thành viên</p>
            <span className="text-[10px] text-emerald-600 font-semibold block">● {subscribers.filter(s => s.status === 'Đang hoạt động').length} Active</span>
          </div>
          <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100 shrink-0">
            <Users className="h-5 w-5" />
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white p-4.5 rounded-xl border border-stone-150 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-stone-400 font-bold block text-[10px] uppercase tracking-wider">Zalo OA Status</span>
            <p className="text-sm font-bold font-serif text-emerald-700 flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse inline-block" /> Đang hoạt động
            </p>
            <span className="text-[10px] text-stone-400 block">Đã liên kết và cấu hình</span>
          </div>
          <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 shrink-0">
            <Radio className="h-5 w-5" />
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white p-4.5 rounded-xl border border-stone-150 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-stone-400 font-bold block text-[10px] uppercase tracking-wider">Kích hoạt Chatbot</span>
            <p className="text-2xl font-bold font-serif text-amber-900">{rules.length} Từ khóa</p>
            <span className="text-[10px] text-stone-500 block">Rule kích nạp tự động</span>
          </div>
          <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100 shrink-0">
            <Bot className="h-5 w-5" />
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white p-4.5 rounded-xl border border-stone-150 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-stone-400 font-bold block text-[10px] uppercase tracking-wider">Lượt Tương Tác Tự Sự</span>
            <p className="text-2xl font-bold font-mono text-indigo-700">
              {rules.reduce((sum, r) => sum + r.usageCount, 0)} lượt
            </p>
            <span className="text-[10px] text-stone-500 block">Tuần hoàn từ lúc tích hợp</span>
          </div>
          <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100 shrink-0">
            <Zap className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Main Container layout */}
      <div className="bg-white border border-stone-150 shadow-sm rounded-xl overflow-hidden">
        {/* Navigation Tabs for Zalo Management */}
        <div className="flex border-b border-stone-100 bg-stone-50 overflow-x-auto text-xs shrink-0 select-none scrollbar-none font-semibold">
          <button 
            onClick={() => setActiveSubTab("subscribers")}
            className={`px-5 py-3.5 border-b-2 font-bold cursor-pointer transition-all ${
              activeSubTab === "subscribers" 
                ? "border-red-900 text-red-900 bg-white" 
                : "border-transparent text-stone-500 hover:text-stone-850 hover:bg-stone-100/50"
            }`}
          >
            Đăng Ký Con Cháu ({subscribers.length})
          </button>
          <button 
            onClick={() => setActiveSubTab("bot")}
            className={`px-5 py-3.5 border-b-2 font-bold cursor-pointer transition-all ${
              activeSubTab === "bot" 
                ? "border-red-900 text-red-900 bg-white" 
                : "border-transparent text-stone-500 hover:text-stone-850 hover:bg-stone-100/50"
            }`}
          >
            Tự Động Trả Lời & Mô Phỏng Chatbot
          </button>
          <button 
            onClick={() => setActiveSubTab("broadcast")}
            className={`px-5 py-3.5 border-b-2 font-bold cursor-pointer transition-all ${
              activeSubTab === "broadcast" 
                ? "border-red-900 text-red-900 bg-white" 
                : "border-transparent text-stone-500 hover:text-stone-850 hover:bg-stone-100/50"
            }`}
          >
            Phát Tin Truyền Tin Họ Tộc
          </button>
          <button 
            onClick={() => setActiveSubTab("api")}
            className={`px-5 py-3.5 border-b-2 font-bold cursor-pointer transition-all ${
              activeSubTab === "api" 
                ? "border-red-900 text-red-900 bg-white" 
                : "border-transparent text-stone-500 hover:text-stone-850 hover:bg-stone-100/50"
            }`}
          >
            Cấu Hình API Zalo OA
          </button>
        </div>

        {/* Tab contents */}
        <div className="p-5">
          {/* Subtab 1: Subscribers list */}
          {activeSubTab === "subscribers" && (
            <div className="space-y-4 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
                <div>
                  <h3 className="text-sm font-serif font-semibold text-stone-850">
                    Danh Sách Con Cháu Đăng Ký Zalo Bot
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Toàn bộ thành viên dòng họ đã liên kết với Zalo Bot để nhận thông báo cúng giỗ, truy phả tự động.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setIsGroupManagerOpen(true)}
                    className="inline-flex items-center gap-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded px-3 py-1.5 font-bold cursor-pointer transition-colors shadow-xs text-xs"
                  >
                    <Settings className="h-3.5 w-3.5 text-amber-200" /> Quản Lý Nhóm
                  </button>
                  <button
                    onClick={() => setIsAddSubOpen(true)}
                    className="inline-flex items-center gap-1.5 bg-red-800 hover:bg-red-950 text-white rounded px-3 py-1.5 font-bold cursor-pointer transition-colors shadow-xs text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" /> Thêm Số Thủ Công
                  </button>
                  {/* Search */}
                  <div className="relative w-full sm:w-56">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-stone-400" />
                  <input 
                    type="text" 
                    placeholder="Tìm tên hoặc chi phái..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 pl-8 py-1.5 focus:outline-none focus:border-red-800 text-xs"
                  />
                </div>
              </div>
            </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-stone-700">
                  <thead>
                    <tr className="text-stone-400 border-b border-stone-100 pb-2">
                      <th className="py-2 px-3 font-semibold">Tộc Đinh / Con cháu</th>
                      <th className="py-2 font-semibold">Nhóm hoạt động</th>
                      <th className="py-2 font-semibold">Số điện thoại</th>
                      <th className="py-2 font-semibold">Chi phái phả phái</th>
                      <th className="py-2 font-semibold">Ngày đăng ký</th>
                      <th className="py-2 font-semibold">Trạng thái</th>
                      <th className="py-2 px-3 font-semibold text-right">Thao tác trị sự</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-55">
                    {filteredSubs.map((s) => (
                      <tr key={s.id} className="hover:bg-stone-50/50 transition-all">
                        <td className="py-3 px-3">
                          <p className="font-bold text-stone-850">{s.name}</p>
                          {s.linkedMemberId && (
                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                              <span className="bg-red-50 text-red-800 border border-red-100/60 rounded-sm px-1.5 py-0.5 text-[8.5px] font-bold">
                                Gia Phả: {members.find(m => m.id === s.linkedMemberId)?.name || s.linkedMemberId}
                              </span>
                              {s.relationship && (
                                <span className="bg-stone-100 text-stone-600 rounded px-1 py-0.5 text-[8.5px] font-medium">
                                  ({s.relationship})
                                </span>
                              )}
                            </div>
                          )}
                          {s.notes && (
                            <p className="text-[9.5px] text-stone-400 italic mt-0.5 max-w-[220px] truncate" title={s.notes}>
                              Ghi chú: {s.notes}
                            </p>
                          )}
                        </td>
                        <td className="py-3">
                          <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[9px] font-bold border ${
                            s.group === "Thanh niên họ"
                              ? "bg-blue-50 text-blue-800 border-blue-105"
                              : s.group === "Ngành trưởng"
                              ? "bg-purple-50 text-purple-800 border-purple-105"
                              : s.group === "Ngành cụ"
                              ? "bg-indigo-50 text-indigo-800 border-indigo-105"
                              : s.group === "Ban trị sự"
                              ? "bg-rose-50 text-rose-800 border-rose-105 font-serif"
                              : "bg-stone-50 text-stone-600 border-stone-200"
                          }`}>
                            {s.group || "Thanh niên họ"}
                          </span>
                        </td>
                        <td className="py-3 font-mono text-[11px] text-stone-500">{s.phone}</td>
                        <td className="py-3">{s.branch}</td>
                        <td className="py-3 font-mono text-[11px] text-stone-500">{s.regDate}</td>
                        <td className="py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                            s.status === "Đang hoạt động" 
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-100" 
                              : s.status === "Chờ duyệt"
                              ? "bg-amber-50 text-amber-800 border border-amber-100"
                              : "bg-red-50 text-red-00 border border-red-100"
                          }`}>
                            {s.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                          {s.status === "Chờ duyệt" && (
                            <button 
                              onClick={() => approveSubscriber(s.id)}
                              className="bg-emerald-750 bg-emerald-700 text-white hover:bg-emerald-800 rounded px-2.5 py-1 font-semibold text-[10px] cursor-pointer"
                            >
                              Duyệt liên kết
                            </button>
                          )}
                          <button 
                            type="button"
                            onClick={() => openEditSubModal(s)}
                            className="bg-amber-50 hover:bg-amber-100 text-amber-900 rounded px-2.5 py-1 font-semibold text-[10px] cursor-pointer"
                          >
                            Hiệu chỉnh
                          </button>
                          <button 
                            onClick={() => toggleSubStatus(s.id)}
                            className={`rounded px-2.5 py-1 font-semibold text-[10px] cursor-pointer ${
                              s.status === "Đang hoạt động" 
                                ? "bg-stone-100 text-stone-600 hover:bg-red-50 hover:text-red-900" 
                                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-105"
                            }`}
                          >
                            {s.status === "Đang hoạt động" ? "Chặn" : "Kích hoạt"}
                          </button>
                          <button 
                            onClick={() => deleteSubscriber(s.id)}
                            className="bg-stone-50 hover:bg-red-800 hover:text-white p-1 text-stone-400 rounded transition-colors cursor-pointer inline-flex items-center"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Subtab 2: Chatbot logic & Simulation */}
          {activeSubTab === "bot" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Bot Auto Trigger Config (7 columns) */}
              <div className="lg:col-span-7 space-y-4 text-xs">
                <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                  <div>
                    <h3 className="text-sm font-serif font-semibold text-stone-850">
                      Từ Khóa Trả Lời Trực Tiếp Zalo OA
                    </h3>
                    <p className="text-[11px] text-stone-500">
                      Quản lý các quy tắc nhận tin nhắn có từ khóa và tự động gửi sớ cúng, thông tin gia hệ, liên hệ cho đinh gia tộc.
                    </p>
                  </div>
                  <button 
                    onClick={() => setIsAddRuleOpen(true)}
                    className="inline-flex items-center gap-1 bg-red-800 hover:bg-red-950 text-white rounded px-3 py-1.5 font-semibold cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> Thêm từ khóa
                  </button>
                </div>

                {/* Grid List of Triggers */}
                <div className="space-y-3">
                  {rules.map((rule) => (
                    <div 
                      key={rule.id}
                      className="border border-stone-150 rounded-lg p-3.5 bg-stone-50/40 hover:bg-white hover:shadow-xs transition-all space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono bg-amber-100 text-amber-900 border border-amber-300 rounded px-2 py-0.5 font-bold">
                            #{rule.keyword}
                          </span>
                          <span className="text-[9px] text-stone-400 uppercase font-black">
                            Loại: {rule.replyType === "card" ? "Thẻ thông báo" : "Văn bản thường"}
                          </span>
                        </div>

                        {/* Toggle button */}
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => toggleRuleActive(rule.id)}
                            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[9px] font-bold cursor-pointer ${
                              rule.isActive 
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200" 
                                : "bg-stone-100 text-stone-400 border border-stone-250"
                            }`}
                          >
                            {rule.isActive ? "● Hoạt động" : "○ Tạm tắt"}
                          </button>
                          <button 
                            onClick={() => deleteRule(rule.id)}
                            className="text-stone-400 hover:text-red-850 p-0.5 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-stone-700 leading-relaxed text-[11px] bg-white p-2 border border-stone-150 rounded italic whitespace-pre-wrap">
                        {rule.replyContent}
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-stone-400">
                        <span>Đã sử dụng: <strong className="font-mono text-stone-700">{rule.usageCount}</strong> lượt nhắn</span>
                        <span className="font-medium italic">Sửa đổi hôm qua</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chatbot Playground Simulator Sandbox (5 columns) */}
              <div className="lg:col-span-5 bg-[#fbfaf6] border border-amber-200/50 rounded-xl p-4.5 space-y-4">
                <div className="border-b border-amber-200/40 pb-2">
                  <h3 className="text-sm font-serif font-semibold text-stone-850 flex items-center gap-1.5">
                    <Bot className="h-4 w-4 text-red-800" />
                    Hộp Thử Nghiệm Zalo Bot (Mô phỏng)
                  </h3>
                  <p className="text-[10px] text-stone-500">
                    Gửi mẫu từ khóa để xem chatbot phản hồi tự động trực quan trước khi đưa vào hoạt động thực tế.
                  </p>
                </div>

                {/* Box screens stream */}
                <div className="bg-white border border-stone-200 rounded-lg p-3 h-72 overflow-y-auto flex flex-col gap-3">
                  {simChat.map((msg, i) => (
                    <div 
                      key={i}
                      className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                    >
                      <div className={`p-2.5 rounded-lg text-[11px] leading-relaxed max-w-[85%] border ${
                        msg.sender === "user" 
                          ? "bg-blue-600 text-white border-blue-700 rounded-tr-none" 
                          : "bg-stone-50 text-stone-800 border-stone-200 rounded-tl-none font-serif"
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Simulation inputs forms */}
                <form onSubmit={handleSimSend} className="flex gap-1.5 text-xs">
                  <input 
                    type="text" 
                    placeholder="Gõ 'lichsu', 'giado', 'donggop',..."
                    value={simText}
                    onChange={(e) => setSimText(e.target.value)}
                    className="flex-1 bg-white border border-stone-200 rounded-md py-2 px-3 text-stone-850 focus:outline-none focus:border-blue-600"
                  />
                  <button 
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-2 cursor-pointer flex items-center justify-center font-bold"
                  >
                    Thử
                  </button>
                </form>

                {/* Shortcuts helper tags trigger */}
                <div className="pt-2 text-[10px] space-y-1.5">
                  <p className="text-stone-400 uppercase font-black">Thử gõ nhanh hoặc bấm:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["lichsu", "giado", "donggop", "lienhe"].map(kw => (
                      <button 
                        key={kw}
                        onClick={() => { setSimText(kw); }}
                        type="button"
                        className="bg-white hover:bg-stone-100 border border-stone-200 rounded px-2 py-1 text-stone-600 cursor-pointer text-[10px] font-mono font-bold hover:border-blue-300 transition-colors"
                      >
                        {kw}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Subtab 3: Broadcast message manager */}
          {activeSubTab === "broadcast" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Write broadcast form (7 columns) */}
              <form onSubmit={handleSendBroadcast} className="lg:col-span-7 space-y-4 text-xs">
                <div>
                  <h3 className="text-sm font-serif font-semibold text-stone-850 mb-1">
                    Soạn Chiến Dịch Phát Tin Nhắn Họ Tộc
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Phát một tin nhắn hàng loạt đến tất cả Zalo Subscriber cùng lúc thông qua Zalo OA API. Tiện ích dùng báo tin cúng kỵ hoặc lời vận động dòng họ.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-stone-700 block">Tiêu đề phát tin:*</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ví dụ: Lễ vinh vương khuyến khoa học niên khóa 2026 sắp tổ chức" 
                    value={bcTitle}
                    onChange={(e) => setBcTitle(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-stone-700 block">Nhóm thông tri:*</label>
                  <select 
                    value={bcCategory}
                    onChange={(e) => setBcCategory(e.target.value as any)}
                    className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800"
                  >
                    <option value="Thông báo cúng giỗ">Thông báo cúng giỗ</option>
                    <option value="Lời kêu gọi trùng tu">Lời kêu gọi trùng tu</option>
                    <option value="Vinh danh khuyến học">Vinh danh khuyến học</option>
                    <option value="Khẩn báo họ tộc">Khẩn báo họ tộc</option>
                  </select>
                </div>

                {/* Audience targeting selectors */}
                <div className="space-y-2 border border-amber-900/10 rounded-lg bg-[#faf9f5] p-3">
                  <span className="font-semibold text-stone-700 block">Chọn đối tượng nhận tin:*</span>
                  <div className="flex gap-4">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold text-stone-800 text-[11px]">
                      <input 
                        type="radio" 
                        name="bcTargetType" 
                        value="all" 
                        checked={bcTargetType === "all"}
                        onChange={() => setBcTargetType("all")}
                        className="accent-red-800"
                      />
                      Tất cả con cháu
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold text-stone-800 text-[11px]">
                      <input 
                        type="radio" 
                        name="bcTargetType" 
                        value="group" 
                        checked={bcTargetType === "group"}
                        onChange={() => setBcTargetType("group")}
                        className="accent-red-800"
                      />
                      Gửi theo nhóm
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold text-stone-800 text-[11px]">
                      <input 
                        type="radio" 
                        name="bcTargetType" 
                        value="individual" 
                        checked={bcTargetType === "individual"}
                        onChange={() => setBcTargetType("individual")}
                        className="accent-red-800"
                      />
                      Gửi từng người
                    </label>
                  </div>

                  {/* Conditionally reveal Group list option */}
                  {bcTargetType === "group" && (
                    <div className="space-y-1.5 block duration-150 animate-fadeIn pt-1.5 border-t border-stone-200/40">
                      <span className="text-[10px] text-stone-500 block font-medium">Chọn nhóm Zalo con cháu nhận thông báo:</span>
                      <select
                        value={bcTargetGroup}
                        onChange={(e) => setBcTargetGroup(e.target.value)}
                        className="w-full bg-white border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 text-[11.5px]"
                      >
                        {zaloGroups.map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Conditionally reveal Individual recipient selection */}
                  {bcTargetType === "individual" && (
                    <div className="space-y-1.5 block duration-150 animate-fadeIn pt-1.5 border-t border-stone-200/40">
                      <span className="text-[10px] text-stone-500 block font-medium">Chọn một người nhận duy nhất:</span>
                      <select
                        value={bcTargetUserId}
                        onChange={(e) => setBcTargetUserId(e.target.value)}
                        className="w-full bg-white border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850 text-[11.5px]"
                      >
                        <option value="">-- Kính chọn một hảo đinh con cháu --</option>
                        {subscribers.map(sub => (
                          <option key={sub.id} value={sub.id}>
                            {sub.name} - {sub.phone} | Nhóm: {sub.group || "Khác"} ({sub.branch})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Frequency & Planned scheduling time */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-stone-700 block">Tần suất gửi chiến dịch:*</label>
                    <select
                      value={bcFrequency}
                      onChange={(e) => setBcFrequency(e.target.value as any)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850"
                    >
                      <option value="Gửi một lần">Gửi một lần (Ngay)</option>
                      <option value="Hàng tuần">Hàng tuần (Định kỳ)</option>
                      <option value="Hàng tháng">Hàng tháng (Định kỳ)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-stone-700 block">Thời điểm phát tự động:</label>
                    <input
                      type="text"
                      required
                      placeholder="dd/mm/yyyy hh:mm"
                      value={bcScheduleTime}
                      onChange={(e) => setBcScheduleTime(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between pb-1">
                    <label className="font-semibold text-stone-700 block mb-0">Nội dung thư phát truyền:*</label>
                    <button
                      type="button"
                      onClick={handleGenerateCampaignWithAI}
                      disabled={isAiGeneratingCampaign}
                      className="inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 border border-amber-900/20 text-amber-900 rounded px-2 py-0.5 text-[10px] font-bold cursor-pointer transition-colors shadow-2xs"
                    >
                      {isAiGeneratingCampaign ? (
                        <>
                          <RefreshCw className="h-3 w-3 animate-spin mr-1 text-amber-700" /> Đang thảo...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5 text-amber-700 mr-1" /> Tạo nội dung bằng AI
                        </>
                      )}
                    </button>
                  </div>
                  <textarea 
                    rows={5.5}
                    required
                    placeholder="Viết nội dung dâng lời nhắn gửi... Hoặc gõ tiêu đề rồi nhấp nút 'Tạo nội dung bằng AI' để hệ thống tự viết văn phong chuẩn gia giáo dòng họ Cao Ninh Bình." 
                    value={bcContent}
                    onChange={(e) => setBcContent(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 resize-none font-serif leading-relaxed text-xs"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={isBroadcasting || !bcTitle.trim() || !bcContent.trim()}
                  className="bg-red-800 hover:bg-red-950 text-white disabled:bg-stone-300 disabled:text-stone-400 rounded-lg px-4 py-2 font-bold cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-md py-2.5"
                >
                  {isBroadcasting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" /> Đang phát tin dâng phái...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" /> Kích nạp Phát tin hàng loạt qua Zalo Bot
                    </>
                  )}
                </button>
              </form>

              {/* Historic broadcasts logs (5 columns) */}
              <div className="lg:col-span-5 bg-[#faf9f5] border border-stone-200 rounded-xl p-4.5 space-y-4 text-xs">
                <h3 className="text-sm font-serif font-semibold text-stone-850 flex items-center gap-1.5 border-b border-stone-150 pb-2">
                  <Clock className="h-4 w-4 text-amber-700" />
                  Lịch Sử Các Tin Đã Gửi
                </h3>

                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {broadcasts.map((bc) => (
                    <div key={bc.id} className="p-3 bg-white border border-stone-200 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[10px] uppercase bg-stone-100 text-stone-600 px-2 py-0.5 rounded">
                          {bc.category}
                        </span>
                        <span className="text-[10px] text-stone-400 font-mono font-bold">{bc.sentDate}</span>
                      </div>
                      <h4 className="font-bold font-serif text-stone-800 text-xs">{bc.title}</h4>
                      <p className="text-stone-500 leading-relaxed text-[11px] line-clamp-2 italic">{bc.content}</p>
                      <p className="text-[10px] text-emerald-800 font-semibold">✓ Đã gửi đến {bc.recipientsCount} thành viên đinh</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Subtab 4: API configuration */}
          {activeSubTab === "api" && (
            <div className="space-y-5 text-xs max-w-2xl">
              <div>
                <h3 className="text-sm font-serif font-semibold text-stone-850 mb-1">
                  Cấu Hình API Kết Nối Zalo OA (Official Account)
                </h3>
                <p className="text-[11px] text-stone-500">
                  Cung cấp các trường Token và khóa bảo mật từ cổng Zalo Developers (https://developers.zalo.me) để đảm bảo đồng bộ danh sách đinh và chatbot tự động hoạt động bình thường.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-semibold text-stone-700 block col-span-2">Zalo App ID:*</label>
                  <input 
                    type="text" 
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-stone-700 block">Zalo App Secret Key:*</label>
                  <input 
                    type="password" 
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-stone-700 block">Zalo OA ID liên kết dòng họ:*</label>
                <input 
                  type="text" 
                  value={oaId}
                  onChange={(e) => setOaId(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 font-mono text-[11px]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-stone-700 block mb-0.5">Webhook URL (Nhận tương tác hội thoại tự động):</label>
                <input 
                  type="text" 
                  disabled
                  value={webhookUrl}
                  className="w-full bg-stone-100 border border-stone-200 rounded px-2.5 py-1.5 text-stone-500 font-mono text-[11px]"
                />
                <span className="text-[10px] text-stone-400 block italic leading-normal">Đây là đường dẫn nhận sự kiện tin nhắn từ người dùng cấu hình tại Cấu hình Webhook OA developers.</span>
              </div>

              <div className="pt-3 border-t border-stone-100 flex flex-wrap gap-2.5 items-center">
                <button 
                  onClick={handleVerifySync}
                  disabled={syncLoading}
                  className="bg-red-850 hover:bg-neutral-900 border border-red-800 hover:border-neutral-900 text-white rounded-lg px-4 py-2 font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
                >
                  {syncLoading ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Đang truyền tin kiểm định Webhook...
                    </>
                  ) : (
                    <>
                      Thử nghiệm Kiểm duyệt Kết nối
                    </>
                  )}
                </button>
              </div>

              {syncStatus && (
                <div className="mt-4 p-3 bg-emerald-50 border border-emerald-250 rounded-lg text-[11px] text-emerald-800 flex items-center gap-2">
                  <CheckCircle className="h-4.5 w-4.5 shrink-0 text-emerald-600" />
                  <p>{syncStatus}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Bot Keyword Modal layout */}
      <AnimatePresence>
        {isAddRuleOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="bg-white rounded-xl overflow-hidden shadow-2xl max-w-sm w-full border border-stone-200"
            >
              <div className="bg-red-950 px-5 py-4 text-white flex items-center justify-between border-b border-amber-900/40">
                <h3 className="font-serif font-bold text-base text-amber-100">
                  Lập Từ Khóa Phản Hồi Mới
                </h3>
                <button 
                  onClick={() => setIsAddRuleOpen(false)}
                  className="rounded-full hover:bg-white/10 p-1 text-stone-300 transition-all cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateRule} className="p-5 space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-stone-700 block">Từ khóa nhắn gửi (không dấu, viết liền):*</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ví dụ: nhangden" 
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850"
                  />
                  <span className="text-[10px] text-stone-400 block italic">Khi tộc đinh nhập đúng từ này, robot sẽ gửi phản hồi tự xử.</span>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-stone-700 block">Nội dung phản hồi dâng gửi:*</label>
                  <textarea 
                    rows={4.5}
                    required
                    placeholder="Ví dụ: Kính trình quý bái, các mục mua nhang trầm chi tế đã được chuẩn bị..." 
                    value={newReplyContent}
                    onChange={(e) => setNewReplyContent(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 resize-none font-serif leading-relaxed"
                  />
                </div>

                {/* Submit button footer */}
                <div className="flex gap-2 justify-end pt-2 border-t border-stone-100">
                  <button 
                    type="button" 
                    onClick={() => setIsAddRuleOpen(false)}
                    className="bg-stone-100 border border-stone-200 hover:bg-stone-250 rounded px-3 py-1.5 font-semibold transition-all cursor-pointer text-stone-800"
                  >
                    Hạ sớ Hủy
                  </button>
                  <button 
                    type="submit" 
                    className="bg-red-800 hover:bg-red-950 text-white rounded px-3 py-1.5 font-semibold transition-all cursor-pointer"
                  >
                    Kính lập quy tắc
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Group Manager Modal */}
      <AnimatePresence>
        {isGroupManagerOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="bg-white rounded-xl overflow-hidden shadow-2xl max-w-sm w-full border border-stone-200"
            >
              <div className="bg-[#5c1c1c] px-4 py-3 text-white flex items-center justify-between border-b border-amber-900/40">
                <h3 className="font-serif font-bold text-sm text-yellow-105 flex items-center gap-1.5">
                  <Settings className="h-4 w-4 text-amber-200" />
                  Quản Lý Nhóm Đăng Ký Zalo
                </h3>
                <button 
                  onClick={() => setIsGroupManagerOpen(false)}
                  className="rounded-full hover:bg-white/10 p-1 text-stone-300 transition-all cursor-pointer"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              <div className="p-4 space-y-4 text-xs">
                {/* List of current groups */}
                <div className="space-y-1.5">
                  <p className="font-bold text-stone-700 block">Các nhóm thành viên hiện tại:</p>
                  <p className="text-[10px] text-stone-400">Các nhóm có thể gán cho đinh gia nhận tin chuyên đề.</p>
                  <div className="divide-y divide-stone-100 max-h-40 overflow-y-auto border border-stone-150 rounded bg-stone-50 p-2 font-medium">
                    {zaloGroups.map(g => (
                      <div key={g} className="flex items-center justify-between py-1.5 text-[11px]">
                        <span className="text-stone-800">{g}</span>
                        {/* We preserve core groups, but let users delete custom groups */}
                        {!["Thanh niên họ", "Ngành trưởng", "Ngành cụ", "Ban trị sự", "Khác"].includes(g) ? (
                          <button 
                            type="button"
                            onClick={() => {
                              if (confirm(`Xác nhận xóa nhóm "${g}"?`)) {
                                setZaloGroups(zaloGroups.filter(x => x !== g));
                              }
                            }}
                            className="text-red-700 hover:text-red-900 font-bold hover:underline cursor-pointer"
                          >
                            Xóa
                          </button>
                        ) : (
                          <span className="text-[9px] text-stone-400 italic font-normal">Mặc định</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Adding new group */}
                <div className="space-y-1.5 pt-2 border-t border-dashed border-stone-200">
                  <p className="font-bold text-stone-700 block">Thêm nhóm hoạt động mới:</p>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Ví dụ: Hội đồng hương..." 
                      value={newGroupNameInput}
                      onChange={(e) => setNewGroupNameInput(e.target.value)}
                      className="flex-1 bg-stone-100 border border-stone-200 rounded px-2.5 py-1.5 text-stone-850 focus:outline-none"
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        const trimmed = newGroupNameInput.trim();
                        if (!trimmed) return;
                        if (zaloGroups.includes(trimmed)) {
                          alert("Nhóm này đã tồn tại!");
                          return;
                        }
                        setZaloGroups([...zaloGroups, trimmed]);
                        setNewGroupNameInput("");
                        alert(`Đã thêm thành công nhóm Zalo "${trimmed}".`);
                      }}
                      className="bg-red-800 hover:bg-red-900 text-white rounded px-3 py-1.5 font-bold cursor-pointer"
                    >
                      Thêm
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-stone-100">
                  <button 
                    type="button"
                    onClick={() => setIsGroupManagerOpen(false)}
                    className="bg-stone-100 hover:bg-stone-200 text-stone-700 rounded px-3 py-1.5 font-bold cursor-pointer"
                  >
                    Hoàn thành
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manual Add Subscriber Modal layout */}
      <AnimatePresence>
        {isAddSubOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="bg-white rounded-xl overflow-hidden shadow-2xl max-w-md w-full border border-stone-200"
            >
              <div className="bg-red-950 px-5 py-4 text-white flex items-center justify-between border-b border-amber-900/40">
                <h3 className="font-serif font-bold text-base text-amber-100 flex items-center gap-1.5">
                  <Users className="h-4.5 w-4.5 text-amber-300" />
                  Đăng Ký Số Zalo Thủ Công
                </h3>
                <button 
                  onClick={() => setIsAddSubOpen(false)}
                  className="rounded-full hover:bg-white/10 p-1 text-stone-300 transition-all cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleAddNewManualSub} className="p-5 space-y-4 text-xs">
                {/* Name and Phone rows */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Tên hiển thị Zalo (Họ tên):*</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ví dụ: Cao Xuân Viết" 
                      value={newSubName}
                      onChange={(e) => setNewSubName(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Số điện thoại liên kết Zalo:*</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ví dụ: 0912111222" 
                      value={newSubPhone}
                      onChange={(e) => setNewSubPhone(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850 font-mono"
                    />
                  </div>
                </div>

                {/* Phả phái */}
                <div className="space-y-1">
                  <label className="font-semibold text-stone-700 block">Chi phái phả tích:*</label>
                  <select 
                    value={newSubBranch}
                    onChange={(e) => setNewSubBranch(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850 text-xs"
                  >
                    <option value="Chi Trưởng (Trường Yên)">Chi Trưởng (Trường Yên)</option>
                    <option value="Chi Thứ Hai (Yên Khánh)">Chi Thứ Hai (Yên Khánh)</option>
                    <option value="Chi Thứ Ba (Gia Sinh)">Chi Thứ Ba (Gia Sinh)</option>
                  </select>
                </div>

                {/* Linked family member */}
                <div className="space-y-1">
                  <label className="font-semibold text-stone-700 block">Liên Kết Với Nhân Vật Trong Gia Phả (KYC):</label>
                  <select 
                    value={newSubLinkedMemberId}
                    onChange={(e) => setNewSubLinkedMemberId(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850 font-medium font-serif text-[11px]"
                  >
                    <option value="">-- Tự chọn tộc nhân gia hệ --</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        Đời {m.generation} - {m.name} ({m.branch})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Relationship, Group and Notes */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1 space-y-1">
                    <label className="font-semibold text-stone-700 block">Vai vế:</label>
                    <select
                      value={newSubRelationship}
                      onChange={(e) => setNewSubRelationship(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850 text-[10px]"
                    >
                      <option value="Bản thân">Bản thân</option>
                      <option value="Cha/Mẹ">Cha/Mẹ</option>
                      <option value="Con đẻ">Con đẻ</option>
                      <option value="Họ hàng xa">Họ hàng xa</option>
                    </select>
                  </div>
                  <div className="col-span-1 space-y-1">
                    <label className="font-semibold text-stone-700 block">Nhóm tế sự:*</label>
                    <select
                      value={newSubGroup}
                      onChange={(e) => setNewSubGroup(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850 text-[10px]"
                    >
                      {zaloGroups.map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-1 space-y-1">
                    <label className="font-semibold text-stone-700 block">Ghi chú sự bộ:</label>
                    <input 
                      type="text" 
                      placeholder="Ghi chú nhận diện..."
                      value={newSubNotes}
                      onChange={(e) => setNewSubNotes(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850 text-[10px]"
                    />
                  </div>
                </div>

                {/* Submit button footer */}
                <div className="flex gap-2 justify-end pt-3 border-t border-stone-100">
                  <button 
                    type="button" 
                    onClick={() => setIsAddSubOpen(false)}
                    className="bg-stone-100 border border-stone-200 hover:bg-stone-200 rounded px-3 py-1.5 font-semibold transition-all cursor-pointer text-stone-800"
                  >
                    Hạ sớ Hủy
                  </button>
                  <button 
                    type="submit" 
                    className="bg-red-800 hover:bg-red-950 text-white rounded px-4 py-1.5 font-semibold transition-all cursor-pointer"
                  >
                    Kích nạp liên kết
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Subscriber Profile Linked Modal */}
      <AnimatePresence>
        {editingSub && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl overflow-hidden shadow-2xl max-w-md w-full border border-stone-200"
            >
              <div className="bg-amber-950 px-5 py-4 text-white flex items-center justify-between border-b border-amber-900/40">
                <h3 className="font-serif font-bold text-base text-amber-100 flex items-center gap-1.5">
                  <Edit className="h-4.5 w-4.5 text-amber-300" />
                  Hiệu Chỉnh Đăng Ký Zalo Bot
                </h3>
                <button 
                  onClick={() => setEditingSub(null)}
                  className="rounded-full hover:bg-white/10 p-1 text-stone-300 transition-all cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveSubEdit} className="p-5 space-y-4 text-xs">
                {/* 1. Name and Phone info rows */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Danh tánh Đăng ký:*</label>
                    <input 
                      type="text" 
                      required
                      value={subEditName}
                      onChange={(e) => setSubEditName(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850 font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Số điện thoại liên lạc:*</label>
                    <input 
                      type="text" 
                      required
                      value={subEditPhone}
                      onChange={(e) => setSubEditPhone(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850 font-mono"
                    />
                  </div>
                </div>

                {/* 2. Branch and Status */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Thuộc Chi phái tạ bộ:*</label>
                    <input 
                      type="text" 
                      required
                      value={subEditBranch}
                      onChange={(e) => setSubEditBranch(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Trạng thái hoạt động:*</label>
                    <select 
                      value={subEditStatus}
                      onChange={(e) => setSubEditStatus(e.target.value as any)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850"
                    >
                      <option value="Đang hoạt động">Đang hoạt động</option>
                      <option value="Chờ duyệt">Chờ duyệt</option>
                      <option value="Đã chặn">Đã chặn</option>
                    </select>
                  </div>
                </div>

                {/* 3. Linked family member in genealogy tree */}
                <div className="space-y-1">
                  <label className="font-semibold text-stone-700 block">Liên Kết Với Nhân Vật Trong Gia Phả:*</label>
                  <select 
                    value={subEditLinkedMemberId}
                    onChange={(e) => setSubEditLinkedMemberId(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850 font-medium font-serif text-[11px]"
                  >
                    <option value="">-- Chưa liên kết (Không xác định) --</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>
                        Đời {m.generation} - {m.name} ({m.branch})
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-stone-400 block italic leading-normal">
                    Giúp hệ thống liên chuyển dữ liệu sớ tế của bản nhân khi nhắn tin truy phả.
                  </span>
                </div>

                {/* 4. Relationship, Group and Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1 space-y-1">
                    <label className="font-semibold text-stone-700 block">Mối quan hệ:*</label>
                    <select
                      value={subEditRelationship}
                      onChange={(e) => setSubEditRelationship(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850 text-[10.5px]"
                    >
                      <option value="Bản thân">Bản thân</option>
                      <option value="Cha/Mẹ">Cha/Mẹ</option>
                      <option value="Con đẻ">Con đẻ</option>
                      <option value="Vợ/Chồng">Vợ/Chồng</option>
                      <option value="Họ hàng xa">Họ hàng xa</option>
                    </select>
                  </div>
                  <div className="sm:col-span-1 space-y-1">
                    <label className="font-semibold text-stone-700 block">Nhóm hoạt động:*</label>
                    <select
                      value={subEditGroup}
                      onChange={(e) => setSubEditGroup(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850 text-[10.5px]"
                    >
                      {zaloGroups.map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-1 space-y-1">
                    <label className="font-semibold text-stone-700 block">Ghi chú thêm:</label>
                    <input 
                      type="text" 
                      placeholder="Ghi chú bổ sung lý lịch..."
                      value={subEditNotes}
                      onChange={(e) => setSubEditNotes(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850 text-[10.5px]"
                    />
                  </div>
                </div>

                {/* Submit button footer */}
                <div className="flex gap-2 justify-end pt-3 border-t border-stone-100">
                  <button 
                    type="button" 
                    onClick={() => setEditingSub(null)}
                    className="bg-stone-100 border border-stone-200 hover:bg-stone-200 rounded px-3 py-1.5 font-semibold transition-all cursor-pointer text-stone-800"
                  >
                    Đóng cửa sổ
                  </button>
                  <button 
                    type="submit" 
                    className="bg-amber-900 border border-amber-900 hover:bg-stone-900 hover:border-stone-900 text-white rounded px-4 py-1.5 font-semibold transition-all cursor-pointer"
                  >
                    Lưu đồng bộ thông tin
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
