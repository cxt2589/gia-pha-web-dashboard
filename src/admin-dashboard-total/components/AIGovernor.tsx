import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ClipboardList,
  Database,
  FileSearch,
  FileText,
  GitBranch,
  Globe2,
  MessageSquare,
  PenLine,
  RefreshCw,
  Send,
  Settings,
  Sparkles,
  Search,
  Trash2,
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
const AI_OPERATION_LOG_PAGE_SIZE = 4;

type KnowledgeStatus = {
  ok?: boolean;
  sources: number;
  chunks: number;
  aliases: number;
  indexedSources?: number;
};

type KnowledgeSourceSummary = {
  id: string;
  title: string;
  sourceType?: string;
  visibility?: string;
  status?: string;
  updatedAt?: string;
  tags?: string[];
  entityRefs?: string[];
  summary?: string;
};

type KnowledgeSearchResult = {
  sourceId: string;
  chunkId: string;
  title: string;
  snippet: string;
  score: number;
  tags?: string[];
  entityRefs?: string[];
  visibility?: string;
  reason?: string;
  matchedTerms?: string[];
};

type AIRequestLog = {
  id: string;
  createdAt: string;
  route: string;
  botType: string;
  intent: string;
  engine: string;
  provider: string;
  model: string;
  status: number;
  cached: boolean;
  durationMs: number;
  contextChars: number;
  estimatedTokens: number;
  contextTrimmed: boolean;
  knowledgeMatchesCount: number;
  knowledgeSourceIds?: string[];
  botConfigEngine?: string;
  botConfigMaxChunks?: number;
  botConfigMaxOutputTokens?: number;
  cacheEnabled?: boolean;
  configVersion?: string;
  errorMessage?: string;
  promptSnippet?: string;
};

type AIRequestLogSummary = {
  requestCount: number;
  cacheHitCount: number;
  errorCount: number;
  avgDurationMs: number;
  totalContextChars: number;
  estimatedTokens: number;
  topBotTypes?: { name: string; count: number }[];
  topIntents?: { name: string; count: number }[];
};

type AIBotConfig = {
  botType: string;
  label: string;
  enabled: boolean;
  pausedReason: string;
  engine: string;
  maxKnowledgeChunks: number;
  maxKnowledgeChars: number;
  maxOutputTokens: number;
  cacheEnabled: boolean;
  cacheTtlMs: number;
  retry429: number;
  retryDelayMs: number;
  publicAccess: boolean;
  requiresKycForPrivateData: boolean;
  systemPromptShort: string;
  updatedAt: string;
  updatedBy: string;
};

type SystemAuditSuggestion = {
  id: string;
  sourceType: string;
  sourcePath: string;
  location?: string;
  currentValue?: string;
  issueType: string;
  summary: string;
  suggestedValue?: string;
  action: string;
  priority: string;
  evidence?: string;
  relatedSourceIds?: string[];
  relatedChunkIds?: string[];
  status: "pending" | "approved" | "rejected" | "applied";
  createdAt?: string;
  reviewedAt?: string;
  appliedAt?: string;
};

type SystemAuditApplyLog = {
  id: string;
  suggestionId: string;
  action: string;
  sourceType: string;
  sourcePath: string;
  oldValue?: string;
  newValue?: string;
  adminUser?: string;
  status: string;
  error?: string;
  createdAt?: string;
};

type AIOperationGraphNodeStatus = "active" | "paused" | "disabled" | "error";

type AIOperationGraphNode = {
  id: string;
  label: string;
  type: "bot" | "gateway" | "config" | "router" | "data" | "model" | "guard" | "logs" | "audit";
  status: AIOperationGraphNodeStatus;
  description: string;
  column: number;
  row: number;
  metrics?: Record<string, string | number>;
};

type AIOperationGraphEdge = {
  from: string;
  to: string;
  label?: string;
};

type ZaloBotStatus = {
  ok?: boolean;
  webhookEnabled?: boolean;
  webhookConfigured: boolean;
  webhookSafe?: boolean;
  webhookSecretConfigured?: boolean;
  webhookVerifyTokenConfigured?: boolean;
  sendEnabled: boolean;
  sendMode: string;
  canReplyReal: boolean;
  totalEvents: number;
  totalReplies: number;
  ignoredCount: number;
  errorCount: number;
  lastEventAt?: string;
};

type ZaloWebhookStatus = ZaloBotStatus & {
  signatureVerifiedCount: number;
  rejectedCount: number;
  duplicateCount: number;
  lastRealEventAt?: string;
  lastRejectedReason?: string;
};

type ZaloBotEvent = {
  id: string;
  eventId: string;
  source?: string;
  channel: string;
  eventType: string;
  appId?: string;
  oaId?: string;
  senderId: string;
  senderName: string;
  recipientId?: string;
  groupId: string;
  messageText: string;
  normalizedText?: string;
  intent: string;
  status: string;
  error?: string;
  signatureStatus?: string;
  reviewedAt?: string;
  eventTimestamp?: string;
  createdAt: string;
};

type ZaloBotReply = {
  id: string;
  eventId: string;
  channel: string;
  senderId: string;
  senderName: string;
  groupId: string;
  messageText: string;
  intent: string;
  replyText: string;
  transport: string;
  status: string;
  error?: string;
  createdAt: string;
};

type AIEvalCase = {
  id: string;
  question: string;
  engine: string;
  expectedContains: string[];
  mustNotContain: string[];
  scope: string;
};

type AIEvalResult = {
  id: string;
  question: string;
  passed: boolean;
  missing: string[];
  forbidden: string[];
  answer: string;
  durationMs: number;
  knowledgeMatchesCount: number;
  knowledgeSourceIds: string[];
};

type ExtractedAnniversaryField = {
  type: string;
  label: string;
  value: string;
  reviewedValue?: string;
  effectiveValue?: string;
};

type LineageMemberMatch = {
  memberId: string;
  fullName: string;
  generation?: number;
  fatherName?: string;
  motherName?: string;
  branchName?: string;
  confidence?: string;
  reason?: string;
  currentValues?: Record<string, string>;
};

type ExtractedAnniversaryCandidate = {
  id: string;
  sourceId: string;
  chunkId: string;
  personName: string;
  generation?: string;
  branch?: string;
  sourceQuote?: string;
  headingPath?: string;
  matchedMemberId?: string;
  matchedMemberName?: string;
  matchConfidence?: string;
  status: "pending" | "approved" | "rejected" | "applied";
  fields: ExtractedAnniversaryField[];
  currentValues?: Record<string, string>;
  candidateMatches?: LineageMemberMatch[];
  updatedAt?: string;
};

type SourceChunkDetail = {
  chunkId: string;
  title: string;
  headingPath?: string;
  content: string;
  visibility?: string;
};

type AppliedExtraction = {
  id: string;
  auditId: string;
  candidateId: string;
  memberId: string;
  memberName: string;
  field: string;
  fieldType?: string;
  oldValue?: string;
  newValue: string;
  sourceId?: string;
  sourceTitle?: string;
  chunkId?: string;
  headingPath?: string;
  sourceQuote?: string;
  appliedBy?: string;
  appliedAt?: string;
  action?: string;
};

const DEFAULT_ZALO_RULES: ZaloAutoReply[] = [
  {
    id: "r1",
    keyword: "lichsu",
    replyType: "text",
    replyContent: "Theo dữ liệu phả hệ hiện có, Cao Tổ là cụ Cao Đình Thuật (高 廷 術), tước hiệu Cao Cao Mãnh Đế Đại Tướng Quân; Thủy Tổ là Cao Đình Lạng (高 廷 兩). Các thông tin chi tiết từng nhân vật cần đăng nhập và hoàn tất KYC để xem.",
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
  const [activeMode, setActiveMode] = useState<"overview" | "operations" | "system-audit" | "knowledge" | "content" | "channels">("overview");
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
  const [knowledgeStatus, setKnowledgeStatus] = useState<KnowledgeStatus | null>(null);
  const [backendSources, setBackendSources] = useState<KnowledgeSourceSummary[]>([]);
  const [knowledgeSearchQuery, setKnowledgeSearchQuery] = useState("Cao Tổ");
  const [knowledgeSearchResults, setKnowledgeSearchResults] = useState<KnowledgeSearchResult[]>([]);
  const [isKnowledgeLoading, setIsKnowledgeLoading] = useState(false);
  const [isKnowledgeSearching, setIsKnowledgeSearching] = useState(false);
  const [knowledgeApiNote, setKnowledgeApiNote] = useState("");
  const [aiLogs, setAiLogs] = useState<AIRequestLog[]>([]);
  const [aiLogSummary, setAiLogSummary] = useState<AIRequestLogSummary | null>(null);
  const [isAiLogsLoading, setIsAiLogsLoading] = useState(false);
  const [aiLogNote, setAiLogNote] = useState("");
  const [aiEvalCases, setAiEvalCases] = useState<AIEvalCase[]>([]);
  const [aiEvalResults, setAiEvalResults] = useState<AIEvalResult[]>([]);
  const [isAiEvalRunning, setIsAiEvalRunning] = useState(false);
  const [aiEvalNote, setAiEvalNote] = useState("");
  const [extractedCandidates, setExtractedCandidates] = useState<ExtractedAnniversaryCandidate[]>([]);
  const [isExtractedLoading, setIsExtractedLoading] = useState(false);
  const [extractedNote, setExtractedNote] = useState("");
  const [extractedStatusFilter, setExtractedStatusFilter] = useState("pending");
  const [extractedTypeFilter, setExtractedTypeFilter] = useState("");
  const [extractedNameFilter, setExtractedNameFilter] = useState("");
  const [editingCandidateId, setEditingCandidateId] = useState("");
  const [editingFieldType, setEditingFieldType] = useState("");
  const [editingValue, setEditingValue] = useState("");
  const [editingMemberId, setEditingMemberId] = useState("");
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [memberSearchResults, setMemberSearchResults] = useState<LineageMemberMatch[]>([]);
  const [sourceChunkDetail, setSourceChunkDetail] = useState<SourceChunkDetail | null>(null);
  const [isSourceChunkOpen, setIsSourceChunkOpen] = useState(false);
  const [appliedExtractions, setAppliedExtractions] = useState<AppliedExtraction[]>([]);
  const [isAppliedExtractionsLoading, setIsAppliedExtractionsLoading] = useState(false);
  const [appliedExtractionNote, setAppliedExtractionNote] = useState("");
  const [appliedExtractionFilter, setAppliedExtractionFilter] = useState("");
  const [appliedExtractionFieldFilter, setAppliedExtractionFieldFilter] = useState("");
  const [aiBotConfigs, setAiBotConfigs] = useState<AIBotConfig[]>([]);
  const [isAiBotConfigsLoading, setIsAiBotConfigsLoading] = useState(false);
  const [aiBotConfigNote, setAiBotConfigNote] = useState("");
  const [selectedOperationNodeId, setSelectedOperationNodeId] = useState("ai_gateway");
  const [operationLogPage, setOperationLogPage] = useState(1);
  const [isOperationDetailOpen, setIsOperationDetailOpen] = useState(false);
  const [isOperationGraphExpanded, setIsOperationGraphExpanded] = useState(false);
  const operationGraphScrollRef = useRef<HTMLDivElement>(null);
  const operationGraphDragRef = useRef({ dragging: false, x: 0, y: 0, left: 0, top: 0 });
  const [systemAuditSuggestions, setSystemAuditSuggestions] = useState<SystemAuditSuggestion[]>([]);
  const [systemAuditLogs, setSystemAuditLogs] = useState<SystemAuditApplyLog[]>([]);
  const [systemAuditStatusFilter, setSystemAuditStatusFilter] = useState("pending");
  const [systemAuditTypeFilter, setSystemAuditTypeFilter] = useState("");
  const [systemAuditQuery, setSystemAuditQuery] = useState("");
  const [systemAuditNote, setSystemAuditNote] = useState("");
  const [isSystemAuditLoading, setIsSystemAuditLoading] = useState(false);
  const [zaloBotStatus, setZaloBotStatus] = useState<ZaloBotStatus | null>(null);
  const [zaloWebhookStatus, setZaloWebhookStatus] = useState<ZaloWebhookStatus | null>(null);
  const [zaloBotEvents, setZaloBotEvents] = useState<ZaloBotEvent[]>([]);
  const [zaloBotReplies, setZaloBotReplies] = useState<ZaloBotReply[]>([]);
  const [zaloBotNote, setZaloBotNote] = useState("");
  const [isZaloBotLoading, setIsZaloBotLoading] = useState(false);
  const [zaloMockChannel, setZaloMockChannel] = useState<"personal" | "group">("personal");
  const [zaloMockSenderId, setZaloMockSenderId] = useState("admin-test");
  const [zaloMockGroupId, setZaloMockGroupId] = useState("group-test");
  const [zaloMockMessage, setZaloMockMessage] = useState("Cao Tổ là ai?");

  useEffect(() => {
    setOperationLogPage(1);
  }, [selectedOperationNodeId]);

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

  const memberOptions = useMemo(() => (
    members
      .map((member) => ({
        id: member.id,
        label: `${member.name} - đời ${member.generation}${member.branch ? ` - ${member.branch}` : ""}`
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "vi"))
  ), [members]);

  const selectedExtractedCandidates = useMemo(() => (
    extractedCandidates.filter((candidate) => selectedCandidateIds.includes(candidate.id))
  ), [extractedCandidates, selectedCandidateIds]);

  const getCandidateCurrentValue = (candidate: ExtractedAnniversaryCandidate, fieldType: string) => (
    candidate.currentValues?.[fieldType] || ""
  );
  const getCandidateMatchedInfo = (candidate: ExtractedAnniversaryCandidate) => (
    candidate.candidateMatches?.find((match) => match.memberId === candidate.matchedMemberId)
      || candidate.candidateMatches?.[0]
      || null
  );

  const toggleCandidateSelection = (candidateId: string) => {
    setSelectedCandidateIds((current) => (
      current.includes(candidateId)
        ? current.filter((id) => id !== candidateId)
        : [...current, candidateId]
    ));
  };

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
        botType: "ai_governor",
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

  const loadKnowledgeBackend = async () => {
    setIsKnowledgeLoading(true);
    try {
      const [statusResponse, sourcesResponse] = await Promise.all([
        fetch("/api/knowledge/status"),
        fetch("/api/knowledge/sources?limit=80")
      ]);
      if (statusResponse.ok) {
        const data = await statusResponse.json();
        setKnowledgeStatus(data);
      }
      if (sourcesResponse.ok) {
        const data = await sourcesResponse.json();
        setBackendSources(Array.isArray(data.sources) ? data.sources : []);
      }
      if (!statusResponse.ok || !sourcesResponse.ok) {
        setKnowledgeApiNote("Chưa đọc được đầy đủ trạng thái kho tri thức backend.");
      }
    } catch (err: any) {
      setKnowledgeApiNote(`Không đọc được kho tri thức backend: ${err?.message || "lỗi không xác định"}`);
    } finally {
      setIsKnowledgeLoading(false);
    }
  };

  const loadExtractedCandidates = async () => {
    setIsExtractedLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "160");
      if (extractedNameFilter.trim()) params.set("q", extractedNameFilter.trim());
      if (extractedStatusFilter) params.set("status", extractedStatusFilter);
      if (extractedTypeFilter) params.set("type", extractedTypeFilter);
      const response = await fetch(`/api/knowledge/extracted-anniversaries?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không đọc được dữ liệu trích xuất.");
      setExtractedCandidates(Array.isArray(data.candidates) ? data.candidates : []);
      setExtractedNote("");
    } catch (err: any) {
      setExtractedNote(`Không đọc được dữ liệu trích xuất: ${err?.message || "lỗi không xác định"}`);
    } finally {
      setIsExtractedLoading(false);
    }
  };

  const loadAppliedExtractions = async () => {
    setIsAppliedExtractionsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "80");
      if (appliedExtractionFilter.trim()) params.set("q", appliedExtractionFilter.trim());
      if (appliedExtractionFieldFilter.trim()) params.set("field", appliedExtractionFieldFilter.trim());
      const response = await fetch(`/api/knowledge/applied-extractions?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không đọc được dữ liệu đã áp dụng.");
      setAppliedExtractions(Array.isArray(data.appliedExtractions) ? data.appliedExtractions : []);
      setAppliedExtractionNote("");
    } catch (err: any) {
      setAppliedExtractionNote(`Không đọc được dữ liệu đã áp dụng: ${err?.message || "lỗi không xác định"}`);
    } finally {
      setIsAppliedExtractionsLoading(false);
    }
  };

  const patchExtractedCandidate = async (candidateId: string, payload: Record<string, unknown>, successNote: string) => {
    const response = await fetch(`/api/knowledge/extracted-anniversaries/${encodeURIComponent(candidateId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setExtractedNote(data.error || "Không cập nhật được candidate.");
      return;
    }
    setExtractedNote(successNote);
    await loadExtractedCandidates();
  };

  const handleApproveCandidate = (candidate: ExtractedAnniversaryCandidate) => (
    patchExtractedCandidate(candidate.id, { status: "approved" }, "Đã duyệt candidate.")
  );

  const handleRejectCandidate = (candidate: ExtractedAnniversaryCandidate) => (
    patchExtractedCandidate(candidate.id, { status: "rejected" }, "Đã từ chối candidate.")
  );

  const handleAssignCandidate = (candidate: ExtractedAnniversaryCandidate, memberId: string) => {
    const member = members.find((item) => item.id === memberId);
    const apiMatch = [...memberSearchResults, ...(candidate.candidateMatches || [])].find((item) => item.memberId === memberId);
    if (!member && !apiMatch) return;
    void patchExtractedCandidate(candidate.id, {
      matchedMemberId: member?.id || apiMatch?.memberId,
      matchedMemberName: member?.name || apiMatch?.fullName,
      matchConfidence: apiMatch?.confidence || "manual"
    }, "Đã gán candidate với nhân vật được chọn.");
  };

  const searchMembersForCandidate = async (query: string) => {
    setMemberSearchQuery(query);
    if (!query.trim()) {
      setMemberSearchResults([]);
      return;
    }
    try {
      const response = await fetch(`/api/lineage/member-search?q=${encodeURIComponent(query.trim())}&limit=12`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không tìm được nhân vật.");
      setMemberSearchResults(Array.isArray(data.matches) ? data.matches : []);
    } catch (err: any) {
      setExtractedNote(`Lỗi tìm nhân vật: ${err?.message || "không xác định"}`);
    }
  };

  const handleBulkExtractedAction = async (action: "approve" | "reject" | "reset" | "apply") => {
    if (!selectedCandidateIds.length) {
      setExtractedNote("Chưa chọn candidate nào.");
      return;
    }
    const response = await fetch("/api/knowledge/extracted-anniversaries/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ids: selectedCandidateIds })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setExtractedNote(data.error || "Không chạy được thao tác hàng loạt.");
      return;
    }
    setExtractedNote(`Bulk ${action}: ${data.total} mục, applied ${data.applied || 0}, approved ${data.approved || 0}, rejected ${data.rejected || 0}, skipped ${data.skipped || 0}, failed ${data.failed || 0}.`);
    setSelectedCandidateIds([]);
    await loadExtractedCandidates();
    if (action === "apply") await loadAppliedExtractions();
  };

  const openSourceChunk = async (candidate: ExtractedAnniversaryCandidate) => {
    if (!candidate.chunkId) {
      setExtractedNote("Candidate chưa có chunkId nguồn.");
      return;
    }
    try {
      const response = await fetch(`/api/knowledge/chunks/${encodeURIComponent(candidate.chunkId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không đọc được chunk nguồn.");
      setSourceChunkDetail(data.chunk || null);
      setIsSourceChunkOpen(true);
    } catch (err: any) {
      setExtractedNote(`Không mở được nguồn: ${err?.message || "lỗi không xác định"}`);
    }
  };

  const startEditCandidateField = (candidate: ExtractedAnniversaryCandidate, field: ExtractedAnniversaryField) => {
    setEditingCandidateId(candidate.id);
    setEditingFieldType(field.type);
    setEditingValue(field.reviewedValue || field.value || "");
    setEditingMemberId(candidate.matchedMemberId || "");
  };

  const saveCandidateField = async () => {
    if (!editingCandidateId || !editingFieldType) return;
    await patchExtractedCandidate(editingCandidateId, {
      reviewedFields: { [editingFieldType]: editingValue },
      matchedMemberId: editingMemberId || undefined,
      matchConfidence: editingMemberId ? "manual" : undefined
    }, "Đã lưu giá trị đã chỉnh.");
    setEditingCandidateId("");
    setEditingFieldType("");
    setEditingValue("");
  };

  const handleApplyCandidate = async (candidate: ExtractedAnniversaryCandidate) => {
    const memberId = editingCandidateId === candidate.id ? editingMemberId : candidate.matchedMemberId;
    if (!memberId) {
      setExtractedNote("Cần gán candidate với một nhân vật trước khi áp dụng.");
      return;
    }
    const response = await fetch(`/api/knowledge/extracted-anniversaries/${encodeURIComponent(candidate.id)}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const conflicts = Array.isArray(data.conflicts) && data.conflicts.length
        ? ` Trường đã có dữ liệu: ${data.conflicts.map((item: any) => item.lineageField).join(", ")}.`
        : "";
      setExtractedNote(`${data.error || "Không áp dụng được candidate."}${conflicts}`);
      return;
    }
    setExtractedNote(`Đã áp dụng ${data.changes?.length ?? 0} trường vào cây phả và ghi audit log.`);
    await loadExtractedCandidates();
    await loadAppliedExtractions();
  };

  const handleKnowledgeSearch = async () => {
    const query = knowledgeSearchQuery.trim();
    if (!query) return;
    setIsKnowledgeSearching(true);
    try {
      const response = await fetch(`/api/knowledge/search?q=${encodeURIComponent(query)}&limit=8`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không tìm được kho tri thức.");
      setKnowledgeSearchResults(Array.isArray(data.chunks) ? data.chunks : []);
      setKnowledgeApiNote(data.localAnswer ? `Alias: ${data.localAnswer}` : "");
    } catch (err: any) {
      setKnowledgeSearchResults([]);
      setKnowledgeApiNote(`Lỗi tìm kiếm kho tri thức: ${err?.message || "không xác định"}`);
    } finally {
      setIsKnowledgeSearching(false);
    }
  };

  const deleteBackendSource = async (sourceId: string) => {
    const response = await fetch(`/api/knowledge/sources/${encodeURIComponent(sourceId)}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setKnowledgeApiNote(data.error || "Không xóa được nguồn tri thức.");
      return;
    }
    setKnowledgeApiNote("Đã xóa nguồn tri thức khỏi backend.");
    await loadKnowledgeBackend();
  };

  const loadAIRequestLogs = async () => {
    setIsAiLogsLoading(true);
    try {
      const [summaryResponse, logsResponse] = await Promise.all([
        fetch("/api/ai/logs/summary"),
        fetch("/api/ai/logs?limit=40")
      ]);
      if (summaryResponse.ok) {
        setAiLogSummary(await summaryResponse.json());
      }
      if (logsResponse.ok) {
        const data = await logsResponse.json();
        setAiLogs(Array.isArray(data.logs) ? data.logs : []);
      }
      if (!summaryResponse.ok || !logsResponse.ok) {
        setAiLogNote("Chưa đọc được nhật ký AI. Tài khoản hiện tại có thể chưa có quyền admin.");
      } else {
        setAiLogNote("");
      }
    } catch (err: any) {
      setAiLogNote(`Không đọc được nhật ký AI: ${err?.message || "lỗi không xác định"}`);
    } finally {
      setIsAiLogsLoading(false);
    }
  };

  const loadAIEvalCases = async () => {
    try {
      const response = await fetch("/api/ai/eval/cases");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không đọc được bộ kiểm thử AI.");
      setAiEvalCases(Array.isArray(data.cases) ? data.cases : []);
    } catch (err: any) {
      setAiEvalNote(`Không đọc được bộ kiểm thử AI: ${err?.message || "lỗi không xác định"}`);
    }
  };

  const runAIEval = async () => {
    setIsAiEvalRunning(true);
    setAiEvalNote("");
    try {
      const response = await fetch("/api/ai/eval/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không chạy được kiểm thử AI.");
      setAiEvalResults(Array.isArray(data.results) ? data.results : []);
      setAiEvalNote(`Kết quả: ${data.passed}/${data.total} case đạt.`);
      void loadAIRequestLogs();
    } catch (err: any) {
      setAiEvalNote(`Lỗi kiểm thử AI: ${err?.message || "không xác định"}`);
    } finally {
      setIsAiEvalRunning(false);
    }
  };

  const loadZaloBotPanel = async () => {
    setIsZaloBotLoading(true);
    try {
      const [statusResponse, webhookResponse, eventsResponse, repliesResponse] = await Promise.all([
        fetch("/api/zalo-bot/status"),
        fetch("/api/zalo-bot/webhook-status"),
        fetch("/api/zalo-bot/events?limit=12"),
        fetch("/api/zalo-bot/replies?limit=12")
      ]);
      if (statusResponse.ok) setZaloBotStatus(await statusResponse.json());
      if (webhookResponse.ok) setZaloWebhookStatus(await webhookResponse.json());
      if (eventsResponse.ok) {
        const data = await eventsResponse.json();
        setZaloBotEvents(Array.isArray(data.events) ? data.events : []);
      }
      if (repliesResponse.ok) {
        const data = await repliesResponse.json();
        setZaloBotReplies(Array.isArray(data.replies) ? data.replies : []);
      }
      if (!statusResponse.ok || !webhookResponse.ok || !eventsResponse.ok || !repliesResponse.ok) {
        setZaloBotNote("Chưa đọc được Zalo Bot. Tài khoản hiện tại có thể chưa có quyền admin.");
      } else {
        setZaloBotNote("");
      }
    } catch (err: any) {
      setZaloBotNote(`Không đọc được Zalo Bot: ${err?.message || "lỗi không xác định"}`);
    } finally {
      setIsZaloBotLoading(false);
    }
  };

  const loadAIBotConfigs = async () => {
    setIsAiBotConfigsLoading(true);
    try {
      const response = await fetch("/api/ai/bot-configs");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Không đọc được cấu hình bot AI.");
      setAiBotConfigs(Array.isArray(data.configs) ? data.configs : []);
      setAiBotConfigNote("");
    } catch (err: any) {
      setAiBotConfigNote(`Không đọc được cấu hình bot AI: ${err?.message || "lỗi không xác định"}`);
    } finally {
      setIsAiBotConfigsLoading(false);
    }
  };

  const patchAIBotConfig = async (botType: string, patch: Partial<AIBotConfig>) => {
    setIsAiBotConfigsLoading(true);
    setAiBotConfigNote("");
    try {
      const response = await fetch(`/api/ai/bot-configs/${encodeURIComponent(botType)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Không cập nhật được bot AI.");
      setAiBotConfigs((prev) => prev.map((item) => item.botType === botType ? data.config : item));
      setAiBotConfigNote(`Da cap nhat ${data.config?.label || botType}.`);
    } catch (err: any) {
      setAiBotConfigNote(`Lỗi cập nhật bot AI: ${err?.message || "không xác định"}`);
    } finally {
      setIsAiBotConfigsLoading(false);
    }
  };

  const loadSystemAuditPanel = async () => {
    setIsSystemAuditLoading(true);
    try {
      const params = new URLSearchParams();
      if (systemAuditStatusFilter) params.set("status", systemAuditStatusFilter);
      if (systemAuditTypeFilter) params.set("type", systemAuditTypeFilter);
      if (systemAuditQuery.trim()) params.set("q", systemAuditQuery.trim());
      params.set("limit", "80");
      const [suggestionsResponse, logsResponse] = await Promise.all([
        fetch(`/api/system-audit/suggestions?${params.toString()}`),
        fetch("/api/system-audit/logs?limit=20")
      ]);
      const suggestionsData = await suggestionsResponse.json().catch(() => ({}));
      const logsData = await logsResponse.json().catch(() => ({}));
      if (!suggestionsResponse.ok) throw new Error(suggestionsData.error || "Không đọc được đề xuất kiểm tra hệ thống.");
      if (!logsResponse.ok) throw new Error(logsData.error || "Không đọc được log áp dụng.");
      setSystemAuditSuggestions(Array.isArray(suggestionsData.suggestions) ? suggestionsData.suggestions : []);
      setSystemAuditLogs(Array.isArray(logsData.logs) ? logsData.logs : []);
      setSystemAuditNote("");
    } catch (err: any) {
      setSystemAuditNote(`Không đọc được kiểm tra hệ thống: ${err?.message || "lỗi không xác định"}`);
    } finally {
      setIsSystemAuditLoading(false);
    }
  };

  const runSystemAuditScan = async () => {
    setIsSystemAuditLoading(true);
    setSystemAuditNote("");
    try {
      const response = await fetch("/api/system-audit/scan", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Không chạy được scanner hệ thống.");
      setSystemAuditNote(`Đã quét ${data.scanned || 0} vùng dữ liệu, tạo mới ${data.inserted || 0} đề xuất, trùng ${data.duplicates || 0}.`);
      await loadSystemAuditPanel();
      await loadAIRequestLogs();
    } catch (err: any) {
      setSystemAuditNote(`Lỗi quét hệ thống: ${err?.message || "không xác định"}`);
    } finally {
      setIsSystemAuditLoading(false);
    }
  };

  const patchSystemAuditSuggestion = async (id: string, patch: Partial<SystemAuditSuggestion>) => {
    setIsSystemAuditLoading(true);
    setSystemAuditNote("");
    try {
      const response = await fetch(`/api/system-audit/suggestions/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Không cập nhật được đề xuất.");
      setSystemAuditSuggestions((items) => items.map((item) => item.id === id ? data.suggestion : item));
      setSystemAuditNote("Đã cập nhật trạng thái đề xuất.");
    } catch (err: any) {
      setSystemAuditNote(`Lỗi cập nhật đề xuất: ${err?.message || "không xác định"}`);
    } finally {
      setIsSystemAuditLoading(false);
    }
  };

  const applySystemAuditSuggestion = async (id: string) => {
    setIsSystemAuditLoading(true);
    setSystemAuditNote("");
    try {
      const response = await fetch(`/api/system-audit/suggestions/${encodeURIComponent(id)}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Không áp dụng được đề xuất.");
      setSystemAuditNote(`Đã áp dụng đề xuất vào ${data.result?.sourcePath || "nguồn dữ liệu"}.`);
      await loadSystemAuditPanel();
    } catch (err: any) {
      setSystemAuditNote(`Lỗi áp dụng đề xuất: ${err?.message || "không xác định"}`);
    } finally {
      setIsSystemAuditLoading(false);
    }
  };

  const markZaloEventReviewed = async (eventId: string) => {
    setIsZaloBotLoading(true);
    setZaloBotNote("");
    try {
      const response = await fetch(`/api/zalo-bot/events/${encodeURIComponent(eventId)}/mark-reviewed`, {
        method: "PATCH"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Không đánh dấu được event.");
      setZaloBotNote("Da danh dau event webhook la da xem.");
      await loadZaloBotPanel();
    } catch (err: any) {
      setZaloBotNote(`Lỗi đánh dấu event: ${err?.message || "không xác định"}`);
    } finally {
      setIsZaloBotLoading(false);
    }
  };

  const replayZaloEvent = async (eventId: string) => {
    setIsZaloBotLoading(true);
    setZaloBotNote("");
    try {
      const response = await fetch(`/api/zalo-bot/replay-event/${encodeURIComponent(eventId)}`, {
        method: "POST"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Không replay được event.");
      setZaloBotNote(data.reply?.replyText ? `Replay mock: ${data.reply.replyText.slice(0, 180)}` : "Da replay mock event.");
      await loadZaloBotPanel();
    } catch (err: any) {
      setZaloBotNote(`Lỗi replay event: ${err?.message || "không xác định"}`);
    } finally {
      setIsZaloBotLoading(false);
    }
  };

  const sendZaloMockMessage = async () => {
    setIsZaloBotLoading(true);
    setZaloBotNote("");
    try {
      const response = await fetch("/api/zalo-bot/mock-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: zaloMockChannel,
          senderId: zaloMockSenderId,
          groupId: zaloMockGroupId,
          messageText: zaloMockMessage
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Không gửi được mock message.");
      setZaloBotNote(data.reply?.replyText ? `Mock reply: ${data.reply.replyText.slice(0, 180)}` : `Mock event ${data.event?.status || "received"}.`);
      await loadZaloBotPanel();
    } catch (err: any) {
      setZaloBotNote(`Lỗi mock Zalo Bot: ${err?.message || "không xác định"}`);
    } finally {
      setIsZaloBotLoading(false);
    }
  };

  useEffect(() => {
    void loadKnowledgeBackend();
    void loadExtractedCandidates();
    void loadAppliedExtractions();
    void loadAIRequestLogs();
    void loadAIEvalCases();
    void loadZaloBotPanel();
    void loadAIBotConfigs();
    void loadSystemAuditPanel();
  }, []);

  useEffect(() => {
    void loadSystemAuditPanel();
  }, [systemAuditStatusFilter, systemAuditTypeFilter]);

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
          "Quy tắc dữ liệu đã biết: Cao Tổ là Cao Đình Thuật (高 廷 術), tước hiệu Cao Cao Mãnh Đế Đại Tướng Quân; Thủy Tổ là Cao Đình Lạng (高 廷 兩). Không dùng lại dữ liệu mẫu cũ nếu tài liệu gốc không xác nhận.",
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
    let backendImported = 0;
    for (const file of files) {
      const text = await file.text();
      const title = file.name.replace(/\.[^.]+$/, "");
      importedDocs.push({
        id: `ai_doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title,
        category: KNOWLEDGE_CATEGORY,
        content: text,
        contributor: "AI Tổng Quản",
        lastUpdated: new Date().toLocaleDateString("vi-VN")
      });
      try {
        const response = await fetch("/api/knowledge/sources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            content: text,
            type: "dashboard_upload",
            scope: "dashboard_knowledge",
            visibility: "admin",
            tags: ["dashboard_upload", "ai_governor"]
          })
        });
        if (response.ok) backendImported += 1;
      } catch {
        // Local dashboard cache remains as a fallback if backend import is unavailable.
      }
    }

    onKnowledgeDocsChange([...importedDocs, ...knowledgeDocs]);
    await loadKnowledgeBackend();
    setUploadNote(`Da nap ${backendImported}/${importedDocs.length} tep vao kho tri thuc backend. Ban localStorage van duoc giu de tuong thich dashboard cu.`);
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

  const aiOperationGraph = useMemo<{ nodes: AIOperationGraphNode[]; edges: AIOperationGraphEdge[] }>(() => {
    const configByBot = new Map<string, AIBotConfig>(aiBotConfigs.map((config) => [config.botType, config]));
    const botMetric = (botType: string) => aiLogSummary?.topBotTypes?.find((item) => item.name === botType)?.count || 0;
    const auditSummary = {
      pending: systemAuditSuggestions.filter((item) => item.status === "pending").length,
      applied: systemAuditSuggestions.filter((item) => item.status === "applied").length,
      rejected: systemAuditSuggestions.filter((item) => item.status === "rejected").length,
      critical: systemAuditSuggestions.filter((item) => ["critical", "high"].includes(item.priority)).length
    };
    const botStatus = (botType: string): AIOperationGraphNodeStatus => {
      const config = configByBot.get(botType);
      if (!config) return "error";
      if (botType === "zalo_bot") return "paused";
      return config.enabled ? "active" : "disabled";
    };
    const botNode = (
      id: string,
      label: string,
      row: number,
      description: string
    ): AIOperationGraphNode => {
      const config = configByBot.get(id);
      return {
        id,
        label,
        type: "bot",
        status: botStatus(id),
        column: 1,
        row,
        description,
        metrics: {
          engine: config?.engine || "chưa nạp",
          chunks: config?.maxKnowledgeChunks ?? "-",
          tokens: config?.maxOutputTokens ?? "-",
          requests: botMetric(id)
        }
      };
    };

    return {
      nodes: [
        botNode("webview_chat", "Chatbot Webview", 1, "Trả lời người dùng trên web, áp KYC trước khi mở dữ liệu chi tiết."),
        botNode("dashboard_helper", "Trợ lý Dashboard", 2, "Hỗ trợ admin tra cứu, kiểm tra dữ liệu và thao tác quản trị."),
        botNode("ai_governor", "AI Tổng Quản", 3, "Điều phối phân tích hệ thống, kiểm chứng dữ liệu và đề xuất chỉnh sửa."),
        botNode("article_writer", "AI Viết Bài", 4, "Tạo bản nháp bài viết từ dữ liệu đã duyệt và kho tri thức."),
        botNode("prayer_writer", "Trác Thư / Sớ", 5, "Soạn nội dung nghi lễ có kiểm soát nguồn, không bịa Hán Nôm hay ngày giỗ."),
        botNode("zalo_bot", "Zalo Bot", 6, "Tạm dừng chờ OA xác thực; chỉ giữ nền log/mock, không gửi thật."),
        {
          id: "ai_gateway",
          label: "/api/ai/chat",
          type: "gateway",
          status: "active",
          column: 2,
          row: 3,
          description: "Cửa vào duy nhất cho các bot AI, ghi log, cache và điều phối theo botType/intent.",
          metrics: {
            requests: aiLogSummary?.requestCount || 0,
            cache: aiLogSummary?.cacheHitCount || 0,
            errors: aiLogSummary?.errorCount || 0
          }
        },
        {
          id: "bot_config",
          label: "Cấu hình Bot",
          type: "config",
          status: aiBotConfigs.length ? "active" : "error",
          column: 3,
          row: 2,
          description: "Bảng ai_bot_configs quyết định engine, chunks, tokens, cache và retry riêng cho từng bot.",
          metrics: { bots: aiBotConfigs.length, enabled: aiBotConfigs.filter((item) => item.enabled).length }
        },
        {
          id: "intent_router",
          label: "Điều phối Intent",
          type: "router",
          status: "active",
          column: 3,
          row: 4,
          description: "Phân loại câu hỏi thành tra người, ngày giỗ, tri thức, viết bài, soạn sớ hoặc fallback.",
          metrics: { intents: aiLogSummary?.topIntents?.length || 0 }
        },
        {
          id: "auth_guard",
          label: "KYC / Quyền xem",
          type: "guard",
          status: "active",
          column: 4,
          row: 1,
          description: "Chặn dữ liệu cá nhân chi tiết nếu người dùng chưa đăng nhập hoặc chưa KYC.",
          metrics: { rule: "public/KYC/admin" }
        },
        {
          id: "local_db",
          label: "Cây phả & Database",
          type: "data",
          status: "active",
          column: 4,
          row: 3,
          description: "Nguồn local-first cho nhân vật, đời, chi/ngành, dữ liệu đã applied và hồ sơ.",
          metrics: { members: formatNumber(members.length) }
        },
        {
          id: "anniversary_calendar",
          label: "Lịch giỗ xác minh",
          type: "data",
          status: "active",
          column: 4,
          row: 4,
          description: "Tra ngày giỗ verified/applied trước khi gửi sang AI diễn đạt.",
          metrics: { events: formatNumber(events.length) }
        },
        {
          id: "knowledge_search",
          label: "Kho tri thức",
          type: "data",
          status: knowledgeStatus ? "active" : "error",
          column: 4,
          row: 5,
          description: "Tìm top chunks từ tài liệu Cao Tộc, alias/danh xưng và dữ liệu đã import.",
          metrics: {
            sources: knowledgeStatus?.sources || 0,
            chunks: knowledgeStatus?.chunks || 0,
            aliases: knowledgeStatus?.aliases || 0
          }
        },
        {
          id: "system_audit",
          label: "Kiểm tra hệ thống",
          type: "audit",
          status: auditSummary.critical ? "error" : "active",
          column: 5,
          row: 2,
          description: "Scanner local-first tạo đề xuất sửa lỗi font, dữ liệu mẫu, danh xưng sai, claim thiếu nguồn và rủi ro riêng tư. Admin duyệt trước khi áp dụng.",
          metrics: auditSummary
        },
        {
          id: "gemini",
          label: "Gemini",
          type: "model",
          status: aiConfig.modelName ? "active" : "disabled",
          column: 5,
          row: 4,
          description: "Chỉ dùng khi local/knowledge chưa đủ hoặc cần sinh nội dung dài.",
          metrics: { model: aiConfig.modelName || "gemini-2.5-flash" }
        },
        {
          id: "response_guard",
          label: "Response Guard",
          type: "guard",
          status: "active",
          column: 6,
          row: 3,
          description: "Chặn bịa dữ liệu, phân biệt pending/applied và giới hạn câu trả lời theo bot.",
          metrics: { policy: "không bịa dữ liệu" }
        },
        {
          id: "ai_logs",
          label: "Logs / Token",
          type: "logs",
          status: "active",
          column: 6,
          row: 5,
          description: "Theo dõi request, cache, lỗi, token ước tính và nguồn tri thức theo từng bot.",
          metrics: { tokens: aiLogSummary?.estimatedTokens || 0, avg: `${aiLogSummary?.avgDurationMs || 0}ms` }
        }
      ],
      edges: [
        { from: "webview_chat", to: "ai_gateway", label: "botType" },
        { from: "dashboard_helper", to: "ai_gateway", label: "botType" },
        { from: "ai_governor", to: "ai_gateway", label: "botType" },
        { from: "article_writer", to: "ai_gateway", label: "botType" },
        { from: "prayer_writer", to: "ai_gateway", label: "botType" },
        { from: "zalo_bot", to: "ai_gateway", label: "paused" },
        { from: "ai_gateway", to: "bot_config", label: "đọc cấu hình" },
        { from: "ai_gateway", to: "intent_router", label: "intent" },
        { from: "intent_router", to: "auth_guard", label: "quyền" },
        { from: "intent_router", to: "local_db", label: "local-first" },
        { from: "intent_router", to: "anniversary_calendar", label: "ngày giỗ" },
        { from: "intent_router", to: "knowledge_search", label: "search" },
        { from: "ai_governor", to: "system_audit", label: "system_audit" },
        { from: "system_audit", to: "bot_config", label: "prompt/config" },
        { from: "system_audit", to: "local_db", label: "scan" },
        { from: "system_audit", to: "knowledge_search", label: "scan" },
        { from: "knowledge_search", to: "gemini", label: "khi cần" },
        { from: "local_db", to: "response_guard" },
        { from: "anniversary_calendar", to: "response_guard" },
        { from: "gemini", to: "response_guard" },
        { from: "system_audit", to: "ai_logs", label: "audit log" },
        { from: "response_guard", to: "ai_logs", label: "ghi log" }
      ]
    };
  }, [aiBotConfigs, aiConfig.modelName, aiLogSummary, events.length, knowledgeStatus, members.length, systemAuditSuggestions]);

  const selectedOperationNode =
    aiOperationGraph.nodes.find((node) => node.id === selectedOperationNodeId) || aiOperationGraph.nodes[0];
  const selectedOperationBotConfig = selectedOperationNode.type === "bot"
    ? aiBotConfigs.find((config) => config.botType === selectedOperationNode.id) || null
    : null;
  const selectedOperationRecentLogs = useMemo(() => {
    if (selectedOperationNode.type === "bot") {
      return aiLogs.filter((log) => log.botType === selectedOperationNode.id);
    }
    if (selectedOperationNode.id === "ai_gateway" || selectedOperationNode.id === "ai_logs") {
      return aiLogs;
    }
    return [];
  }, [aiLogs, selectedOperationNode.id, selectedOperationNode.type]);
  const selectedOperationErrorLogs = selectedOperationRecentLogs.filter((log) => log.status >= 400 || log.errorMessage);
  const selectedOperationCanShowLogs =
    selectedOperationNode.type === "bot" || selectedOperationNode.id === "ai_gateway" || selectedOperationNode.id === "ai_logs";
  const selectedOperationLogPageCount = Math.max(1, Math.ceil(selectedOperationRecentLogs.length / AI_OPERATION_LOG_PAGE_SIZE));
  const selectedOperationCurrentLogPage = Math.min(operationLogPage, selectedOperationLogPageCount);
  const selectedOperationPagedLogs = selectedOperationRecentLogs.slice(
    (selectedOperationCurrentLogPage - 1) * AI_OPERATION_LOG_PAGE_SIZE,
    selectedOperationCurrentLogPage * AI_OPERATION_LOG_PAGE_SIZE
  );
  const statusLabel: Record<AIOperationGraphNodeStatus, string> = {
    active: "Đang chạy",
    paused: "Tạm dừng",
    disabled: "Đã tắt",
    error: "Cần kiểm tra"
  };
  const statusClass: Record<AIOperationGraphNodeStatus, string> = {
    active: "border-emerald-200 bg-emerald-50/70 text-emerald-800",
    paused: "border-amber-200 bg-amber-50/80 text-amber-900",
    disabled: "border-stone-200 bg-stone-100 text-stone-500",
    error: "border-red-200 bg-red-50 text-red-800"
  };
  const nodeTypeLabel: Record<AIOperationGraphNode["type"], string> = {
    bot: "Bot",
    gateway: "Gateway",
    config: "Cấu hình",
    router: "Router",
    data: "Dữ liệu",
    model: "Model",
    guard: "Guard",
    logs: "Log",
    audit: "Audit"
  };
  const graphCanvas = { width: 1500, height: 800, nodeWidth: 172, nodeHeight: 76 };
  const getOperationNodePosition = (node: AIOperationGraphNode) => ({
    x: 44 + (node.column - 1) * 238,
    y: 48 + (node.row - 1) * 110
  });
  const operationEdgeLane = (edge: AIOperationGraphEdge, index: number) => {
    const siblingEdges = aiOperationGraph.edges.filter((item) => item.to === edge.to || item.from === edge.from);
    const siblingIndex = siblingEdges.findIndex((item) => item === edge);
    if (siblingIndex < 0) return ((index % 3) - 1) * 6;
    return (siblingIndex - (siblingEdges.length - 1) / 2) * 7;
  };
  const getOperationNodeRect = (node: AIOperationGraphNode, padding = 0) => {
    const pos = getOperationNodePosition(node);
    return {
      left: pos.x - padding,
      right: pos.x + graphCanvas.nodeWidth + padding,
      top: pos.y - padding,
      bottom: pos.y + graphCanvas.nodeHeight + padding
    };
  };
  const getOperationAnchor = (
    node: AIOperationGraphNode,
    side: "left" | "right" | "top" | "bottom",
    slot = 0.5
  ) => {
    const pos = getOperationNodePosition(node);
    const insetX = 22;
    const insetY = 16;
    const normalizedSlot = Math.min(0.88, Math.max(0.12, slot));
    if (side === "left") return { x: pos.x, y: pos.y + insetY + (graphCanvas.nodeHeight - insetY * 2) * normalizedSlot };
    if (side === "right") return { x: pos.x + graphCanvas.nodeWidth, y: pos.y + insetY + (graphCanvas.nodeHeight - insetY * 2) * normalizedSlot };
    if (side === "top") return { x: pos.x + insetX + (graphCanvas.nodeWidth - insetX * 2) * normalizedSlot, y: pos.y };
    return { x: pos.x + insetX + (graphCanvas.nodeWidth - insetX * 2) * normalizedSlot, y: pos.y + graphCanvas.nodeHeight };
  };
  const getPreferredOperationSides = (edge: AIOperationGraphEdge): {
    fromSide: "left" | "right" | "top" | "bottom";
    toSide: "left" | "right" | "top" | "bottom";
  } => {
    if (edge.to === "ai_gateway") {
      if (edge.from === "webview_chat" || edge.from === "dashboard_helper") return { fromSide: "right", toSide: "top" };
      if (edge.from === "article_writer" || edge.from === "prayer_writer") return { fromSide: "right", toSide: "bottom" };
      return { fromSide: "right", toSide: "left" };
    }
    if (edge.from === "ai_governor" && edge.to === "system_audit") return { fromSide: "right", toSide: "top" };
    const fromNode = aiOperationGraph.nodes.find((node) => node.id === edge.from);
    const toNode = aiOperationGraph.nodes.find((node) => node.id === edge.to);
    if (!fromNode || !toNode) return { fromSide: "right", toSide: "left" };
    const fromPos = getOperationNodePosition(fromNode);
    const toPos = getOperationNodePosition(toNode);
    const dx = toPos.x - fromPos.x;
    const dy = toPos.y - fromPos.y;
    if (Math.abs(dx) >= Math.abs(dy)) {
      return { fromSide: dx >= 0 ? "right" : "left", toSide: dx >= 0 ? "left" : "right" };
    }
    return { fromSide: dy >= 0 ? "bottom" : "top", toSide: dy >= 0 ? "top" : "bottom" };
  };
  const getOperationAnchorSlot = (
    edge: AIOperationGraphEdge,
    nodeId: string,
    side: "left" | "right" | "top" | "bottom",
    endpoint: "from" | "to"
  ) => {
    const peers = aiOperationGraph.edges.filter((item) => {
      const preferred = getPreferredOperationSides(item);
      return item[endpoint] === nodeId && preferred[endpoint === "from" ? "fromSide" : "toSide"] === side;
    });
    const index = peers.findIndex((item) => item === edge);
    if (peers.length <= 1 || index < 0) return 0.5;
    return (index + 1) / (peers.length + 1);
  };
  const operationSegmentIntersectsRect = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    rect: { left: number; right: number; top: number; bottom: number }
  ) => {
    if (a.x === b.x) {
      const minY = Math.min(a.y, b.y);
      const maxY = Math.max(a.y, b.y);
      return a.x >= rect.left && a.x <= rect.right && maxY >= rect.top && minY <= rect.bottom;
    }
    if (a.y === b.y) {
      const minX = Math.min(a.x, b.x);
      const maxX = Math.max(a.x, b.x);
      return a.y >= rect.top && a.y <= rect.bottom && maxX >= rect.left && minX <= rect.right;
    }
    return false;
  };
  const operationPolylineLength = (points: Array<{ x: number; y: number }>) =>
    points.slice(1).reduce((total, point, index) => {
      const previous = points[index];
      return total + Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y);
    }, 0);
  const operationPathFromPoints = (points: Array<{ x: number; y: number }>) =>
    points.reduce((path, point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;
      const previous = points[index - 1];
      if (point.x === previous.x) return `${path} V ${point.y}`;
      if (point.y === previous.y) return `${path} H ${point.x}`;
      return `${path} L ${point.x} ${point.y}`;
    }, "");
  const operationGraphEdges = aiOperationGraph.edges.map((edge, index) => {
    const fromNode = aiOperationGraph.nodes.find((node) => node.id === edge.from);
    const toNode = aiOperationGraph.nodes.find((node) => node.id === edge.to);
    if (!fromNode || !toNode) return null;
    const lane = operationEdgeLane(edge, index);
    const sourceRect = getOperationNodeRect(fromNode, 14);
    const targetRect = getOperationNodeRect(toNode, 14);
    const obstacles = aiOperationGraph.nodes
      .filter((node) => node.id !== edge.from && node.id !== edge.to)
      .map((node) => getOperationNodeRect(node, 18));
    const sidePairs: Array<["left" | "right" | "top" | "bottom", "left" | "right" | "top" | "bottom"]> = [
      ["right", "left"],
      ["top", "top"],
      ["bottom", "bottom"],
      ["right", "top"],
      ["top", "left"],
      ["bottom", "left"],
      ["left", "right"],
      ["top", "bottom"],
      ["bottom", "top"]
    ];
    const routePadding = 30;
    const routeXValues = [
      Math.round((sourceRect.right + targetRect.left) / 2) + lane,
      Math.max(sourceRect.right, targetRect.right) + routePadding + Math.abs(lane),
      Math.min(sourceRect.left, targetRect.left) - routePadding - Math.abs(lane)
    ];
    const routeYValues = [
      Math.round((sourceRect.top + targetRect.top) / 2) + lane,
      Math.min(sourceRect.top, targetRect.top) - routePadding - Math.abs(lane),
      Math.max(sourceRect.bottom, targetRect.bottom) + routePadding + Math.abs(lane)
    ];
    const candidates: Array<{ points: Array<{ x: number; y: number }>; score: number }> = [];
    let routePoints: Array<{ x: number; y: number }> | null = null;

    if (edge.to === "ai_gateway" && fromNode.type === "bot") {
      const preferred = getPreferredOperationSides(edge);
      const start = getOperationAnchor(fromNode, preferred.fromSide, getOperationAnchorSlot(edge, fromNode.id, preferred.fromSide, "from"));
      const end = getOperationAnchor(toNode, preferred.toSide, getOperationAnchorSlot(edge, toNode.id, preferred.toSide, "to"));
      if (preferred.toSide === "top") {
        const routeX = Math.min(start.x + 32, end.x - 16);
        const routeY = end.y - 28;
        routePoints = [start, { x: routeX, y: start.y }, { x: routeX, y: routeY }, { x: end.x, y: routeY }, end];
      } else if (preferred.toSide === "bottom") {
        const routeX = Math.min(start.x + 32, end.x - 16);
        const routeY = end.y + 28;
        routePoints = [start, { x: routeX, y: start.y }, { x: routeX, y: routeY }, { x: end.x, y: routeY }, end];
      } else {
        const routeX = end.x - 30 - Math.abs(lane);
        routePoints = [start, { x: routeX, y: start.y }, { x: routeX, y: end.y }, end];
      }
    } else if (edge.from === "ai_governor" && edge.to === "system_audit") {
      const start = getOperationAnchor(fromNode, "right", getOperationAnchorSlot(edge, fromNode.id, "right", "from"));
      const end = getOperationAnchor(toNode, "top", getOperationAnchorSlot(edge, toNode.id, "top", "to"));
      const routeX = sourceRect.right + 22;
      const routeY = 24 + Math.max(0, lane);
      routePoints = [start, { x: routeX, y: start.y }, { x: routeX, y: routeY }, { x: end.x, y: routeY }, end];
    }

    if (!routePoints) sidePairs.forEach(([fromSide, toSide]) => {
      const start = getOperationAnchor(fromNode, fromSide, getOperationAnchorSlot(edge, fromNode.id, fromSide, "from"));
      const end = getOperationAnchor(toNode, toSide, getOperationAnchorSlot(edge, toNode.id, toSide, "to"));
      const midX = Math.round((start.x + end.x) / 2) + lane;
      const midY = Math.round((start.y + end.y) / 2) + lane;
      const pointSets: Array<Array<{ x: number; y: number }>> = [
        [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end],
        [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end],
        ...routeXValues.map((routeX) => [start, { x: routeX, y: start.y }, { x: routeX, y: end.y }, end]),
        ...routeYValues.map((routeY) => [start, { x: start.x, y: routeY }, { x: end.x, y: routeY }, end])
      ];
      pointSets.forEach((points) => {
        const intersections = points.slice(1).reduce((count, point, pointIndex) => {
          const previous = points[pointIndex];
          return count + obstacles.filter((rect) => operationSegmentIntersectsRect(previous, point, rect)).length;
        }, 0);
        const outsidePenalty = points.some((point) => point.x < 12 || point.y < 12 || point.x > graphCanvas.width - 12 || point.y > graphCanvas.height - 12) ? 3000 : 0;
        const topBottomBonus = (fromSide === "top" || fromSide === "bottom" || toSide === "top" || toSide === "bottom") ? -80 : 0;
        const score = operationPolylineLength(points) + intersections * 10000 + outsidePenalty + points.length * 12 + topBottomBonus;
        candidates.push({ points, score });
      });
    });
    const bestRoute = candidates.sort((a, b) => a.score - b.score)[0];
    routePoints = routePoints || bestRoute?.points || [];
    const path = operationPathFromPoints(routePoints);
    const middlePoint = routePoints[Math.max(1, Math.floor(routePoints.length / 2))] || { x: 0, y: 0 };
    const label = edge.label === "botType" ? "" : edge.label || "";
    const labelWidth = Math.min(104, Math.max(42, label.length * 6 + 18));
    return {
      ...edge,
      label,
      fromNode,
      toNode,
      path,
      labelWidth,
      labelX: middlePoint.x,
      labelY: middlePoint.y - 10
    };
  }).filter(Boolean) as Array<AIOperationGraphEdge & {
    fromNode: AIOperationGraphNode;
    toNode: AIOperationGraphNode;
    path: string;
    labelWidth: number;
    labelX: number;
    labelY: number;
  }>;
  const operationShellClass = isOperationGraphExpanded
    ? "fixed inset-4 z-50 overflow-hidden rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl"
    : "rounded-xl border border-stone-200 bg-white p-5 shadow-sm";
  const handleOperationGraphPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const container = operationGraphScrollRef.current;
    if (!container) return;
    operationGraphDragRef.current = {
      dragging: true,
      x: event.clientX,
      y: event.clientY,
      left: container.scrollLeft,
      top: container.scrollTop
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handleOperationGraphPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!operationGraphDragRef.current.dragging) return;
    const container = operationGraphScrollRef.current;
    if (!container) return;
    container.scrollLeft = operationGraphDragRef.current.left - (event.clientX - operationGraphDragRef.current.x);
    container.scrollTop = operationGraphDragRef.current.top - (event.clientY - operationGraphDragRef.current.y);
  };
  const handleOperationGraphPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    operationGraphDragRef.current.dragging = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
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
          ["operations", "Sơ đồ vận hành", GitBranch],
          ["system-audit", "Kiểm tra hệ thống", AlertTriangle],
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

            <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm xl:col-span-3">
              <h3 className="mb-3 flex items-center gap-2 font-serif text-lg font-bold text-red-950">
                <ClipboardList className="h-5 w-5 text-amber-700" />
                Nhật ký AI
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-5">
                <p className="rounded-lg bg-stone-50 p-3">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-stone-400">Requests</span>
                  <strong className="mt-1 block text-red-950">{aiLogSummary?.requestCount ?? "-"}</strong>
                </p>
                <p className="rounded-lg bg-stone-50 p-3">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-stone-400">Cache</span>
                  <strong className="mt-1 block text-red-950">{aiLogSummary?.cacheHitCount ?? "-"}</strong>
                </p>
                <p className="rounded-lg bg-stone-50 p-3">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-stone-400">Errors</span>
                  <strong className="mt-1 block text-red-950">{aiLogSummary?.errorCount ?? "-"}</strong>
                </p>
                <p className="rounded-lg bg-stone-50 p-3">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-stone-400">Avg</span>
                  <strong className="mt-1 block text-red-950">{aiLogSummary?.avgDurationMs ?? "-"}ms</strong>
                </p>
                <p className="rounded-lg bg-stone-50 p-3">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-stone-400">Tokens</span>
                  <strong className="mt-1 block text-red-950">{aiLogSummary?.estimatedTokens ?? "-"}</strong>
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveMode("knowledge")}
                  className="rounded bg-red-900 px-3 py-2 text-xs font-bold text-white hover:bg-red-950"
                >
                  Mở nhật ký chi tiết
                </button>
                <button
                  type="button"
                  onClick={() => void loadAIRequestLogs()}
                  disabled={isAiLogsLoading}
                  className="inline-flex items-center gap-2 rounded border border-stone-200 px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${isAiLogsLoading ? "animate-spin" : ""}`} />
                  Tải lại
                </button>
              </div>
              {aiLogNote && <p className="mt-2 rounded bg-amber-50 p-2 text-[11px] text-amber-800">{aiLogNote}</p>}
            </div>
          </div>

          <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 font-serif text-lg font-bold text-red-950">
              <BrainCircuit className="h-5 w-5 text-amber-700" />
              Sơ đồ vận hành AI
            </h3>
            <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-3">
              <div className="rounded-lg border border-stone-200 bg-[#fbfaf6] p-3">
                <span className="block font-bold text-red-950">Workflow tương tác</span>
                <span className="mt-2 block leading-relaxed text-stone-500">Bot → Gateway → Cấu hình → Intent → Dữ liệu local/kho tri thức/Gemini → Guard → Log.</span>
              </div>
              <div className="rounded-lg border border-stone-200 bg-[#fbfaf6] p-3">
                <span className="block font-bold text-red-950">Theo từng bot</span>
                <span className="mt-2 block leading-relaxed text-stone-500">Click node để xem engine, chunks, tokens, cache, request và lỗi gần đây.</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveMode("operations")}
                className="rounded-lg border border-red-200 bg-red-50 p-3 text-left font-bold text-red-950 hover:border-red-300 hover:bg-red-100"
              >
                Mở sơ đồ vận hành đầy đủ
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              {(aiLogSummary?.topBotTypes || []).slice(0, 6).map((item) => (
                <span key={item.name} className="rounded bg-stone-100 px-2 py-1 font-bold text-stone-600">{item.name}: {item.count}</span>
              ))}
            </div>
          </section>

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

      {activeMode === "operations" && (
        <div className={isOperationGraphExpanded ? "fixed inset-0 z-40 bg-stone-950/30 p-4" : "space-y-5"}>
          <section className={operationShellClass}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="flex items-center gap-2 font-serif text-xl font-bold text-red-950">
                  <GitBranch className="h-5 w-5 text-amber-700" />
                  Sơ đồ vận hành AI
                </h3>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-stone-500">
                  Workflow trái sang phải cho toàn bộ hệ thống AI. Bấm vào từng node để xem cấu hình, trạng thái, chỉ số và đường truyền dữ liệu liên quan.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                {Object.entries(statusLabel).map(([status, label]) => (
                  <span key={status} className={`rounded-full border px-2.5 py-1 ${statusClass[status as AIOperationGraphNodeStatus]}`}>
                    {label}
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => setIsOperationGraphExpanded((value) => !value)}
                  className="rounded-full border border-red-200 bg-red-50 px-3 py-1 font-bold text-red-950 hover:bg-red-100"
                >
                  {isOperationGraphExpanded ? "Thu gọn" : "Mở rộng ngang"}
                </button>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex flex-wrap gap-3 text-[11px] font-semibold text-stone-500">
                <span className="inline-flex items-center gap-1"><span className="h-0.5 w-5 rounded bg-slate-500" />Luồng thường</span>
                <span className="inline-flex items-center gap-1"><span className="h-0.5 w-5 rounded bg-blue-600" />Liên quan kiểm tra</span>
                <span className="inline-flex items-center gap-1"><span className="h-0.5 w-5 rounded bg-red-700" />Node đang chọn</span>
                <span className="inline-flex items-center gap-1"><span className="h-0.5 w-5 rounded border-t border-dashed border-stone-400" />Tạm dừng</span>
              </div>
              <div
                ref={operationGraphScrollRef}
                className={`rounded-xl border border-stone-200 bg-[#fbfaf6] ${isOperationGraphExpanded ? "h-[calc(100vh-180px)]" : "max-h-[680px]"} overflow-auto p-3`}
              >
                <div
                  className="relative cursor-grab active:cursor-grabbing"
                  style={{ width: graphCanvas.width, height: graphCanvas.height, touchAction: "none" }}
                  onPointerDown={handleOperationGraphPointerDown}
                  onPointerMove={handleOperationGraphPointerMove}
                  onPointerUp={handleOperationGraphPointerEnd}
                  onPointerCancel={handleOperationGraphPointerEnd}
                >
                  <svg
                    className="pointer-events-none absolute inset-0 z-0"
                    width={graphCanvas.width}
                    height={graphCanvas.height}
                    viewBox={`0 0 ${graphCanvas.width} ${graphCanvas.height}`}
                    aria-hidden="true"
                  >
                    <defs>
                      <marker id="ai-flow-arrow" markerWidth="5.5" markerHeight="5.5" refX="5.1" refY="2.75" orient="auto" markerUnits="strokeWidth">
                        <path d="M 0 0 L 5.5 2.75 L 0 5.5 z" fill="context-stroke" />
                      </marker>
                      <marker id="ai-flow-arrow-active" markerWidth="6.5" markerHeight="6.5" refX="6" refY="3.25" orient="auto" markerUnits="strokeWidth">
                        <path d="M 0 0 L 6.5 3.25 L 0 6.5 z" fill="context-stroke" />
                      </marker>
                    </defs>
                    {operationGraphEdges.map((edge) => {
                      const isRelated = edge.from === selectedOperationNode.id || edge.to === selectedOperationNode.id;
                      const edgeStroke = isRelated
                        ? "#991b1b"
                        : edge.from === "system_audit" || edge.to === "system_audit"
                          ? "#2563eb"
                          : edge.from === "zalo_bot"
                            ? "#9ca3af"
                            : "#64748b";
                      return (
                        <g key={`${edge.from}-${edge.to}-${edge.label || ""}`}>
                          <path
                            d={edge.path}
                            fill="none"
                            stroke={edgeStroke}
                            strokeWidth={isRelated ? 1.45 : 0.85}
                            strokeDasharray={edge.from === "zalo_bot" ? "5 5" : undefined}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity={isRelated ? 0.95 : 0.58}
                            markerEnd={isRelated ? "url(#ai-flow-arrow-active)" : "url(#ai-flow-arrow)"}
                          />
                          {edge.label && isRelated && (
                            <g className="hidden md:block">
                              <rect
                                x={edge.labelX - edge.labelWidth / 2}
                                y={edge.labelY - 12}
                                width={edge.labelWidth}
                                height={18}
                                rx={6}
                                className="fill-[#fbfaf6] stroke-stone-200"
                              />
                              <text
                                x={edge.labelX}
                                y={edge.labelY + 1}
                                textAnchor="middle"
                                className="fill-stone-600 text-[10px] font-bold"
                              >
                                {edge.label}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </svg>

                  {aiOperationGraph.nodes.map((node) => {
                    const pos = getOperationNodePosition(node);
                    const isSelected = selectedOperationNode.id === node.id;
                    const primaryMetric = node.metrics ? Object.entries(node.metrics)[0] : null;
                    return (
                      <button
                        key={node.id}
                        type="button"
                        onClick={() => {
                          setSelectedOperationNodeId(node.id);
                          setIsOperationDetailOpen(true);
                        }}
                        className={`absolute z-10 rounded-xl border bg-white p-3 text-left text-xs shadow-sm transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md ${
                          isSelected ? "border-red-300 ring-2 ring-red-100" : "border-stone-200"
                        }`}
                        style={{
                          left: pos.x,
                          top: pos.y,
                          width: graphCanvas.nodeWidth,
                          height: graphCanvas.nodeHeight
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[9px] font-black uppercase tracking-wide text-amber-700">{nodeTypeLabel[node.type]}</span>
                          <span className={`h-2.5 w-2.5 shrink-0 rounded-full border ${
                            node.status === "active" ? "border-emerald-500 bg-emerald-400" :
                            node.status === "paused" ? "border-amber-500 bg-amber-400" :
                            node.status === "error" ? "border-red-500 bg-red-400" :
                            "border-stone-400 bg-stone-300"
                          }`} />
                        </div>
                        <strong className="mt-0.5 block line-clamp-2 text-[13px] leading-snug text-red-950">{node.label}</strong>
                        {primaryMetric && (
                          <span className="mt-1 inline-flex max-w-full rounded bg-stone-100 px-2 py-1 text-[10px] font-semibold text-stone-600">
                            <span className="truncate">{primaryMetric[0]}: {String(primaryMetric[1])}</span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {isOperationDetailOpen && (
                <div
                  className="fixed inset-0 z-[70] flex items-center justify-center bg-stone-950/40 p-4"
                  role="dialog"
                  aria-modal="true"
                  onClick={() => setIsOperationDetailOpen(false)}
                >
                  <div
                    className="max-h-[88vh] w-full max-w-2xl overflow-auto rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wide text-amber-700">
                          {nodeTypeLabel[selectedOperationNode.type]}
                        </span>
                        <h4 className="mt-1 font-serif text-2xl font-bold text-red-950">{selectedOperationNode.label}</h4>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsOperationDetailOpen(false)}
                        className="rounded-full border border-stone-200 px-3 py-1 text-xs font-bold text-stone-600 hover:bg-stone-50"
                      >
                        Đóng
                      </button>
                    </div>
                    <span className={`mt-3 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClass[selectedOperationNode.status]}`}>
                      {statusLabel[selectedOperationNode.status]}
                    </span>
                    <p className="mt-4 text-sm leading-relaxed text-stone-600">{selectedOperationNode.description}</p>

                    {selectedOperationNode.metrics && (
                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                        {Object.entries(selectedOperationNode.metrics).map(([key, value]) => (
                          <p key={key} className="rounded-lg bg-stone-50 p-3">
                            <span className="block text-[10px] font-bold uppercase text-stone-400">{key}</span>
                            <strong className="mt-1 block break-words text-red-950">{String(value)}</strong>
                          </p>
                        ))}
                      </div>
                    )}

                    {selectedOperationNode.id === "system_audit" && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsOperationDetailOpen(false);
                          setActiveMode("system-audit");
                        }}
                        className="mt-4 rounded bg-red-900 px-3 py-2 text-xs font-bold text-white hover:bg-red-950"
                      >
                        Mở danh sách đề xuất
                      </button>
                    )}

                    {selectedOperationBotConfig && (
                      <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wide text-amber-700">Cài đặt bot AI</p>
                            <p className="mt-1 text-xs text-stone-500">Đồng bộ với cấu hình chung qua ai_bot_configs.</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase text-stone-400">{selectedOperationBotConfig.enabled ? "On" : "Off"}</span>
                            <button
                              type="button"
                              disabled={isAiBotConfigsLoading || selectedOperationBotConfig.botType === "zalo_bot"}
                              onClick={() => void patchAIBotConfig(selectedOperationBotConfig.botType, { enabled: !selectedOperationBotConfig.enabled })}
                              className={`inline-flex h-5 w-10 items-center rounded-full p-0.5 transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                selectedOperationBotConfig.enabled ? "bg-emerald-500" : "bg-stone-300"
                              }`}
                              aria-pressed={selectedOperationBotConfig.enabled}
                            >
                              <span
                                className={`h-4 w-4 rounded-full bg-white shadow transition ${
                                  selectedOperationBotConfig.enabled ? "translate-x-5" : "translate-x-0"
                                }`}
                              />
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <label className="block text-xs">
                            <span className="mb-1 block text-[10px] font-bold uppercase text-stone-400">Engine</span>
                            <select
                              value={selectedOperationBotConfig.engine}
                              disabled={isAiBotConfigsLoading || selectedOperationBotConfig.botType === "zalo_bot"}
                              onChange={(event) => void patchAIBotConfig(selectedOperationBotConfig.botType, { engine: event.target.value })}
                              className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2"
                            >
                              <option value="local">local</option>
                              <option value="local-knowledge">local-knowledge</option>
                              <option value="gemini">gemini</option>
                            </select>
                          </label>
                          <label className="block text-xs">
                            <span className="mb-1 block text-[10px] font-bold uppercase text-stone-400">Max chunks</span>
                            <input
                              type="number"
                              min={0}
                              max={20}
                              value={selectedOperationBotConfig.maxKnowledgeChunks}
                              disabled={isAiBotConfigsLoading}
                              onChange={(event) => void patchAIBotConfig(selectedOperationBotConfig.botType, { maxKnowledgeChunks: Number(event.target.value) })}
                              className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2"
                            />
                          </label>
                          <label className="block text-xs">
                            <span className="mb-1 block text-[10px] font-bold uppercase text-stone-400">Max tokens</span>
                            <input
                              type="number"
                              min={200}
                              max={4000}
                              value={selectedOperationBotConfig.maxOutputTokens}
                              disabled={isAiBotConfigsLoading}
                              onChange={(event) => void patchAIBotConfig(selectedOperationBotConfig.botType, { maxOutputTokens: Number(event.target.value) })}
                              className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2"
                            />
                          </label>
                          <label className="flex h-full cursor-pointer items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-600">
                            <input
                              type="checkbox"
                              checked={selectedOperationBotConfig.cacheEnabled}
                              disabled={isAiBotConfigsLoading}
                              onChange={(event) => void patchAIBotConfig(selectedOperationBotConfig.botType, { cacheEnabled: event.target.checked })}
                              className="sr-only"
                            />
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                              selectedOperationBotConfig.cacheEnabled ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-stone-200 bg-white text-transparent"
                            }`}>
                              <CheckCircle2 className="h-4 w-4" />
                            </span>
                            Cache
                          </label>
                        </div>

                        {selectedOperationBotConfig.pausedReason && (
                          <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-amber-900">{selectedOperationBotConfig.pausedReason}</p>
                        )}
                      </div>
                    )}

                    <div className="mt-5 border-t border-stone-100 pt-4">
                      <p className="text-[10px] font-black uppercase tracking-wide text-stone-400">Đường nối liên quan</p>
                      <div className="mt-2 space-y-2 text-xs">
                        {aiOperationGraph.edges
                          .filter((edge) => edge.from === selectedOperationNode.id || edge.to === selectedOperationNode.id)
                          .map((edge) => {
                            const fromNode = aiOperationGraph.nodes.find((node) => node.id === edge.from);
                            const toNode = aiOperationGraph.nodes.find((node) => node.id === edge.to);
                            return (
                              <button
                                key={`${edge.from}-${edge.to}-${edge.label || ""}`}
                                type="button"
                                onClick={() => setSelectedOperationNodeId(edge.to === selectedOperationNode.id ? edge.from : edge.to)}
                                className="w-full rounded-lg border border-stone-200 bg-[#fbfaf6] px-3 py-2 text-left hover:border-amber-300 hover:bg-amber-50"
                              >
                                <span className="font-bold text-red-950">{fromNode?.label || edge.from}</span>
                                <span className="px-2 text-amber-700">→</span>
                                <span className="font-bold text-red-950">{toNode?.label || edge.to}</span>
                                {edge.label && <span className="ml-2 text-stone-500">({edge.label})</span>}
                              </button>
                            );
                          })}
                        {!aiOperationGraph.edges.some((edge) => edge.from === selectedOperationNode.id || edge.to === selectedOperationNode.id) && (
                          <p className="rounded bg-stone-50 p-2 text-stone-500">Node này chưa có đường nối được ghi nhận.</p>
                        )}
                      </div>
                    </div>

                    {selectedOperationCanShowLogs && (
                      <div className="mt-5 rounded-xl border border-stone-200 bg-white p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wide text-stone-400">Request và lỗi gần đây</p>
                            <p className="mt-1 text-xs text-stone-500">
                              {selectedOperationNode.type === "bot"
                                ? `Lịch sử gần nhất của bot ${selectedOperationNode.label}.`
                                : "Lịch sử gần nhất đi qua AI Gateway."}
                            </p>
                          </div>
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                            selectedOperationErrorLogs.length
                              ? "border-red-200 bg-red-50 text-red-800"
                              : "border-emerald-200 bg-emerald-50 text-emerald-800"
                          }`}>
                            {selectedOperationErrorLogs.length ? `${selectedOperationErrorLogs.length} lỗi` : "Không có lỗi gần đây"}
                          </span>
                        </div>
                        <div className="mt-3 space-y-2 text-xs">
                          {selectedOperationPagedLogs.map((log) => (
                            <div key={log.id} className="rounded-lg border border-stone-100 bg-[#fbfaf6] px-3 py-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-bold text-red-950">{log.intent || "unknown"}</span>
                                <span className="font-mono text-[10px] text-stone-400">{log.createdAt || "-"}</span>
                              </div>
                              <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-semibold text-stone-500">
                                <span className="rounded bg-white px-2 py-0.5">engine: {log.botConfigEngine || log.engine || "-"}</span>
                                <span className="rounded bg-white px-2 py-0.5">status: {log.status || "-"}</span>
                                <span className="rounded bg-white px-2 py-0.5">{log.cached ? "cache hit" : `${log.durationMs || 0}ms`}</span>
                                <span className="rounded bg-white px-2 py-0.5">tokens: {formatNumber(log.estimatedTokens || 0)}</span>
                                {log.knowledgeMatchesCount ? (
                                  <span className="rounded bg-white px-2 py-0.5">chunks: {log.knowledgeMatchesCount}</span>
                                ) : null}
                              </div>
                              {log.errorMessage && (
                                <p className="mt-2 rounded bg-red-50 px-2 py-1 text-[11px] text-red-800">{log.errorMessage}</p>
                              )}
                            </div>
                          ))}
                          {!selectedOperationRecentLogs.length && (
                            <p className="rounded-lg border border-dashed border-stone-200 bg-[#fbfaf6] px-3 py-3 text-stone-500">
                              Chưa có request gần đây cho node này. Hãy gửi thử một câu hỏi qua bot tương ứng rồi tải lại nhật ký AI.
                            </p>
                          )}
                          {selectedOperationRecentLogs.length > AI_OPERATION_LOG_PAGE_SIZE && (
                            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-2">
                              <span className="text-[10px] font-semibold text-stone-400">
                                Trang {selectedOperationCurrentLogPage}/{selectedOperationLogPageCount} · {selectedOperationRecentLogs.length} request
                              </span>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => setOperationLogPage((page) => Math.max(1, page - 1))}
                                  disabled={selectedOperationCurrentLogPage <= 1}
                                  className="rounded border border-stone-200 px-2 py-1 text-[10px] font-bold text-stone-600 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  Trước
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setOperationLogPage((page) => Math.min(selectedOperationLogPageCount, page + 1))}
                                  disabled={selectedOperationCurrentLogPage >= selectedOperationLogPageCount}
                                  className="rounded border border-stone-200 px-2 py-1 text-[10px] font-bold text-stone-600 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  Sau
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <aside className="hidden">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wide text-amber-700">
                      {nodeTypeLabel[selectedOperationNode.type]}
                    </span>
                    <h4 className="mt-1 font-serif text-lg font-bold text-red-950">{selectedOperationNode.label}</h4>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClass[selectedOperationNode.status]}`}>
                    {statusLabel[selectedOperationNode.status]}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-stone-600">{selectedOperationNode.description}</p>

                {selectedOperationNode.metrics && (
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(selectedOperationNode.metrics).map(([key, value]) => (
                      <p key={key} className="rounded-lg bg-stone-50 p-2">
                        <span className="block text-[10px] font-bold uppercase text-stone-400">{key}</span>
                        <strong className="mt-1 block text-red-950">{String(value)}</strong>
                      </p>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {selectedOperationNode.type === "bot" && (
                    <button
                      type="button"
                      onClick={() => setActiveMode("overview")}
                      className="rounded bg-red-900 px-3 py-2 text-xs font-bold text-white hover:bg-red-950"
                    >
                      Mở cấu hình bot
                    </button>
                  )}
                  {selectedOperationNode.id === "knowledge_search" && (
                    <button
                      type="button"
                      onClick={() => setActiveMode("knowledge")}
                      className="rounded bg-red-900 px-3 py-2 text-xs font-bold text-white hover:bg-red-950"
                    >
                      Mở kho tri thức
                    </button>
                  )}
                  {selectedOperationNode.id === "ai_logs" && (
                    <button
                      type="button"
                      onClick={() => setActiveMode("knowledge")}
                      className="rounded bg-red-900 px-3 py-2 text-xs font-bold text-white hover:bg-red-950"
                    >
                      Mở nhật ký AI
                    </button>
                  )}
                </div>
              </aside>
            </div>
          </section>
        </div>
      )}

      {activeMode === "system-audit" && (
        <div className="space-y-5">
          <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="flex items-center gap-2 font-serif text-xl font-bold text-red-950">
                  <AlertTriangle className="h-5 w-5 text-amber-700" />
                  Kiểm tra hệ thống
                </h3>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-stone-500">
                  Scanner local-first rà dữ liệu dashboard, cấu hình bot và kho tri thức để tạo đề xuất sửa. AI chỉ đề xuất, admin duyệt rồi mới áp dụng các sửa an toàn.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void runSystemAuditScan()}
                  disabled={isSystemAuditLoading}
                  className="inline-flex items-center gap-2 rounded bg-red-900 px-4 py-2 text-xs font-bold text-white hover:bg-red-950 disabled:opacity-60"
                >
                  <Search className="h-4 w-4" />
                  Quét hệ thống
                </button>
                <button
                  type="button"
                  onClick={() => void loadSystemAuditPanel()}
                  disabled={isSystemAuditLoading}
                  className="inline-flex items-center gap-2 rounded border border-stone-200 px-4 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${isSystemAuditLoading ? "animate-spin" : ""}`} />
                  Tải lại
                </button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
              {[
                ["Pending", systemAuditSuggestions.filter((item) => item.status === "pending").length],
                ["Approved", systemAuditSuggestions.filter((item) => item.status === "approved").length],
                ["Applied", systemAuditSuggestions.filter((item) => item.status === "applied").length],
                ["Critical/High", systemAuditSuggestions.filter((item) => ["critical", "high"].includes(item.priority)).length]
              ].map(([label, value]) => (
                <p key={label as string} className="rounded-lg bg-stone-50 p-3">
                  <span className="block text-[10px] font-bold uppercase tracking-wide text-stone-400">{label}</span>
                  <strong className="mt-1 block text-red-950">{value}</strong>
                </p>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[160px_180px_1fr_auto]">
              <select
                value={systemAuditStatusFilter}
                onChange={(event) => setSystemAuditStatusFilter(event.target.value)}
                className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs"
              >
                <option value="">Mọi trạng thái</option>
                <option value="pending">pending</option>
                <option value="approved">approved</option>
                <option value="rejected">rejected</option>
                <option value="applied">applied</option>
              </select>
              <select
                value={systemAuditTypeFilter}
                onChange={(event) => setSystemAuditTypeFilter(event.target.value)}
                className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs"
              >
                <option value="">Mọi loại lỗi</option>
                <option value="mojibake">mojibake</option>
                <option value="wrong_title">wrong_title</option>
                <option value="sample_data">sample_data</option>
                <option value="unsupported_claim">unsupported_claim</option>
                <option value="privacy_risk">privacy_risk</option>
              </select>
              <input
                value={systemAuditQuery}
                onChange={(event) => setSystemAuditQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void loadSystemAuditPanel();
                }}
                placeholder="Tìm theo nguồn, nội dung, bằng chứng..."
                className="rounded-lg border border-stone-200 px-3 py-2 text-xs"
              />
              <button
                type="button"
                onClick={() => void loadSystemAuditPanel()}
                className="rounded bg-stone-900 px-4 py-2 text-xs font-bold text-white hover:bg-black"
              >
                Lọc
              </button>
            </div>
            {systemAuditNote && <p className="mt-3 rounded bg-amber-50 p-3 text-xs text-amber-900">{systemAuditNote}</p>}
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="space-y-3 xl:col-span-2">
              {systemAuditSuggestions.map((item) => (
                <article key={item.id} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wide">
                        <span className="rounded bg-stone-100 px-2 py-1 text-stone-600">{item.issueType}</span>
                        <span className={`rounded px-2 py-1 ${
                          ["critical", "high"].includes(item.priority) ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"
                        }`}>{item.priority}</span>
                        <span className="rounded bg-blue-50 px-2 py-1 text-blue-800">{item.status}</span>
                      </div>
                      <h4 className="mt-2 font-bold text-red-950">{item.summary}</h4>
                      <p className="mt-1 text-xs text-stone-500">{item.sourceType} · {item.sourcePath}</p>
                      {item.location && <p className="mt-1 text-[11px] text-stone-400">{item.location}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.status === "pending" && (
                        <>
                          <button type="button" onClick={() => void patchSystemAuditSuggestion(item.id, { status: "approved" })} className="rounded bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800">Duyệt</button>
                          <button type="button" onClick={() => void patchSystemAuditSuggestion(item.id, { status: "rejected" })} className="rounded border border-stone-200 px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50">Từ chối</button>
                        </>
                      )}
                      {item.status === "approved" && (
                        <>
                          <button type="button" onClick={() => void applySystemAuditSuggestion(item.id)} className="rounded bg-red-900 px-3 py-2 text-xs font-bold text-white hover:bg-red-950">Áp dụng</button>
                          <button type="button" onClick={() => void patchSystemAuditSuggestion(item.id, { status: "pending" })} className="rounded border border-stone-200 px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50">Về pending</button>
                        </>
                      )}
                    </div>
                  </div>

                  <details className="mt-3 rounded-lg border border-stone-100 bg-[#fbfaf6] p-3 text-xs">
                    <summary className="cursor-pointer font-bold text-stone-700">Chi tiết đề xuất</summary>
                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-stone-400">Giá trị hiện tại</p>
                        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-white p-2 text-[11px] text-stone-700">{item.currentValue || "-"}</pre>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-stone-400">Giá trị đề xuất</p>
                        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-white p-2 text-[11px] text-stone-700">{item.suggestedValue || "-"}</pre>
                      </div>
                    </div>
                    {item.evidence && <p className="mt-3 rounded bg-white p-2 text-[11px] text-stone-600">Bằng chứng: {item.evidence}</p>}
                    <p className="mt-2 text-[11px] text-stone-500">Action: {item.action}</p>
                  </details>
                </article>
              ))}
              {!systemAuditSuggestions.length && (
                <div className="rounded-xl border border-dashed border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
                  Chưa có đề xuất theo bộ lọc hiện tại. Có thể bấm “Quét hệ thống” để tạo đề xuất mới.
                </div>
              )}
            </div>

            <aside className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
              <h4 className="flex items-center gap-2 font-serif text-lg font-bold text-red-950">
                <ClipboardList className="h-5 w-5 text-amber-700" />
                Log áp dụng gần đây
              </h4>
              <div className="mt-3 space-y-2 text-xs">
                {systemAuditLogs.map((log) => (
                  <div key={log.id} className="rounded-lg border border-stone-100 bg-[#fbfaf6] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-red-950">{log.action}</span>
                      <span className="text-[10px] text-stone-400">{log.createdAt || "-"}</span>
                    </div>
                    <p className="mt-1 text-stone-500">{log.sourcePath}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase text-emerald-700">{log.status}</p>
                  </div>
                ))}
                {!systemAuditLogs.length && <p className="rounded bg-stone-50 p-3 text-stone-500">Chưa có log áp dụng.</p>}
              </div>
            </aside>
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
            <div className="mb-4 rounded-lg border border-stone-200 bg-[#fbfaf6] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h4 className="flex items-center gap-2 font-bold text-stone-850">
                    <Database className="h-4 w-4 text-amber-700" />
                    Kho tri thức local backend
                  </h4>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold text-stone-600">
                    <span className="rounded bg-white px-2 py-1">Sources: {knowledgeStatus?.sources ?? "-"}</span>
                    <span className="rounded bg-white px-2 py-1">Chunks: {knowledgeStatus?.chunks ?? "-"}</span>
                    <span className="rounded bg-white px-2 py-1">Aliases: {knowledgeStatus?.aliases ?? "-"}</span>
                    <span className="rounded bg-white px-2 py-1">Indexed: {knowledgeStatus?.indexedSources ?? "-"}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void loadKnowledgeBackend()}
                  disabled={isKnowledgeLoading}
                  className="inline-flex items-center justify-center gap-2 rounded border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${isKnowledgeLoading ? "animate-spin" : ""}`} />
                  Đồng bộ
                </button>
              </div>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input
                  value={knowledgeSearchQuery}
                  onChange={(event) => setKnowledgeSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void handleKnowledgeSearch();
                  }}
                  className="min-w-0 flex-1 rounded border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500"
                  placeholder="Thử tìm: Cao Tổ, Thủy Tổ, Hán Nôm, Thuần..."
                />
                <button
                  type="button"
                  onClick={() => void handleKnowledgeSearch()}
                  disabled={isKnowledgeSearching}
                  className="inline-flex items-center justify-center gap-2 rounded bg-red-900 px-3 py-2 text-xs font-bold text-white hover:bg-red-950 disabled:opacity-60"
                >
                  {isKnowledgeSearching ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Tìm
                </button>
              </div>
              {knowledgeApiNote && <p className="mt-2 whitespace-pre-wrap rounded bg-white p-2 text-[11px] leading-relaxed text-stone-600">{truncateText(knowledgeApiNote, 420)}</p>}
              {knowledgeSearchResults.length > 0 && (
                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {knowledgeSearchResults.map((result) => (
                    <article key={result.chunkId} className="rounded border border-stone-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <h5 className="font-bold text-stone-850">{result.title}</h5>
                        <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">{Math.round(result.score)}</span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-stone-600">{result.snippet}</p>
                      <p className="mt-2 text-[10px] font-semibold text-stone-400">{result.reason || "matched"} · {result.visibility || "public"}</p>
                    </article>
                  ))}
                </div>
              )}

              <div className="mt-4 max-h-[220px] space-y-2 overflow-y-auto pr-1">
                {backendSources.slice(0, 12).map((source) => (
                  <article key={source.id} className="flex items-start justify-between gap-3 rounded border border-stone-200 bg-white p-3">
                    <div className="min-w-0">
                      <h5 className="truncate font-bold text-stone-850">{source.title}</h5>
                      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                        {source.sourceType || "source"} · {source.visibility || "admin"} · {source.status || "indexed"}
                      </p>
                      {source.summary && <p className="mt-1 text-xs text-stone-500">{truncateText(source.summary, 150)}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => void deleteBackendSource(source.id)}
                      className="shrink-0 rounded border border-stone-200 p-1.5 text-stone-500 hover:border-red-200 hover:text-red-800"
                      title="Xóa source backend"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </article>
                ))}
                {!backendSources.length && (
                  <p className="rounded border border-dashed border-stone-200 bg-white p-3 text-xs text-stone-500">
                    Chưa đọc được danh sách source backend hoặc kho tri thức chưa có tài liệu upload thêm.
                  </p>
                )}
              </div>
            </div>
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/40 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h4 className="flex items-center gap-2 font-bold text-stone-850">
                    <ClipboardList className="h-4 w-4 text-emerald-700" />
                    Dữ liệu đã áp dụng gần đây
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-stone-500">
                    Lịch sử các giá trị đã được ghi vào cây phả từ candidate đã duyệt, dùng để kiểm tra nguồn trước khi đưa vào webview, dashboard và AI.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadAppliedExtractions()}
                  disabled={isAppliedExtractionsLoading}
                  className="inline-flex items-center justify-center gap-2 rounded border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${isAppliedExtractionsLoading ? "animate-spin" : ""}`} />
                  Tải lịch sử
                </button>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_180px_auto]">
                <input
                  value={appliedExtractionFilter}
                  onChange={(event) => setAppliedExtractionFilter(event.target.value)}
                  className="rounded border border-stone-200 bg-white px-3 py-2 text-xs outline-none focus:border-emerald-500"
                  placeholder="Lọc theo tên, nguồn, giá trị"
                />
                <select
                  value={appliedExtractionFieldFilter}
                  onChange={(event) => setAppliedExtractionFieldFilter(event.target.value)}
                  className="rounded border border-stone-200 bg-white px-3 py-2 text-xs outline-none focus:border-emerald-500"
                >
                  <option value="">Tất cả field</option>
                  <option value="birthYear">Năm/ngày sinh</option>
                  <option value="solarBirthDate">Ngày sinh dương lịch</option>
                  <option value="deathYear">Năm/ngày mất</option>
                  <option value="solarDeathDate">Ngày mất dương lịch</option>
                  <option value="deathAnniversaryLunar">Ngày giỗ âm lịch</option>
                  <option value="birthPlace">Quê quán</option>
                  <option value="graveLocation">Mộ chí</option>
                </select>
                <button
                  type="button"
                  onClick={() => void loadAppliedExtractions()}
                  disabled={isAppliedExtractionsLoading}
                  className="inline-flex items-center justify-center gap-2 rounded bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
                >
                  <Search className="h-4 w-4" />
                  Lọc
                </button>
              </div>
              {appliedExtractionNote && <p className="mt-2 rounded bg-white p-2 text-[11px] leading-relaxed text-stone-700">{appliedExtractionNote}</p>}
              <div className="mt-3 max-h-72 overflow-y-auto rounded border border-emerald-100 bg-white">
                <table className="min-w-full text-left text-[11px]">
                  <thead className="sticky top-0 bg-emerald-50 text-stone-600">
                    <tr>
                      <th className="px-2 py-2">Nhân vật</th>
                      <th className="px-2 py-2">Field</th>
                      <th className="px-2 py-2">Giá trị cũ</th>
                      <th className="px-2 py-2">Giá trị mới</th>
                      <th className="px-2 py-2">Nguồn/chunk</th>
                      <th className="px-2 py-2">Admin/time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appliedExtractions.map((item) => (
                      <tr key={item.id} className="border-t border-stone-100 align-top">
                        <td className="px-2 py-2 font-bold text-stone-800">{item.memberName || item.memberId}</td>
                        <td className="px-2 py-2 text-emerald-700">{item.field}</td>
                        <td className="px-2 py-2 text-stone-500">{item.oldValue || "Trống"}</td>
                        <td className="px-2 py-2 text-stone-800">{item.newValue}</td>
                        <td className="px-2 py-2 text-stone-500">{truncateText(item.headingPath || item.sourceTitle || item.chunkId || item.sourceId || "-", 90)}</td>
                        <td className="px-2 py-2 text-stone-500">{item.appliedBy || "-"}<br />{item.appliedAt || "-"}</td>
                      </tr>
                    ))}
                    {!appliedExtractions.length && (
                      <tr>
                        <td colSpan={6} className="px-3 py-4 text-center text-xs text-stone-500">
                          Chưa có dữ liệu đã áp dụng phù hợp bộ lọc.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/40 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h4 className="flex items-center gap-2 font-bold text-stone-850">
                    <FileSearch className="h-4 w-4 text-amber-700" />
                    Dữ liệu trích xuất cần duyệt
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-stone-500">
                    Candidate từ file 04 chỉ được áp dụng vào cây phả khi admin duyệt. Hệ thống không tự ghi đè trường đã có dữ liệu.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadExtractedCandidates()}
                  disabled={isExtractedLoading}
                  className="inline-flex items-center justify-center gap-2 rounded border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${isExtractedLoading ? "animate-spin" : ""}`} />
                  Tải candidate
                </button>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-4">
                <input
                  value={extractedNameFilter}
                  onChange={(event) => setExtractedNameFilter(event.target.value)}
                  className="rounded border border-stone-200 bg-white px-3 py-2 text-xs outline-none focus:border-amber-500"
                  placeholder="Tên nhân vật"
                />
                <select
                  value={extractedStatusFilter}
                  onChange={(event) => setExtractedStatusFilter(event.target.value)}
                  className="rounded border border-stone-200 bg-white px-3 py-2 text-xs outline-none focus:border-amber-500"
                >
                  <option value="">Tất cả trạng thái</option>
                  <option value="pending">Chưa duyệt</option>
                  <option value="approved">Đã duyệt</option>
                  <option value="rejected">Đã từ chối</option>
                  <option value="applied">Đã áp dụng</option>
                </select>
                <select
                  value={extractedTypeFilter}
                  onChange={(event) => setExtractedTypeFilter(event.target.value)}
                  className="rounded border border-stone-200 bg-white px-3 py-2 text-xs outline-none focus:border-amber-500"
                >
                  <option value="">Tất cả loại dữ liệu</option>
                  <option value="birth">Ngày sinh</option>
                  <option value="death">Ngày mất</option>
                  <option value="lunar_anniversary">Ngày giỗ âm lịch</option>
                  <option value="hometown">Quê quán</option>
                  <option value="grave">Mộ chí</option>
                </select>
                <button
                  type="button"
                  onClick={() => void loadExtractedCandidates()}
                  disabled={isExtractedLoading}
                  className="inline-flex items-center justify-center gap-2 rounded bg-red-900 px-3 py-2 text-xs font-bold text-white hover:bg-red-950 disabled:opacity-60"
                >
                  <Search className="h-4 w-4" />
                  Lọc
                </button>
              </div>
              {extractedNote && <p className="mt-2 rounded bg-white p-2 text-[11px] leading-relaxed text-stone-700">{extractedNote}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded border border-stone-200 bg-white p-2">
                <span className="text-[11px] font-bold text-stone-600">Đã chọn: {selectedCandidateIds.length}</span>
                <button type="button" onClick={() => setSelectedCandidateIds(extractedCandidates.map((item) => item.id))} className="rounded border border-stone-200 px-2 py-1 text-[11px] font-bold text-stone-600">Chọn tất cả</button>
                <button type="button" onClick={() => setSelectedCandidateIds([])} className="rounded border border-stone-200 px-2 py-1 text-[11px] font-bold text-stone-600">Bỏ chọn</button>
                <button type="button" onClick={() => void handleBulkExtractedAction("approve")} className="rounded bg-emerald-700 px-2 py-1 text-[11px] font-bold text-white">Duyệt nhiều</button>
                <button type="button" onClick={() => void handleBulkExtractedAction("reject")} className="rounded border border-red-200 px-2 py-1 text-[11px] font-bold text-red-700">Từ chối nhiều</button>
                <button type="button" onClick={() => void handleBulkExtractedAction("reset")} className="rounded border border-stone-200 px-2 py-1 text-[11px] font-bold text-stone-600">Reset pending</button>
                <button type="button" onClick={() => void handleBulkExtractedAction("apply")} className="rounded bg-red-900 px-2 py-1 text-[11px] font-bold text-white">Apply nhiều</button>
              </div>
              <div className="mt-3 max-h-[520px] space-y-3 overflow-y-auto pr-1">
                {extractedCandidates.map((candidate) => (
                  <article key={candidate.id} className="rounded border border-stone-200 bg-white p-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedCandidateIds.includes(candidate.id)}
                            onChange={() => toggleCandidateSelection(candidate.id)}
                            className="h-4 w-4 rounded border-stone-300"
                          />
                          <h5 className="font-bold text-stone-850">{candidate.personName}</h5>
                          <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            candidate.status === "applied" ? "bg-emerald-50 text-emerald-700" :
                            candidate.status === "approved" ? "bg-blue-50 text-blue-700" :
                            candidate.status === "rejected" ? "bg-red-50 text-red-700" :
                            "bg-amber-50 text-amber-700"
                          }`}>
                            {candidate.status}
                          </span>
                          <span className="rounded bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-500">{candidate.matchConfidence || "none"}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-stone-500">
                          {candidate.headingPath || "-"} · {candidate.sourceId} · {candidate.chunkId || "-"}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-stone-600">{truncateText(candidate.sourceQuote || "", 260)}</p>
                        <button
                          type="button"
                          onClick={() => void openSourceChunk(candidate)}
                          className="mt-2 rounded border border-stone-200 px-2 py-1 text-[11px] font-bold text-stone-600 hover:bg-stone-50"
                        >
                          Mở đoạn nguồn
                        </button>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void handleApproveCandidate(candidate)}
                          disabled={candidate.status === "applied"}
                          className="rounded bg-emerald-700 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                        >
                          Duyệt
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleRejectCandidate(candidate)}
                          disabled={candidate.status === "applied"}
                          className="rounded border border-red-200 px-2.5 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          Từ chối
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleApplyCandidate(candidate)}
                          disabled={candidate.status !== "approved" && candidate.status !== "applied"}
                          className="rounded bg-red-900 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-red-950 disabled:opacity-50"
                        >
                          Áp dụng
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                      {candidate.fields.map((field) => (
                        <div key={`${candidate.id}-${field.type}`} className="rounded border border-stone-100 bg-[#fbfaf6] p-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">{field.type}</p>
                              <p className="mt-1 text-xs leading-relaxed text-stone-700">{field.reviewedValue || field.value}</p>
                              {field.reviewedValue && <p className="mt-1 text-[10px] text-stone-400">Gốc: {truncateText(field.value, 120)}</p>}
                            </div>
                            <button
                              type="button"
                              onClick={() => startEditCandidateField(candidate, field)}
                              className="shrink-0 rounded border border-stone-200 p-1 text-stone-500 hover:bg-white"
                              title="Sửa giá trị trước khi duyệt"
                            >
                              <PenLine className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 overflow-x-auto rounded border border-stone-100">
                      <table className="min-w-full text-left text-[11px]">
                        <thead className="bg-stone-50 text-stone-500">
                          <tr>
                            <th className="px-2 py-1">Loại</th>
                            <th className="px-2 py-1">Hiện tại trong hồ sơ</th>
                            <th className="px-2 py-1">Giá trị từ tài liệu</th>
                            <th className="px-2 py-1">Nguồn/chunk</th>
                          </tr>
                        </thead>
                        <tbody>
                          {candidate.fields.map((field) => (
                            <tr key={`${candidate.id}-${field.type}-compare`} className="border-t border-stone-100">
                              <td className="px-2 py-1 font-bold text-amber-700">{field.type}</td>
                              <td className="px-2 py-1 text-stone-600">{getCandidateCurrentValue(candidate, field.type) || "Trống"}</td>
                              <td className="px-2 py-1 text-stone-800">{field.reviewedValue || field.value}</td>
                              <td className="px-2 py-1 text-stone-500">{truncateText(candidate.headingPath || candidate.chunkId || "-", 90)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-[1fr_auto]">
                      <div className="min-w-0">
                        <input
                          value={editingCandidateId === candidate.id ? memberSearchQuery : ""}
                          onFocus={() => {
                            setEditingCandidateId(candidate.id);
                            void searchMembersForCandidate(candidate.personName);
                          }}
                          onChange={(event) => {
                            setEditingCandidateId(candidate.id);
                            void searchMembersForCandidate(event.target.value);
                          }}
                          className="w-full rounded border border-stone-200 bg-white px-3 py-2 text-xs outline-none focus:border-amber-500"
                          placeholder="Tìm nhân vật theo tên có dấu/không dấu"
                        />
                        {editingCandidateId === candidate.id && (memberSearchResults.length > 0 || (candidate.candidateMatches || []).length > 0) && (
                          <div className="mt-1 max-h-44 overflow-y-auto rounded border border-stone-200 bg-white shadow-sm">
                            {[...memberSearchResults, ...(memberSearchResults.length ? [] : candidate.candidateMatches || [])].map((match) => (
                              <button
                                key={match.memberId}
                                type="button"
                                onClick={() => {
                                  setEditingMemberId(match.memberId);
                                  handleAssignCandidate(candidate, match.memberId);
                                }}
                                className="block w-full border-b border-stone-100 px-3 py-2 text-left text-xs last:border-b-0 hover:bg-amber-50"
                              >
                                <span className="font-bold text-stone-800">{match.fullName}</span>
                                <span className="ml-2 rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold text-stone-500">{match.confidence}</span>
                                <span className="block text-[10px] text-stone-500">
                                  Đời {match.generation ?? "-"} · Cha: {match.fatherName || "-"} · Mẹ: {match.motherName || "-"} · Chi: {match.branchName || "-"}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {(() => {
                        const matchedInfo = getCandidateMatchedInfo(candidate);
                        return (
                          <p className="rounded bg-stone-50 px-3 py-2 text-[11px] text-stone-500">
                            Match: {candidate.matchedMemberName || "chưa có"}
                            {" · "}Đời: {matchedInfo?.generation ?? "-"}
                            {" · "}Cha: {matchedInfo?.fatherName || "-"}
                            {" · "}Mẹ: {matchedInfo?.motherName || "-"}
                            {" · "}Chi/ngành: {matchedInfo?.branchName || "-"}
                          </p>
                        );
                      })()}
                    </div>
                    {editingCandidateId === candidate.id && editingFieldType && (
                      <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3">
                        <label className="text-[11px] font-bold text-stone-700">Sửa giá trị `{editingFieldType}` trước khi duyệt</label>
                        <textarea
                          value={editingValue}
                          onChange={(event) => setEditingValue(event.target.value)}
                          rows={3}
                          className="mt-2 w-full rounded border border-stone-200 bg-white px-3 py-2 text-xs outline-none focus:border-amber-500"
                        />
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button type="button" onClick={() => void saveCandidateField()} className="rounded bg-red-900 px-3 py-1.5 text-[11px] font-bold text-white">Lưu chỉnh sửa</button>
                          <button type="button" onClick={() => { setEditingCandidateId(""); setEditingFieldType(""); setEditingValue(""); }} className="rounded border border-stone-200 px-3 py-1.5 text-[11px] font-bold text-stone-600">Hủy</button>
                        </div>
                      </div>
                    )}
                  </article>
                ))}
                {!extractedCandidates.length && (
                  <p className="rounded border border-dashed border-stone-200 bg-white p-3 text-xs text-stone-500">
                    Chưa có candidate phù hợp bộ lọc, hoặc tài khoản hiện tại chưa có quyền admin.
                  </p>
                )}
              </div>
              {isSourceChunkOpen && sourceChunkDetail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                  <div className="max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-lg bg-white shadow-xl">
                    <div className="flex items-start justify-between gap-3 border-b border-stone-200 p-4">
                      <div>
                        <h4 className="font-bold text-stone-900">{sourceChunkDetail.title}</h4>
                        <p className="mt-1 text-xs text-stone-500">{sourceChunkDetail.headingPath || sourceChunkDetail.chunkId} · {sourceChunkDetail.visibility || "-"}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsSourceChunkOpen(false)}
                        className="rounded border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-600 hover:bg-stone-50"
                      >
                        Đóng
                      </button>
                    </div>
                    <div className="max-h-[65vh] overflow-y-auto p-4">
                      <pre className="whitespace-pre-wrap text-sm leading-relaxed text-stone-700">{sourceChunkDetail.content}</pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="mb-4 rounded-lg border border-stone-200 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h4 className="flex items-center gap-2 font-bold text-stone-850">
                    <ClipboardList className="h-4 w-4 text-amber-700" />
                    Nhật ký AI
                  </h4>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold text-stone-600">
                    <span className="rounded bg-[#fbfaf6] px-2 py-1">Requests: {aiLogSummary?.requestCount ?? "-"}</span>
                    <span className="rounded bg-[#fbfaf6] px-2 py-1">Cache: {aiLogSummary?.cacheHitCount ?? "-"}</span>
                    <span className="rounded bg-[#fbfaf6] px-2 py-1">Errors: {aiLogSummary?.errorCount ?? "-"}</span>
                    <span className="rounded bg-[#fbfaf6] px-2 py-1">Avg: {aiLogSummary?.avgDurationMs ?? "-"}ms</span>
                    <span className="rounded bg-[#fbfaf6] px-2 py-1">Est tokens: {aiLogSummary?.estimatedTokens ?? "-"}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void loadAIRequestLogs()}
                  disabled={isAiLogsLoading}
                  className="inline-flex items-center justify-center gap-2 rounded border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${isAiLogsLoading ? "animate-spin" : ""}`} />
                  Tải log
                </button>
              </div>
              {aiLogNote && <p className="mt-2 rounded bg-amber-50 p-2 text-[11px] text-amber-800">{aiLogNote}</p>}
              <div className="mt-3 max-h-[240px] overflow-y-auto rounded border border-stone-100">
                {aiLogs.slice(0, 12).map((log) => (
                  <div key={log.id} className="grid grid-cols-2 gap-2 border-b border-stone-100 p-2 text-[11px] last:border-b-0 md:grid-cols-6">
                    <span className="font-semibold text-stone-700">{new Date(log.createdAt).toLocaleString("vi-VN")}</span>
                    <span>{log.botType || "-"} / {log.intent || "-"}</span>
                    <span>{log.engine || log.provider || "-"}</span>
                    <span className={log.status >= 400 ? "font-bold text-red-700" : "font-bold text-emerald-700"}>{log.status}</span>
                    <span>{log.cached ? "cache" : `${log.durationMs}ms`}</span>
                    <span>{log.knowledgeMatchesCount} chunks · {log.estimatedTokens} tok{log.contextTrimmed ? " · trimmed" : ""}</span>
                  </div>
                ))}
                {!aiLogs.length && (
                  <p className="p-3 text-xs text-stone-500">Chưa có log AI hoặc tài khoản hiện tại chưa được phép xem.</p>
                )}
              </div>
            </div>
            <div className="mb-4 rounded-lg border border-stone-200 bg-[#fbfaf6] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h4 className="flex items-center gap-2 font-bold text-stone-850">
                    <CheckCircle2 className="h-4 w-4 text-amber-700" />
                    Kiểm thử AI
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-stone-500">
                    Chạy bộ câu hỏi cố định để kiểm tra alias, Hán Nôm, dữ liệu chưa xác minh và chính sách KYC.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void runAIEval()}
                  disabled={isAiEvalRunning}
                  className="inline-flex items-center justify-center gap-2 rounded bg-red-900 px-3 py-2 text-xs font-bold text-white hover:bg-red-950 disabled:opacity-60"
                >
                  {isAiEvalRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Chạy kiểm thử
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-stone-600">
                <span className="rounded bg-white px-2 py-1">Cases: {aiEvalCases.length || "-"}</span>
                <span className="rounded bg-white px-2 py-1">Pass: {aiEvalResults.filter((item) => item.passed).length || "-"}</span>
                <span className="rounded bg-white px-2 py-1">Fail: {aiEvalResults.filter((item) => !item.passed).length || "-"}</span>
              </div>
              {aiEvalNote && <p className="mt-2 rounded bg-white p-2 text-[11px] text-stone-700">{aiEvalNote}</p>}
              <div className="mt-3 max-h-[300px] space-y-2 overflow-y-auto pr-1">
                {(aiEvalResults.length ? aiEvalResults : aiEvalCases.map((item) => ({
                  id: item.id,
                  question: item.question,
                  passed: false,
                  missing: [],
                  forbidden: [],
                  answer: "",
                  durationMs: 0,
                  knowledgeMatchesCount: 0,
                  knowledgeSourceIds: []
                }))).map((result) => (
                  <article key={result.id} className="rounded border border-stone-200 bg-white p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h5 className="font-bold text-stone-850">{result.question}</h5>
                        <p className="mt-0.5 text-[10px] font-semibold text-stone-400">
                          {result.knowledgeMatchesCount} chunks · {result.durationMs}ms
                        </p>
                      </div>
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${result.answer ? (result.passed ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700") : "bg-stone-100 text-stone-500"}`}>
                        {result.answer ? (result.passed ? "PASS" : "FAIL") : "READY"}
                      </span>
                    </div>
                    {result.answer && <p className="mt-2 text-xs leading-relaxed text-stone-600">{truncateText(result.answer, 260)}</p>}
                    {(result.missing.length > 0 || result.forbidden.length > 0) && (
                      <p className="mt-2 text-[11px] text-red-700">
                        Thiếu: {result.missing.join(", ") || "-"} · Cấm: {result.forbidden.join(", ") || "-"}
                      </p>
                    )}
                  </article>
                ))}
              </div>
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
          <section className="xl:col-span-12 rounded-xl border border-emerald-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="flex items-center gap-2 font-serif text-lg font-bold text-red-950">
                  <MessageSquare className="h-5 w-5 text-emerald-700" />
                  Zalo Bot an toan
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-stone-500">
                  Chỉ phản hồi khi có tương tác hợp lệ. Không broadcast, không gửi lịch tự động, không gọi Zalo real khi send mode đang khóa.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadZaloBotPanel()}
                disabled={isZaloBotLoading}
                className="inline-flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-100 disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${isZaloBotLoading ? "animate-spin" : ""}`} />
                Tải lại Zalo Bot
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
              {[
                ["Webhook", zaloBotStatus?.webhookConfigured ? "configured" : "mock/dev"],
                ["Send", `${zaloBotStatus?.sendMode || "mock"}`],
                ["Real reply", String(Boolean(zaloBotStatus?.canReplyReal))],
                ["Events", formatNumber(zaloBotStatus?.totalEvents || 0)],
                ["Replies", formatNumber(zaloBotStatus?.totalReplies || 0)],
                ["Ignored", formatNumber(zaloBotStatus?.ignoredCount || 0)],
                ["Errors", formatNumber(zaloBotStatus?.errorCount || 0)],
                ["Last", zaloBotStatus?.lastEventAt ? new Date(zaloBotStatus.lastEventAt).toLocaleString("vi-VN") : "-"]
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase text-stone-500">{label}</p>
                  <p className="mt-1 break-words text-xs font-bold text-stone-850">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-bold text-blue-950">Webhook thật</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-blue-900">
                    Phase 2Q chỉ nhận event, xác thực và ghi log. Chưa reply Zalo thật, chưa broadcast, chưa gửi nhóm thật.
                  </p>
                </div>
                <span className={`rounded px-2 py-1 text-[11px] font-bold ${
                  zaloWebhookStatus?.webhookSafe ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
                }`}>
                  {zaloWebhookStatus?.webhookSafe ? "an toàn" : "chưa an toàn"}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
                {[
                  ["Enabled", String(Boolean(zaloWebhookStatus?.webhookEnabled))],
                  ["Configured", String(Boolean(zaloWebhookStatus?.webhookConfigured))],
                  ["Verified", formatNumber(zaloWebhookStatus?.signatureVerifiedCount || 0)],
                  ["Rejected", formatNumber(zaloWebhookStatus?.rejectedCount || 0)],
                  ["Duplicate", formatNumber(zaloWebhookStatus?.duplicateCount || 0)],
                  ["Last real", zaloWebhookStatus?.lastRealEventAt ? new Date(zaloWebhookStatus.lastRealEventAt).toLocaleString("vi-VN") : "-"],
                  ["Last reject", zaloWebhookStatus?.lastRejectedReason || "-"],
                  ["Real reply", String(Boolean(zaloWebhookStatus?.canReplyReal))]
                ].map(([label, value]) => (
                  <div key={label} className="rounded border border-blue-100 bg-white px-2 py-1.5">
                    <p className="text-[10px] font-bold uppercase text-blue-500">{label}</p>
                    <p className="mt-1 break-words text-[11px] font-bold text-blue-950">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
              <div className="xl:col-span-4 rounded-lg border border-stone-200 bg-[#fbfaf6] p-3">
                <p className="text-xs font-bold text-stone-850">Test mock message</p>
                <div className="mt-2 grid grid-cols-1 gap-2 text-xs">
                  <select
                    value={zaloMockChannel}
                    onChange={(event) => setZaloMockChannel(event.target.value as "personal" | "group")}
                    className="rounded border border-stone-200 bg-white px-2 py-1.5"
                  >
                    <option value="personal">personal</option>
                    <option value="group">group</option>
                  </select>
                  <input
                    value={zaloMockSenderId}
                    onChange={(event) => setZaloMockSenderId(event.target.value)}
                    className="rounded border border-stone-200 bg-white px-2 py-1.5"
                    placeholder="senderId"
                  />
                  {zaloMockChannel === "group" && (
                    <input
                      value={zaloMockGroupId}
                      onChange={(event) => setZaloMockGroupId(event.target.value)}
                      className="rounded border border-stone-200 bg-white px-2 py-1.5"
                      placeholder="groupId"
                    />
                  )}
                  <textarea
                    value={zaloMockMessage}
                    onChange={(event) => setZaloMockMessage(event.target.value)}
                    rows={4}
                    className="rounded border border-stone-200 bg-white px-2 py-1.5"
                    placeholder="/giapha Cao To la ai"
                  />
                  <button
                    type="button"
                    onClick={() => void sendZaloMockMessage()}
                    disabled={isZaloBotLoading || !zaloMockMessage.trim()}
                    className="inline-flex items-center justify-center gap-2 rounded bg-red-900 px-3 py-2 text-xs font-bold text-white hover:bg-red-950 disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" />
                    Gui mock
                  </button>
                </div>
                {zaloBotNote && <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">{zaloBotNote}</p>}
              </div>

              <div className="xl:col-span-4 rounded-lg border border-stone-200 bg-white p-3">
                <p className="text-xs font-bold text-stone-850">Event gan day</p>
                <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                  {zaloBotEvents.map((event) => (
                    <div key={event.id} className="rounded border border-stone-100 bg-stone-50 px-2 py-1.5 text-[11px] text-stone-700">
                      <p><strong>{event.status}</strong> · {event.channel} · {event.intent}</p>
                      <p className="text-stone-500">{event.eventType} / {event.signatureStatus || "no-signature"} / {event.reviewedAt ? "đã xem" : "chưa xem"}</p>
                      <p className="truncate">{event.senderName || event.senderId}: {event.messageText || event.eventType}</p>
                      {event.error ? <p className="text-amber-700">{event.error}</p> : null}
                      <div className="mt-1 flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => void markZaloEventReviewed(event.id)}
                          disabled={isZaloBotLoading || Boolean(event.reviewedAt)}
                          className="rounded border border-stone-200 bg-white px-2 py-0.5 font-bold text-stone-600 hover:bg-stone-100 disabled:opacity-50"
                        >
                          Da xem
                        </button>
                        <button
                          type="button"
                          onClick={() => void replayZaloEvent(event.id)}
                          disabled={isZaloBotLoading || event.eventType !== "message" || !event.messageText}
                          className="rounded border border-blue-200 bg-white px-2 py-0.5 font-bold text-blue-800 hover:bg-blue-50 disabled:opacity-50"
                        >
                          Replay mock
                        </button>
                      </div>
                    </div>
                  ))}
                  {!zaloBotEvents.length && <p className="text-xs text-stone-500">Chưa có event.</p>}
                </div>
              </div>

              <div className="xl:col-span-4 rounded-lg border border-stone-200 bg-white p-3">
                <p className="text-xs font-bold text-stone-850">Reply gan day</p>
                <div className="mt-2 max-h-64 space-y-2 overflow-y-auto">
                  {zaloBotReplies.map((reply) => (
                    <div key={reply.id} className="rounded border border-stone-100 bg-stone-50 px-2 py-1.5 text-[11px] text-stone-700">
                      <p><strong>{reply.status}</strong> · {reply.transport} · {reply.intent}</p>
                      <p className="line-clamp-3">{reply.replyText || reply.error || "No reply text"}</p>
                    </div>
                  ))}
                  {!zaloBotReplies.length && <p className="text-xs text-stone-500">Chưa có reply.</p>}
                </div>
              </div>
            </div>
          </section>

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
