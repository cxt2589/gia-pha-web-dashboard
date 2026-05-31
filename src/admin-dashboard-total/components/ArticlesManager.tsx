import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FileText, Plus, Search, Eye, Edit, Trash2, Globe, Clock, Check, X, Calendar, User, Bookmark, Image, Sparkles, Bold, Italic, Underline, Heading1, Heading2, Quote, List, Link, Minus, Copy } from "lucide-react";
import { WebArticle, KnowledgeBaseDocument, ClanEvent, FamilyMember } from "../types";

interface ArticlesManagerProps {
  aiConfig?: {
    modelName?: string;
    temperature?: number;
    engineCeremony: string;
    engineArticles: string;
    engineChat: string;
    engineZalo: string;
    apiKey?: string;
  };
  knowledgeDocs?: KnowledgeBaseDocument[];
  eventSuggestions?: ClanEvent[];
  members?: FamilyMember[];
  initialArticles?: WebArticle[];
  onArticlesChange?: (articles: WebArticle[]) => void;
}

function normalizeSearchText(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function truncateAIContext(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}... [đã rút gọn]`;
}

function selectRelevantMembers(query: string, members: FamilyMember[]) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery.trim()) return [];

  return members
    .map((member) => {
      const fields = [
        member.name,
        member.title,
        member.rankRole,
        member.customSuffix,
        member.branch,
        member.deathAnniversaryLunar,
        member.solarDeathDate,
        member.deathYear,
        member.graveLocation,
        member.bio
      ].filter(Boolean).join(" ");
      const normalizedFields = normalizeSearchText(fields);
      const name = normalizeSearchText(member.name || "");
      const score = normalizedQuery.includes(name) && name.length > 4
        ? 12
        : normalizedQuery.split(/[^a-z0-9]+/).filter((word) => word.length >= 3 && normalizedFields.includes(word)).length;
      return { member, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.member.generation - b.member.generation)
    .slice(0, 8)
    .map((item) => item.member);
}

function buildMemberAnniversaryContext(members: FamilyMember[]) {
  if (!members.length) return "";
  const lines = members.map((member) => [
    `Tên: ${member.name}`,
    `Đời: ${member.generation}`,
    member.title ? `Tước vị/vai trò: ${member.title}` : "",
    member.branch ? `Chi/ngành: ${member.branch}` : "",
    member.isDeceased ? "Tình trạng: Đã mất" : "Tình trạng: Còn sống",
    member.birthYear ? `Năm sinh: ${member.birthYear}` : "",
    member.deathYear ? `Năm mất: ${member.deathYear}` : "",
    member.solarDeathDate ? `Ngày mất dương lịch: ${member.solarDeathDate}` : "",
    member.deathAnniversaryLunar ? `Ngày giỗ/kỵ nhật âm lịch: ${member.deathAnniversaryLunar}` : "",
    member.graveLocation ? `Mộ phần: ${member.graveLocation}` : "",
    member.bio ? `Hành trạng: ${truncateAIContext(member.bio, 420)}` : ""
  ].filter(Boolean).join("; "));
  return `\n      - Dữ liệu nhân vật tìm được trong cây phả:\n      - ${lines.join("\n      - ")}`;
}

function findRelevantEvent(query: string, events: ClanEvent[]) {
  const normalizedQuery = normalizeSearchText(query);
  return events.find((event) => {
    const haystack = normalizeSearchText([event.title, event.description, event.lunarDate, event.solarDate].join(" "));
    return normalizedQuery.split(/[^a-z0-9]+/).filter((word) => word.length >= 3 && haystack.includes(word)).length >= 2;
  });
}

function selectRelevantDocs(query: string, docs: KnowledgeBaseDocument[]) {
  const normalizedQuery = normalizeSearchText(query);
  const keywords = normalizedQuery.split(/[^a-z0-9]+/).filter((word) => word.length >= 3);
  const scored = docs.map((doc, index) => {
    const haystack = normalizeSearchText([doc.title, doc.content].join(" "));
    return {
      doc,
      index,
      score: keywords.filter((word) => haystack.includes(word)).length
    };
  });
  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 5)
    .map((item) => ({
      ...item.doc,
      content: truncateAIContext(item.doc.content || "", 900)
    }));
}

export default function ArticlesManager({ aiConfig, knowledgeDocs = [], eventSuggestions = [], members = [], initialArticles = [], onArticlesChange }: ArticlesManagerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Tất cả");

  // Mock articles base
  const [articles, setArticles] = useState<WebArticle[]>(() => initialArticles.length ? initialArticles : [
    {
      id: "art1",
      title: "Rà soát dữ liệu phả hệ họ Cao theo cây phả hiện tại",
      slug: "ra-soat-du-lieu-pha-he-ho-cao-ninh-binh",
      category: "Tin tức họ tộc",
      author: "Ban biên tập phả hệ",
      summary: "Dashboard đang ưu tiên dữ liệu từ cây phả và file Excel chuẩn, trong đó Cao Tổ là cụ Cao Đình Thuật và Thủy Tổ là Cao Đình Lạng.",
      content: "Ban trị sự đang rà soát lại toàn bộ dữ liệu phả hệ họ Cao theo cây phả hiện tại.\n\nCác mốc đang dùng trong hệ thống:\n1. Cao Tổ: cụ Cao Đình Thuật (高 廷 術), tước hiệu Cao Cao Mãnh Đế Đại Tướng Quân.\n2. Thủy Tổ: cụ Cao Đình Lạng (高 廷 兩).\n3. Những trường còn khuyết như ngày tháng, mẹ, vợ, nơi an táng, chi/ngành cần tiếp tục đối chiếu từ file Excel, phả ký và tài liệu gốc.\n\nMọi bài viết công bố trên webview cần được thay thế dần bằng nội dung đã xác minh, không dùng lại dữ liệu mẫu cũ nếu không có căn cứ.",
      publishDate: "28/05/2026",
      status: "Đăng tải",
      views: 742,
      coverImage: "/images/ancient_temple_roof_1779856049722.png"
    },
    {
      id: "art2",
      title: "Quy chiếu Cao Tổ và Thủy Tổ",
      slug: "quy-chieu-cao-to-doi-0-va-thuy-to-doi-1",
      category: "Lịch sử tích cổ",
      author: "Ban phả ký",
      summary: "Bản quy chiếu giúp admin và AI không nhầm lẫn giữa Cao Tổ Cao Đình Thuật và Thủy Tổ Cao Đình Lạng.",
      content: "Trong dashboard và webview, quy tắc đời/phả hệ đang được chuẩn hóa như sau:\n\n- Cao Tổ: Cao Đình Thuật (高 廷 術), tước hiệu Cao Cao Mãnh Đế Đại Tướng Quân.\n- Thủy Tổ: Cao Đình Lạng (高 廷 兩).\n- Các đời sau: ghi theo Đời thứ N khi cần hiển thị thứ tự kỹ thuật.\n\nAI Tổng Quản và Trợ lý AI phải dùng quy chiếu này khi viết bài, soạn sớ, tạo rule Zalo hoặc trả lời chatbox. Những tư liệu chưa xác minh cần được đánh dấu là cần kiểm chứng.",
      publishDate: "15/05/2026",
      status: "Đăng tải",
      views: 1205,
      coverImage: "/images/dong-son-drum.png"
    },
    {
      id: "art3",
      title: "Chương trình vinh danh Trạng Nguyên trẻ dâng hương phát học bổng",
      slug: "vinh-danh-trang-nguyen-tre-phat-hoc-bong-nien-khoa-moi",
      category: "Gương sáng học tập",
      author: "Ban khuyến học họ Cao",
      summary: "Lễ vinh danh các cháu học sinh đỗ đạt cao học kỳ thi thủ khoa quốc gia và thạc sĩ hải ngoại trước án anh linh dòng tộc nhân ngày giỗ tổ rằm tháng ba...",
      content: "Trọng đạo hiếu kính, khích lệ hiền tài là một hướng hoạt động cần được ghi nhận bằng dữ liệu thật của từng năm.\n\nBài viết này là khung chờ để Ban Khuyến học bổ sung danh sách con cháu đạt thành tích, học bổng đã trao, nguồn quỹ và ngày tổ chức đã xác minh.\n\nKhi chưa có danh sách chính thức, AI và ban biên tập không tự thêm tên người, số lượng giải thưởng, học vị hoặc ngày lễ biểu dương.",
      publishDate: "20/05/2026",
      status: "Đăng tải",
      views: 459,
      coverImage: "/images/vietnamese_ink_landscape_1779856029849.png"
    },
    {
      id: "art4",
      title: "Lời dụ khẩn: Hạn chế thắp hương trầm rực lửa tại nội điện Thượng điện thờ cổ",
      slug: "loi-du-khan-han-che-thap-huong-tram-trong-thuong-dien-co",
      category: "Thông tri khẩn",
      author: "Hội đồng Gia tộc bảo tồn điện thờ",
      summary: "Quy định mới về bảo vệ chống hỏa hoạn cho ngôi điện gỗ mít hơn 200 năm tuổi tránh hư hại linh vị gỗ cổ và bức hoành phi sơn son...",
      content: "Bài thông tri này là khung chờ cho nội dung quản trị thật về quy định hương khói, bảo quản hiện vật và an toàn không gian thờ tự.\n\nTrước khi công bố, Ban trị sự cần bổ sung địa điểm, người phụ trách, phạm vi áp dụng, căn cứ thống nhất và ngày hiệu lực.\n\nAI không được tự thêm niên đại kiến trúc, chất liệu hiện vật, vị trí từ đường hoặc quy định lễ nghi nếu tài liệu gốc chưa nêu rõ.",
      publishDate: "29/05/2026",
      status: "Bản nháp",
      views: 18,
      coverImage: "/images/ancient_temple_roof_1779856049722.png"
    }
  ]);

  const [activeArticle, setActiveArticle] = useState<WebArticle | null>(articles[0]);
  const [isOpenAdd, setIsOpenAdd] = useState(false);
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [copiedLinkLabel, setCopiedLinkLabel] = useState<string | null>(null);

  const commitArticles = (updater: WebArticle[] | ((prev: WebArticle[]) => WebArticle[])) => {
    setArticles((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      onArticlesChange?.(next);
      return next;
    });
  };

  // Form compose article states
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<any>("Tin tức họ tộc");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [author, setAuthor] = useState("Ủy viên Ban Trị Sự");
  const [status, setStatus] = useState<"Đăng tải" | "Bản nháp">("Đăng tải");
  const [coverUrl, setCoverUrl] = useState("");

  // AI draft generators & rich tools state buffers
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiSubject, setAiSubject] = useState("Đại lễ tảo mộ và giỗ Tổ rằm tháng Ba");
  const [aiSubNotes, setAiSubNotes] = useState("");
  const [aiSolarTerm, setAiSolarTerm] = useState("Thanh Minh");
  const [aiEventContext, setAiEventContext] = useState("");
  const [aiLocationContext, setAiLocationContext] = useState("");

  const getArticleShareUrl = (article: WebArticle) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/tin-tuc/${article.slug}`;
  };

  const getArticleShortUrl = (article: WebArticle) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const shortId = article.id.replace(/^(news_|art_)/, "").slice(-8);
    return `${origin}/a/${shortId}`;
  };

  const copyArticleLink = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedLinkLabel(label);
      window.setTimeout(() => setCopiedLinkLabel(null), 1400);
    } catch {
      window.prompt("Sao chép liên kết:", value);
    }
  };

  const resetArticleForm = () => {
    setEditingArticleId(null);
    setTitle("");
    setSummary("");
    setContent("");
    setAuthor("Ủy viên Ban Trị Sự");
    setCategory("Tin tức họ tộc");
    setStatus("Đăng tải");
    setCoverUrl("");
  };

  const openCreateArticle = () => {
    resetArticleForm();
    setIsOpenAdd(true);
  };

  const openEditArticle = (article: WebArticle, event?: React.MouseEvent) => {
    event?.stopPropagation();
    setEditingArticleId(article.id);
    setTitle(article.title);
    setSummary(article.summary);
    setContent(article.content);
    setAuthor(article.author);
    setCategory(article.category);
    setStatus(article.status);
    setCoverUrl(article.coverImage || "");
    setIsOpenAdd(true);
  };

  const insertFormatting = (prefix: string, suffix: string = "") => {
    const element = document.getElementById("articleContentTextarea") as HTMLTextAreaElement;
    if (!element) {
      setContent(prev => prev + prefix + suffix);
      return;
    }
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const text = element.value;
    const selected = text.substring(start, end);
    const replacement = prefix + selected + suffix;
    const newContent = text.substring(0, start) + replacement + text.substring(end);
    setContent(newContent);
    setTimeout(() => {
      element.focus();
      element.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 50);
  };

  const handleAIGenerateArticle = async () => {
    setIsGeneratingAI(true);
    const articleQuery = [aiSubject, aiSubNotes, aiEventContext].filter(Boolean).join(" ");
    const selectedEvent = eventSuggestions.find((event) => event.id === aiEventContext) || findRelevantEvent(articleQuery, eventSuggestions);
    const matchedMembers = selectRelevantMembers(articleQuery, members);
    const selectedKnowledgeDocs = selectRelevantDocs(articleQuery, knowledgeDocs);
    const memberAnniversaryContext = buildMemberAnniversaryContext(matchedMembers);
    const knowledgeContext = selectedKnowledgeDocs.length
      ? `\n      - Tài liệu liên quan đã lọc:\n      - ${selectedKnowledgeDocs.map((doc) => `${doc.title}: ${truncateAIContext(doc.content, 700)}`).join("\n      - ")}`
      : "";
    const seasonalContext = [
      aiSolarTerm ? `Tiết khí: ${aiSolarTerm}` : "",
      selectedEvent ? `Sự kiện: ${selectedEvent.title}` : aiEventContext ? `Sự kiện: ${aiEventContext}` : "",
      selectedEvent?.lunarDate ? `Ngày âm lịch: ${selectedEvent.lunarDate}` : "",
      selectedEvent?.solarDate ? `Ngày dương lịch: ${selectedEvent.solarDate}` : "",
      aiLocationContext || selectedEvent?.location ? `Địa điểm: ${aiLocationContext || selectedEvent?.location}` : "",
      memberAnniversaryContext,
      knowledgeContext,
    ].filter(Boolean).join("\n      - ");
    try {
      const promptText = `Hãy thảo tạc một bài văn/bản tin chính thống truyền thông trên website dòng họ Cao.
      - Chủ đề chính: ${aiSubject}
      - Bối cảnh tiết khí, sự kiện và địa điểm:
      - ${seasonalContext || "Không có bối cảnh riêng, ưu tiên văn phong tôn cổ lịch lãm."}
      - Chú ý quan yếu kèm riêng: ${aiSubNotes || "Chú trọng văn phong tôn cổ lịch lãm, nêu bật tấm gương hiếu nghĩa tiên tổ"}
      Yêu cầu dữ liệu: Nếu chủ đề nhắc tới ngày giỗ/kỵ nhật của một cụ, phải ưu tiên mục "Dữ liệu nhân vật tìm được trong cây phả" ở trên. Nếu không thấy ngày giỗ thì ghi rõ "chưa có ngày giỗ trong dữ liệu", tuyệt đối không tự đoán.
      Yêu cầu văn phong: hấp dẫn hơn bài tin hành chính thông thường; mở đầu có thể gợi khí tiết mùa vụ, địa điểm nếu dữ liệu đã cho có nêu. Không bịa nhân vật, số tiền hoặc ngày tháng ngoài dữ liệu đã cho.
      Hãy trả về chính xác kết cấu nội dung ngắn gọn phân tách rõ ràng qua ba mục lớn ngăn cách bởi phân cách thẻ [PART] duy nhất:
      Mục 1: Tiêu đề lừng lẫy, có thể kết hợp tiết khí - sự kiện - địa điểm, tối đa 15 từ
      [PART]
      Mục 2: Mô tả tấm tắc ngắn một câu duy nhất
      [PART]
      Mục 3: Toàn văn sớ chi tiết trôi chảy, có các hàng mục rõ ràng xuống dòng, xưng hô tôn kính tổ đức.`;

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText,
          type: "appeal",
          botType: "dashboard",
          intent: "article",
          message: promptText,
          documents: selectedKnowledgeDocs,
          modelName: aiConfig?.modelName,
          temperature: aiConfig?.temperature
        })
      });

      if (!response.ok) {
        const rawText = await response.text();
        let errorData: any = {};
        try {
          errorData = rawText ? JSON.parse(rawText) : {};
        } catch {
          errorData = { raw: rawText };
        }
        throw new Error(errorData.details || errorData.error || "Không thể liên kết đến đầu cổng trí tuệ nhân tạo.");
      }

      const data = await response.json();
      const aiResponseText = data.text || "";

      if (aiResponseText.includes("[PART]")) {
        const parts = aiResponseText.split("[PART]");
        if (parts[0]) {
          setTitle(parts[0].replace(/Mục 1:|Tiêu đề:|#/gi, "").trim());
        }
        if (parts[1]) {
          setSummary(parts[1].replace(/Mục 2:|Mô tả:|Tóm tắt:/gi, "").trim());
        }
        if (parts[2]) {
          setContent(parts[2].replace(/Mục 3:|Nội dung:/gi, "").trim());
        }
      } else {
        setTitle("Biên ký sự: " + aiSubject);
        setSummary("Truyền thống uống nước nhớ nguồn rạng ngời nghìn thu.");
        setContent(aiResponseText);
      }
    } catch (err: any) {
      console.error("AI Article draft writer failed:", err);
      alert("Hệ thống trợ lý bận tế tự phục vụ xa gần, xin Quý nhân thử lại sau.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const categories = ["Tất cả", "Tin tức họ tộc", "Lịch sử tích cổ", "Gương sáng học tập", "Thông tri khẩn"];

  const filteredArticles = useMemo(() => {
    return articles.filter(a => {
      const matchSearch = a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          a.author.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = selectedCategory === "Tất cả" || a.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [articles, searchTerm, selectedCategory]);

  const handleCreateArticle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    const slug = title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "-");

    const nextArticle: WebArticle = {
      id: editingArticleId || "art_" + Date.now(),
      title,
      slug,
      category,
      author,
      summary,
      content,
      publishDate: editingArticleId
        ? articles.find((article) => article.id === editingArticleId)?.publishDate || new Date().toLocaleDateString("vi-VN")
        : new Date().toLocaleDateString("vi-VN"),
      status,
      views: editingArticleId ? articles.find((article) => article.id === editingArticleId)?.views || 0 : 1,
      coverImage: coverUrl || "/images/ancient_temple_roof_1779856049722.png"
    };

    commitArticles(prev => editingArticleId
      ? prev.map((article) => article.id === editingArticleId ? nextArticle : article)
      : [nextArticle, ...prev]
    );
    setActiveArticle(nextArticle);
    resetArticleForm();
    setIsOpenAdd(false);
  };

  const deleteArticle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    commitArticles(prev => prev.filter(a => a.id !== id));
    if (activeArticle?.id === id) {
      setActiveArticle(null);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header statistical metrics of published content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1 */}
        <div className="bg-white p-4 rounded-xl border border-stone-150 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-stone-400 font-bold block text-[10px] uppercase tracking-wider">Tổng Bài Viết Portal</span>
            <p className="text-xl font-bold font-serif text-stone-800">{articles.length} Bản tin biên khảo</p>
            <span className="text-[10px] text-stone-400 block">Đặc tập: {articles.filter(a => a.status === 'Đăng tải').length} Published</span>
          </div>
          <div className="h-10 w-10 rounded-lg bg-red-50 text-red-850 flex items-center justify-center border border-red-100 shrink-0">
            <FileText className="h-5 w-5" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white p-4 rounded-xl border border-stone-150 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-stone-400 font-bold block text-[10px] uppercase tracking-wider font-semibold">Tông Lượt Xem Độc Giả</span>
            <p className="text-xl font-mono font-extrabold text-stone-850">
              {articles.reduce((sum, a) => sum + a.views, 0).toLocaleString()} lượt đọc
            </p>
            <span className="text-[10px] text-emerald-600 block">✓ Phản hồi từ con cháu họ tộc cao</span>
          </div>
          <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 shrink-0">
            <Eye className="h-5 w-5" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white p-4 rounded-xl border border-stone-150 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-stone-400 font-bold block text-[10px] uppercase tracking-wider">Trạng thái công khai portal</span>
            <p className="text-sm font-bold font-serif text-emerald-700 flex items-center gap-1.5 leading-none mt-1">
              <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse inline-block" /> Đang truyền mạng
            </p>
            <span className="text-[10px] text-stone-400 block mt-1">Cổng tin tức trực tuyến rạng rỡ</span>
          </div>
          <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100 shrink-0">
            <Globe className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Grid: Editor list vs interactive preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: List with search (7 columns) */}
        <div className="lg:col-span-7 bg-white border border-stone-150 rounded-xl shadow-sm p-4.5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
            <div>
              <h2 className="text-base font-serif font-semibold text-stone-850">
                Lập Bản Tin & Sử Ký Tộc Phả
              </h2>
              <p className="text-xs text-stone-500">
                Xuất bản các tin khẩn hỏa hoạn, lịch cúng tuần báo, gia thế tổ bối lên Trang mạng dòng tộc.
              </p>
            </div>
            <button 
              onClick={openCreateArticle}
              className="inline-flex self-start sm:self-center items-center gap-1.5 bg-red-800 hover:bg-red-950 text-white rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer shadow-sm transition-all"
            >
              <Plus className="h-3.5 w-3.5" /> Biên tập bài viết mới
            </button>
          </div>

          {/* Filters bar */}
          <div className="flex flex-col md:flex-row gap-2 text-xs">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-stone-400 pointer-events-none" />
              <input 
                type="text" 
                placeholder="Tìm tiêu đề hoặc tác giả bài viết..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-lg pl-8 pr-3 py-2 text-stone-800 focus:outline-none focus:border-amber-400 text-xs shadow-xs"
              />
            </div>

            {/* Selector list */}
            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none shrink-0">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded px-2.5 py-1.5 text-[10px] font-bold cursor-pointer whitespace-nowrap border ${
                    selectedCategory === cat 
                      ? "bg-red-950 border-red-900 text-amber-200" 
                      : "bg-stone-50 border-stone-150 text-stone-600 hover:bg-stone-100"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Simple Article List Cards */}
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {filteredArticles.length === 0 ? (
              <div className="text-center py-10 bg-stone-50 rounded-lg border border-dashed border-stone-200">
                <FileText className="h-8 w-8 text-stone-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-stone-600">Chưa tìm thấy bài viết tin tức nào</p>
                <p className="text-[10px] text-stone-400">Quý nhân soạn nháp bài tin tế lễ biên biên.</p>
              </div>
            ) : (
              filteredArticles.map((art) => (
                <div 
                  key={art.id}
                  onClick={() => setActiveArticle(art)}
                  className={`group border rounded-xl p-4.5 text-xs transition-all cursor-pointer text-left flex gap-4 ${
                    activeArticle?.id === art.id 
                      ? "bg-amber-500/5 border-amber-900/30 shadow-xs" 
                      : "bg-stone-50/50 hover:bg-white border-stone-150 hover:shadow-xs"
                  }`}
                >
                  {/* cover image mini */}
                  {art.coverImage && (
                    <div className="hidden sm:block h-20 w-24 rounded-lg bg-stone-100 overflow-hidden shrink-0 border border-stone-200">
                      <img 
                        src={art.coverImage} 
                        alt="" 
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      />
                    </div>
                  )}

                  <div className="grow space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-red-50 text-red-800 border border-red-100 px-2 py-0.5 font-bold text-[9px] uppercase tracking-wider">
                        {art.category}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                        art.status === "Đăng tải" 
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-100" 
                          : "bg-amber-50 text-amber-800 border border-amber-100"
                      }`}>
                        {art.status}
                      </span>
                    </div>

                    <h3 className="font-bold font-serif text-[13px] leading-snug text-stone-850 group-hover:text-red-900 transition-colors line-clamp-1">
                      {art.title}
                    </h3>

                    <p className="text-stone-500 leading-relaxed text-[11px] line-clamp-2 italic font-serif">
                      {art.summary}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-[10px] text-stone-400 font-medium">
                      <span className="flex items-center gap-1"><User className="h-3 w-3 text-stone-400" /> {art.author}</span>
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3 text-stone-400" /> {art.publishDate}</span>
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3 text-stone-400" /> {art.views} views</span>
                      <button
                        onClick={(e) => openEditArticle(art, e)}
                        className="ml-auto text-stone-300 hover:text-amber-800 p-1 rounded hover:bg-amber-50 transition-colors cursor-pointer"
                        title="Sửa bài viết"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyArticleLink(getArticleShortUrl(art), `short-${art.id}`);
                        }}
                        className="text-stone-300 hover:text-emerald-800 p-1 rounded hover:bg-emerald-50 transition-colors cursor-pointer"
                        title="Sao chép link rút gọn"
                      >
                        {copiedLinkLabel === `short-${art.id}` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                      <button 
                        onClick={(e) => deleteArticle(art.id, e)}
                        className="text-stone-300 hover:text-red-800 p-1 rounded hover:bg-red-50 transition-colors cursor-pointer"
                        title="Xóa bài viết"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: News Portal Preview (5 columns) */}
        <div className="lg:col-span-5 bg-[#fbfaf6] border border-amber-200/50 rounded-xl p-5 shadow-sm min-h-[400px]">
          {activeArticle ? (
            <div className="space-y-4">
              {/* Box Title indicator */}
              <div className="flex items-center justify-between border-b border-amber-200/40 pb-2 text-xs">
                <span className="font-bold text-stone-400 uppercase tracking-widest text-[9px] flex items-center gap-1">
                  <Globe className="h-3.5 w-3.5 text-emerald-600" />
                  Màn Thử Xem Đăng Portal trang mạng
                </span>
                <span className="font-mono text-[10px] font-bold text-stone-500">Slug: {activeArticle.slug}</span>
              </div>

              <div className="rounded-lg border border-amber-200/60 bg-white/70 p-2.5 space-y-2 text-[10px]">
                <div className="flex items-center gap-2">
                  <Link className="h-3.5 w-3.5 text-amber-800 shrink-0" />
                  <span className="min-w-0 flex-1 truncate font-mono text-stone-600">{getArticleShareUrl(activeArticle)}</span>
                  <button
                    type="button"
                    onClick={() => copyArticleLink(getArticleShareUrl(activeArticle), `share-${activeArticle.id}`)}
                    className="rounded border border-stone-200 bg-white px-2 py-1 font-bold text-stone-600 hover:text-red-800"
                  >
                    {copiedLinkLabel === `share-${activeArticle.id}` ? "Đã copy" : "Copy link"}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <Copy className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                  <span className="min-w-0 flex-1 truncate font-mono text-stone-600">{getArticleShortUrl(activeArticle)}</span>
                  <button
                    type="button"
                    onClick={() => copyArticleLink(getArticleShortUrl(activeArticle), `short-preview-${activeArticle.id}`)}
                    className="rounded border border-stone-200 bg-white px-2 py-1 font-bold text-stone-600 hover:text-emerald-800"
                  >
                    {copiedLinkLabel === `short-preview-${activeArticle.id}` ? "Đã copy" : "Copy rút gọn"}
                  </button>
                </div>
              </div>

              {/* Cover Banner rendering */}
              {activeArticle.coverImage && (
                <div className="w-full h-36 rounded-lg bg-stone-100 overflow-hidden border border-amber-900/10 shadow-inner">
                  <img src={activeArticle.coverImage} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                </div>
              )}

              {/* Post body header */}
              <div className="space-y-2 text-left">
                <span className="text-[10px] uppercase font-bold text-red-900 tracking-wider">
                  {activeArticle.category} • Bản tin số #{activeArticle.id}
                </span>
                <h1 className="text-lg leading-tight font-serif font-black tracking-tight text-amber-950">
                  {activeArticle.title}
                </h1>

                {/* Meta details */}
                <div className="flex items-center gap-3.5 text-[10px] text-stone-500 font-medium py-1.5 border-y border-amber-200/20">
                  <span className="flex items-center gap-1 font-bold text-amber-900">
                    <User className="h-3 w-3" /> Tác giả: {activeArticle.author}
                  </span>
                  <span className="flex items-center gap-1 font-mono">
                    <Calendar className="h-3 w-3" /> {activeArticle.publishDate}
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" /> {activeArticle.views} lượt xem
                  </span>
                </div>
              </div>

              {/* Rich contents area */}
              <div className="font-serif leading-relaxed text-[11.5px] text-stone-800 space-y-3 whitespace-pre-wrap select-text px-1 max-h-[250px] overflow-y-auto font-medium">
                {activeArticle.content}
              </div>

              {/* Box advice foot */}
              <div className="bg-amber-500/10 border border-amber-500/20 p-2 text-[10px] rounded text-stone-600 leading-normal text-center select-none font-bold">
                📢 Bài viết này đã sẵn sàng đồng bộ trực tuyến lên Trang mạng chủ đề công khai dòng tộc Cao Trường Yên.
              </div>
            </div>
          ) : (
            <div className="text-center py-24 select-none">
              <Eye className="h-10 w-10 text-stone-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-stone-600">Chưa có bài viết tuyển chọn</p>
              <p className="text-[10px] text-stone-400 mt-1">Xin click chọn 01 bản ghi chép ở dãy bên trái để thực hiện chế độ xem thử live-preview bài viết của quý nhân.</p>
            </div>
          )}
        </div>

      </div>

      {/* Add New Article Modal */}
      <AnimatePresence>
        {isOpenAdd && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl overflow-hidden shadow-2xl max-w-xl w-full border border-stone-200 flex flex-col max-h-[90vh]"
            >
              {/* Modal header */}
              <div className="bg-red-950 px-5 py-4 text-white flex items-center justify-between border-b border-amber-900/40">
                <h3 className="font-serif font-bold text-base text-amber-100">
                  Biên Soạn Sử Ký & Bản Tin Họ Tộc mới
                </h3>
                <button 
                  onClick={() => {
                    setIsOpenAdd(false);
                    resetArticleForm();
                  }}
                  className="rounded-full hover:bg-white/10 p-1 text-stone-300 transition-all cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form body */}
              <form onSubmit={handleCreateArticle} className="p-5 overflow-y-auto space-y-4 text-xs">
                
                {/* Title */}
                <div className="space-y-1">
                  <label className="font-semibold text-stone-700 block col-span-2">Tiêu đề bài viết bản tin:*</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Ví dụ: Đại lễ tảo mộ Thung Lá xuân năm nay" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Category */}
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Chủ đề biên lý:*</label>
                    <select 
                      value={category}
                      onChange={(e) => setCategory(e.target.value as any)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800"
                    >
                      <option value="Tin tức họ tộc">Tin tức họ tộc</option>
                      <option value="Lịch sử tích cổ">Lịch sử tích cổ</option>
                      <option value="Gương sáng học tập">Gương sáng học tập</option>
                      <option value="Thông tri khẩn">Thông tri khẩn</option>
                    </select>
                  </div>
                  
                  {/* Author */}
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Danh tánh Tác giả biên soạn:*</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ông Cao Xuân Hòa" 
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* cover image */}
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block inline-flex items-center gap-1"><Image className="h-3.5 w-3.5 text-stone-400" /> Đường dẫn ảnh bìa minh họa (URL):</label>
                    <input 
                      type="text" 
                      placeholder="/images/ancient_temple_roof_1779856049722.png hoặc URL ảnh đã xác minh" 
                      value={coverUrl}
                      onChange={(e) => setCoverUrl(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850 font-mono text-[10px]"
                    />
                  </div>

                  {/* publish status */}
                  <div className="space-y-1">
                    <label className="font-semibold text-stone-700 block">Kích hoạt đăng mạng:*</label>
                    <select 
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800"
                    >
                      <option value="Đăng tải">Công khai (Đăng tải trực tiếp)</option>
                      <option value="Bản nháp">Bản nháp lưu chữ</option>
                    </select>
                  </div>
                </div>

                {/* ✨ AI Autocomposer & Custom Draft box */}
                <div className="bg-amber-500/5 rounded-lg border border-amber-500/20 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-serif font-bold text-xs text-amber-900 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                      Trợ lý soạn thảo văn tự AI
                      <span className="bg-amber-100 text-[9px] text-amber-800 font-bold px-1.5 py-0.5 rounded border border-amber-200 font-mono">
                        {aiConfig?.engineArticles || "ChatGPT (GPT-4o)"}
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={isGeneratingAI}
                      onClick={handleAIGenerateArticle}
                      className="cursor-pointer inline-flex items-center gap-1 bg-amber-800 hover:bg-amber-950 text-white rounded px-2.5 py-1 text-[10px] font-bold shadow-xs transition-all"
                    >
                      {isGeneratingAI ? (
                        <>
                          <span className="animate-spin h-2.5 w-2.5 border-2 border-white border-t-transparent rounded-full" />
                          Đang khởi soạn...
                        </>
                      ) : (
                        "Khởi bút lập tức"
                      )}
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="space-y-1">
                      <label className="text-stone-500 font-semibold block">Chủ điểm muốn thảo hợp vị:</label>
                      <select 
                        value={aiSubject}
                        onChange={(e) => setAiSubject(e.target.value)}
                        className="w-full bg-white border border-stone-200 rounded px-1.5 py-1 focus:outline-none focus:border-red-800 text-stone-800 text-[10px]"
                      >
                        <option value="Đại lễ tảo mộ và giỗ Tổ rằm tháng Ba">Tảo mộ & Giỗ Tổ Thung Lá</option>
                        <option value="Biên phả lịch sử Cao Tổ Cao Đình Thuật và Thủy Tổ Cao Đình Lạng">Lịch sử Cao Tổ - Thủy Tổ</option>
                        <option value="Đóng hiến trùng tu ngôi Hữu vu chính tẩm">Quyên đóng trùng tu Hữu Vu</option>
                        <option value="Tuyên dương hiền tài đằng khoa dòng họ niên học mới">Vinh danh Khuyến học giữa thu</option>
                        <option value="Quản phòng hỏa hoạn nhà mộc linh tế Thượng điện cổ">Khẩn cáo phòng hỏa Từ Đường</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-stone-500 font-semibold block">Ghi chú ngữ cảnh phụ (tùy chọn):</label>
                      <input 
                        type="text"
                        placeholder="Ví dụ: trao học bổng 2,000,000đ..."
                        value={aiSubNotes}
                        onChange={(e) => setAiSubNotes(e.target.value)}
                        className="w-full bg-white border border-stone-200 rounded px-1.5 py-1 focus:outline-none focus:border-red-800 text-stone-800 text-[10px]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div className="space-y-1">
                      <label className="text-stone-500 font-semibold block">Tiết khí:</label>
                      <input
                        type="text"
                        value={aiSolarTerm}
                        onChange={(e) => setAiSolarTerm(e.target.value)}
                        placeholder="Ví dụ: Thanh Minh"
                        className="w-full bg-white border border-stone-200 rounded px-1.5 py-1 focus:outline-none focus:border-red-800 text-stone-800 text-[10px]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-stone-500 font-semibold block">Sự kiện:</label>
                      <select
                        value={aiEventContext}
                        onChange={(e) => {
                          const value = e.target.value;
                          const selected = eventSuggestions.find((event) => event.id === value);
                          setAiEventContext(value);
                          if (selected?.location && !aiLocationContext.trim()) setAiLocationContext(selected.location);
                        }}
                        className="w-full bg-white border border-stone-200 rounded px-1.5 py-1 focus:outline-none focus:border-red-800 text-stone-800 text-[10px]"
                      >
                        <option value="">Tự nhập theo chủ đề</option>
                        {eventSuggestions.map((event) => (
                          <option key={event.id} value={event.id}>{event.title}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-stone-500 font-semibold block">Địa điểm:</label>
                      <input
                        type="text"
                        value={aiLocationContext}
                        onChange={(e) => setAiLocationContext(e.target.value)}
                        placeholder="Ví dụ: Hoa Lư, Thung Lá"
                        className="w-full bg-white border border-stone-200 rounded px-1.5 py-1 focus:outline-none focus:border-red-800 text-stone-800 text-[10px]"
                      />
                    </div>
                  </div>
                  {knowledgeDocs.length > 0 && (
                    <div className="text-[9px] text-emerald-800 font-medium border-t border-amber-500/10 pt-1.5 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                      Tự động liên kết học tập sâu sắc từ {knowledgeDocs.length} tài liệu phả hệ sẵn có!
                    </div>
                  )}
                </div>

                {/* Summary field */}
                <div className="space-y-1">
                  <label className="font-semibold text-stone-700 block col-span-2">Mô tả tóm tắt văn điệu:*</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Viết một dòng khơi mở vấn đề vắn tắt..." 
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-850 italic"
                  />
                </div>

                {/* Content body textarea with Word-like rich formatting toolbar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-stone-700 block">Nội dung chi tiết toàn sớ (Hỗ trợ Định dạng Word):*</label>
                    <span className="text-[10px] text-stone-400 italic">Chọn văn bản rồi bấm phím công cụ để bọc nhanh</span>
                  </div>

                  {/* Word formatting toolbar bar */}
                  <div className="flex flex-wrap items-center gap-1 bg-stone-100 border border-stone-200 rounded p-1 shadow-xs text-[10px] text-stone-600 font-bold select-none">
                    <span className="text-[9px] uppercase tracking-wider text-stone-400 px-1">Soạn Thảo:</span>
                    <button type="button" onClick={() => insertFormatting("**", "**")} title="In đậm (Bold)" className="p-1 hover:bg-stone-200 cursor-pointer rounded text-stone-800 border border-stone-150 bg-white"><Bold className="h-3 w-3" /></button>
                    <button type="button" onClick={() => insertFormatting("*", "*")} title="In nghiêng (Italic)" className="p-1 hover:bg-stone-200 cursor-pointer rounded text-stone-800 border border-stone-150 bg-white"><Italic className="h-3 w-3" /></button>
                    <button type="button" onClick={() => insertFormatting("<u>", "</u>")} title="Gạch dưới (Underline)" className="p-1 hover:bg-stone-200 cursor-pointer rounded text-stone-800 border border-stone-150 bg-white"><Underline className="h-3 w-3" /></button>
                    <div className="h-4 w-px bg-stone-300 mx-1" />
                    <button type="button" onClick={() => insertFormatting("\n# ", "\n")} title="Tiêu đề H1" className="px-1.5 py-0.5 hover:bg-stone-200 cursor-pointer rounded text-stone-800 border border-stone-150 bg-white text-[9px] font-serif leading-none">H1</button>
                    <button type="button" onClick={() => insertFormatting("\n## ", "\n")} title="Tiêu đề H2" className="px-1.5 py-0.5 hover:bg-stone-200 cursor-pointer rounded text-stone-800 border border-stone-150 bg-white text-[9px] font-serif leading-none">H2</button>
                    <button type="button" onClick={() => insertFormatting("\n> *", "*\n")} title="Trích dẫn cổ" className="p-1 hover:bg-stone-200 cursor-pointer rounded text-stone-800 border border-stone-150 bg-white"><Quote className="h-3 w-3" /></button>
                    <button type="button" onClick={() => insertFormatting("\n- ", "\n")} title="Liệt kê dòng" className="p-1 hover:bg-stone-200 cursor-pointer rounded text-stone-800 border border-stone-150 bg-white"><List className="h-3 w-3" /></button>
                    <button type="button" onClick={() => insertFormatting("[Tên hiển thị](", ")")} title="Chèn liên kết" className="p-1 hover:bg-stone-200 cursor-pointer rounded text-stone-800 border border-stone-150 bg-white"><Link className="h-3 w-3" /></button>
                    <button type="button" onClick={() => insertFormatting("\n---\n")} title="Đường phân cách" className="p-1 hover:bg-stone-200 cursor-pointer rounded text-stone-800 border border-stone-150 bg-white"><Minus className="h-3 w-3" /></button>
                  </div>

                  <textarea 
                    id="articleContentTextarea"
                    rows={10}
                    required
                    placeholder="Nhập nội dung biên soạn sử văn tế tổ bái tại đây... (Hoặc tuyển dụng trợ lý AI biên thảo tự động ở khung trên)" 
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-red-800 text-stone-800 font-serif leading-relaxed text-xs resize-none"
                  />
                </div>

                {/* Footer buttons */}
                <div className="flex gap-2 justify-end pt-3 border-t border-stone-100 shrink-0">
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsOpenAdd(false);
                      resetArticleForm();
                    }}
                    className="bg-stone-100 border border-stone-200 hover:bg-stone-250 rounded px-4 py-2 font-semibold text-stone-800 cursor-pointer"
                  >
                    Bỏ qua
                  </button>
                  <button 
                    type="submit" 
                    className="bg-red-800 hover:bg-red-950 text-white rounded px-4 py-2 font-bold cursor-pointer transition-all flex items-center gap-1 shadow-sm"
                  >
                    Kính chép xuất bản bài viết
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
