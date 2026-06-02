import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import Overview from "./components/Overview";
import Genealogy from "./components/Genealogy";
import Events from "./components/Events";
import Treasury from "./components/Treasury";
import AIHelper from "./components/AIHelper";
import AIGovernor from "./components/AIGovernor";
import ZaloManager from "./components/ZaloManager";
import ArticlesManager from "./components/ArticlesManager";
import SettingsManager from "./components/SettingsManager";
import MemberAccountsManager from "./components/MemberAccountsManager";
import { addDashboardMemberToSharedTree, getOutstandingMembersFromFamilyMembers, getWebViewFamilyMembers, hydrateWebViewFamilyMembers, updateDashboardMemberInSharedTree } from "./data/lineageBridge";
import { getWebViewArticles, getWebViewClanEvents, getWebViewKnowledgeDocs, getWebViewTreasuryTransactions } from "./data/webViewBridge";
import { FamilyMember, ClanEvent, TreasuryTx, OutstandingMember, WebThemeConfig, AIModelConfig, UserSession, KnowledgeBaseDocument, WebArticle, ZaloAutoReply } from "./types";
import { KeyRound, MapPin, HelpCircle, Activity, Sun, Moon, CalendarDays } from "lucide-react";

const DASHBOARD_THEME_KEY = "caogia_dashboard_theme_config_v1";
const DASHBOARD_AI_KEY = "caogia_dashboard_ai_config_v1";
const DASHBOARD_USERS_KEY = "caogia_dashboard_users_v1";
const DASHBOARD_ARTICLES_KEY = "caogia_dashboard_articles_v1";
const DASHBOARD_KNOWLEDGE_KEY = "caogia_dashboard_knowledge_docs_v1";
const DASHBOARD_EVENTS_KEY = "caogia_dashboard_events_v1";
const DASHBOARD_ZALO_RULES_KEY = "caogia_dashboard_zalo_rules_v1";
const WEBVIEW_AUTH_STORAGE_KEY = "caogia_webview_auth_session_v1";
const DASHBOARD_ACTIVE_TAB_KEY = "caogia_dashboard_active_tab_v1";

const dashboardColorMap: Record<WebThemeConfig["primaryColor"], { primary: string; hover: string; soft: string }> = {
  "royal-red": { primary: "#991b1b", hover: "#7f1d1d", soft: "#fef2f2" },
  "ebony-slate": { primary: "#1f2937", hover: "#111827", soft: "#f8fafc" },
  "amber-warm": { primary: "#b45309", hover: "#92400e", soft: "#fffbeb" },
  "temple-moss": { primary: "#166534", hover: "#14532d", soft: "#f0fdf4" },
};

type AdminAuthSession = {
  provider?: "zalo" | "gmail";
  id?: string;
  account?: string;
  name?: string;
  role?: UserSession["role"];
  roles?: UserSession["roles"];
  isKYCed?: boolean;
  kycStatus?: UserSession["kycStatus"];
  isApproved?: boolean;
  approvalStatus?: UserSession["approvalStatus"];
};

function AdminLoginPage({ session }: { session: AdminAuthSession | null }) {
  const isLoggedIn = !!session;
  const isDenied = isLoggedIn && !(session.role === "admin" || session.roles?.includes("admin"));

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#fbf9f5] text-[#1b1c1a] [background-image:radial-gradient(#e4e2de_0.5px,transparent_0.5px)] [background-size:24px_24px]">
      <style>{`
        @keyframes admin-login-drum-spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        .admin-login-drum {
          animation: admin-login-drum-spin 95s linear infinite;
          transform-origin: center center;
          will-change: transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .admin-login-drum {
            animation-duration: 240s;
          }
        }
      `}</style>
      <header className="sticky top-0 z-20 border-b border-[#e0bfbf] bg-[#fbf9f5]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:flex-nowrap sm:px-6 md:px-16">
          <a href="/" className="min-w-0 font-serif text-xl font-bold leading-tight text-[#570013] sm:text-2xl">Gia Tộc Họ Cao</a>
          <a href="/" className="shrink-0 rounded border border-[#775a19]/40 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-[#570013] hover:bg-[#fed488]/30 sm:px-4 sm:text-xs">
            Về web gia phả
          </a>
        </div>
      </header>

      <main className="relative box-border flex min-h-[calc(100vh-132px)] w-full items-center justify-center overflow-hidden px-3 py-10 sm:px-4 sm:py-12">
        <img
          src="/images/dong-son-drum.png"
          alt=""
          aria-hidden="true"
          className="admin-login-drum pointer-events-none absolute left-1/2 top-1/2 h-[460px] w-[460px] max-w-none object-contain opacity-[0.13] mix-blend-multiply sm:h-[620px] sm:w-[620px] md:h-[820px] md:w-[820px]"
        />

        <section className="relative z-10 box-border w-full max-w-[calc(100vw-1.5rem)] rounded border border-[#e0bfbf] bg-[#fbf9f5]/95 p-6 shadow-sm sm:max-w-md sm:p-8 md:p-12">
          <div className="mb-7 text-center sm:mb-9">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#775a19]/35 bg-[#ffdea5]/40 text-[#570013]">
              <KeyRound className="h-5 w-5" />
            </div>
            <h1 className="font-serif text-3xl font-semibold text-[#570013] sm:text-4xl">Chào mừng</h1>
            <p className="mt-3 text-sm leading-relaxed text-[#584141]">
              Chào mừng quản trị viên trở về với không gian điều hành gia phả.
              Vui lòng đăng nhập bằng tài khoản đã được cấp quyền.
            </p>
            <div className="relative mx-auto my-7 h-px w-24 bg-gradient-to-r from-transparent via-[#775a19] to-transparent">
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#fbf9f5] px-2 text-[#775a19]">✦</span>
            </div>
          </div>

          {isDenied && (
            <div className="mb-5 rounded border border-[#ba1a1a]/20 bg-[#ffdad6]/60 p-3 text-xs leading-relaxed text-[#93000a]">
              Tài khoản <strong>{session?.name || session?.account}</strong> đã đăng nhập nhưng chưa có quyền quản trị. Chỉ tài khoản đã được cấp quyền admin mới vào được dashboard.
            </div>
          )}

          <div className="space-y-3">
            <a
              href="/api/auth/zalo/start?return_to=/admin"
              className="block w-full border border-[#570013] bg-[#800020] px-4 py-4 text-center text-xs font-bold uppercase tracking-wide text-white transition hover:bg-[#570013] sm:px-5 sm:text-sm sm:tracking-widest"
            >
              Đăng nhập bằng Zalo
            </a>
            <a
              href="/api/auth/google/start?return_to=/admin"
              className="block w-full border border-[#775a19]/45 bg-transparent px-4 py-4 text-center text-xs font-bold uppercase tracking-wide text-[#570013] transition hover:bg-[#ffdea5]/35 sm:px-5 sm:text-sm sm:tracking-widest"
            >
              Đăng nhập bằng Gmail
            </a>
          </div>

          <p className="mt-8 text-center text-xs leading-relaxed text-[#584141]/80">
            Quyền quản trị được xác thực qua OAuth và trạng thái phân quyền trong hệ thống.
          </p>
        </section>
      </main>

      <footer className="border-t border-[#e0bfbf] bg-[#f5f3ef]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-center md:flex-row md:px-16 md:text-left">
          <span className="font-serif text-2xl text-[#570013]">Họ Cao</span>
          <p className="text-sm text-[#584141]">Trường tồn cùng thời gian.</p>
        </div>
      </footer>
    </div>
  );
}

function loadStored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (Array.isArray(fallback)) {
      return Array.isArray(parsed) ? parsed as T : fallback;
    }
    if (fallback !== null && typeof fallback === "object") {
      return parsed && typeof parsed === "object" ? { ...fallback, ...parsed } : fallback;
    }
    return typeof parsed === typeof fallback ? parsed as T : fallback;
  } catch {
    return fallback;
  }
}

function loadInitialDashboardTab(fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const queryTab = new URLSearchParams(window.location.search).get("tab");
  if (queryTab) return queryTab;
  return loadStored(DASHBOARD_ACTIVE_TAB_KEY, fallback);
}

async function loadServerStored<T>(key: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`/api/state/${key}`, { headers: { Accept: "application/json" } });
    if (response.status === 404) return fallback;
    if (!response.ok) throw new Error(`State API returned ${response.status}`);
    const payload = await response.json();
    const value = payload?.value;
    if (Array.isArray(fallback)) {
      return Array.isArray(value) ? value as T : fallback;
    }
    if (fallback !== null && typeof fallback === "object") {
      return value && typeof value === "object" ? { ...fallback, ...value } : fallback;
    }
    return typeof value === typeof fallback ? value as T : fallback;
  } catch (err) {
    console.warn(`Không thể tải cấu hình ${key} từ server.`, err);
    return fallback;
  }
}

async function saveServerStored(key: string, value: unknown): Promise<void> {
  try {
    const response = await fetch(`/api/state/${key}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value })
    });
    if (!response.ok) throw new Error(`State API returned ${response.status}`);
  } catch (err) {
    console.warn(`Không thể lưu cấu hình ${key} lên server.`, err);
  }
}

function sanitizeDefaultAIText(value: string) {
  return String(value || "")
    .replace(/họ Cao Ninh Bình/g, "dòng họ Cao")
    .replace(/dòng họ Cao Ninh Bình/g, "dòng họ Cao")
    .replace(/dòng tộc Cao Ninh Bình/g, "dòng họ Cao")
    .replace(/Cao Ninh Bình/g, "họ Cao")
    .replace(/Cao Quý Công\/Cao Văn Lãm/g, "dữ liệu mẫu cũ chưa xác minh")
    .replace(/Cao Quý Công/g, "dữ liệu mẫu cũ chưa xác minh")
    .replace(/Cao Văn Lãm/g, "dữ liệu mẫu cũ chưa xác minh");
}

function sanitizeAIModelConfig(config: AIModelConfig): AIModelConfig {
  return {
    ...config,
    systemPrompt: sanitizeDefaultAIText(config.systemPrompt)
  };
}

function sanitizeThemeConfig(config: WebThemeConfig): WebThemeConfig {
  const siteName = config.siteName === "Họ Cao Ninh Bình" ? "Họ Cao" : config.siteName;
  return {
    ...config,
    siteName: sanitizeDefaultAIText(siteName),
    slogan: sanitizeDefaultAIText(config.slogan)
  };
}

function sanitizeKnowledgeDocs(docs: KnowledgeBaseDocument[]) {
  return docs.map((doc) => {
    if (!["doc_1", "doc_2"].includes(doc.id)) return doc;
    return {
      ...doc,
      title: sanitizeDefaultAIText(doc.title),
      content: sanitizeDefaultAIText(doc.content),
      contributor: sanitizeDefaultAIText(doc.contributor)
    };
  });
}

function normalizeDashboardUser(user: UserSession): UserSession {
  const isApproved = user.isApproved !== undefined ? user.isApproved : user.approvalStatus === "approved";
  return {
    ...user,
    isApproved,
    approvalStatus: user.approvalStatus || (isApproved ? "approved" : "pending"),
    kycStatus: user.kycStatus || (user.isKYCed ? "verified" : "not_submitted")
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<string>(() => loadInitialDashboardTab("overview"));
  const [serverHealth, setServerHealth] = useState<boolean>(false);
  const [adminAuthSession, setAdminAuthSession] = useState<AdminAuthSession | null>(null);
  const [adminAuthChecked, setAdminAuthChecked] = useState(false);

  // States initialized from high-fidelity mock datasets page-level
  const [members, setMembers] = useState<FamilyMember[]>(() => getWebViewFamilyMembers());
  const [events, setEvents] = useState<ClanEvent[]>(() => loadStored(DASHBOARD_EVENTS_KEY, getWebViewClanEvents()));
  const [transactions, setTransactions] = useState<TreasuryTx[]>(() => getWebViewTreasuryTransactions());
  const [articles, setArticles] = useState<WebArticle[]>(() => loadStored(DASHBOARD_ARTICLES_KEY, getWebViewArticles()));
  const [outstandingMembers, setOutstandingMembers] = useState<OutstandingMember[]>(() => getOutstandingMembersFromFamilyMembers(getWebViewFamilyMembers()));

  // Pre-seeded system users list for simulating Member KYC matching & OTP checks
  const defaultUsersList: UserSession[] = [
    {
      id: "usr_1",
      username: "caotien_ninhbinh",
      fullName: "Cao Tiến Trung",
      role: "admin",
      isKYCed: true,
      isApproved: true,
      approvalStatus: "approved",
      kycStatus: "verified",
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
      isApproved: true,
      approvalStatus: "approved",
      kycStatus: "verified",
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
      isApproved: true,
      approvalStatus: "approved",
      kycStatus: "verified",
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
      isApproved: false,
      approvalStatus: "pending",
      kycStatus: "not_submitted",
      phone: "0888777122",
      email: "vuphong@zalo.vn",
      regDate: "20/05/2026",
      loginType: "zalo"
    }
  ];
  const [usersList, setUsersList] = useState<UserSession[]>(() => loadStored(DASHBOARD_USERS_KEY, defaultUsersList).map(normalizeDashboardUser));
  const [authUsersLoaded, setAuthUsersLoaded] = useState(false);

  const [currentUser, setCurrentUser] = useState<UserSession>(usersList[0]);

  const updateUsersList = (nextUsers: UserSession[] | ((prev: UserSession[]) => UserSession[])) => {
    setUsersList((prev) => {
      const next = typeof nextUsers === "function" ? nextUsers(prev) : nextUsers;
      const normalized = next.map(normalizeDashboardUser);
      const updatedCurrent = normalized.find((user) => user.id === currentUser.id);
      if (updatedCurrent) setCurrentUser(updatedCurrent);
      return normalized;
    });
  };

  // Preloads genealogy references and documents for AI brain contextual querying
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeBaseDocument[]>(() => loadStored(DASHBOARD_KNOWLEDGE_KEY, [
    {
      id: "doc_1",
      title: "Quy chiếu phả hệ gốc đang dùng",
      category: "Gia phả học",
      content: "Dữ liệu cây phả hiện tại xác định Cao Tổ là cụ Cao Đình Thuật (高 廷 術), tước hiệu Cao Cao Mãnh Đế Đại Tướng Quân (高 高 猛 帝 大 將 軍), sinh năm 1716. Thủy Tổ là Cao Đình Lạng (高 廷 兩). Các thông tin còn khuyết phải được admin đối chiếu lại từ file Excel, phả ký và tài liệu gốc trước khi công bố.",
      contributor: "Dữ liệu webview",
      lastUpdated: "30/05/2026"
    },
    {
      id: "doc_2",
      title: "Nguyên tắc dùng AI với dữ liệu họ tộc",
      category: "Gia phả học",
      content: "AI chỉ được dùng dữ liệu đã có trong cây phả, tài liệu tải lên, lịch giỗ và ghi chú quản trị. Không dùng lại dữ liệu mẫu cũ chưa xác minh. Khi gặp thông tin khuyết, AI phải ghi rõ cần Ban trị sự kiểm chứng.",
      contributor: "AI Tổng Quản",
      lastUpdated: "30/05/2026"
    }
  ]));
  const [zaloAutoRules, setZaloAutoRules] = useState<ZaloAutoReply[]>(() => loadStored(DASHBOARD_ZALO_RULES_KEY, []));

  // Cross-component forwarding pipelines for redirecting quick actions to AI Helper
  const [aiInitialPrompt, setAiInitialPrompt] = useState<string>("");
  const [aiInitialType, setAiInitialType] = useState<string>("");

  // Configuration Settings State
  const [themeConfig, setThemeConfig] = useState<WebThemeConfig>(() => loadStored(DASHBOARD_THEME_KEY, {
    siteName: "Họ Cao",
    slogan: "Uống nước nhớ nguồn - Kính tộc phụng tiên",
    primaryColor: "royal-red",
    fontFamily: "Inter",
    showBanner: true,
    bannerImage: "/images/ancient_temple_roof_1779856049722.png",
    logoText: "Cao"
  }));

  const [aiConfig, setAiConfig] = useState<AIModelConfig>(() => loadStored(DASHBOARD_AI_KEY, {
    modelName: "gemini-2.5-flash",
    temperature: 0.35,
    systemPrompt: "Bạn là một Trợ lý AI Hán Nôm am hiểu phong tục tập quán lễ nghĩa bái cổ truyền của dòng họ Cao, chuyên soạn thảo văn sớ và văn hiến gia tự. Chỉ dùng dữ liệu đã xác minh trong cây phả, lịch giỗ và tài liệu admin tải lên.",
    engineCeremony: "chatgpt",
    engineArticles: "chatgpt",
    engineChat: "gemini",
    engineZalo: "gemini"
  }));
  const [calendarHeaderText, setCalendarHeaderText] = useState("Đang tra tiết khí hôm nay...");
  const [dashboardServerStateLoaded, setDashboardServerStateLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadServerStored<WebThemeConfig>("dashboard-theme", themeConfig),
      loadServerStored<AIModelConfig>("dashboard-ai", aiConfig),
      loadServerStored<WebArticle[]>("dashboard-articles", articles),
      loadServerStored<KnowledgeBaseDocument[]>("dashboard-knowledge", knowledgeDocs),
      loadServerStored<ClanEvent[]>("dashboard-events", events),
      loadServerStored<ZaloAutoReply[]>("dashboard-zalo-rules", zaloAutoRules)
    ]).then(([serverTheme, serverAi, serverArticles, serverKnowledge, serverEvents, serverZaloRules]) => {
      if (cancelled) return;
      setThemeConfig(sanitizeThemeConfig(serverTheme));
      setAiConfig(sanitizeAIModelConfig(serverAi));
      setArticles(serverArticles);
      setKnowledgeDocs(sanitizeKnowledgeDocs(serverKnowledge));
      setEvents(serverEvents);
      setZaloAutoRules(serverZaloRules);
    }).finally(() => {
      if (!cancelled) setDashboardServerStateLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setKnowledgeDocs((prev) => {
      if (prev.some((doc) => doc.id.startsWith("knowledge_"))) return prev;
      return [...getWebViewKnowledgeDocs(), ...prev];
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refreshMembersFromBackend = () => {
      void hydrateWebViewFamilyMembers().then((backendMembers) => {
        if (cancelled) return;
        setMembers(backendMembers);
        setOutstandingMembers(getOutstandingMembersFromFamilyMembers(backendMembers));
      });
    };

    refreshMembersFromBackend();
    window.addEventListener("caogia_tree_data_updated", refreshMembersFromBackend);
    return () => {
      cancelled = true;
      window.removeEventListener("caogia_tree_data_updated", refreshMembersFromBackend);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(DASHBOARD_THEME_KEY, JSON.stringify(themeConfig));
    if (dashboardServerStateLoaded) void saveServerStored("dashboard-theme", themeConfig);
    const colors = dashboardColorMap[themeConfig.primaryColor] || dashboardColorMap["royal-red"];
    const root = document.getElementById("admin-dashboard-root");
    if (!root) return;
    root.style.setProperty("--dashboard-primary", colors.primary);
    root.style.setProperty("--dashboard-primary-hover", colors.hover);
    root.style.setProperty("--dashboard-primary-soft", colors.soft);
    root.style.fontFamily = themeConfig.fontFamily === "Playfair Display"
      ? '"Playfair Display", serif'
      : themeConfig.fontFamily === "Space Grotesk"
        ? '"Space Grotesk", sans-serif'
        : '"Inter", sans-serif';
  }, [dashboardServerStateLoaded, themeConfig]);

  useEffect(() => {
    localStorage.setItem(DASHBOARD_AI_KEY, JSON.stringify(aiConfig));
    if (dashboardServerStateLoaded) void saveServerStored("dashboard-ai", aiConfig);
  }, [aiConfig, dashboardServerStateLoaded]);

  useEffect(() => {
    localStorage.setItem(DASHBOARD_ACTIVE_TAB_KEY, JSON.stringify(activeTab));
  }, [activeTab]);

  useEffect(() => {
    if (Array.isArray(usersList)) {
      localStorage.setItem(DASHBOARD_USERS_KEY, JSON.stringify(usersList));
    }
  }, [usersList]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { headers: { Accept: "application/json" } })
      .then((response) => response.ok ? response.json() : { user: null })
      .then((payload) => {
        if (!cancelled) setAdminAuthSession(payload.user || null);
      })
      .catch(() => {
        if (!cancelled) setAdminAuthSession(null);
      })
      .finally(() => {
        if (!cancelled) setAdminAuthChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!adminAuthSession) return;
    const adminUser = usersList.find((user) => (
      user.username === adminAuthSession.account ||
      (!!adminAuthSession.id && user.id === `oauth_${adminAuthSession.provider}_${adminAuthSession.id}`) ||
      user.role === "admin"
    ));
    if (adminUser && (adminUser.id !== currentUser.id || adminUser.role !== currentUser.role)) {
      setCurrentUser(normalizeDashboardUser(adminUser));
    }
  }, [adminAuthSession, currentUser.id, currentUser.role, usersList]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/users", { headers: { Accept: "application/json" } })
      .then((response) => response.ok ? response.json() : { users: [] })
      .then((payload) => {
        if (cancelled) return;
        const serverUsers = Array.isArray(payload.users) ? payload.users.map(normalizeDashboardUser) : [];
        if (serverUsers.length > 0) {
          setUsersList((prev) => {
            const merged = [...prev.map(normalizeDashboardUser)];
            serverUsers.forEach((serverUser) => {
              const index = merged.findIndex((user) => user.id === serverUser.id || user.username === serverUser.username);
              if (index === -1) {
                merged.unshift(serverUser);
                return;
              }
              merged[index] = normalizeDashboardUser({ ...merged[index], ...serverUser });
            });
            return merged;
          });
        }
      })
      .catch((err) => {
        console.warn("Không thể đồng bộ danh sách tài khoản đăng nhập từ server.", err);
      })
      .finally(() => {
        if (!cancelled) setAuthUsersLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!authUsersLoaded) return;
    fetch("/api/auth/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ users: usersList.map(normalizeDashboardUser) })
    }).catch((err) => {
      console.warn("Không thể lưu danh sách tài khoản đăng nhập lên server.", err);
    });
  }, [authUsersLoaded, usersList]);

  useEffect(() => {
    const syncWebviewAuthUser = () => {
      try {
        const raw = localStorage.getItem(WEBVIEW_AUTH_STORAGE_KEY);
        if (!raw) return;
        const session = JSON.parse(raw) as { provider?: "zalo" | "gmail"; id?: string; name?: string; account?: string; avatar?: string; loggedInAt?: string };
        if (!session?.account && !session?.id) return;

        const loginType: UserSession["loginType"] = session.provider === "zalo" ? "zalo" : "email";
        const username = session.account || session.id || `oauth_${Date.now()}`;
        updateUsersList((prev) => {
          const exists = prev.some((user) => user.username === username || (!!session.id && user.id === `oauth_${session.provider}_${session.id}`));
          if (exists) return prev;

          const registeredUser: UserSession = {
            id: `oauth_${session.provider || "gmail"}_${session.id || Date.now()}`,
            username,
            fullName: session.name || username,
            role: "user",
            roles: ["user"],
            isKYCed: false,
            kycStatus: "not_submitted",
            isApproved: false,
            approvalStatus: "pending",
            email: loginType === "email" ? username : "",
            phone: loginType === "zalo" ? username : "",
            avatar: session.avatar || "",
            regDate: new Date().toLocaleDateString("vi-VN"),
            loginType
          };
          return [registeredUser, ...prev];
        });
      } catch {
        // Ignore malformed local auth cache.
      }
    };

    syncWebviewAuthUser();
    window.addEventListener("storage", syncWebviewAuthUser);
    window.addEventListener("caogia_webview_auth_updated", syncWebviewAuthUser);
    return () => {
      window.removeEventListener("storage", syncWebviewAuthUser);
      window.removeEventListener("caogia_webview_auth_updated", syncWebviewAuthUser);
    };
  }, []);

  useEffect(() => {
    if (Array.isArray(articles)) {
      localStorage.setItem(DASHBOARD_ARTICLES_KEY, JSON.stringify(articles));
      if (dashboardServerStateLoaded) void saveServerStored("dashboard-articles", articles);
    }
  }, [articles, dashboardServerStateLoaded]);

  useEffect(() => {
    if (Array.isArray(knowledgeDocs)) {
      localStorage.setItem(DASHBOARD_KNOWLEDGE_KEY, JSON.stringify(knowledgeDocs));
      if (dashboardServerStateLoaded) void saveServerStored("dashboard-knowledge", knowledgeDocs);
    }
  }, [dashboardServerStateLoaded, knowledgeDocs]);

  useEffect(() => {
    if (Array.isArray(events)) {
      localStorage.setItem(DASHBOARD_EVENTS_KEY, JSON.stringify(events));
      if (dashboardServerStateLoaded) void saveServerStored("dashboard-events", events);
    }
  }, [dashboardServerStateLoaded, events]);

  useEffect(() => {
    if (Array.isArray(zaloAutoRules)) {
      localStorage.setItem(DASHBOARD_ZALO_RULES_KEY, JSON.stringify(zaloAutoRules));
      if (dashboardServerStateLoaded) void saveServerStored("dashboard-zalo-rules", zaloAutoRules);
    }
  }, [dashboardServerStateLoaded, zaloAutoRules]);

  useEffect(() => {
    let cancelled = false;
    const today = new Date();
    const upcomingEvent = events.find((event) => event.status !== "Đã hoàn thành") || events[0];
    const shortLocation = (upcomingEvent?.location || "")
      .split(",")
      .slice(-2)
      .join(", ")
      .trim() || "dòng họ";

    fetch(`/api/lunar/day?d=${today.getDate()}&m=${today.getMonth() + 1}&y=${today.getFullYear()}`)
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (cancelled) return;
        const term = payload?.data?.tiet_khi || "Tiết khí hôm nay";
        const eventTitle = upcomingEvent?.title ? ` · ${upcomingEvent.title}` : "";
        setCalendarHeaderText(`${term}${eventTitle} tại ${shortLocation}`);
      })
      .catch(() => {
        if (!cancelled) setCalendarHeaderText(`${upcomingEvent?.title || "Lịch lễ nghi"} tại ${shortLocation}`);
      });

    return () => {
      cancelled = true;
    };
  }, [events]);

  // Check backend server synchronization on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch("/api/health");
        const data = await response.json();
        if (data.status === "healthy" || data.ok === true) {
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

  useEffect(() => {
    const reloadMembersFromWebViewTree = () => {
      const nextMembers = getWebViewFamilyMembers();
      setMembers(nextMembers);
      setOutstandingMembers(getOutstandingMembersFromFamilyMembers(nextMembers));
    };

    window.addEventListener("caogia_tree_data_updated", reloadMembersFromWebViewTree);
    return () => window.removeEventListener("caogia_tree_data_updated", reloadMembersFromWebViewTree);
  }, []);

  // CRUD callback triggers
  const handleAddMember = (newMem: FamilyMember) => {
    try {
      const nextMembers = addDashboardMemberToSharedTree(newMem);
      setMembers(nextMembers);
      setOutstandingMembers(getOutstandingMembersFromFamilyMembers(nextMembers));
    } catch (err: any) {
      alert(err?.message || "Không thể ghi phả thành viên mới.");
    }
  };

  const handleUpdateMember = (member: FamilyMember) => {
    try {
      const nextMembers = updateDashboardMemberInSharedTree(member);
      setMembers(nextMembers);
      setOutstandingMembers(getOutstandingMembersFromFamilyMembers(nextMembers));
    } catch (err: any) {
      alert(err?.message || "Không thể sửa thông tin thành viên.");
    }
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

  const hasAdminAccess = adminAuthSession?.role === "admin" || adminAuthSession?.roles?.includes("admin");
  if (!adminAuthChecked) {
    return <div className="min-h-screen bg-[#fbf9f5]" />;
  }
  if (!hasAdminAccess) {
    return <AdminLoginPage session={adminAuthSession} />;
  }

  return (
    <div id="admin-dashboard-root" className="admin-dashboard-root flex flex-col lg:flex-row min-h-screen bg-[#faf9f5] text-stone-850 h-screen overflow-hidden">
      <style>{`
        @keyframes admin-drum-spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        .admin-login-drum {
          animation: admin-drum-spin 95s linear infinite;
        }
        #admin-dashboard-root .bg-red-800,
        #admin-dashboard-root .bg-red-900,
        #admin-dashboard-root .bg-red-950,
        #admin-dashboard-root .bg-primary {
          background-color: var(--dashboard-primary, #991b1b) !important;
        }
        #admin-dashboard-root .hover\\:bg-red-900:hover,
        #admin-dashboard-root .hover\\:bg-red-950:hover,
        #admin-dashboard-root .hover\\:bg-primary-hover:hover {
          background-color: var(--dashboard-primary-hover, #7f1d1d) !important;
        }
        #admin-dashboard-root .text-red-800,
        #admin-dashboard-root .text-red-900,
        #admin-dashboard-root .text-red-950,
        #admin-dashboard-root .text-primary {
          color: var(--dashboard-primary, #991b1b) !important;
        }
        #admin-dashboard-root .border-red-800,
        #admin-dashboard-root .border-red-900,
        #admin-dashboard-root .border-primary {
          border-color: var(--dashboard-primary, #991b1b) !important;
        }
        #admin-dashboard-root .accent-red-800 {
          accent-color: var(--dashboard-primary, #991b1b) !important;
        }
      `}</style>
      
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
              <span className="text-stone-700">{calendarHeaderText}</span>
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
                onUpdateMember={handleUpdateMember}
                onBulkImport={handleBulkImport}
              />
            )}

            {activeTab === "members" && (
              <MemberAccountsManager
                usersList={usersList}
                members={members}
                currentUser={currentUser}
                onUpdateUsersList={updateUsersList}
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

            {activeTab === "ai-governor" && (
              <AIGovernor
                members={members}
                events={events}
                transactions={transactions}
                articles={articles}
                knowledgeDocs={knowledgeDocs}
                aiConfig={aiConfig}
                zaloRules={zaloAutoRules}
                onKnowledgeDocsChange={setKnowledgeDocs}
                onArticlesChange={setArticles}
                onZaloRulesChange={setZaloAutoRules}
                onSetActiveTab={setActiveTab}
                onSetAIInitialPrompt={handleSetAIInitialPrompt}
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
                aiConfig={aiConfig}
              />
            )}

            {activeTab === "zalo" && (
              <ZaloManager 
                members={members} 
                currentUser={currentUser}
                usersList={usersList}
                onUpdateUsersList={updateUsersList}
                knowledgeDocs={knowledgeDocs}
                initialRules={zaloAutoRules}
                onRulesChange={setZaloAutoRules}
              />
            )}

            {activeTab === "articles" && (
              <ArticlesManager aiConfig={aiConfig} knowledgeDocs={knowledgeDocs} eventSuggestions={events} members={members} initialArticles={articles} onArticlesChange={setArticles} />
            )}

            {activeTab === "settings" && (
              <SettingsManager 
                themeConfig={themeConfig}
                onThemeConfigChange={setThemeConfig}
                aiConfig={aiConfig}
                onAIConfigChange={setAiConfig}
                currentUser={currentUser}
                usersList={usersList}
                onAddUser={(user) => updateUsersList((prev) => [user, ...prev])}
                onUpdateUserRole={(userId, newRole, newRoles) => {
                  const updated = usersList.map(u => u.id === userId ? { ...u, role: newRole, roles: newRoles } : u);
                  updateUsersList(updated);
                  const updatedCU = updated.find(u => u.id === currentUser.id);
                  if (updatedCU) setCurrentUser(updatedCU);
                }}
                onUpdateUserKYC={(userId, isKYCed) => {
                  const updated = usersList.map(u => u.id === userId ? { ...u, isKYCed, kycStatus: isKYCed ? "verified" : "not_submitted" as const } : u);
                  updateUsersList(updated);
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
