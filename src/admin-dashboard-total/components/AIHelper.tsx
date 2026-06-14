import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, FileText, Languages, History, BookOpen, Clock, AlertTriangle, RefreshCw, Feather, Book, Plus, Trash2, Eye, FileSpreadsheet, Sparkles, Edit3, Save, X } from "lucide-react";
import { AIChatMessage, UserSession, KnowledgeBaseDocument, AIModelConfig } from "../types";

interface AIHelperProps {
  initialPrompt?: string;
  initialType?: string;
  onClearInitialPrompt?: () => void;
  currentUser: UserSession;
  knowledgeDocs: KnowledgeBaseDocument[];
  onKnowledgeDocsChange: (docs: KnowledgeBaseDocument[]) => void;
  aiConfig?: AIModelConfig;
}

type PrayerShortcut = {
  id: string;
  title: string;
  note: string;
  prompt: string;
  icon: "translate" | "appeal" | "ceremony" | "history";
};

const AI_SHORTCUTS_KEY = "caogia_ai_prayer_shortcuts_v1";

function sanitizeAISeedText(value: string) {
  return String(value || "")
    .replace(/họ Cao Ninh Bình/g, "dòng họ Cao")
    .replace(/dòng tộc Cao Ninh Bình/g, "dòng họ Cao")
    .replace(/Cao Ninh Bình/g, "họ Cao")
    .replace(/Cao Quý Công\/Cao Văn Lãm/g, "dữ liệu mẫu cũ chưa xác minh")
    .replace(/Cao Quý Công/g, "dữ liệu mẫu cũ chưa xác minh")
    .replace(/Cao Văn Lãm/g, "dữ liệu mẫu cũ chưa xác minh");
}

const DEFAULT_PRAYER_SHORTCUTS: PrayerShortcut[] = [
  {
    id: "translate-hoanh-phi",
    title: "Biên dịch hoành phi, sắc phong",
    note: "Dịch nghĩa chữ Hán Nôm, đối chiếu với phả hệ đang có",
    icon: "translate",
    prompt: `Xin nhờ giải dịch nghĩa văn tự Hán Nôm hoặc hoành phi/câu đối của họ Cao. Khi chưa đủ tư liệu, hãy chỉ rõ phần cần admin bổ sung ảnh, phiên âm hoặc văn bản gốc; không tự bịa niên hiệu, chức tước hay nhân vật.`
  },
  {
    id: "appeal-lineage-data",
    title: "Thư ngỏ bổ sung tư liệu gia phả",
    note: "Kêu gọi con cháu gửi ảnh, ngày tháng, chi/ngành, hành trạng",
    icon: "appeal",
    prompt: `Hãy soạn một bức thư ngỏ thay mặt Ban trị sự dòng họ Cao, kêu gọi con cháu bổ sung tư liệu gia phả: ảnh chân dung, ngày sinh/mất, ngày giỗ âm lịch, nơi an táng, chi/ngành và hành trạng. Văn phong trang trọng, gần gũi, nhấn mạnh việc xác minh dữ liệu trước khi công bố.`
  },
  {
    id: "ceremony-cao-dinh-lang",
    title: "Lập sớ bái Thủy Tổ Cao Đình Lạng",
    note: "Dựa trên dữ liệu hiện có, tránh dùng dữ liệu mẫu cũ chưa xác minh",
    icon: "ceremony",
    prompt: `Nhờ soạn bài văn khấn/văn tế trang trọng dâng hương Thủy Tổ Cao Đình Lạng (高 廷 兩) của dòng họ Cao. Nếu cần nhắc tới Cao Tổ thì ghi cụ Cao Đình Thuật (高 廷 術), tước hiệu Cao Cao Mãnh Đế Đại Tướng Quân. Chỉ dùng dữ liệu đã có, không đưa lại dữ liệu mẫu cũ chưa xác minh.`
  },
  {
    id: "history-current-tree",
    title: "Khảo sử theo cây phả hiện tại",
    note: "Tóm tắt từ Cao Tổ, Thủy Tổ và các chi/ngành đã nhập",
    icon: "history",
    prompt: `Hãy tóm tắt lịch sử phả hệ dòng họ Cao theo dữ liệu cây phả hiện tại: Cao Tổ là Cao Đình Thuật, Thủy Tổ là Cao Đình Lạng. Trình bày phần đã xác thực, phần còn khuyết và danh sách thông tin cần admin kiểm chứng.`
  }
];

function loadPrayerShortcuts(): PrayerShortcut[] {
  if (typeof window === "undefined") return DEFAULT_PRAYER_SHORTCUTS;
  try {
    const parsed = JSON.parse(localStorage.getItem(AI_SHORTCUTS_KEY) || "[]");
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_PRAYER_SHORTCUTS;
    return parsed
      .map((item) => ({
        id: String(item?.id || `shortcut_${Date.now()}`),
        title: sanitizeAISeedText(String(item?.title || "")).trim(),
        note: sanitizeAISeedText(String(item?.note || "")).trim(),
        prompt: sanitizeAISeedText(String(item?.prompt || "")).trim(),
        icon: ["translate", "appeal", "ceremony", "history"].includes(item?.icon) ? item.icon : "ceremony"
      }))
      .filter((item) => item.title && item.prompt);
  } catch {
    return DEFAULT_PRAYER_SHORTCUTS;
  }
}

function getShortcutIcon(icon: PrayerShortcut["icon"]) {
  if (icon === "translate") return Languages;
  if (icon === "appeal") return FileText;
  if (icon === "history") return Clock;
  return BookOpen;
}

function getModelLabel(modelName = "gemini-2.5-flash") {
  const normalized = modelName.trim().toLowerCase();
  if (normalized === "gemini-2.5-pro") return "Gemini 2.5 Pro";
  if (normalized === "gemini-1.5-flash") return "Gemini 1.5 Flash";
  if (normalized === "gemini-2.5-flash") return "Gemini 2.5 Flash";
  return modelName || "Gemini";
}

function getActiveAIEngine(aiConfig?: AIModelConfig, taskType = "chat") {
  const normalizedType = taskType.toLowerCase();
  if (["ceremony", "prayer", "ritual", "han_nom", "han-nom"].includes(normalizedType)) {
    return aiConfig?.engineCeremony || "gemini";
  }
  if (["article", "articles", "appeal", "news", "audit"].includes(normalizedType)) {
    return aiConfig?.engineArticles || "gemini";
  }
  if (["zalo", "zalo_rule", "zalo-rule"].includes(normalizedType)) {
    return aiConfig?.engineZalo || "gemini";
  }
  return aiConfig?.engineChat || "gemini";
}

function getAIBotTypeForTask(taskType = "chat") {
  const normalizedType = taskType.toLowerCase();
  if (["ceremony", "prayer", "ritual", "han_nom", "han-nom"].includes(normalizedType)) {
    return "prayer_writer";
  }
  if (["article", "articles", "appeal", "news"].includes(normalizedType)) {
    return "article_writer";
  }
  if (["audit", "system_audit", "chatbox_policy", "policy"].includes(normalizedType)) {
    return "ai_governor";
  }
  if (["zalo", "zalo_rule", "zalo-rule", "zalo_campaign"].includes(normalizedType)) {
    return "zalo_bot";
  }
  return "dashboard_helper";
}

function getEngineLabel(aiConfig?: AIModelConfig, taskType = "chat") {
  const engine = getActiveAIEngine(aiConfig, taskType);
  if (engine === "local") return "AI nội bộ";
  if (engine === "chatgpt") return "ChatGPT";
  return getModelLabel(aiConfig?.modelName);
}

function normalizeReferenceText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}... [đã rút gọn]`;
}

function selectRelevantKnowledgeDocs(prompt: string, docs: KnowledgeBaseDocument[]) {
  if (!docs.length) return [];
  const keywords = Array.from(new Set(
    normalizeReferenceText(prompt)
      .split(/[^a-z0-9]+/i)
      .filter((word) => word.length >= 3)
  ));

  const scored = docs.map((doc, index) => {
    const title = normalizeReferenceText(doc.title || "");
    const content = normalizeReferenceText(doc.content || "");
    const score = keywords.reduce((sum, keyword) => {
      if (title.includes(keyword)) return sum + 4;
      if (content.includes(keyword)) return sum + 1;
      return sum;
    }, 0);
    return { doc, index, score };
  });

  const relevant = scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 4);

  return (relevant.length ? relevant : scored.slice(0, 3)).map((item) => ({
    ...item.doc,
    title: truncateText(item.doc.title || "", 120),
    content: truncateText(item.doc.content || "", 1200)
  }));
}

function buildKnowledgeReference(docs: KnowledgeBaseDocument[]) {
  if (!docs.length) return "";
  const body = docs
    .map((doc) => `- ${doc.title}: ${doc.content}`)
    .join("\n");
  return `\n\nTài liệu tham chiếu dashboard đã lọc theo câu hỏi:\n${truncateText(body, 5200)}`;
}

async function readAIResponse(response: Response) {
  const rawText = await response.text();
  let data: any = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = { raw: rawText };
  }

  if (!response.ok) {
    if (/^\s*<!doctype html/i.test(rawText) || /^\s*<html/i.test(rawText)) {
      throw new Error(
        `Máy chủ trả về trang HTML lỗi thay vì JSON từ /api/ai/chat. HTTP ${response.status}. ` +
        "Cần kiểm tra nginx/Cloudflare và trạng thái service gia-pha-dashboard trên VPS."
      );
    }
    const detail = data.details || data.error || data.message || data.raw || `HTTP ${response.status}`;
    throw new Error(String(detail).slice(0, 600));
  }

  return data;
}

export default function AIHelper({ 
  initialPrompt, 
  initialType, 
  onClearInitialPrompt,
  currentUser,
  knowledgeDocs,
  onKnowledgeDocsChange,
  aiConfig
}: AIHelperProps) {
  
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      role: "model",
      content: `Kính chào Quý bối trong Ban trị sự! Ta là **Trợ lý Sơ thảo Gia tộc họ Cao**.
 
Ta sở học được nuôi dưỡng bằng lịch sử gia môn lâu đời, am hiểu sâu sắc về:
1. **Dịch thuật Hán Nôm**: Giải nghĩa câu đối cổ, hoành phi điện thờ, dịch văn bia từ dữ liệu phả hệ đã xác minh.
2. **Kính soạn Thể Sớ (Văn cúng/Văn khấn)**: Tế tổ đầu xuân, cúng giỗ đại hội dòng họ, sắm sửa lễ chạp khói hương tảo lăng.
3. **Thư Ngỏ/Biên Niên**: Thư xin phát tâm trùng tu điện thờ tôn kính, khích lệ đóng góp khuyến học dâng hiến vinh quang dòng họ Cao.
 
*Mẹo gia truyền*: Bản tiên hữu đã nạp sẵn **${knowledgeDocs.length} tài liệu lịch sử gia tộc** vào bộ nhớ trợ lý. Ta sẽ tự động đối chiếu các mốc niên khóa, chi thứ trong phả chí để kết quả cúng bái xác thực nhất!`,
      timestamp: new Date().toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadMessage, setLoadMessage] = useState("Đang mài mực khảo thư...");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [pendingTaskType, setPendingTaskType] = useState("");
  const [shortcuts, setShortcuts] = useState<PrayerShortcut[]>(() => loadPrayerShortcuts());
  const [editingShortcutId, setEditingShortcutId] = useState<string | null>(null);
  const [shortcutTitle, setShortcutTitle] = useState("");
  const [shortcutNote, setShortcutNote] = useState("");
  const [shortcutPrompt, setShortcutPrompt] = useState("");
  const [shortcutIcon, setShortcutIcon] = useState<PrayerShortcut["icon"]>("ceremony");

  // Left Rail Tab Controller
  const [leftTab, setLeftTab] = useState<"shortcuts" | "knowledge">("shortcuts");
  
  // Custom document form state
  const [isAddingDoc, setIsAddingDoc] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docCategory, setDocCategory] = useState("Gia phả học");
  const [docContent, setDocContent] = useState("");
  const [selectedDocForPreview, setSelectedDocForPreview] = useState<KnowledgeBaseDocument | null>(null);

  const listEndRef = useRef<HTMLDivElement>(null);

  // Classic placeholder messages when loading to build amazing atmosphere
  const lodingPhrases = [
    "Đang đối chiếu tài liệu gia truyền...",
    "Trợ lý đang áp dụng phả hệ mộc bản...",
    "Đang gọt dũa lời văn kính tổ đường...",
    "Đang rà soát chữ cổ từ kho di sản tri châu...",
    "Đang mài nghiên ngòi bút lập tờ sớ tế..."
  ];

  // Rotate loading phrases while waiting for backend
  useEffect(() => {
    let interval: any;
    if (isLoading) {
      interval = setInterval(() => {
        const randomPhrase = lodingPhrases[Math.floor(Math.random() * lodingPhrases.length)];
        setLoadMessage(randomPhrase);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  // Hook up to external prompts (Redirected actions from Overview or Calendar click!)
  useEffect(() => {
    if (initialPrompt) {
      setUserInput(initialPrompt);
      setPendingTaskType(initialType || "chat");
      if (onClearInitialPrompt) onClearInitialPrompt();
    }
  }, [initialPrompt, initialType, onClearInitialPrompt]);

  useEffect(() => {
    localStorage.setItem(AI_SHORTCUTS_KEY, JSON.stringify(shortcuts));
  }, [shortcuts]);

  // Handle auto scrolling to bottom
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleShortcutClick = (prompt: string) => {
    setUserInput(prompt);
    setPendingTaskType("ceremony");
  };

  const openShortcutEditor = (shortcut?: PrayerShortcut) => {
    setEditingShortcutId(shortcut?.id || "new");
    setShortcutTitle(shortcut?.title || "");
    setShortcutNote(shortcut?.note || "");
    setShortcutPrompt(shortcut?.prompt || "");
    setShortcutIcon(shortcut?.icon || "ceremony");
  };

  const closeShortcutEditor = () => {
    setEditingShortcutId(null);
    setShortcutTitle("");
    setShortcutNote("");
    setShortcutPrompt("");
    setShortcutIcon("ceremony");
  };

  const handleSaveShortcut = (event: React.FormEvent) => {
    event.preventDefault();
    if (!shortcutTitle.trim() || !shortcutPrompt.trim()) return;

    const nextShortcut: PrayerShortcut = {
      id: editingShortcutId && editingShortcutId !== "new" ? editingShortcutId : `shortcut_${Date.now()}`,
      title: shortcutTitle.trim(),
      note: shortcutNote.trim(),
      prompt: shortcutPrompt.trim(),
      icon: shortcutIcon
    };

    setShortcuts((prev) => {
      const exists = prev.some((item) => item.id === nextShortcut.id);
      return exists
        ? prev.map((item) => item.id === nextShortcut.id ? nextShortcut : item)
        : [nextShortcut, ...prev];
    });
    closeShortcutEditor();
  };

  const handleDeleteShortcut = (id: string) => {
    if (!confirm("Xóa lối tắt sớ này?")) return;
    setShortcuts((prev) => prev.filter((item) => item.id !== id));
    if (editingShortcutId === id) closeShortcutEditor();
  };

  const restoreDefaultShortcuts = () => {
    if (!confirm("Khôi phục lại bộ lối tắt sớ mặc định theo dữ liệu Cao Đình Thuật/Cao Đình Lạng?")) return;
    setShortcuts(DEFAULT_PRAYER_SHORTCUTS);
    closeShortcutEditor();
  };

  // Submit query to Node.js backend proxy
  const handleQuerySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isLoading) return;

    const userPrompt = userInput;
    setUserInput("");
    setErrorText(null);

    // Append user message
    const formattedTime = new Date().toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' });
    const userMessage: AIChatMessage = {
      role: "user",
      content: userPrompt,
      timestamp: formattedTime
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setLoadMessage("Đang tra thảo gia sử...");

    try {
      const selectedKnowledgeDocs = selectRelevantKnowledgeDocs(userPrompt, knowledgeDocs);
      const taskType = pendingTaskType || initialType || "chat";
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          message: [
            userPrompt,
            buildKnowledgeReference(selectedKnowledgeDocs)
          ].join(""),
          prompt: userPrompt,
          type: taskType,
          botType: getAIBotTypeForTask(taskType),
          intent: taskType,
          engine: getActiveAIEngine(aiConfig, taskType),
          documents: selectedKnowledgeDocs,
          modelName: aiConfig?.modelName,
          temperature: aiConfig?.temperature
        })
      });

      const data = await readAIResponse(response);

      const modelMessage: AIChatMessage = {
        role: "model",
        content: data.text,
        timestamp: new Date().toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, modelMessage]);
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || "Không thể kết nối đến Trợ lý Hán Nôm AI. Kiểm tra GEMINI_API_KEY, model Gemini, quota và kết nối mạng của VPS.");
    } finally {
      setPendingTaskType("");
      setIsLoading(false);
    }
  };

  // Create document logic
  const handleAddDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim() || !docContent.trim()) return;

    const newDoc: KnowledgeBaseDocument = {
      id: "doc_" + Date.now(),
      title: docTitle.trim(),
      category: docCategory,
      content: docContent.trim(),
      contributor: currentUser.fullName,
      lastUpdated: new Date().toLocaleDateString("vi-VN")
    };

    onKnowledgeDocsChange([newDoc, ...knowledgeDocs]);
    setDocTitle("");
    setDocContent("");
    setIsAddingDoc(false);
    alert(`Đã nạp văn kiện "${newDoc.title}" thành công dâng trợ lý AI nghiên cứu!`);
  };

  const handleDeleteDoc = (id: string, title: string) => {
    if (confirm(`Quý bối có chắc muốn gỡ bỏ tài liệu tham chiếu "${title}"? Trợ lý sẽ quên tư liệu này.`)) {
      onKnowledgeDocsChange(knowledgeDocs.filter(d => d.id !== id));
      if (selectedDocForPreview?.id === id) {
        setSelectedDocForPreview(null);
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-auto min-h-0 lg:h-[calc(100vh-140px)] lg:min-h-[550px]">
      
      {/* Template Suggestions rail (4 columns on desktop) */}
      <div className="lg:col-span-4 relative overflow-visible lg:overflow-hidden rounded-xl border border-amber-300/70 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.14),transparent_34%),linear-gradient(180deg,#fffaf0_0%,#fffdf8_48%,#fbf5e9_100%)] p-4 shadow-[0_16px_40px_rgba(92,45,10,0.12)] flex flex-col justify-between space-y-4">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-red-900 via-amber-500 to-yellow-300" />
        <div className="space-y-3.5 flex-1 min-h-0 flex flex-col overflow-visible lg:overflow-hidden">
          
          {/* Segment selection buttons */}
          <div className="flex border border-amber-200 bg-white/80 p-1 rounded-lg text-xs leading-normal font-semibold select-none shrink-0 shadow-[inset_0_1px_3px_rgba(120,53,15,0.08),0_8px_20px_rgba(120,53,15,0.06)]">
            <button 
              onClick={() => setLeftTab("shortcuts")}
              type="button"
              className={`flex-1 px-2.5 py-2 rounded-md cursor-pointer transition-all duration-200 flex items-center justify-center gap-1 ${
                leftTab === "shortcuts" 
                  ? "bg-gradient-to-r from-red-900 to-amber-700 text-white font-bold shadow-[0_6px_16px_rgba(127,29,29,0.22)]" 
                  : "text-stone-600 hover:bg-amber-50 hover:text-red-900"
              }`}
            >
              <Feather className="h-3.5 w-3.5" /> Lối Tắt Sớ
            </button>
            <button 
              onClick={() => setLeftTab("knowledge")}
              type="button"
              className={`flex-1 px-2.5 py-2 rounded-md cursor-pointer transition-all duration-200 flex items-center justify-center gap-1 ${
                leftTab === "knowledge" 
                  ? "bg-gradient-to-r from-red-900 to-amber-700 text-white font-bold shadow-[0_6px_16px_rgba(127,29,29,0.22)]" 
                  : "text-stone-600 hover:bg-amber-50 hover:text-red-900"
              }`}
            >
              <Book className="h-3.5 w-3.5" /> Tri Thức Họ ({knowledgeDocs.length})
            </button>
          </div>

          {/* TAB 1: SHORTCUTS */}
          {leftTab === "shortcuts" && (
            <div className="space-y-2.5 text-xs overflow-y-auto max-h-[44vh] lg:max-h-[360px] pr-1">
              <div className="border-b border-amber-300/70 pb-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[10px] uppercase font-black tracking-wider text-red-900">Lối tắt sớ tế nhanh</p>
                    <p className="text-[10.5px] text-stone-650 leading-snug">Chọn, sửa hoặc thêm mẫu prompt để trợ lý soạn sớ đúng dữ liệu họ tộc.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openShortcutEditor()}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md bg-gradient-to-r from-red-900 to-red-700 px-2.5 py-1.5 text-[10px] font-bold text-white shadow-[0_6px_14px_rgba(127,29,29,0.18)] hover:from-red-950 hover:to-red-800"
                  >
                    <Plus className="h-3 w-3" /> Thêm
                  </button>
                </div>
              </div>

              {editingShortcutId && (
                <form onSubmit={handleSaveShortcut} className="rounded-lg border border-amber-300 bg-white/95 p-3 space-y-2 shadow-[0_10px_26px_rgba(120,53,15,0.12)]">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-stone-850">{editingShortcutId === "new" ? "Thêm lối tắt sớ" : "Chỉnh sửa lối tắt sớ"}</p>
                    <button type="button" onClick={closeShortcutEditor} className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-800">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <input
                    value={shortcutTitle}
                    onChange={(event) => setShortcutTitle(event.target.value)}
                    placeholder="Tên lối tắt"
                    className="w-full rounded border border-stone-200 bg-stone-50 px-2 py-1.5 text-[11px] focus:border-red-900 focus:outline-none"
                    required
                  />
                  <input
                    value={shortcutNote}
                    onChange={(event) => setShortcutNote(event.target.value)}
                    placeholder="Mô tả ngắn"
                    className="w-full rounded border border-stone-200 bg-stone-50 px-2 py-1.5 text-[11px] focus:border-red-900 focus:outline-none"
                  />
                  <select
                    value={shortcutIcon}
                    onChange={(event) => setShortcutIcon(event.target.value as PrayerShortcut["icon"])}
                    className="w-full rounded border border-stone-200 bg-stone-50 px-2 py-1.5 text-[11px] focus:border-red-900 focus:outline-none"
                  >
                    <option value="ceremony">Văn tế/sớ</option>
                    <option value="translate">Dịch Hán Nôm</option>
                    <option value="appeal">Thư ngỏ</option>
                    <option value="history">Khảo sử</option>
                  </select>
                  <textarea
                    value={shortcutPrompt}
                    onChange={(event) => setShortcutPrompt(event.target.value)}
                    rows={5}
                    placeholder="Prompt gửi sang AI..."
                    className="w-full resize-none rounded border border-stone-200 bg-stone-50 px-2 py-1.5 font-serif text-[11px] leading-relaxed focus:border-red-900 focus:outline-none"
                    required
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="inline-flex flex-1 items-center justify-center gap-1 rounded bg-red-900 py-1.5 font-bold text-white hover:bg-red-950">
                      <Save className="h-3.5 w-3.5" /> Lưu
                    </button>
                    <button type="button" onClick={restoreDefaultShortcuts} className="rounded bg-stone-100 px-2 py-1.5 text-[10px] font-bold text-stone-600 hover:bg-stone-200">
                      Mặc định
                    </button>
                  </div>
                </form>
              )}

              {shortcuts.map((shortcut) => {
                const ShortcutIcon = getShortcutIcon(shortcut.icon);
                return (
                  <div key={shortcut.id} className="group relative overflow-hidden rounded-lg border border-amber-200 bg-gradient-to-br from-white via-[#fffaf0] to-amber-50/60 shadow-[0_8px_22px_rgba(120,53,15,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:border-red-700 hover:shadow-[0_14px_30px_rgba(120,53,15,0.16)]">
                    <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-red-900 via-amber-500 to-yellow-300" />
                    <button
                      type="button"
                      onClick={() => handleShortcutClick(shortcut.prompt)}
                      className="relative w-full text-left p-3 pl-3.5 block cursor-pointer"
                    >
                      <div className="flex gap-2 items-start">
                        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-amber-300 bg-amber-100 text-red-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] transition-colors group-hover:bg-red-900 group-hover:text-amber-100">
                          <ShortcutIcon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <span className="font-black text-stone-900 leading-tight block group-hover:text-red-950">{shortcut.title}</span>
                          <span className="text-[10.5px] text-stone-600 block mt-0.5 leading-snug">{shortcut.note}</span>
                        </div>
                      </div>
                    </button>
                    <div className="relative flex items-center justify-between border-t border-amber-100 bg-white/55 px-3 py-1.5 pl-3.5">
                      <span className="text-[9px] font-black uppercase tracking-wide text-red-800">Prompt có thể chỉnh sửa</span>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => openShortcutEditor(shortcut)} className="rounded p-1 text-stone-500 hover:bg-amber-100 hover:text-red-900" title="Sửa lối tắt">
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => handleDeleteShortcut(shortcut.id)} className="rounded p-1 text-stone-500 hover:bg-red-50 hover:text-red-900" title="Xóa lối tắt">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: KNOWLEDGE BASE DOCUMENTS */}
          {leftTab === "knowledge" && (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden text-xs space-y-3">
              {isAddingDoc ? (
                /* Add document form */
                <form onSubmit={handleAddDocument} className="bg-white border border-stone-150 rounded-lg p-3 space-y-3 overflow-y-auto max-h-[350px]">
                  <p className="font-bold text-stone-800 uppercase tracking-widest text-[9.5px]">Nạp tài liệu gia truyền</p>
                  
                  <div className="space-y-1">
                    <label className="font-bold text-stone-605 block">Tiêu đề tài liệu:*</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ví dụ: Sử tích lăng bia cụ Chi thứ Hai" 
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2 py-1 focus:outline-none focus:border-red-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-stone-605 block">Thể loại:*</label>
                    <select
                      value={docCategory}
                      onChange={(e) => setDocCategory(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2 py-1 focus:outline-none"
                    >
                      <option value="Gia phả học">Gia phả học</option>
                      <option value="Lịch sử chi phái">Lịch sử chi phái</option>
                      <option value="Nghi thức tế tự">Nghi thức tế tự</option>
                      <option value="Tích cổ triều Lê">Tích cổ triều Lê</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-stone-650 block mb-1">Nội dung chi văn tế phả:*</label>
                      <label className="inline-flex items-center gap-1 bg-stone-100 hover:bg-stone-200 text-stone-700 px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors border border-stone-250 shadow-2xs select-none">
                        Tải tệp .txt
                        <input
                          type="file"
                          accept=".txt"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const text = event.target?.result as string;
                              setDocContent(text);
                              if (!docTitle) {
                                setDocTitle(file.name.replace(/\.[^/.]+$/, ""));
                              }
                            };
                            reader.readAsText(file);
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                    <textarea 
                      rows={5}
                      required
                      placeholder="Mời chép nội dung sắc phong, thế trạch, mốc lịch sử... Hoặc ấn chọn 'Tải tệp .txt' để nhập văn bản từ tệp văn vật họ tộc."
                      value={docContent}
                      onChange={(e) => setDocContent(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded p-2 focus:outline-none focus:border-red-900 font-serif text-[11px] leading-relaxed resize-none"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button 
                      type="submit"
                      className="flex-1 bg-red-800 hover:bg-red-900 text-white rounded py-1.5 font-bold cursor-pointer"
                    >
                      Nạp tài liệu
                    </button>
                    <button 
                      onClick={() => setIsAddingDoc(false)}
                      type="button"
                      className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded py-1.5 font-bold cursor-pointer hover:text-stone-900"
                    >
                      Hủy bỏ
                    </button>
                  </div>
                </form>
              ) : (
                /* Documents list */
                <div className="flex-grow flex flex-col overflow-hidden space-y-2">
                  <div className="flex items-center justify-between pointer-events-auto">
                    <span className="text-[10px] text-stone-400 uppercase font-black">Khảo tranh thư mục</span>
                    <button 
                      onClick={() => setIsAddingDoc(true)}
                      type="button"
                      className="inline-flex items-center gap-1 text-[10px] bg-red-900 hover:bg-red-950 text-white rounded px-2 py-1 font-bold cursor-pointer"
                    >
                      <Plus className="h-3 w-3" /> Nạp tài liệu
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 max-h-[300px]">
                    {knowledgeDocs.map((doc) => (
                      <div 
                        key={doc.id}
                        className={`p-2.5 rounded-lg border text-[11px] transition-all relative ${
                          selectedDocForPreview?.id === doc.id 
                            ? "bg-amber-500/5 border-amber-400 shadow-xs" 
                            : "bg-white border-stone-150 hover:bg-stone-50/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="grow pr-8 select-none">
                            <span className="text-[8.5px] uppercase font-bold text-red-800 bg-red-50 px-1 py-0.5 rounded border border-red-100">{doc.category}</span>
                            <h4 className="font-serif font-black text-stone-800 mt-1 block leading-tight">{doc.title}</h4>
                            <p className="text-[9.5px] text-stone-400 italic mt-0.5">Nhân bối nạp: {doc.contributor}</p>
                          </div>

                          <div className="absolute right-2 top-2 flex items-center gap-1">
                            <button
                              onClick={() => setSelectedDocForPreview(selectedDocForPreview?.id === doc.id ? null : doc)}
                              type="button"
                              title="Xem nhanh văn kiện"
                              className="p-1 hover:bg-stone-100 hover:text-stone-900 text-stone-400 rounded cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteDoc(doc.id, doc.title)}
                              type="button"
                              title="Loại bỏ tài liệu"
                              className="p-1 hover:bg-red-50 hover:text-red-950 text-stone-400 rounded cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Expandable preview details block */}
                        {selectedDocForPreview?.id === doc.id && (
                          <div className="mt-2.5 pt-2.5 border-t border-dashed border-stone-200">
                            <p className="text-stone-700 italic font-serif leading-relaxed text-[11px] whitespace-pre-wrap bg-stone-50 p-2 rounded border border-stone-100">
                              {doc.content}
                            </p>
                            <button
                              onClick={() => {
                                setUserInput(`Dựa theo tài liệu cổ gia quyến: "${doc.title}" nội dung: "${doc.content}". Hãy giải thuật đối chiếu...`);
                                alert("Đã áp chế nội dung tài liệu lịch sử gia hệ vào khung gõ phác thảo soạn sớ!");
                              }}
                              type="button"
                              className="mt-2.5 w-full bg-amber-100 hover:bg-amber-150 text-amber-950 rounded py-1 text-[10px] font-bold cursor-pointer flex items-center justify-center gap-1"
                            >
                              <Sparkles className="h-3 w-3" /> Nạp làm ngữ cảnh soạn thảo
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Informative advice */}
        <div className="bg-gradient-to-br from-amber-100/85 to-white border border-amber-300/80 p-3 rounded-lg text-[11px] text-stone-700 leading-relaxed shrink-0 space-y-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          <p>💡 **Lời Trị Sự**: Trợ lý AI tự học dựa sát gia sử mộc bản và tài liệu lưu trữ ở trên để lập sớ tế nghiêm khắc chính gốc, không bịa sớ rác.</p>
          <p>✍️ **Gợi ý**: Sau khi trợ lý soạn thảo xong bài văn sớ, đinh nam hãy đối chiếu kỹ lưỡng, sao chép để in ấn và đóng triện đỏ gia tộc bái tế tôn nghiêm.</p>
        </div>
      </div>

      {/* Main Interactive Chat module (8 columns on desktop) */}
      <div className="lg:col-span-8 bg-white border border-stone-150 rounded-xl shadow-sm flex flex-col h-[68vh] min-h-[500px] lg:h-full lg:min-h-0 overflow-hidden select-none">
        {/* Chat header */}
        <div className="bg-stone-50 border-b border-stone-100 px-4.5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-red-850 animate-pulse" />
            <h3 className="font-serif font-bold text-sm text-stone-800">
              Trác Thư Đàm Luận Di Sản Hán Nôm AI
            </h3>
          </div>
          <span className="text-[10px] text-stone-400 uppercase font-bold tracking-wider font-mono bg-stone-100 px-2.5 py-0.5 rounded">
            {getEngineLabel(aiConfig, initialType || "chat")}
          </span>
        </div>

        {/* Message bubble stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              <div className={`flex gap-2.5 items-end max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                
                {/* Micro avatar */}
                <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 border text-[11px] font-bold ${
                  msg.role === "user" 
                    ? "bg-stone-100 border-stone-200 text-stone-600" 
                    : "bg-red-50 border-red-200 text-red-900"
                }`}>
                  {msg.role === "user" ? "Tr" : "🪶"}
                </div>

                {/* Bubble bubble content */}
                <div className={`p-3.5 rounded-xl text-xs leading-relaxed border shadow-xs whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-red-800 text-white border-red-900 rounded-tr-none hover:bg-red-850 transition-colors"
                    : "bg-[#faf9f5] text-stone-800 border-amber-900/10 rounded-tl-none font-serif prose max-w-none"
                }`}>
                  {msg.content}
                </div>
              </div>
              
              <span className={`text-[9px] text-stone-400 block mt-1 ${msg.role === "user" ? "mr-10" : "ml-10"}`}>
                {msg.timestamp}
              </span>
            </div>
          ))}

          {/* Loading status widget */}
          {isLoading && (
            <div className="flex gap-2.5 items-end max-w-[85%]">
              <div className="h-7 w-7 rounded-full bg-red-50 border border-red-200 text-red-900 flex items-center justify-center shrink-0 animate-spin text-xs">
                <RefreshCw className="h-3 w-3" />
              </div>
              <div className="p-3 bg-stone-50 text-stone-500 border border-stone-200 rounded-xl rounded-tl-none text-xs flex items-center gap-2">
                <span className="dot-pulse-mini flex gap-1 items-center">
                  <span className="h-1.5 w-1.5 bg-amber-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 bg-amber-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 bg-amber-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
                <span className="font-serif italic text-[11px]">{loadMessage}</span>
              </div>
            </div>
          )}

          {/* Error notice state */}
          {errorText && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl max-w-xl mx-auto flex gap-3 text-xs text-red-800 items-start shadow-sm mt-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-red-700" />
              <div className="space-y-1.5 grow">
                <p className="font-bold">Chưa kết nối được Trợ Lý AI</p>
                <p className="leading-relaxed opacity-95">{errorText}</p>
                <button 
                  onClick={() => { setErrorText(null); }}
                  className="bg-red-800 text-white rounded px-3 py-1 font-semibold text-[10px] hover:bg-neutral-850 cursor-pointer mt-1"
                >
                  Xác nhận đóng thông báo
                </button>
              </div>
            </div>
          )}

          <div ref={listEndRef} />
        </div>

        {/* Input box */}
        <div className="p-3 border-t border-stone-100 bg-stone-50 shrink-0">
          <form onSubmit={handleQuerySubmit} className="flex gap-2 items-center">
            <input 
              type="text" 
              placeholder="Nhập nghi tiết cổ cần soạn, chữ thi hoành cổ cần dịch..."
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              className="flex-1 bg-white border border-stone-200 rounded-lg py-2.5 px-3.5 placeholder-stone-400 focus:outline-none focus:border-amber-400 text-stone-850 text-xs shadow-xs"
            />
            <button 
              type="submit"
              disabled={isLoading || !userInput.trim()}
              className="bg-red-800 hover:bg-red-950 text-white disabled:bg-stone-300 disabled:text-stone-400 rounded-lg p-2.5 shrink-0 shadow-md transition-all cursor-pointer flex items-center justify-center justify-items-center"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

    </div>
  );
}
