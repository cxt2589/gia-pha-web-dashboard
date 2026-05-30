import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, FileText, Languages, History, BookOpen, Clock, AlertTriangle, RefreshCw, Feather, Book, Plus, Trash2, Eye, FileSpreadsheet, Sparkles } from "lucide-react";
import { AIChatMessage, UserSession, KnowledgeBaseDocument } from "../types";

interface AIHelperProps {
  initialPrompt?: string;
  initialType?: string;
  onClearInitialPrompt?: () => void;
  currentUser: UserSession;
  knowledgeDocs: KnowledgeBaseDocument[];
  onKnowledgeDocsChange: (docs: KnowledgeBaseDocument[]) => void;
}

export default function AIHelper({ 
  initialPrompt, 
  initialType, 
  onClearInitialPrompt,
  currentUser,
  knowledgeDocs,
  onKnowledgeDocsChange
}: AIHelperProps) {
  
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      role: "model",
      content: `Kính chào Quý bối trong Ban trị sự! Ta là **Trợ lý Sơ thảo Gia tộc họ Cao Ninh Bình**.
 
Ta sở học được nuôi dưỡng bằng lịch sử gia môn lâu đời, am hiểu sâu sắc về:
1. **Dịch thuật Hán Nôm**: Giải nghĩa câu đối cổ, hoành phi điện thờ, dịch văn bia từ tích của khởi thủy Cụ Cao Quý Công.
2. **Kính soạn Thể Sớ (Văn cúng/Văn khấn)**: Tế tổ đầu xuân, cúng giỗ đại hội dòng họ, sắm sửa lễ chạp khói hương tảo lăng.
3. **Thư Ngỏ/Biên Niên**: Thư xin phát tâm trùng tu điện thờ tôn kính, khích lệ đóng góp khuyến học dâng hiến vinh quang dòng tộc Cao Ninh Bình.
 
*Mẹo gia truyền*: Bản tiên hữu đã nạp sẵn **${knowledgeDocs.length} tài liệu lịch sử gia tộc** vào bộ nhớ trợ lý. Ta sẽ tự động đối chiếu các mốc niên khóa, chi thứ trong phả chí để kết quả cúng bái xác thực nhất!`,
      timestamp: new Date().toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadMessage, setLoadMessage] = useState("Đang mài mực khảo thư...");
  const [errorText, setErrorText] = useState<string | null>(null);

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
      if (onClearInitialPrompt) onClearInitialPrompt();
    }
  }, [initialPrompt]);

  // Handle auto scrolling to bottom
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleShortcutClick = (prompt: string) => {
    setUserInput(prompt);
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
      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        // We inject the active reference clan documents array!
        body: JSON.stringify({ 
          prompt: userPrompt,
          type: initialType || "chat",
          documents: knowledgeDocs
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || "Trục trặc dịch vụ liên minh trí tuệ nhân tạo.");
      }

      const modelMessage: AIChatMessage = {
        role: "model",
        content: data.text,
        timestamp: new Date().toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, modelMessage]);
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || "Không thể kết nối đến Trợ lý Hán Nôm AI. Xin hãy cấu hình GEMINI_API_KEY ở mục Cài đặt (Secrets) trên thanh công cụ.");
    } finally {
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[calc(100vh-140px)] min-h-[550px]">
      
      {/* Template Suggestions rail (4 columns on desktop) */}
      <div className="lg:col-span-4 bg-[#fbfaf6] border border-amber-200/50 rounded-xl p-4 flex flex-col justify-between space-y-4">
        <div className="space-y-3.5 flex-1 flex flex-col overflow-hidden">
          
          {/* Segment selection buttons */}
          <div className="flex border border-stone-200 bg-stone-100 p-1 rounded-lg text-xs leading-normal font-semibold select-none shrink-0">
            <button 
              onClick={() => setLeftTab("shortcuts")}
              type="button"
              className={`flex-1 px-2.5 py-1.5 rounded-md cursor-pointer transition-all flex items-center justify-center gap-1 ${
                leftTab === "shortcuts" 
                  ? "bg-white text-red-950 font-bold shadow-xs border border-stone-200/50" 
                  : "text-stone-500 hover:text-stone-900"
              }`}
            >
              <Feather className="h-3.5 w-3.5" /> Lối Tắt Sớ
            </button>
            <button 
              onClick={() => setLeftTab("knowledge")}
              type="button"
              className={`flex-1 px-2.5 py-1.5 rounded-md cursor-pointer transition-all flex items-center justify-center gap-1 ${
                leftTab === "knowledge" 
                  ? "bg-white text-red-950 font-bold shadow-xs border border-stone-200/50" 
                  : "text-stone-500 hover:text-stone-900"
              }`}
            >
              <Book className="h-3.5 w-3.5" /> Tri Thức Họ ({knowledgeDocs.length})
            </button>
          </div>

          {/* TAB 1: SHORTCUTS */}
          {leftTab === "shortcuts" && (
            <div className="space-y-2 text-xs overflow-y-auto max-h-[360px] pr-0.5">
              <div className="border-b border-stone-150 pb-2">
                <p className="text-[10px] uppercase font-black tracking-wider text-stone-400">Lối tắt sớ tế nhanh</p>
                <p className="text-[10.5px] text-stone-500">Ấn biểu mẫu để trợ lý AI soạn sớ tế, giải tự cổ lập tức.</p>
              </div>

              {/* Shortcut 1 */}
              <button 
                onClick={() => handleShortcutClick(
                  `Xin nhờ giải dịch nghĩa bức Đại Hoành Phi cổ được khắc gỗ chạm son thếp vàng dâng tại Thượng Điện đền Tổ đường có hàng chữ cổ: "曹貴祖德芳"(Tào quý tổ đức phương). Giải nghĩa xuất bối và điển cố triêu Lê.`
                )}
                className="w-full text-left p-2.5 rounded bg-white border border-stone-150 hover:border-amber-400 hover:bg-amber-500/5 block transition-all cursor-pointer"
              >
                <div className="flex gap-2 items-start">
                  <Languages className="h-4 w-4 text-amber-750 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold text-stone-850 leading-tight block">Biên dịch hoành phi đền cổ</span>
                    <span className="text-[10px] text-stone-450 block italic mt-0.5 font-serif">"Tào quý tổ đức phương"</span>
                  </div>
                </div>
              </button>

              {/* Shortcut 2 */}
              <button 
                onClick={() => handleShortcutClick(
                  `Hãy soạn thảo tờ Thư Ngỏ mở để Hội đồng dòng họ quyên tiến dâng hiến đất, quỹ tiền quyên góp phục vụ đại tu khu mộ phần tiên linh rộng lớn Thung Lá, Gia Viễn, Ninh Bình. Nơi an giấc nghìn năm của đức tổ đời thứ 1 Cao Quý Công.`
                )}
                className="w-full text-left p-2.5 rounded bg-white border border-stone-150 hover:border-amber-400 hover:bg-amber-500/5 block transition-all cursor-pointer"
              >
                <div className="flex gap-2 items-start">
                  <FileText className="h-4 w-4 text-red-800 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold text-stone-850 leading-tight block">Quyên góp đại tu mộ lăng Thung Lá</span>
                    <span className="text-[10px] text-stone-450 block mt-0.5">Lời kêu gọi đinh gia uống nước nhớ nguồn</span>
                  </div>
                </div>
              </button>

              {/* Shortcut 3 */}
              <button 
                onClick={() => handleShortcutClick(
                  `Nhờ soạn bài văn tế giỗ chạp dòng họ (văn tế tổ) dâng hương thỉnh các cụ ba chi và đức Thủy Tổ Cao Quý Công nhân lễ giỗ tổ 15/3 âm lịch. Viết thật súc tích mang ý tứ đức hiếu cảm ân.`
                )}
                className="w-full text-left p-2.5 rounded bg-white border border-stone-150 hover:border-amber-400 hover:bg-amber-500/5 block transition-all cursor-pointer"
              >
                <div className="flex gap-2 items-start">
                  <BookOpen className="h-4 w-4 text-indigo-700 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold text-stone-850 leading-tight block">Lập sớ bái Đại tế Thủy tổ 15/3</span>
                    <span className="text-[10px] text-stone-450 block mt-0.5 font-serif">Duy tuệ tế tổ - Nghi tế đại điển</span>
                  </div>
                </div>
              </button>

              {/* Shortcut 4 */}
              <button 
                onClick={() => handleShortcutClick(
                  `Họ Cao tại Ninh Bình có nguồn gốc thế nào? Thủy tổ Cao Quý Công (húy Cao Văn Lãm) bắt đầu di cư chắp trạch ra Trường Yên năm nào?`
                )}
                className="w-full text-left p-2.5 rounded bg-white border border-stone-150 hover:border-amber-400 hover:bg-amber-500/5 block transition-all cursor-pointer"
              >
                <div className="flex gap-2 items-start">
                  <Clock className="h-4 w-4 text-emerald-700 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold text-stone-850 leading-tight block">Khảo sử dòng tộc sơ khởi</span>
                    <span className="text-[10px] text-stone-455 block mt-0.5">Tìm hiểu tiên tổ nguồn gốc Ninh Bình</span>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* TAB 2: KNOWLEDGE BASE DOCUMENTS */}
          {leftTab === "knowledge" && (
            <div className="flex-1 flex flex-col overflow-hidden text-xs space-y-3">
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
        <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded text-[11px] text-stone-600 leading-relaxed shrink-0 space-y-1.5">
          <p>💡 **Lời Trị Sự**: Trợ lý AI tự học dựa sát gia sử mộc bản và tài liệu lưu trữ ở trên để lập sớ tế nghiêm khắc chính gốc, không bịa sớ rác.</p>
          <p>✍️ **Gợi ý**: Sau khi trợ lý soạn thảo xong bài văn sớ, đinh nam hãy đối chiếu kỹ lưỡng, sao chép để in ấn và đóng triện đỏ gia tộc bái tế tôn nghiêm.</p>
        </div>
      </div>

      {/* Main Interactive Chat module (8 columns on desktop) */}
      <div className="lg:col-span-8 bg-white border border-stone-150 rounded-xl shadow-sm flex flex-col h-full overflow-hidden select-none">
        {/* Chat header */}
        <div className="bg-stone-50 border-b border-stone-100 px-4.5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-red-850 animate-pulse" />
            <h3 className="font-serif font-bold text-sm text-stone-800">
              Trác Thư Đàm Luận Di Sản Hán Nôm AI
            </h3>
          </div>
          <span className="text-[10px] text-stone-400 uppercase font-bold tracking-wider font-mono bg-stone-100 px-2.5 py-0.5 rounded">
            Gemini-3.5-flash
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
