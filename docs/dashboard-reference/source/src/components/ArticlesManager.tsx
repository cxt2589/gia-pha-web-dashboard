import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FileText, Plus, Search, Eye, Edit, Trash2, Globe, Clock, Check, X, Calendar, User, Bookmark, Image, Sparkles, Bold, Italic, Underline, Heading1, Heading2, Quote, List, Link, Minus } from "lucide-react";
import { WebArticle, KnowledgeBaseDocument } from "../types";

interface ArticlesManagerProps {
  aiConfig?: {
    engineCeremony: string;
    engineArticles: string;
    engineChat: string;
    engineZalo: string;
    apiKey?: string;
  };
  knowledgeDocs?: KnowledgeBaseDocument[];
}

export default function ArticlesManager({ aiConfig, knowledgeDocs = [] }: ArticlesManagerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Tất cả");

  // Mock articles base
  const [articles, setArticles] = useState<WebArticle[]>([
    {
      id: "art1",
      title: "Đại lễ khánh thành nhà bia Thượng điện dòng họ Cao Ninh Bình",
      slug: "khanh-thanh-nha-bia-thuong-dien-cao-ninh-binh",
      category: "Tin tức họ tộc",
      author: "Trưởng ban trị sự Cao Xuân Viết",
      summary: "Sau sáu tháng phát tâm tôn tạo, công sự dựng tạc dãy bia đá mộc bản ghi danh tổ tiên và trùng tu điện thờ Thượng diện đã được khánh thành trang nghiêm khang thái...",
      content: "Kính lạy Tiên tổ dòng họ Cao Ninh Bình!\n\nNhờ hồng ân giội đức của đức Thủy Tổ Cao Quý Công cùng anh linh tổ tông ba chi tế phái, vào ngày mùng 10 xuân niên vừa qua, Ban Trị Sự Hội đồng gia tộc cùng con cháu xa gần hải xứ đã đồng tâm tề tựu tại Thôn Trung, xã Trường Yên, Hoa Lư tiến lễ tụ hội cắt băng khánh thành Thượng Điện thờ cổ và dãy bia đá cổ truyền thần.\n\nCông sự trùng tu bao gồm:\n1. Phục dựng toàn diện vách gỗ mít điện thờ Thượng điện mười sáu cột.\n2. Chế tác và đóng mộc triện bộ Hoành phi câu đối sơn son thếp vàng dâng điện.\n3. Khắc dựng ba dãy bia mộc bản ghi danh cụ ông cụ bà khởi thủy đời 1 đến đời 5.\n\nTổng kinh phí trùng tu phát tâm thiện nguyện đạt con số 245,000,000 VND dâng hiến toàn phần bởi con cháu dòng tộc hỷ cúng. Thay mặt Ban trị sự, chúng tôi xin cúi sớ tạ ơn toàn thể quý ân nhân tộc đinh gia tử hiếu thảo...",
      publishDate: "28/05/2026",
      status: "Đăng tải",
      views: 742,
      coverImage: "https://images.unsplash.com/photo-1596436889106-be35e843f974?auto=format&fit=crop&w=800&q=80"
    },
    {
      id: "art2",
      title: "Gia thế và xuất bối chí sỹ của Thủy Tổ Cao Quý Công đời thứ nhất",
      slug: "gia-the-xuat-tich-thuy-to-cao-quy-cong-doi-1",
      category: "Lịch sử tích cổ",
      author: "Nhà nghiên cứu Cao Minh Tiến",
      summary: "Khảo cứu tư liệu gia phả cổ thư khắc trên mộc bản chữ nho niên hiệu Cảnh Hưng và Hồng Đức về nguồn cội cụ tổ họ Cao lập gia nghiệp ở Trương Yên...",
      content: "Theo tư liệu dòng họ Cao còn lưu giữ tại gia đình Chi Trưởng Trường Yên, Thủy Tổ dòng họ Cao tại Ninh Bình là cụ Cao Quý Công (Húy là Văn Lãm).\n\nSách sử tịch và mộc thư ghi nhận, Cụ sinh vào khoảng những năm niên hiệu Cảnh Trị triều vua Lê Huyền Tông, quê gốc ở vùng Thanh Hóa xưa. Vốn xuất thân khoa bảng nho giáo, cụ giữ phẩm trạch Chánh nhị phẩm tại triều đệ tam Lê Trung Hưng. Vào khoảng thập niên 1715, chứng kiến thời cuộc dâu bể, cụ cáo quan ẩn sỹ, tìm về vùng thung lũng lăng miếu sơn thanh thủy tú Hoa Lư định cơ.\n\nTại đây, cụ bắt đầu sự nghiệp khai điền lập ấp, giúp chiêu mộ dân lưu vong lập ra Thôn Trung ngày nay. Cụ sắm sửa đền bái tôn vinh Thánh mẫu, xây nương rẫy, răn dạy con cháu học hành nho giáo nghĩa khí. Sau khi cụ tạ thế ngày rằm tháng 3 năm Tân Mùi (1751), con cháu bái phụng, xây dựng am lăng yên giấc nghìn năm tại khu Thung Lá Gia Viễn...",
      publishDate: "15/05/2026",
      status: "Đăng tải",
      views: 1205,
      coverImage: "https://images.unsplash.com/photo-1508193638397-1c4234db14d8?auto=format&fit=crop&w=800&q=80"
    },
    {
      id: "art3",
      title: "Chương trình vinh danh Trạng Nguyên trẻ dâng hương phát học bổng",
      slug: "vinh-danh-trang-nguyen-tre-phat-hoc-bong-nien-khoa-moi",
      category: "Gương sáng học tập",
      author: "Ban khuyến học họ Cao Ninh Bình",
      summary: "Lễ vinh danh các cháu học sinh đỗ đạt cao học kỳ thi thủ khoa quốc gia và thạc sĩ hải ngoại trước án anh linh dòng tộc nhân ngày giỗ tổ rằm tháng ba...",
      content: "Trọng đạo hiếu kính, khích lệ hiền tài là cốt tủy phát triển của dòng tộc Cao Ninh Bình hơn ba trăm năm qua.\n\nNăm nay, Ban Khuyến Học vinh hạnh thông tri toàn gia tộc về kết quả thi cử xuất sắc niên khóa vừa qua của con cháu dòng họ:\n- 01 cháu đỗ Học vị Tiến sĩ Công nghệ thông tin học vị xuất sắc tại Viện hàn lâm.\n- 01 cháu đạt Thủ khoa Đại học Sư Phạm Hà Nội tuyển sinh khóa mới.\n- Hơn 50 cháu đạt giải cao học sinh giỏi cấp Tỉnh, Kỳ thi Olympic toàn quốc.\n\nLễ biểu dương và phát phần thưởng dâng hiến 'Trạng Nguyên trẻ dòng họ Cao' sẽ được Ban Trị Sự cử hành tôn nghiêm trước Đền đức Tổ Thượng Điện vào lúc 8h:00 rằm tháng Ba âm lịch. Kính xin quý phụ huynh và các cháu học sinh tề tựu sắm lễ báo công dâng kính anh linh tiên tổ soi đường.",
      publishDate: "20/05/2026",
      status: "Đăng tải",
      views: 459,
      coverImage: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=800&q=80"
    },
    {
      id: "art4",
      title: "Lời dụ khẩn: Hạn chế thắp hương trầm rực lửa tại nội điện Thượng điện thờ cổ",
      slug: "loi-du-khan-han-che-thap-huong-tram-trong-thuong-dien-co",
      category: "Thông tri khẩn",
      author: "Hội đồng Gia tộc bảo tồn điện thờ",
      summary: "Quy định mới về bảo vệ chống hỏa hoạn cho ngôi điện gỗ mít hơn 200 năm tuổi tránh hư hại linh vị gỗ cổ và bức hoành phi sơn son...",
      content: "Hội đồng Ban Trị Sự cùng Ban Khánh tiết tôn bảo di tích điện cổ dòng họ Cao Ninh Bình khẩn báo quý bà con xa gần:\n\nDo di tích Thượng Điện cúng tổ đường Hoa Lư được dựng hoàn toàn ròng rã bằng chất liệu cột mít gỗ tre mây tự nhiên đã trải qua hơn hai trăm năm tuổi, gỗ khô nhạy bén rực lửa.\n\nĐể gìn giữ hoành phi sơn son thếp vàng, bài vị gia phong cổ nho liêm và ngăn ngừa rủi ro hỏa hoạn cực đoan, Ban Trị sự thiết lập điều lệ khẩn bái tế tự từ nay:\n1. Con cháu dâng hương ngoài đỉnh lư hương đồng ngoài sân rồng chính.\n2. Cấm tuyệt đối thắp hương cây lớn, châm đèn dầu thả lỏng bên trong nội điện.\n3. Chỉ túc túc thắp 03 búp hương dâng mộc tế lư chủ trì tuyên sớ sắm hương bởi o thừa tế trưởng phái.\n\nRất mong quý nhân dòng tộc hoan hỷ chấp thuận nghiêm ngặt để di sản tổ tế đời đời ấm êm...",
      publishDate: "29/05/2026",
      status: "Bản nháp",
      views: 18,
      coverImage: "https://images.unsplash.com/photo-1547989453-11e67ffb3885?auto=format&fit=crop&w=800&q=80"
    }
  ]);

  const [activeArticle, setActiveArticle] = useState<WebArticle | null>(articles[0]);
  const [isOpenAdd, setIsOpenAdd] = useState(false);

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
    try {
      const promptText = `Hãy thảo tạc một bài văn/bản tin chính thống truyền thông trên website dòng tộc Cao Ninh Binh.
      - Chủ sớ chính đề: ${aiSubject}
      - Chú ý quan yếu kèm riêng: ${aiSubNotes || "Chú trọng văn phong tôn cổ lịch lãm, nêu bật tấm gương hiếu nghĩa tiên tổ"}
      Hãy trả về chính xác kết cấu nội dung ngắn gọn phân tách rõ ràng qua ba mục lớn ngăn cách bởi phân cách thẻ [PART] duy nhất:
      Mục 1: Tiêu đề lừng lẫy (Đừng quá dài, tối đa 15 từ)
      [PART]
      Mục 2: Mô tả tấm tắc ngắn một câu duy nhất
      [PART]
      Mục 3: Toàn văn sớ chi tiết trôi chảy, có các hàng mục rõ ràng xuống dòng, xưng hô tôn kính tổ đức.`;

      const response = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptText,
          type: "appeal",
          documents: knowledgeDocs
        })
      });

      if (!response.ok) {
        throw new Error("Không thể liên kết đến đầu cổng trí tuệ nhân tạo.");
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

    const newArt: WebArticle = {
      id: "art_" + Date.now(),
      title,
      slug,
      category,
      author,
      summary,
      content,
      publishDate: new Date().toLocaleDateString("vi-VN"),
      status,
      views: 1,
      coverImage: coverUrl || "https://images.unsplash.com/photo-1596436889106-be35e843f974?auto=format&fit=crop&w=800&q=80"
    };

    setArticles(prev => [newArt, ...prev]);
    setTitle("");
    setSummary("");
    setContent("");
    setIsOpenAdd(false);
  };

  const deleteArticle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setArticles(prev => prev.filter(a => a.id !== id));
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
              onClick={() => setIsOpenAdd(true)}
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
                        onClick={(e) => deleteArticle(art.id, e)}
                        className="ml-auto text-stone-300 hover:text-red-800 p-1 rounded hover:bg-red-50 transition-colors cursor-pointer"
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
                  onClick={() => setIsOpenAdd(false)}
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
                      placeholder="https://images.unsplash.com/..." 
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
                        <option value="Biên phả lịch sử gia thế Thủy Tổ cụ Cao Quý Công">Lịch sử Thủy Tổ Cao Quý Công</option>
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
                    onClick={() => setIsOpenAdd(false)}
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
