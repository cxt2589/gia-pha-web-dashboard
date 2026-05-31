export interface FamilyMember {
  id: string;
  name: string;
  generation: number;
  title?: string;
  rankRole?: string;
  customSuffix?: string;
  branch: string;
  gender: "Ngh\u1ecb" | "N\u1eef";
  isDeceased: boolean;
  birthYear?: string;
  deathYear?: string;
  birthPlace?: string;
  deathPlace?: string;
  solarBirthDate?: string;
  solarDeathDate?: string;
  deathAnniversaryLunar?: string;
  birthDateStructured?: GenealogyDateStructured;
  deathDateStructured?: GenealogyDateStructured;
  deathAnniversaryLunarStructured?: GenealogyDateStructured;
  graveLocation?: string;
  motherName?: string;
  residence?: string;
  phone1?: string;
  phone2?: string;
  phone3?: string;
  email?: string;
  spouse?: string;
  children: string[];
  parentId?: string;
  photo?: string;
  bio?: string;
  achievements?: string[];
}

export interface GenealogyDateStructured {
  calendar: "solar" | "lunar" | "unknown";
  precision: "full_date" | "day_month" | "month_year" | "year" | "approximate" | "unknown";
  day: number | null;
  month: number | null;
  year: number | null;
  rawText: string;
  certainty: "verified" | "candidate" | "uncertain";
  sourceId?: string;
  chunkId?: string;
  isLeapMonth?: boolean;
}

export interface ClanEvent {
  id: string;
  title: string;
  lunarDate: string; // Ngày Âm Lịch (e.g., "Mùng 10 tháng Giêng")
  solarDate: string; // Ngày Dương Lịch tương ứng
  location: string;
  organizer: string;
  description: string;
  estimatedCost: number;
  status: "Sắp diễn ra" | "Đang chuẩn bị" | "Đã hoàn thành";
  category: "Cúng Giỗ" | "Họp Họ" | "Khánh Thành" | "Khuyến Học" | "Khác";
}

export interface TreasuryTx {
  id: string;
  type: "Thu" | "Chi";
  amount: number;
  date: string;
  donorOrReceiver: string; // Tên dòng họ hiếu thảo / Nhà tài trợ / Người nhận chi
  branch: string; // Chi họ của người đó
  purpose: string; // Lý do thu/chi
  category: "Đóng góp thường niên" | "Sự nghiệp Trùng tu" | "Khuyến học" | "Chi Tế lễ" | "Hỗ trợ hoàn cảnh khó khăn" | "Khác";
}

export interface OutstandingMember {
  id: string;
  name: string;
  achievement: string; // Ví dụ: Thủ khoa Đại Học Quốc Gia, Giáo Sư, Doanh Nhân Thành Đạt
  year: number;
  branch: string;
  prizeAwarded?: string;
}

export interface AIChatMessage {
  role: "user" | "model";
  content: string;
  timestamp: string;
}

export interface UserSession {
  id: string;
  username: string; // Username, Email, or Zalo ID
  loginType: "username" | "zalo" | "email";
  fullName?: string;
  phone?: string;
  email?: string;
  role: "admin" | "user" | "writer" | "treasurer" | "secretary";
  isKYCed: boolean;
  isApproved?: boolean;
  approvalStatus?: "pending" | "approved" | "rejected";
  kycStatus?: "not_submitted" | "pending" | "verified";
  avatar?: string;
  linkedMemberId?: string; // Matches a FamilyMember id in the database
  regDate: string;
  roles?: string[]; // Multiple roles as requested
}

export interface KnowledgeBaseDocument {
  id: string;
  title: string;
  category: "Gia phả học" | "Lịch sử chi phái" | "Sắc phong cổ dã" | "Nghi nghi thức tế tự" | "Địa linh phong thủy";
  content: string;
  contributor: string;
  lastUpdated: string;
}

export interface ZaloBroadcastCampaign {
  id: string;
  title: string;
  targetBranch: string; // "Tất cả" or a specific branch like "Chi Trưởng (Trường Yên)"
  messageContent: string;
  frequency: "Một lần" | "Hàng tuần" | "Hàng tháng vào ngày Rằm" | "Trước tết Nguyên Đán" | "Trước ngày Giỗ Tổ (15/3)";
  scheduledTime: string; // text or ISO date
  status: "Chờ phê duyệt" | "Đang lập lịch" | "Đã phát sóng" | "Hủy bỏ";
  recipientsCount: number;
}

export interface ZaloUser {
  id: string;
  name: string;
  phone: string;
  branch: string;
  regDate: string;
  status: "Đang hoạt động" | "Chờ duyệt" | "Đã chặn";
  notes?: string;
  linkedMemberId?: string;
  relationship?: string;
  group?: string; // Group, e.g., "Thanh niên họ", "Ngành trưởng", "Ngành cụ", "Ban trị sự"...
}

export interface ZaloAutoReply {
  id: string;
  keyword: string;
  replyType: "text" | "card" | "rich_media";
  replyContent: string;
  usageCount: number;
  isActive: boolean;
}

export interface ZaloBroadcast {
  id: string;
  title: string;
  sentDate: string;
  recipientsCount: number;
  content: string;
  category: "Thông báo cúng giỗ" | "Lời kêu gọi trùng tu" | "Vinh danh khuyến học" | "Khẩn báo họ tộc";
}

export interface WebArticle {
  id: string;
  title: string;
  slug: string;
  category: "Tin tức họ tộc" | "Lịch sử tích cổ" | "Gương sáng học tập" | "Thông tri khẩn";
  author: string;
  summary: string;
  content: string;
  publishDate: string;
  status: "Đăng tải" | "Bản nháp";
  views: number;
  coverImage?: string;
}

export interface WebThemeConfig {
  siteName: string;
  slogan: string;
  primaryColor: "royal-red" | "ebony-slate" | "amber-warm" | "temple-moss";
  fontFamily: "Inter" | "Space Grotesk" | "Playfair Display";
  showBanner: boolean;
  bannerImage: string;
  logoText: string;
}

export interface AIModelConfig {
  modelName: string;
  temperature: number;
  systemPrompt: string;
  engineCeremony?: "gemini" | "chatgpt" | "local";
  engineArticles?: "gemini" | "chatgpt" | "local";
  engineChat?: "gemini" | "chatgpt" | "local";
  engineZalo?: "gemini" | "chatgpt" | "local";
}
