import React, { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ClipboardList,
  Database,
  FileSearch,
  FileText,
  Globe2,
  MessageSquare,
  PenLine,
  RefreshCw,
  Send,
  Settings,
  Sparkles,
  UploadCloud,
  Wand2,
  Zap
} from "lucide-react";
import {
  AIModelConfig,
  ClanEvent,
  FamilyMember,
  KnowledgeBaseDocument,
  TreasuryTx,
  WebArticle,
  ZaloAutoReply
} from "../types";

type AIGovernorProps = {
  members: FamilyMember[];
  events: ClanEvent[];
  transactions: TreasuryTx[];
  articles: WebArticle[];
  knowledgeDocs: KnowledgeBaseDocument[];
  aiConfig: AIModelConfig;
  zaloRules: ZaloAutoReply[];
  onKnowledgeDocsChange: (docs: KnowledgeBaseDocument[]) => void;
  onArticlesChange: (articles: WebArticle[]) => void;
  onZaloRulesChange: (rules: ZaloAutoReply[]) => void;
  onSetActiveTab: (tab: string) => void;
  onSetAIInitialPrompt: (prompt: string, type: string) => void;
};

type AuditItem = {
  id: string;
  level: "warning" | "info" | "good";
  title: string;
  detail: string;
  action: string;
  targetTab: string;
};

type WebviewSuggestion = {
  id: string;
  title: string;
  detail: string;
  impact: string;
  status: "pending" | "approved" | "applied";
};

const KNOWLEDGE_CATEGORY: KnowledgeBaseDocument["category"] = "Gia phả học";
const DRAFT_CATEGORY: WebArticle["category"] = "Tin tức họ tộc";
const DRAFT_STATUS: WebArticle["status"] = "Bản nháp";

const DEFAULT_ZALO_RULES: ZaloAutoReply[] = [
  {
    id: "r1",
    keyword: "lichsu",
    replyType: "text",
    replyContent: "Theo dữ liệu phả hệ hiện có, Cao Tổ đời 0 là cụ Cao Đình Thuật (高 廷 術), tước hiệu Cao Cao Mãnh Đế Đại Tướng Quân; đời 1 là Thủy Tổ Cao Đình Lạng (高 廷 兩). Các thông tin chi tiết từng nhân vật cần đăng nhập và hoàn tất KYC để xem.",
    usageCount: 142,
    isActive: true
  },
  {
    id: "r2",
    keyword: "giado",
    replyType: "card",
    replyContent: "Lịch giỗ theo dữ liệu đang có: cụ Cao Đình Lạng có ngày 10/3 âm lịch; cụ Cao Đình Thuật có ngày 15/3 Canh Ngọ. Ban trị sự cần đối chiếu lại tài liệu gốc trước khi phát thông báo chính thức.",
    usageCount: 94,
    isActive: true
  },
  {
    id: "r3",
    keyword: "donggop",
    replyType: "text",
    replyContent: "Kính thưa quý tộc đinh hào hiệp, quý vị có thể phát tâm quyên dâng trùng tu ngôi Từ đường hoặc ủng hộ quỹ khuyến học niên khóa mới qua Tài khoản dòng họ hoặc nộp trực tiếp tại Thủ Quỹ.",
    usageCount: 65,
    isActive: true
  },
  {
    id: "r4",
    keyword: "lienhe",
    replyType: "text",
    replyContent: "Ban trị sự hội đồng gia tộc họ Cao. Địa chỉ, số điện thoại và người phụ trách liên hệ cần được cấu hình theo dữ liệu thật trước khi phát công khai.",
    usageCount: 22,
    isActive: true
  }
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function truncateText(value: string, length = 180) {
  const clean = String(value || "").replace(/\s+/g, " ").trim();
  return clean.length > length ? `${clean.slice(0, length)}...` : clean;
}

function normalizeSlug(value: string) {
  return String(value || "ban-nhap-ai")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 90) || `ban-nhap-ai-${Date.now()}`;
}

function normalizeKeyword(value: string) {
  return normalizeSlug(value).replace(/-/g, "").slice(0, 28) || "giapha";
}

function getDraftTitle(text: string, fallback: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, "").replace(/^Mục\s*\d+\s*:\s*/i, "").trim())
    .filter(Boolean);
  const title = lines.find((line) => line.length >= 8 && line.length <= 120 && !line.startsWith("-"));
  return title || truncateText(fallback, 86) || "Bản nháp AI dòng họ Cao";
}

function getDraftSummary(text: string, title: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .filter(Boolean)
    .filter((line) => line !== title);
  return truncateText(lines.find((line) => line.length > 40) || text, 180);
}

export default function AIGovernor({
  members,
  events,
  transactions,
  articles,
  knowledgeDocs,
  aiConfig,
  zaloRules,
  onKnowledgeDocsChange,
  onArticlesChange,
  onZaloRulesChange,
  onSetActiveTab,
  onSetAIInitialPrompt
}: AIGovernorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeMode, setActiveMode] = useState<"overview" | "knowledge" | "content" | "channels">("overview");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);
  const [isScanningSystem, setIsScanningSystem] = useState(false);
  const [articleBrief, setArticleBrief] = useState("Viết bài giới thiệu dòng họ Cao dựa trên dữ liệu gia phả, sự kiện và tài liệu đã nạp.");
  const [generatedText, setGeneratedText] = useState("");
  const [templateText, setTemplateText] = useState("");
  const [systemScanReport, setSystemScanReport] = useState("");
  const [uploadNote, setUploadNote] = useState("");
  const [zaloKeyword, setZaloKeyword] = useState("giapha");
  const [zaloRuleText, setZaloRuleText] = useState("");
  const [suggestions, setSuggestions] = useState<WebviewSuggestion[]>([
    {
      id: "replace-sample-articles",
      title: "Thay các bài viết còn giống dữ liệu mẫu",
      detail: "AI soạn bản nháp mới từ dữ liệu gia phả, lịch giỗ, tiết khí và tài liệu đã tải lên.",
      impact: "Tạo bản nháp trong Quản lý Bài viết để admin duyệt trước khi đăng.",
      status: "pending"
    },
    {
      id: "zalo-common-rule",
      title: "Tạo rule Zalo trả lời câu hỏi gia phả cơ bản",
      detail: "Từ khóa mặc định gợi ý: giapha. Nội dung trả lời dẫn người dùng tới đăng nhập/KYC nếu hỏi chi tiết nhân vật.",
      impact: "Thêm trực tiếp vào Quản lý Zalo Bot.",
      status: "pending"
    },
    {
      id: "web-chatbox-policy",
      title: "Chuẩn hóa chính sách trả lời chatbox web",
      detail: "AI chỉ trả lời dữ liệu công khai khi khách chưa KYC, và hướng dẫn đăng nhập khi hỏi thông tin chi tiết.",
      impact: "Đưa prompt sang Trợ lý AI để tạo quy tắc triển khai.",
      status: "pending"
    },
    {
      id: "knowledge-template",
      title: "Tạo mẫu viết bài từ tài liệu tự tải lên",
      detail: "Kho tri thức sẽ sinh mẫu bài/thư trả lời dựa trên chính tài liệu admin vừa nạp, không chỉ dựa vào mẫu có sẵn.",
      impact: "Sinh mẫu trong tab Kho tri thức để dùng lại cho bài viết/Zalo.",
      status: "pending"
    }
  ]);

  const auditItems = useMemo<AuditItem[]>(() => {
    const items: AuditItem[] = [];
    const sampleArticles = articles.filter((article) => {
      const haystack = [article.title, article.summary, article.content, article.coverImage || ""].join(" ").toLowerCase();
      return /mẫu|demo|placeholder|unsplash|lorem|thử xem|bản tin biên khảo/.test(haystack);
    });
    const missingProfilePhoto = members.filter((member) => !member.photo).length;
    const missingBio = members.filter((member) => !member.bio && !member.title && !member.deathAnniversaryLunar).length;
    const upcomingEvents = events.filter((event) => event.status !== "Đã hoàn thành");

    if (sampleArticles.length > 0) {
      items.push({
        id: "sample-articles",
        level: "warning",
        title: `${sampleArticles.length} bài viết có dấu hiệu nội dung mẫu`,
        detail: `AI phát hiện tiêu đề, ảnh hoặc mô tả có dấu hiệu dữ liệu demo: ${sampleArticles.slice(0, 3).map((a) => a.title).join(", ")}.`,
        action: "Mở quản lý bài viết",
        targetTab: "articles"
      });
    }

    if (missingProfilePhoto > 0) {
      items.push({
        id: "missing-photo",
        level: "info",
        title: `${formatNumber(missingProfilePhoto)} nhân vật chưa có ảnh chân dung`,
        detail: "Có thể ưu tiên bổ sung ảnh cho các cụ/người đại diện chi ngành để hồ sơ xác thực thuyết phục hơn.",
        action: "Mở gia phả",
        targetTab: "tree"
      });
    }

    if (missingBio > 0) {
      items.push({
        id: "missing-bio",
        level: "info",
        title: `${formatNumber(missingBio)} hồ sơ còn thiếu hành trạng`,
        detail: "AI có thể gợi ý đoạn mô tả ngắn từ đời, chi ngành, cha mẹ, ngày sinh mất và thông tin Excel đã nhập.",
        action: "Tạo prompt bổ sung",
        targetTab: "ai"
      });
    }

    if (upcomingEvents.length > 0) {
      items.push({
        id: "event-content",
        level: "good",
        title: "Có dữ liệu sự kiện để sinh nội dung mới",
        detail: `Sự kiện gần nhất: ${upcomingEvents[0].title}. Có thể kết hợp tiết khí, địa điểm và lịch giỗ để viết bài.`,
        action: "Soạn bài từ sự kiện",
        targetTab: "articles"
      });
    }

    return items;
  }, [articles, events, members]);

  const systemCoverage = useMemo(() => {
    const treasuryTotal = transactions.reduce((sum, tx) => sum + (tx.type === "Thu" ? tx.amount : -tx.amount), 0);
    return [
      { label: "Nhân vật gia phả", value: formatNumber(members.length), hint: "nguồn xác thực hồ sơ" },
      { label: "Tài liệu AI", value: formatNumber(knowledgeDocs.length), hint: "đã nạp vào kho tri thức" },
      { label: "Bài viết", value: formatNumber(articles.length), hint: "cần rà soát mẫu" },
      { label: "Rule Zalo", value: formatNumber((zaloRules.length || DEFAULT_ZALO_RULES.length)), hint: "có thể tạo từ AI Tổng Quản" },
      { label: "Số dư quỹ", value: `${formatNumber(treasuryTotal)} đ`, hint: "dữ liệu tài chính tham chiếu" }
    ];
  }, [articles.length, knowledgeDocs.length, members.length, transactions, zaloRules.length]);

  const aiTouchpoints = useMemo(() => [
    {
      title: "AI Tổng Quản",
      location: "Dashboard / AI Tổng Quản",
      detail: "Tải tài liệu, tạo mẫu, tạo nháp bài viết, tạo rule Zalo và lập đề xuất sửa webview.",
      status: "Đã bổ sung hành động ghi dữ liệu thật",
      target: "ai-governor"
    },
    {
      title: "Trợ lý Dashboard",
      location: "Văn tế & Hán Nôm AI",
      detail: "Nhận prompt từ Tổng quan/Sự kiện/AI Tổng Quản, gọi /api/ai/chat và gửi kèm kho tri thức đã nạp.",
      status: `${knowledgeDocs.length} tài liệu đang được đưa vào ngữ cảnh`,
      target: "ai"
    },
    {
      title: "Quản lý Bài viết",
      location: "Bài viết / Trợ lý soạn thảo AI",
      detail: "Sinh tiêu đề, mô tả và nội dung từ chủ đề, tiết khí, sự kiện, địa điểm và tài liệu dòng họ.",
      status: "Đã nhận kho tri thức từ dashboard",
      target: "articles"
    },
    {
      title: "Zalo Bot",
      location: "Zalo / Từ khóa trả lời & phát tin",
      detail: "Sinh nội dung chiến dịch bằng AI; AI Tổng Quản có thể tạo rule trả lời tự động rồi lưu vào Zalo Bot.",
      status: "Đã nối rule từ AI Tổng Quản",
      target: "zalo"
    },
    {
      title: "Chatbox Webview",
      location: "Webview / bong bóng AI",
      detail: "Đang gọi /api/ai/chat cho người dùng web. Cần áp quy tắc chỉ trả lời chi tiết khi đã đăng nhập và KYC.",
      status: "Đã đưa vào danh sách đề xuất kiểm soát",
      target: "ai"
    },
    {
      title: "Cấu hình AI",
      location: "Cấu hình chung",
      detail: "Lưu model, nhiệt độ, system prompt và phân luồng engine cho văn tế, bài viết, chat, Zalo.",
      status: "Đọc cùng cấu hình hiện tại",
      target: "settings"
    }
  ], [knowledgeDocs.length]);

  const requestAI = async (message: string, type: string) => {
    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        botType: "governor",
        intent: type,
        prompt: message,
        message,
        documents: knowledgeDocs,
        knowledgeDocs,
        modelName: aiConfig.modelName,
        temperature: aiConfig.temperature
      })
    });
    const rawText = await response.text();
    let data: any = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = { raw: rawText };
    }
    if (!response.ok) {
      if (/^\s*<!doctype html/i.test(rawText) || /^\s*<html/i.test(rawText)) {
        throw new Error(`Máy chủ trả về trang HTML lỗi thay vì JSON từ /api/ai/chat. HTTP ${response.status}. Kiểm tra nginx/Cloudflare và service gia-pha-dashboard.`);
      }
      throw new Error(data.details || data.error || data.message || data.raw || "Không thể gọi AI.");
    }
    return String(data.text || "").trim();
  };

  const handleScanWholeSystem = async () => {
    setIsScanningSystem(true);
    setSystemScanReport("");

    const oldSampleTerms = [/cao quý công/i, /cao văn lãm/i, /unsplash/i, /placeholder/i, /lorem/i, /phú mỹ/i, /cao đại lang/i];
    const suspiciousArticles = articles.filter((article) => {
      const haystack = [article.title, article.summary, article.content, article.coverImage || ""].join(" ");
      return oldSampleTerms.some((pattern) => pattern.test(haystack));
    });
    const suspiciousDocs = knowledgeDocs.filter((doc) => {
      const haystack = [doc.title, doc.content].join(" ");
      return oldSampleTerms.some((pattern) => pattern.test(haystack));
    });
    const missingProfilePhoto = members.filter((member) => !member.photo).length;
    const missingBio = members.filter((member) => !member.bio && !member.title && !member.deathAnniversaryLunar).length;

    const deterministicSummary = [
      `Tổng số nhân vật: ${members.length}`,
      `Nhân vật chưa có ảnh: ${missingProfilePhoto}`,
      `Hồ sơ thiếu hành trạng/ngày giỗ/tước vị: ${missingBio}`,
      `Bài viết nghi còn dữ liệu mẫu/sai họ tộc: ${suspiciousArticles.length}`,
      `Tài liệu AI nghi còn dữ liệu mẫu/sai họ tộc: ${suspiciousDocs.length}`,
      `Rule Zalo hiện có: ${zaloRules.length || DEFAULT_ZALO_RULES.length}`,
      "",
      "Bài viết cần kiểm tra:",
      suspiciousArticles.slice(0, 8).map((article) => `- ${article.title}`).join("\n") || "- Chưa phát hiện theo bộ lọc cứng.",
      "",
      "Tài liệu cần kiểm tra:",
      suspiciousDocs.slice(0, 8).map((doc) => `- ${doc.title}`).join("\n") || "- Chưa phát hiện theo bộ lọc cứng."
    ].join("\n");

    try {
      const text = await requestAI(
        [
          "Hãy quét toàn bộ dữ liệu dashboard để đề xuất chỉnh sửa nội dung webview và dashboard.",
          "Mục tiêu: loại bỏ dữ liệu mẫu, thay bằng dữ liệu đúng theo cây phả hiện tại.",
          "Quy tắc dữ liệu đã biết: Cao Tổ đời 0 là Cao Đình Thuật (高 廷 術), tước hiệu Cao Cao Mãnh Đế Đại Tướng Quân; đời 1 là Thủy Tổ Cao Đình Lạng (高 廷 兩). Không dùng lại dữ liệu mẫu cũ nếu tài liệu gốc không xác nhận.",
          "Hãy trả về danh sách ưu tiên gồm: vị trí, vấn đề, đề xuất sửa, dữ liệu cần admin xác minh, mức độ ảnh hưởng.",
          "",
          deterministicSummary
        ].join("\n"),
        "system_audit"
      );
      setSystemScanReport(text || deterministicSummary);
    } catch (err: any) {
      setSystemScanReport([
        "AI chưa phản hồi được, dưới đây là báo cáo quét cứng tạm thời:",
        "",
        deterministicSummary,
        "",
        `Lỗi AI: ${err?.message || "không xác định"}`
      ].join("\n"));
    } finally {
      setIsScanningSystem(false);
    }
  };

  const handleFilesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []) as File[];
    if (!files.length) return;

    const importedDocs: KnowledgeBaseDocument[] = [];
    for (const file of files) {
      const text = await file.text();
      importedDocs.push({
        id: `ai_doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title: file.name.replace(/\.[^.]+$/, ""),
        category: KNOWLEDGE_CATEGORY,
        content: text,
        contributor: "AI Tổng Quản",
        lastUpdated: new Date().toLocaleDateString("vi-VN")
      });
    }

    onKnowledgeDocsChange([...importedDocs, ...knowledgeDocs]);
    setUploadNote(`Đã nạp ${importedDocs.length} tệp dữ liệu vào kho tri thức AI. Các module Trợ lý, Bài viết và Zalo sẽ nhận cùng kho này.`);
    event.target.value = "";
  };

  const handleGenerateArticle = async () => {
    if (!articleBrief.trim()) return;
    setIsGenerating(true);
    setGeneratedText("");
    try {
      const context = [
        `Số nhân vật gia phả: ${members.length}`,
        `Sự kiện: ${events.slice(0, 5).map((event) => `${event.title} - ${event.lunarDate} - ${event.location}`).join("; ")}`,
        `Tài liệu đã nạp: ${knowledgeDocs.slice(0, 8).map((doc) => `${doc.title}: ${truncateText(doc.content, 260)}`).join("\n")}`,
        `Yêu cầu: ${articleBrief}`
      ].join("\n");

      const text = await requestAI(
        `Hãy viết nội dung quản trị web gia tộc dựa trên dữ liệu thật, tránh bịa nhân vật/số liệu. ${context}`,
        "article"
      );
      setGeneratedText(text);
    } catch (err: any) {
      setGeneratedText(`Không thể sinh bài tự động: ${err?.message || "lỗi không xác định"}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateTemplate = async (kind: "article" | "zalo") => {
    setIsGeneratingTemplate(true);
    setTemplateText("");
    try {
      const text = await requestAI(
        kind === "article"
          ? "Từ kho tri thức đã tải lên, hãy tạo một mẫu bài viết có cấu trúc: tiêu đề, mô tả ngắn, dàn ý, phần dữ liệu cần kiểm chứng, phần có thể đăng sau khi admin duyệt. Chỉ dùng dữ liệu đã có."
          : "Từ kho tri thức đã tải lên, hãy tạo một mẫu rule trả lời Zalo ngắn gọn, lịch sự, nêu rõ khi nào cần yêu cầu người dùng đăng nhập/KYC để xem chi tiết gia phả.",
        kind === "article" ? "article_template" : "zalo_rule_template"
      );
      setTemplateText(text);
      if (kind === "zalo") {
        setZaloRuleText(text);
        setZaloKeyword("giapha");
      }
    } catch (err: any) {
      setTemplateText(`Không thể tạo mẫu: ${err?.message || "lỗi không xác định"}`);
    } finally {
      setIsGeneratingTemplate(false);
    }
  };

  const saveGeneratedAsDraft = (text = generatedText, brief = articleBrief) => {
    if (!text.trim() || /^Không thể/.test(text.trim())) return;
    const title = getDraftTitle(text, brief);
    const draft: WebArticle = {
      id: `ai_draft_${Date.now()}`,
      title,
      slug: normalizeSlug(title),
      category: DRAFT_CATEGORY,
      author: "AI Tổng Quản",
      summary: getDraftSummary(text, title),
      content: text,
      publishDate: new Date().toLocaleDateString("vi-VN"),
      status: DRAFT_STATUS,
      views: 0,
      coverImage: ""
    };
    onArticlesChange([draft, ...articles]);
    onSetActiveTab("articles");
  };

  const createZaloRule = (content = zaloRuleText || generatedText) => {
    const replyContent = content.trim() || "Kính chào quý tộc nhân. Để xem thông tin chi tiết gia phả, xin vui lòng đăng nhập và hoàn tất xác thực KYC. Với thông tin công khai, hệ thống sẽ hỗ trợ tra cứu theo hướng dẫn của Ban trị sự.";
    const keyword = normalizeKeyword(zaloKeyword);
    const baseRules = zaloRules.length ? zaloRules : DEFAULT_ZALO_RULES;
    const newRule: ZaloAutoReply = {
      id: `ai_rule_${Date.now()}`,
      keyword,
      replyType: "text",
      replyContent,
      usageCount: 0,
      isActive: true
    };
    onZaloRulesChange([newRule, ...baseRules.filter((rule) => rule.keyword !== keyword)]);
    onSetActiveTab("zalo");
  };

  const createAuditPrompt = (item: AuditItem) => {
    const prompt = [
      `Hãy rà soát và đề xuất cách sửa nội dung cho mục: ${item.title}.`,
      item.detail,
      "Yêu cầu: chỉ dùng dữ liệu gia phả, tài liệu AI đã nạp, sự kiện, bài viết và quỹ hiện có; chỉ rõ phần nào là dữ liệu thật, phần nào cần admin xác minh."
    ].join("\n");
    onSetAIInitialPrompt(prompt, "audit");
    onSetActiveTab("ai");
  };

  const markSuggestion = (id: string, status: WebviewSuggestion["status"]) => {
    setSuggestions((prev) => prev.map((item) => item.id === id ? { ...item, status } : item));
  };

  const applySuggestion = async (item: WebviewSuggestion) => {
    markSuggestion(item.id, "approved");
    if (item.id === "zalo-common-rule") {
      createZaloRule("Kính chào quý tộc nhân. Quý vị có thể hỏi các từ khóa như lịch giỗ, liên hệ, đóng góp, gia phả. Thông tin chi tiết từng nhân vật chỉ hiển thị khi tài khoản đã đăng nhập và được KYC.");
      markSuggestion(item.id, "applied");
      return;
    }

    if (item.id === "web-chatbox-policy") {
      onSetAIInitialPrompt(
        "Hãy viết bộ quy tắc trả lời cho chatbox webview: chỉ trả lời dữ liệu công khai khi khách chưa đăng nhập; khi hỏi thông tin chi tiết từng người thì yêu cầu đăng nhập và KYC; không bịa dữ liệu ngoài kho tri thức.",
        "chatbox_policy"
      );
      onSetActiveTab("ai");
      markSuggestion(item.id, "applied");
      return;
    }

    if (item.id === "knowledge-template") {
      setActiveMode("knowledge");
      await handleGenerateTemplate("article");
      markSuggestion(item.id, "applied");
      return;
    }

    setIsGenerating(true);
    try {
      const text = await requestAI(
        "Hãy tạo một bản nháp bài viết thay nội dung mẫu trên webview. Dựa trên gia phả, sự kiện, tiết khí/địa điểm nếu có và kho tri thức đã nạp. Không dùng ảnh mẫu, không bịa số liệu.",
        "webview_suggestion_article"
      );
      setGeneratedText(text);
      saveGeneratedAsDraft(text, "Bản nháp thay nội dung mẫu trên webview");
      markSuggestion(item.id, "applied");
    } catch (err: any) {
      setGeneratedText(`Không thể áp dụng đề xuất: ${err?.message || "lỗi không xác định"}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-5 text-stone-850">
      <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 font-serif text-2xl font-black text-red-950">
              <BrainCircuit className="h-6 w-6 text-amber-700" />
              AI Tổng Quản Nội Dung Gia Tộc
            </h2>
            <p className="max-w-3xl text-sm leading-relaxed text-stone-500">
              Trung tâm gom dữ liệu gia phả, tài liệu dòng họ, bài viết, sự kiện và kênh Zalo/chatbox để AI đánh giá,
              viết nội dung, tạo nháp bài viết, tạo rule trả lời và lập danh sách đề xuất sửa webview để admin duyệt.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:w-[620px]">
            {systemCoverage.map((item) => (
              <div key={item.label} className="rounded-lg border border-stone-200 bg-[#fbfaf6] p-3">
                <span className="block text-[10px] font-bold uppercase tracking-wide text-stone-400">{item.label}</span>
                <strong className="mt-1 block text-base text-red-950">{item.value}</strong>
                <span className="text-[10px] text-stone-400">{item.hint}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 rounded-xl border border-stone-200 bg-stone-100 p-1 text-xs font-bold">
        {[
          ["overview", "Tổng quan AI", BrainCircuit],
          ["knowledge", "Kho tri thức", UploadCloud],
          ["content", "Rà soát & viết bài", FileSearch],
          ["channels", "Kênh trả lời", MessageSquare]
        ].map(([id, label, Icon]) => {
          const TabIcon = Icon as typeof BrainCircuit;
          return (
            <button
              key={id as string}
              type="button"
              onClick={() => setActiveMode(id as typeof activeMode)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 transition ${
                activeMode === id ? "bg-white text-red-950 shadow-sm" : "text-stone-500 hover:text-stone-850"
              }`}
            >
              <TabIcon className="h-4 w-4" />
              {label as string}
            </button>
          );
        })}
      </div>

      {activeMode === "overview" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="xl:col-span-2 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 font-serif text-lg font-bold text-red-950">
                <Zap className="h-5 w-5 text-amber-700" />
                Luồng vận hành AI đề xuất
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {[
                  ["1. Nạp dữ liệu", "Excel, JSON, Markdown, ghi chú chi/ngành, văn bản phả tích, ảnh hoặc mô tả sự kiện."],
                  ["2. Rà soát nội dung", "AI tìm bài mẫu, ảnh mẫu, hồ sơ thiếu hành trạng, ngày giỗ chưa khớp, nội dung cần xác minh."],
                  ["3. Sinh hành động", "Tạo nháp bài viết, mẫu nội dung, rule Zalo và prompt chính sách chatbox."],
                  ["4. Admin duyệt", "AI chỉ đề xuất. Admin kiểm tra, chỉnh sửa và mới đưa ra webview/Zalo/chatbox."]
                ].map(([title, detail]) => (
                  <div key={title} className="rounded-lg border border-amber-200/70 bg-amber-50/40 p-4">
                    <p className="font-bold text-stone-850">{title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-stone-500">{detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 font-serif text-lg font-bold text-red-950">
                <Bot className="h-5 w-5 text-amber-700" />
                Trạng thái mô hình
              </h3>
              <div className="space-y-3 text-xs">
                <p className="rounded-lg bg-stone-50 p-3">
                  Mô hình chính: <strong className="text-red-950">{aiConfig.modelName}</strong>
                </p>
                <p className="rounded-lg bg-stone-50 p-3">
                  Độ sáng tạo: <strong className="text-red-950">{aiConfig.temperature}</strong>
                </p>
                <button
                  type="button"
                  onClick={() => onSetActiveTab("settings")}
                  className="w-full rounded bg-red-900 px-3 py-2 font-bold text-white hover:bg-red-950"
                >
                  Mở cấu hình model/API
                </button>
              </div>
            </div>
          </div>

          <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 font-serif text-lg font-bold text-red-950">
              <Database className="h-5 w-5 text-amber-700" />
              Bản đồ các vị trí đang có AI hỗ trợ
            </h3>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {aiTouchpoints.map((item) => (
                <article key={item.title} className="rounded-lg border border-stone-200 bg-[#fbfaf6] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-stone-850">{item.title}</h4>
                      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">{item.location}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSetActiveTab(item.target)}
                      className="shrink-0 rounded bg-stone-100 px-2.5 py-1 text-[10px] font-bold text-stone-700 hover:bg-stone-200"
                    >
                      Mở
                    </button>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-stone-600">{item.detail}</p>
                  <p className="mt-2 rounded bg-white px-2.5 py-1.5 text-[10px] font-semibold text-emerald-700">{item.status}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {activeMode === "knowledge" && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <section className="xl:col-span-4 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h3 className="font-serif text-lg font-bold text-red-950">Nạp dữ liệu dòng họ</h3>
            <p className="mt-1 text-xs leading-relaxed text-stone-500">
              Có thể tải lên TXT, MD, CSV, JSON hoặc nội dung xuất từ Excel. Mỗi tệp sẽ trở thành một tài liệu tham chiếu cho AI.
            </p>
            <input ref={fileInputRef} type="file" multiple accept=".txt,.md,.csv,.json,.html" className="hidden" onChange={handleFilesSelected} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-amber-500 bg-amber-50 px-4 py-8 text-sm font-bold text-red-950 hover:bg-amber-100"
            >
              <UploadCloud className="h-5 w-5" />
              Tải dữ liệu cho AI
            </button>
            {uploadNote && <p className="mt-3 rounded bg-emerald-50 p-2 text-xs text-emerald-700">{uploadNote}</p>}

            <div className="mt-5 rounded-lg border border-stone-200 bg-[#fbfaf6] p-4">
              <h4 className="flex items-center gap-2 font-bold text-stone-850">
                <Sparkles className="h-4 w-4 text-amber-700" />
                Tạo mẫu từ tài liệu đã nạp
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-stone-500">
                Dùng chính tài liệu tự tải lên để tạo mẫu bài viết hoặc mẫu trả lời Zalo, thay vì chỉ dựa trên dữ liệu mẫu sẵn có.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleGenerateTemplate("article")}
                  disabled={isGeneratingTemplate}
                  className="rounded bg-red-900 px-3 py-2 text-xs font-bold text-white hover:bg-red-950 disabled:opacity-60"
                >
                  Mẫu bài viết
                </button>
                <button
                  type="button"
                  onClick={() => handleGenerateTemplate("zalo")}
                  disabled={isGeneratingTemplate}
                  className="rounded border border-stone-200 px-3 py-2 text-xs font-bold text-stone-700 hover:bg-white disabled:opacity-60"
                >
                  Mẫu Zalo
                </button>
              </div>
              {isGeneratingTemplate && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Đang tạo mẫu từ kho tri thức...
                </p>
              )}
            </div>
          </section>

          <section className="xl:col-span-8 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="font-serif text-lg font-bold text-red-950">Tài liệu AI đang dùng</h3>
              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-500">{knowledgeDocs.length} tài liệu</span>
            </div>
            {templateText && (
              <pre className="mb-4 max-h-[260px] overflow-y-auto whitespace-pre-wrap rounded-lg border border-amber-200 bg-amber-50/40 p-4 text-xs leading-relaxed text-stone-800">
                {templateText}
              </pre>
            )}
            <div className="grid max-h-[460px] grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2">
              {knowledgeDocs.map((doc) => (
                <article key={doc.id} className="rounded-lg border border-stone-200 bg-[#fbfaf6] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-stone-850">{doc.title}</h4>
                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">{doc.category}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onKnowledgeDocsChange(knowledgeDocs.filter((item) => item.id !== doc.id))}
                      className="rounded border border-stone-200 px-2 py-1 text-[10px] font-bold text-stone-500 hover:border-red-200 hover:text-red-800"
                    >
                      Gỡ
                    </button>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-stone-500">{truncateText(doc.content, 220)}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {activeMode === "content" && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <section className="xl:col-span-5 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50/40 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="flex items-center gap-2 font-serif text-lg font-bold text-red-950">
                    <FileSearch className="h-5 w-5 text-amber-700" />
                    AI quét toàn hệ thống
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-stone-600">
                    Quét bài viết, kho tri thức, rule Zalo, hồ sơ gia phả và các dấu hiệu dữ liệu mẫu để đề xuất chỉnh sửa.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleScanWholeSystem()}
                  disabled={isScanningSystem}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded bg-red-900 px-3 py-2 text-xs font-bold text-white hover:bg-red-950 disabled:opacity-60"
                >
                  {isScanningSystem ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
                  Quét ngay
                </button>
              </div>
              {systemScanReport && (
                <pre className="mt-3 max-h-[260px] overflow-y-auto whitespace-pre-wrap rounded border border-amber-200 bg-white p-3 text-[11px] leading-relaxed text-stone-800">
                  {systemScanReport}
                </pre>
              )}
            </div>

            <h3 className="mb-3 flex items-center gap-2 font-serif text-lg font-bold text-red-950">
              <ClipboardList className="h-5 w-5 text-amber-700" />
              Đề xuất sửa webview
            </h3>
            <div className="space-y-3">
              {suggestions.map((item) => (
                <div key={item.id} className="rounded-lg border border-stone-200 bg-[#fbfaf6] p-3">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className={`mt-0.5 h-4 w-4 ${item.status === "applied" ? "text-emerald-700" : "text-amber-700"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-stone-850">{item.title}</p>
                        <span className="rounded bg-white px-2 py-0.5 text-[9px] font-bold uppercase text-stone-500">
                          {item.status === "pending" ? "Chưa duyệt" : item.status === "approved" ? "Đã duyệt" : "Đã áp dụng"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-stone-500">{item.detail}</p>
                      <p className="mt-1 text-[10px] font-semibold text-stone-500">{item.impact}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" onClick={() => markSuggestion(item.id, "approved")} className="rounded bg-stone-100 px-2.5 py-1 text-[10px] font-bold text-stone-700 hover:bg-stone-200">Duyệt</button>
                        <button type="button" onClick={() => void applySuggestion(item)} className="rounded bg-red-900 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-red-950">Áp dụng</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <h3 className="mb-3 mt-5 flex items-center gap-2 font-serif text-lg font-bold text-red-950">
              <AlertTriangle className="h-5 w-5 text-amber-700" />
              Cảnh báo nội dung
            </h3>
            <div className="space-y-3">
              {auditItems.map((item) => (
                <div key={item.id} className="rounded-lg border border-stone-200 bg-white p-3">
                  <div className="flex items-start gap-2">
                    {item.level === "warning" ? <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-700" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700" />}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-stone-850">{item.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-stone-500">{item.detail}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button type="button" onClick={() => onSetActiveTab(item.targetTab)} className="rounded bg-stone-100 px-2.5 py-1 text-[10px] font-bold text-stone-700 hover:bg-stone-200">{item.action}</button>
                        <button type="button" onClick={() => createAuditPrompt(item)} className="rounded bg-red-900 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-red-950">Đưa sang trợ lý AI</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="xl:col-span-7 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 font-serif text-lg font-bold text-red-950">
              <Wand2 className="h-5 w-5 text-amber-700" />
              Sinh bài dựa trên toàn bộ dữ liệu
            </h3>
            <textarea
              value={articleBrief}
              onChange={(event) => setArticleBrief(event.target.value)}
              rows={4}
              className="w-full rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm leading-relaxed focus:border-red-900 focus:outline-none"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleGenerateArticle}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 rounded bg-red-900 px-4 py-2 text-xs font-bold text-white hover:bg-red-950 disabled:opacity-60"
              >
                {isGenerating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Sinh nội dung
              </button>
              <button
                type="button"
                onClick={() => saveGeneratedAsDraft()}
                disabled={!generatedText.trim() || /^Không thể/.test(generatedText.trim())}
                className="inline-flex items-center gap-2 rounded border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
              >
                <PenLine className="h-4 w-4" />
                Lưu thành bản nháp bài viết
              </button>
              <button type="button" onClick={() => onSetActiveTab("articles")} className="rounded border border-stone-200 px-4 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50">
                Mở quản lý bài viết
              </button>
            </div>
            {generatedText && (
              <pre className="mt-4 max-h-[360px] overflow-y-auto whitespace-pre-wrap rounded-lg border border-amber-200 bg-amber-50/40 p-4 text-sm leading-relaxed text-stone-800">
                {generatedText}
              </pre>
            )}
          </section>
        </div>
      )}

      {activeMode === "channels" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <section className="xl:col-span-5 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 font-serif text-lg font-bold text-red-950">
              <MessageSquare className="h-5 w-5 text-amber-700" />
              Tạo rule trả lời Zalo từ AI
            </h3>
            <div className="space-y-3 text-xs">
              <label className="block">
                <span className="mb-1 block font-bold text-stone-700">Từ khóa Zalo</span>
                <input
                  value={zaloKeyword}
                  onChange={(event) => setZaloKeyword(event.target.value)}
                  className="w-full rounded border border-stone-200 bg-stone-50 px-3 py-2 text-stone-850 focus:border-red-900 focus:outline-none"
                  placeholder="Ví dụ: giapha"
                />
              </label>
              <label className="block">
                <span className="mb-1 block font-bold text-stone-700">Nội dung trả lời</span>
                <textarea
                  value={zaloRuleText}
                  onChange={(event) => setZaloRuleText(event.target.value)}
                  rows={7}
                  className="w-full rounded border border-stone-200 bg-stone-50 px-3 py-2 leading-relaxed text-stone-850 focus:border-red-900 focus:outline-none"
                  placeholder="Có thể dán nội dung AI sinh ra, hoặc để trống để dùng mẫu mặc định."
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleGenerateTemplate("zalo")}
                  disabled={isGeneratingTemplate}
                  className="rounded border border-stone-200 px-3 py-2 font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-60"
                >
                  Sinh mẫu trả lời
                </button>
                <button
                  type="button"
                  onClick={() => createZaloRule()}
                  className="rounded bg-red-900 px-3 py-2 font-bold text-white hover:bg-red-950"
                >
                  Lưu rule vào Zalo Bot
                </button>
              </div>
            </div>
          </section>

          <section className="xl:col-span-7 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              ["Zalo OA Bot", "Dùng engine Zalo để trả lời câu hỏi thường gặp, gửi thông báo, dẫn về KYC khi hỏi hồ sơ chi tiết.", "zalo", MessageSquare],
              ["Chatbox Web", "Gắn hộp chat trên webview, chỉ trả lời dữ liệu công khai nếu người hỏi chưa đăng nhập/KYC.", "settings", Globe2],
              ["Trợ lý Dashboard", "Hỗ trợ admin viết bài, kiểm tra nội dung mẫu, soạn thông báo và tạo đề xuất sửa trang.", "ai", Bot],
              ["Cấu hình AI", "Điều chỉnh model, nhiệt độ, system prompt và phân luồng engine theo từng tác vụ.", "settings", Settings],
              ["Kho tri thức", "Nguồn tài liệu tự tải lên đang được truyền tới Trợ lý, Bài viết, Zalo và AI Tổng Quản.", "ai-governor", Database],
              ["Bài viết", "Nhận bản nháp sinh từ AI Tổng Quản để admin sửa, duyệt và đăng lên portal.", "articles", FileText]
            ].map(([title, detail, target, Icon]) => {
              const ChannelIcon = Icon as typeof MessageSquare;
              return (
                <section key={title as string} className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-red-950 text-amber-200">
                    <ChannelIcon className="h-5 w-5" />
                  </div>
                  <h3 className="font-serif text-lg font-bold text-red-950">{title as string}</h3>
                  <p className="mt-2 min-h-[92px] text-xs leading-relaxed text-stone-500">{detail as string}</p>
                  <button
                    type="button"
                    onClick={() => onSetActiveTab(target as string)}
                    className="mt-4 inline-flex items-center gap-1.5 rounded bg-stone-100 px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-200"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Mở cấu hình liên quan
                  </button>
                </section>
              );
            })}
          </section>
        </div>
      )}
    </div>
  );
}
