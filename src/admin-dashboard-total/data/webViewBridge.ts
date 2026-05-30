import { ANNIVERSARY_EVENTS, CLAN_CONTRIBUTIONS, LINEAGE_NEWS_DATA } from "../../data/lineageData";
import type { AnniversaryEvent, ClanContribution, LineageNews } from "../../types";
import type { ClanEvent, TreasuryTx, WebArticle, KnowledgeBaseDocument } from "../types";

function parseVietnameseDate(value: string) {
  const [day, month, year] = String(value || "").split("/").map((part) => Number(part));
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
}

function isPastDate(value: string) {
  const date = parseVietnameseDate(value);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today;
}

function parseVndAmount(value: string) {
  const raw = String(value || "").replace(/[^\d]/g, "");
  return raw ? Number(raw) : 0;
}

function slugify(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function mapEventStatus(event: AnniversaryEvent): ClanEvent["status"] {
  if (isPastDate(event.solarDate)) return "Đã hoàn thành" as ClanEvent["status"];
  return "Sắp diễn ra" as ClanEvent["status"];
}

function mapContributionCategory(purpose: string): TreasuryTx["category"] {
  const normalized = String(purpose || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (normalized.includes("khuyen hoc")) return "Khuyến học" as TreasuryTx["category"];
  if (normalized.includes("trung tu") || normalized.includes("bia") || normalized.includes("duc")) {
    return "Sự nghiệp Trùng tu" as TreasuryTx["category"];
  }
  if (normalized.includes("gio") || normalized.includes("te le")) return "Chi Tế lễ" as TreasuryTx["category"];
  return "Đóng góp thường niên" as TreasuryTx["category"];
}

function mapNewsCategory(category: LineageNews["category"]): WebArticle["category"] {
  if (category === "su_kien" || category === "hoat_dong") return "Tin tức họ tộc" as WebArticle["category"];
  if (category === "dong_gop") return "Thông tri khẩn" as WebArticle["category"];
  return "Lịch sử tích cổ" as WebArticle["category"];
}

export function getWebViewClanEvents(): ClanEvent[] {
  return ANNIVERSARY_EVENTS.map((event) => ({
    id: `ann_${event.id}`,
    title: event.title,
    lunarDate: event.lunarDate,
    solarDate: event.solarDate,
    location: event.location,
    organizer: event.host,
    description: [event.description, ...event.ritualGuide].filter(Boolean).join("\n"),
    estimatedCost: 0,
    status: mapEventStatus(event),
    category: "Cúng Giỗ" as ClanEvent["category"],
  }));
}

export function getWebViewTreasuryTransactions(): TreasuryTx[] {
  return CLAN_CONTRIBUTIONS.map((item: ClanContribution) => ({
    id: `contribution_${item.id}`,
    type: "Thu",
    amount: parseVndAmount(item.amount),
    date: item.date,
    donorOrReceiver: item.name,
    branch: item.branch,
    purpose: item.purpose,
    category: mapContributionCategory(item.purpose),
  }));
}

export function getWebViewArticles(): WebArticle[] {
  return LINEAGE_NEWS_DATA.map((item) => ({
    id: `news_${item.id}`,
    title: item.title,
    slug: slugify(item.title || item.id),
    category: mapNewsCategory(item.category),
    author: item.author,
    summary: item.summary,
    content: item.content,
    publishDate: item.date,
    status: "Đăng tải" as WebArticle["status"],
    views: 0,
    coverImage: item.imageUrl,
  }));
}

export function getWebViewKnowledgeDocs(): KnowledgeBaseDocument[] {
  return LINEAGE_NEWS_DATA.map((item) => ({
    id: `knowledge_${item.id}`,
    title: item.title,
    category: "Gia phả học" as KnowledgeBaseDocument["category"],
    content: [item.summary, item.content].filter(Boolean).join("\n\n"),
    contributor: item.author,
    lastUpdated: item.date,
  }));
}
