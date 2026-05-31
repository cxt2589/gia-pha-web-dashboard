/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ANCESTRAL_TREE } from '../data/lineageData';
import { AncestorNode, GenealogyDateStructured } from '../types';
import { deriveLunarAnniversaryFromSolarDeathDate, getAnniversaryCountdown } from '../utils/lunarConverter';
import { parseGenealogyDateText } from '../utils/genealogyDate.mjs';
import { getPersistedTreeData, hydratePersistedTreeDataFromBackend, savePersistedTreeData, getAppSettings } from '../utils/configManager';
import {
  computeClanLeaderRules,
  formatNodeTitle,
  getAncestralTierClassName,
  getAncestralTierLabel,
  isMaleNode,
  isUnknownText,
  MAX_TREE_ZOOM,
  MIN_TREE_ZOOM,
  TREE_ZOOM_STEP
} from '../utils/lineageDisplay';
import { findNodeById, getSpouseNames, parseSpouses, syncSpouseDetailsFromText } from '../utils/lineageTreeHelpers';
import { ProfileAdminActions } from './gia-pha-tree/ProfileAdminActions';
import { SelectedNodeProfileDetails } from './gia-pha-tree/SelectedNodeProfileDetails';
import { SelectedNodeMobileProfileDialog } from './gia-pha-tree/SelectedNodeMobileProfileDialog';
import { TreeCanvasLegend } from './gia-pha-tree/TreeCanvasLegend';
import { TreeSearchBox } from './gia-pha-tree/TreeSearchBox';
import { TreeSectionHeader } from './gia-pha-tree/TreeSectionHeader';
import { TreeToolbar } from './gia-pha-tree/TreeToolbar';
import { 
  Heart, 
  Calendar, 
  Scroll, 
  ChevronRight, 
  ChevronDown, 
  ShieldCheck,
  X
} from 'lucide-react';

type WebviewAuthProvider = 'zalo' | 'gmail';
const parseStructuredGenealogyDate = (...args: Parameters<typeof parseGenealogyDateText>): GenealogyDateStructured =>
  parseGenealogyDateText(...args) as GenealogyDateStructured;

type WebviewAuthSession = {
  provider: WebviewAuthProvider;
  id?: string;
  name: string;
  account: string;
  avatar?: string;
  loggedInAt?: string;
  isKYCed?: boolean;
  kycStatus?: 'not_submitted' | 'pending' | 'verified';
  isApproved?: boolean;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
  linkedMemberId?: string;
};

const WEBVIEW_AUTH_STORAGE_KEY = 'caogia_webview_auth_session_v1';
const MOBILE_LOGIN_HINT_STORAGE_KEY = 'caogia_mobile_login_hint_dismissed_v1';
const PENDING_PROFILE_NODE_STORAGE_KEY = 'caogia_pending_profile_node_id_v1';

const getAuthErrorMessage = (code: string) => {
  const messages: Record<string, string> = {
    google_config: 'Chưa cấu hình Google OAuth. Cần thêm GOOGLE_OAUTH_CLIENT_ID và GOOGLE_OAUTH_CLIENT_SECRET trong .env.local.',
    zalo_config: 'Chưa cấu hình Zalo OAuth. Cần thêm ZALO_APP_ID và ZALO_SECRET_KEY trong .env.local.',
    google_state: 'Phiên đăng nhập Google đã hết hạn hoặc không hợp lệ. Vui lòng thử lại.',
    zalo_state: 'Phiên đăng nhập Zalo đã hết hạn hoặc không hợp lệ. Vui lòng thử lại.',
    google: 'Google OAuth chưa hoàn tất. Vui lòng thử lại.',
    zalo: 'Zalo OAuth chưa hoàn tất. Vui lòng thử lại.'
  };
  return messages[code] || 'Đăng nhập OAuth chưa hoàn tất. Vui lòng thử lại.';
};

const hasVerifiedKyc = (session: WebviewAuthSession | null) => {
  return !!session && (!!session.isKYCed || session.kycStatus === 'verified');
};

export default function GiaPhaTree() {
  const [treeData, setTreeData] = React.useState<AncestorNode>(() => getPersistedTreeData(ANCESTRAL_TREE));
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedNode, setSelectedNode] = React.useState<AncestorNode | null>(null);
  const [showExactDates, setShowExactDates] = React.useState(false);
  const [showAnniversaryDetails, setShowAnniversaryDetails] = React.useState(false);
  const [collapsedNodes, setCollapsedNodes] = React.useState<Record<string, boolean>>({});

  // Loaded dynamic theme configurations
  const [settings, setSettings] = React.useState(getAppSettings());

  React.useEffect(() => {
    void hydratePersistedTreeDataFromBackend(ANCESTRAL_TREE).then((backendTree) => {
      if (backendTree) setTreeData(backendTree);
    });

    const handleConfigTrigger = () => {
      setSettings(getAppSettings());
    };
    const handleTreeTrigger = () => {
      setTreeData(getPersistedTreeData(ANCESTRAL_TREE));
    };
    window.addEventListener("caogia_settings_updated", handleConfigTrigger);
    window.addEventListener("caogia_tree_data_updated", handleTreeTrigger);
    return () => {
      window.removeEventListener("caogia_settings_updated", handleConfigTrigger);
      window.removeEventListener("caogia_tree_data_updated", handleTreeTrigger);
    };
  }, []);

  React.useEffect(() => {
    setShowExactDates(false);
    setShowAnniversaryDetails(false);
  }, [selectedNode?.id]);

  const [generationFilter, setGenerationFilter] = React.useState<number | 'all'>('all');
  
  // Interactive UI configurations
  const [zoomLevel, setZoomLevel] = React.useState<number>(100);
  const [orientation, setOrientation] = React.useState<'vertical' | 'horizontal'>('vertical');
  const [isFullTreeView, setIsFullTreeView] = React.useState(false);
  const treeScale = zoomLevel / 100;

  const zoomOut = React.useCallback(() => {
    setZoomLevel(prev => Math.max(MIN_TREE_ZOOM, prev - TREE_ZOOM_STEP));
  }, []);

  const zoomIn = React.useCallback(() => {
    setZoomLevel(prev => Math.min(MAX_TREE_ZOOM, prev + TREE_ZOOM_STEP));
  }, []);

  const resetZoom = React.useCallback(() => {
    setZoomLevel(100);
  }, []);

  React.useEffect(() => {
    if (!treeData?.id) return;

    const cardId = orientation === 'vertical' ? `vt-node-card-${treeData.id}` : `hz-node-card-${treeData.id}`;
    const centerKey = `${cardId}:${isFullTreeView ? 'full' : 'normal'}`;
    if (centeredRootKeyRef.current === centerKey) return;
    centeredRootKeyRef.current = centerKey;

    let attempts = 0;
    let timerId = 0;

    const centerRoot = () => {
      const viewport = viewportRef.current;
      const card = document.getElementById(cardId);
      attempts += 1;
      if (!viewport || !card || card.getBoundingClientRect().width <= 0) {
        if (attempts < 12) timerId = window.setTimeout(centerRoot, 120);
        return;
      }
      const viewportRect = viewport.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      viewport.scrollTo({
        left: viewport.scrollLeft + cardRect.left - viewportRect.left - (viewport.clientWidth / 2) + (cardRect.width / 2),
        top: viewport.scrollTop + cardRect.top - viewportRect.top - (viewport.clientHeight / 2) + (cardRect.height / 2),
        behavior: attempts <= 2 ? 'auto' : 'smooth'
      });
    };

    timerId = window.setTimeout(centerRoot, 80);
    return () => window.clearTimeout(timerId);
  }, [treeData?.id, orientation, isFullTreeView]);
  
  // Admin Mode protection (Only admin can modify tree on web)
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = React.useState('');
  const [showAdminLoginModal, setShowAdminLoginModal] = React.useState(false);
  const [adminLoginError, setAdminLoginError] = React.useState('');
  const [webviewAuthSession, setWebviewAuthSession] = React.useState<WebviewAuthSession | null>(() => {
    try {
      const raw = window.localStorage.getItem(WEBVIEW_AUTH_STORAGE_KEY);
      return raw ? JSON.parse(raw) as WebviewAuthSession : null;
    } catch {
      return null;
    }
  });
  const [showProfileLoginModal, setShowProfileLoginModal] = React.useState(false);
  const [showMobileLoginHint, setShowMobileLoginHint] = React.useState(false);
  const [pendingProfileNode, setPendingProfileNode] = React.useState<AncestorNode | null>(null);
  const [profileLoginProvider, setProfileLoginProvider] = React.useState<WebviewAuthProvider>('zalo');
  const [profileLoginName, setProfileLoginName] = React.useState('');
  const [profileLoginAccount, setProfileLoginAccount] = React.useState('');
  const [profileLoginError, setProfileLoginError] = React.useState('');

  React.useEffect(() => {
    try {
      if (webviewAuthSession) {
        window.localStorage.setItem(WEBVIEW_AUTH_STORAGE_KEY, JSON.stringify(webviewAuthSession));
      } else {
        window.localStorage.removeItem(WEBVIEW_AUTH_STORAGE_KEY);
      }
      window.dispatchEvent(new CustomEvent('caogia_webview_auth_updated'));
    } catch {
      // Storage can be unavailable in some private browsing modes.
    }
  }, [webviewAuthSession]);

  React.useEffect(() => {
    let cancelled = false;

    fetch('/api/auth/me', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then((response) => response.ok ? response.json() : { user: null })
      .then((data) => {
        if (cancelled) return;
        if (data.user) {
          setWebviewAuthSession(data.user);
        }
      })
      .catch(() => {
        // Keep the local session if the server session check is temporarily unavailable.
      });

    const url = new URL(window.location.href);
    const authError = url.searchParams.get('auth_error');
    if (authError) {
      setProfileLoginError(getAuthErrorMessage(authError));
      setShowProfileLoginModal(true);
    }

    if (url.searchParams.has('auth') || url.searchParams.has('auth_error')) {
      url.searchParams.delete('auth');
      url.searchParams.delete('auth_error');
      window.history.replaceState({}, '', url.toString());
    }

    return () => {
      cancelled = true;
    };
  }, []);

  // Mobile viewport helper and popup modal trigger
  const [isMobile, setIsMobile] = React.useState(false);
  const [isMobileModalOpen, setIsMobileModalOpen] = React.useState(false);
  const canViewProfileDetails = hasVerifiedKyc(webviewAuthSession) || isAdmin;

  const [clanLeaderRuleActive, setClanLeaderRuleActive] = React.useState(false);

  const leaderSpecsMap = React.useMemo(() => {
    if (!clanLeaderRuleActive) return {};
    return computeClanLeaderRules(treeData);
  }, [treeData, clanLeaderRuleActive]);

  // State for dynamic additions
  const [isAddingNode, setIsAddingNode] = React.useState(false);
  const [addType, setAddType] = React.useState<'child' | 'spouse' | 'edit' | 'edit_spouse'>('child');
  
  // Dragging state for desktop space dragging pan scroll
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const centeredRootKeyRef = React.useRef("");
  const [isDragging, setIsDragging] = React.useState(false);
  const [startX, setStartX] = React.useState(0);
  const [startY, setStartY] = React.useState(0);
  const [scrollLeft, setScrollLeft] = React.useState(0);
  const [scrollTop, setScrollTop] = React.useState(0);
  // Expanded status for spouses details
  const [expandedSpouseNames, setExpandedSpouseNames] = React.useState<Record<string, boolean>>({});

  const [newMemberName, setNewMemberName] = React.useState('');
  const [newMemberGender, setNewMemberGender] = React.useState<'nam' | 'nữ'>('nam');
  const [newMemberRankRole, setNewMemberRankRole] = React.useState('');
  const [newMemberCustomSuffix, setNewMemberCustomSuffix] = React.useState('');
  const [newMemberBirthYear, setNewMemberBirthYear] = React.useState('');
  const [newMemberDeathYear, setNewMemberDeathYear] = React.useState('');
  const [newMemberDescription, setNewMemberDescription] = React.useState('');
  const [newMemberSpouse, setNewMemberSpouse] = React.useState('');
  const [newMemberMother, setNewMemberMother] = React.useState(''); // Mother reference field (multi-wife solution)
  const [newMemberResidence, setNewMemberResidence] = React.useState('');
  const [newMemberBurial, setNewMemberBurial] = React.useState('');
  const [newMemberLunarAnniversary, setNewMemberLunarAnniversary] = React.useState('');
  const [newMemberIsLiving, setNewMemberIsLiving] = React.useState(false);
  const [newMemberPhone1, setNewMemberPhone1] = React.useState('');
  const [newMemberPhone2, setNewMemberPhone2] = React.useState('');
  const [newMemberPhone3, setNewMemberPhone3] = React.useState('');
  const [newMemberBirthPlace, setNewMemberBirthPlace] = React.useState('');
  const [newMemberDeathPlace, setNewMemberDeathPlace] = React.useState('');
  const [newMemberEmail, setNewMemberEmail] = React.useState('');

  // Sơ đồ phối ngẫu mới thêm chi tiết
  const [spouseBirthYear, setSpouseBirthYear] = React.useState('');
  const [spouseDeathYear, setSpouseDeathYear] = React.useState('');
  const [spouseBirthPlace, setSpouseBirthPlace] = React.useState('');
  const [spouseDeathPlace, setSpouseDeathPlace] = React.useState('');
  const [spouseResidence, setSpouseResidence] = React.useState('');
  const [spouseLunarAnniversary, setSpouseLunarAnniversary] = React.useState('');
  const [spousePhone1, setSpousePhone1] = React.useState('');
  const [spousePhone2, setSpousePhone2] = React.useState('');
  const [spousePhone3, setSpousePhone3] = React.useState('');
  const [spouseEmail, setSpouseEmail] = React.useState('');
  const [spouseIsLiving, setSpouseIsLiving] = React.useState(false);
  const [editingSpouseOriginalName, setEditingSpouseOriginalName] = React.useState<string | null>(null);

  // Solar Date & automatic Lunar formatting states
  const [newMemberSolarBirthDate, setNewMemberSolarBirthDate] = React.useState('');
  const [newMemberSolarDeathDate, setNewMemberSolarDeathDate] = React.useState('');
  const [spouseSolarBirthDate, setSpouseSolarBirthDate] = React.useState('');
  const [spouseSolarDeathDate, setSpouseSolarDeathDate] = React.useState('');

  // Mouse pan event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 1) return;
    const target = e.target as HTMLElement;
    if (
      target.closest('input') || 
      target.closest('button') || 
      target.closest('select') || 
      target.closest('textarea') || 
      target.closest('[id^="vt-node-card-"]') || 
      target.closest('[id^="hz-node-card-"]')
    ) {
      return;
    }
    if (viewportRef.current) {
      e.preventDefault(); // Ngăn hiển thị bôi đen chữ hoặc cơ chế kéo mặc định của trình duyệt để có thể giữ chuột trái kéo lướt mượt mà
      setIsDragging(true);
      setStartX(e.clientX - viewportRef.current.offsetLeft);
      setStartY(e.clientY - viewportRef.current.offsetTop);
      setScrollLeft(viewportRef.current.scrollLeft);
      setScrollTop(viewportRef.current.scrollTop);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !viewportRef.current) return;
    e.preventDefault();
    const x = e.clientX - viewportRef.current.offsetLeft;
    const y = e.clientY - viewportRef.current.offsetTop;
    const walkX = (x - startX) * 1.5;
    const walkY = (y - startY) * 1.5;
    viewportRef.current.scrollLeft = scrollLeft - walkX;
    viewportRef.current.scrollTop = scrollTop - walkY;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const scrollNodeIntoCanvas = React.useCallback((nodeId: string, behavior: ScrollBehavior = 'smooth') => {
    const viewport = viewportRef.current;
    const cardId = orientation === 'vertical' ? `vt-node-card-${nodeId}` : `hz-node-card-${nodeId}`;
    const card = document.getElementById(cardId);
    if (!viewport || !card) return;
    const viewportRect = viewport.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    viewport.scrollTo({
      left: viewport.scrollLeft + cardRect.left - viewportRect.left - (viewport.clientWidth / 2) + (cardRect.width / 2),
      top: viewport.scrollTop + cardRect.top - viewportRect.top - (viewport.clientHeight / 2) + (cardRect.height / 2),
      behavior
    });
  }, [orientation]);

  const handleReturnToRoot = React.useCallback(() => {
    if (!treeData?.id) return;
    window.setTimeout(() => scrollNodeIntoCanvas(treeData.id), 120);
  }, [scrollNodeIntoCanvas, treeData?.id]);

  React.useEffect(() => {
    if (!treeData?.id) return;
    let attempts = 0;
    let timerId = 0;

    const centerRootInCanvas = () => {
      attempts += 1;
      scrollNodeIntoCanvas(treeData.id, attempts <= 2 ? 'auto' : 'smooth');
      if (attempts < 10) {
        timerId = window.setTimeout(centerRootInCanvas, attempts < 3 ? 180 : 320);
      }
    };

    timerId = window.setTimeout(centerRootInCanvas, 220);
    return () => window.clearTimeout(timerId);
  }, [isMobile, orientation, scrollNodeIntoCanvas, treeData?.id]);

  // Launching panels helpers
  const startAddChild = () => {
    setAddType('child');
    setNewMemberName('');
    setNewMemberGender('nam');
    setNewMemberRankRole('');
    setNewMemberCustomSuffix('');
    setNewMemberBirthYear('');
    setNewMemberDeathYear('');
    setNewMemberDescription('');
    setNewMemberSpouse('');
    setNewMemberMother('');
    setNewMemberResidence('');
    setNewMemberBurial('');
    setNewMemberLunarAnniversary('');
    setNewMemberIsLiving(false);
    setNewMemberPhone1('');
    setNewMemberPhone2('');
    setNewMemberPhone3('');
    setNewMemberBirthPlace('');
    setNewMemberDeathPlace('');
    setNewMemberSolarBirthDate('');
    setNewMemberSolarDeathDate('');
    setNewMemberEmail('');
    setSpouseEmail('');
    setIsAddingNode(true);
  };

  const startAddSpouse = () => {
    setAddType('spouse');
    setNewMemberSpouse('');
    setSpouseBirthYear('');
    setSpouseDeathYear('');
    setSpouseBirthPlace('');
    setSpouseDeathPlace('');
    setSpouseResidence('');
    setSpouseLunarAnniversary('');
    setSpousePhone1('');
    setSpousePhone2('');
    setSpousePhone3('');
    setSpouseIsLiving(false);
    setSpouseSolarBirthDate('');
    setSpouseSolarDeathDate('');
    setSpouseEmail('');
    setIsAddingNode(true);
  };

  const startEditSpouse = (spouseName: string, detail: any) => {
    setNewMemberSpouse(spouseName);
    setSpouseBirthYear(detail?.birthYear || '');
    setSpouseDeathYear(detail?.deathYear || '');
    setSpouseBirthPlace(detail?.birthPlace || '');
    setSpouseDeathPlace(detail?.deathPlace || '');
    setSpouseResidence(detail?.residence || '');
    setSpouseLunarAnniversary(detail?.lunarAnniversary || '');
    setSpousePhone1(detail?.phone1 || '');
    setSpousePhone2(detail?.phone2 || '');
    setSpousePhone3(detail?.phone3 || '');
    setSpouseIsLiving(detail ? !!detail.isLiving : false);
    setSpouseSolarBirthDate(detail?.solarBirthDate || '');
    setSpouseSolarDeathDate(detail?.solarDeathDate || '');
    setSpouseEmail(detail?.email || '');
    setEditingSpouseOriginalName(spouseName);
    setAddType('edit_spouse');
    setIsAddingNode(true);
  };

  const handleCancelAdd = () => {
    setIsAddingNode(false);
    setNewMemberSpouse('');
    setNewMemberRankRole('');
    setNewMemberCustomSuffix('');
    setSpouseBirthYear('');
    setSpouseDeathYear('');
    setSpouseBirthPlace('');
    setSpouseDeathPlace('');
    setSpouseResidence('');
    setSpouseLunarAnniversary('');
    setSpousePhone1('');
    setSpousePhone2('');
    setSpousePhone3('');
    setSpouseIsLiving(false);
    setSpouseSolarBirthDate('');
    setSpouseSolarDeathDate('');
    setSpouseEmail('');
    setEditingSpouseOriginalName(null);
  };

  const startEditing = () => {
    if (!selectedNode) return;
    setAddType('edit');
    setNewMemberName(selectedNode.name || '');
    setNewMemberGender(selectedNode.gender || 'nam');
    setNewMemberBirthYear(selectedNode.birthYear || '');
    setNewMemberDeathYear(selectedNode.deathYear || '');
    
    let rRole = selectedNode.rankRole || '';
    let cSuffix = selectedNode.customSuffix || '';
    if (!selectedNode.rankRole && selectedNode.title) {
      // Parse legacy
      let cleanTitle = selectedNode.title;
      cleanTitle = cleanTitle.replace(/^Đệ\s+[A-Za-zĂăÂâĐđÊêÔôƠơƯưỨứ\s]+\s+thế\s+tổ(?:\s*-\s*|\s+)?/gi, '');
      cleanTitle = cleanTitle.replace(/^Hậu\s+duệ\s+đời\s+\d+(?:\s*-\s*|\s+)?/gi, '');
      
      const roles = ["trưởng chi", "trưởng tộc", "đệ nhị", "đệ tam", "gái cả", "gái thứ 1-2-3", "gái thứ 1", "gái thứ 2", "gái thứ 3", "đích tôn"];
      const foundRole = roles.find(r => cleanTitle.toLowerCase().includes(r));
      if (foundRole) {
        const index = cleanTitle.toLowerCase().indexOf(foundRole);
        rRole = cleanTitle.substring(index, index + foundRole.length);
        const part1 = cleanTitle.substring(0, index).trim();
        const part2 = cleanTitle.substring(index + foundRole.length).trim();
        cSuffix = [part1, part2].filter(Boolean).join(' ').replace(/^\s*-\s*|\s*-\s*$/g, '').trim();
      } else {
        rRole = '';
        cSuffix = cleanTitle.trim();
      }
    }
    setNewMemberRankRole(rRole);
    setNewMemberCustomSuffix(cSuffix);

    setNewMemberDescription(selectedNode.description || '');
    setNewMemberSpouse(selectedNode.spouse || '');
    setNewMemberMother(selectedNode.motherName || '');
    setNewMemberResidence(selectedNode.residence || '');
    setNewMemberBurial(selectedNode.burialPlace || '');
    setNewMemberLunarAnniversary(selectedNode.lunarAnniversary || '');
    setNewMemberIsLiving(!!selectedNode.isLiving);
    setNewMemberPhone1(selectedNode.phone1 || '');
    setNewMemberPhone2(selectedNode.phone2 || '');
    setNewMemberPhone3(selectedNode.phone3 || '');
    setNewMemberBirthPlace(selectedNode.birthPlace || '');
    setNewMemberDeathPlace(selectedNode.deathPlace || '');
    setNewMemberSolarBirthDate(selectedNode.solarBirthDate || '');
    setNewMemberSolarDeathDate(selectedNode.solarDeathDate || '');
    setNewMemberEmail(selectedNode.email || '');
    setIsAddingNode(true);
  };

  // Responsive device checks
  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Recursively gather all ancestors into a flat list for search and filtering
  const flatAncestors = React.useMemo(() => {
    const list: AncestorNode[] = [];
    const traverse = (node: AncestorNode) => {
      list.push(node);
      if (node.children) {
        node.children.forEach(traverse);
      }
    };
    traverse(treeData);
    return list;
  }, [treeData]);

  const parentIdMap = React.useMemo(() => {
    const map: Record<string, string | undefined> = {};
    flatAncestors.forEach((node) => {
      map[node.id] = node.parentId;
    });
    return map;
  }, [flatAncestors]);

  const nodeByIdMap = React.useMemo(() => {
    const map: Record<string, AncestorNode> = {};
    flatAncestors.forEach((node) => {
      map[node.id] = node;
    });
    return map;
  }, [flatAncestors]);

  React.useEffect(() => {
    if (!canViewProfileDetails || selectedNode) return;
    try {
      const pendingId = window.sessionStorage.getItem(PENDING_PROFILE_NODE_STORAGE_KEY);
      if (!pendingId) return;
      const pendingNode = nodeByIdMap[pendingId];
      if (!pendingNode) return;
      setSelectedNode(pendingNode);
      window.sessionStorage.removeItem(PENDING_PROFILE_NODE_STORAGE_KEY);
      if (isMobile || isFullTreeView) {
        setIsMobileModalOpen(true);
      }
    } catch {
      // Ignore restore failures; the user can select the node again.
    }
  }, [canViewProfileDetails, isFullTreeView, isMobile, nodeByIdMap, selectedNode]);

  const isNgoaiTonNode = React.useCallback((node: AncestorNode) => {
    const parent = node.parentId ? nodeByIdMap[node.parentId] : undefined;
    return !!(parent && !isMaleNode(parent));
  }, [nodeByIdMap]);

  const doesNodeMatchSearch = React.useCallback((node: AncestorNode, rawTerm: string) => {
    const term = rawTerm.trim().toLowerCase();
    if (!term) return false;
    const spouseText = [
      node.spouse,
      ...(node.spouseDetails?.map(detail => detail.name) || [])
    ].filter(Boolean).join(' ');

    return [
      node.name,
      node.title,
      node.birthYear,
      node.deathYear,
      node.motherName,
      spouseText,
      node.generation ? `đời ${node.generation}` : ''
    ].some(value => String(value || '').toLowerCase().includes(term));
  }, []);

  const searchMatches = React.useMemo(
    () => flatAncestors.filter(node => doesNodeMatchSearch(node, searchTerm)),
    [flatAncestors, doesNodeMatchSearch, searchTerm]
  );

  const expandAncestorsOfNode = React.useCallback((nodeId: string) => {
    const ancestorIds = new Set<string>();
    let currentParentId = parentIdMap[nodeId];
    while (currentParentId) {
      ancestorIds.add(currentParentId);
      currentParentId = parentIdMap[currentParentId];
    }

    if (ancestorIds.size === 0) return;
    setCollapsedNodes(prev => {
      const next = { ...prev };
      ancestorIds.forEach(id => {
        delete next[id];
      });
      return next;
    });
  }, [parentIdMap]);

  const openProfileLoginForNode = React.useCallback((node?: AncestorNode | null) => {
    setPendingProfileNode(node || null);
    try {
      if (node?.id) {
        window.sessionStorage.setItem(PENDING_PROFILE_NODE_STORAGE_KEY, node.id);
      } else {
        window.sessionStorage.removeItem(PENDING_PROFILE_NODE_STORAGE_KEY);
      }
    } catch {
      // Non-critical; OAuth login can still continue without restoring the selected node.
    }
    setProfileLoginError(webviewAuthSession && !hasVerifiedKyc(webviewAuthSession)
      ? 'Tài khoản đã đăng nhập nhưng chưa được KYC. Vui lòng chờ admin quy chiếu với gia phả và duyệt KYC trước khi xem hồ sơ chi tiết.'
      : '');
    setShowProfileLoginModal(true);
  }, [webviewAuthSession]);

  const openNodeDetails = React.useCallback((node: AncestorNode) => {
    if (!canViewProfileDetails) {
      openProfileLoginForNode(node);
      return;
    }

    setSelectedNode(node);
    if (isMobile || isFullTreeView) {
      setIsMobileModalOpen(true);
    }
  }, [canViewProfileDetails, isFullTreeView, isMobile, openProfileLoginForNode]);

  const selectAndScrollToNode = React.useCallback((node: AncestorNode) => {
    expandAncestorsOfNode(node.id);
    window.setTimeout(() => scrollNodeIntoCanvas(node.id), 120);
  }, [expandAncestorsOfNode, scrollNodeIntoCanvas]);

  const completeProfileLogin = React.useCallback((session: WebviewAuthSession) => {
    setWebviewAuthSession(session);
    setShowProfileLoginModal(false);
    setProfileLoginError('');
    setProfileLoginName('');
    setProfileLoginAccount('');

    if (pendingProfileNode) {
      setSelectedNode(pendingProfileNode);
      try {
        window.sessionStorage.removeItem(PENDING_PROFILE_NODE_STORAGE_KEY);
      } catch {
        // Non-critical.
      }
      if (isMobile || isFullTreeView) {
        setIsMobileModalOpen(true);
      }
    }
    setPendingProfileNode(null);
  }, [isFullTreeView, isMobile, pendingProfileNode]);

  const startOAuthLogin = React.useCallback((provider: WebviewAuthProvider) => {
    setProfileLoginProvider(provider);
    const oauthProvider = provider === 'gmail' ? 'google' : 'zalo';
    window.location.href = `/api/auth/${oauthProvider}/start`;
  }, []);

  const handleProfileLoginSubmit = React.useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = profileLoginName.trim();
    const account = profileLoginAccount.trim();
    if (!name || !account) {
      setProfileLoginError('Vui lòng nhập đủ họ tên và tài khoản đăng nhập.');
      return;
    }

    completeProfileLogin({
      provider: profileLoginProvider,
      name,
      account
    });
  }, [completeProfileLogin, profileLoginAccount, profileLoginName, profileLoginProvider]);

  const handleQuickProfileLogin = React.useCallback((provider: WebviewAuthProvider) => {
    completeProfileLogin({
      provider,
      name: provider === 'zalo' ? 'Khách Zalo' : 'Khách Gmail',
      account: provider === 'zalo' ? 'zalo-demo' : 'gmail-demo@example.com'
    });
  }, [completeProfileLogin]);

  const handleProfileLogout = React.useCallback(() => {
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined).finally(() => {
      setWebviewAuthSession(null);
      setSelectedNode(null);
      setIsMobileModalOpen(false);
    });
  }, []);

  React.useEffect(() => {
    if (!isMobile || canViewProfileDetails || showProfileLoginModal) {
      setShowMobileLoginHint(false);
      return;
    }

    try {
      if (window.sessionStorage.getItem(MOBILE_LOGIN_HINT_STORAGE_KEY) === '1') return;
    } catch {
      // If sessionStorage is unavailable, still show the hint for the current mobile visit.
    }

    setShowMobileLoginHint(true);
  }, [canViewProfileDetails, isMobile, showProfileLoginModal]);

  const dismissMobileLoginHint = React.useCallback(() => {
    setShowMobileLoginHint(false);
    try {
      window.sessionStorage.setItem(MOBILE_LOGIN_HINT_STORAGE_KEY, '1');
    } catch {
      // Non-critical; the hint can be shown again next visit.
    }
  }, []);

  const startMobileHintLogin = React.useCallback(() => {
    dismissMobileLoginHint();
    setPendingProfileNode(selectedNode);
    setProfileLoginError('');
    setShowProfileLoginModal(true);
  }, [dismissMobileLoginHint, selectedNode]);

  const handleSearchSubmit = React.useCallback(() => {
    const firstMatch = searchMatches[0];
    if (firstMatch) {
      selectAndScrollToNode(firstMatch);
    }
  }, [searchMatches, selectAndScrollToNode]);

  // Dynamic lookup for selectedNode's mother details
  const motherDetail = React.useMemo(() => {
    if (!selectedNode || !selectedNode.parentId || !selectedNode.motherName) return null;
    const father = flatAncestors.find(a => a.id === selectedNode.parentId);
    if (!father || !father.spouseDetails) return null;
    const cleanMotherName = selectedNode.motherName.toLowerCase().replace(/\s*\(.*\)\s*/g, '').trim();
    return father.spouseDetails.find(d => {
      const dName = d.name.toLowerCase().replace(/\s*\(.*\)\s*/g, '').trim();
      return dName === cleanMotherName || dName.includes(cleanMotherName) || cleanMotherName.includes(dName);
    }) || null;
  }, [selectedNode, flatAncestors]);

  // Traverses and appends a child
  const handleAddChild = (parentId: string) => {
    if (!newMemberName.trim()) return;

    const traverseAndAdd = (node: AncestorNode): boolean => {
      if (node.id === parentId) {
        const nextGen = node.generation + 1;
        const compiledTitle = formatNodeTitle({
          generation: nextGen,
          isLiving: newMemberIsLiving,
          birthYear: newMemberBirthYear,
          deathYear: newMemberDeathYear,
          rankRole: newMemberRankRole,
          customSuffix: newMemberCustomSuffix
        });

        const newChild: AncestorNode = {
          id: `custom-gen-${Date.now()}`,
          name: newMemberName,
          generation: nextGen,
          parentId: parentId,
          title: compiledTitle,
          rankRole: newMemberRankRole,
          customSuffix: newMemberCustomSuffix,
          birthYear: newMemberBirthYear,
          deathYear: newMemberDeathYear,
          description: newMemberDescription,
          spouse: newMemberSpouse,
          spouseList: newMemberSpouse ? parseSpouses(newMemberSpouse) : [],
          spouseDetails: newMemberSpouse ? [{
            name: newMemberSpouse,
            birthYear: spouseBirthYear,
            deathYear: spouseDeathYear,
            birthPlace: spouseBirthPlace,
            deathPlace: spouseDeathPlace,
            residence: spouseResidence,
            lunarAnniversary: spouseLunarAnniversary,
            phone1: spousePhone1,
            phone2: spousePhone2,
            phone3: spousePhone3,
            isLiving: spouseIsLiving,
            solarBirthDate: spouseSolarBirthDate,
            solarDeathDate: spouseSolarDeathDate,
            birthDateStructured: parseStructuredGenealogyDate(spouseSolarBirthDate || spouseBirthYear, 'solar'),
            deathDateStructured: parseStructuredGenealogyDate(spouseSolarDeathDate || spouseDeathYear, 'solar'),
            deathAnniversaryLunarStructured: parseStructuredGenealogyDate(spouseLunarAnniversary, 'lunar'),
            email: spouseEmail
          }] : [],
          motherName: newMemberMother,
          residence: newMemberResidence,
          isLiving: newMemberIsLiving,
          phone1: newMemberPhone1,
          phone2: newMemberPhone2,
          phone3: newMemberPhone3,
          birthPlace: newMemberBirthPlace,
          deathPlace: newMemberDeathPlace,
          solarBirthDate: newMemberSolarBirthDate,
          solarDeathDate: newMemberSolarDeathDate,
          birthDateStructured: parseStructuredGenealogyDate(newMemberSolarBirthDate || newMemberBirthYear, 'solar'),
          deathDateStructured: parseStructuredGenealogyDate(newMemberSolarDeathDate || newMemberDeathYear, 'solar'),
          deathAnniversaryLunarStructured: parseStructuredGenealogyDate(newMemberLunarAnniversary, 'lunar'),
          email: newMemberEmail,
          gender: newMemberGender,
          children: []
        };
        if (!node.children) node.children = [];
        node.children.push(newChild);
        return true;
      }
      if (node.children) {
        for (const child of node.children) {
          if (traverseAndAdd(child)) return true;
        }
      }
      return false;
    };

    const treeCopy = JSON.parse(JSON.stringify(treeData));
    traverseAndAdd(treeCopy);
    setTreeData(treeCopy);
    savePersistedTreeData(treeCopy);
    
    // Clear form and sync selection back
    setIsAddingNode(false);
    setNewMemberName('');
    setNewMemberRankRole('');
    setNewMemberCustomSuffix('');
    setNewMemberBirthYear('');
    setNewMemberDeathYear('');
    setNewMemberDescription('');
    setNewMemberSpouse('');
    setNewMemberMother('');
    setNewMemberResidence('');
    setNewMemberBurial('');
    setNewMemberLunarAnniversary('');
    setNewMemberIsLiving(false);
    setNewMemberPhone1('');
    setNewMemberPhone2('');
    setNewMemberPhone3('');
    setNewMemberBirthPlace('');
    setNewMemberDeathPlace('');
    setNewMemberSolarBirthDate('');
    setNewMemberSolarDeathDate('');
    setNewMemberEmail('');
    setSpouseEmail('');
    
    // Auto focus the updated parent node to view children
    const updatedAncestor = findNodeById(treeCopy, parentId);
    if (updatedAncestor) setSelectedNode(updatedAncestor);
  };

  // Traverses and adds a spouse
  const handleAddSpouse = (nodeId: string) => {
    if (!newMemberSpouse.trim()) return;

    const traverseAndAddSpouse = (node: AncestorNode): boolean => {
      if (node.id === nodeId) {
        if (node.spouse) {
          node.spouse = `${node.spouse}, ${newMemberSpouse}`;
        } else {
          node.spouse = newMemberSpouse;
        }
        node.spouseList = parseSpouses(node.spouse);

        const newSpouseDetail = {
          name: newMemberSpouse,
          birthYear: spouseBirthYear,
          deathYear: spouseDeathYear,
          birthPlace: spouseBirthPlace,
          deathPlace: spouseDeathPlace,
          residence: spouseResidence,
          lunarAnniversary: spouseLunarAnniversary,
          phone1: spousePhone1,
          phone2: spousePhone2,
          phone3: spousePhone3,
          isLiving: spouseIsLiving,
          solarBirthDate: spouseSolarBirthDate,
          solarDeathDate: spouseSolarDeathDate,
          birthDateStructured: parseStructuredGenealogyDate(spouseSolarBirthDate || spouseBirthYear, 'solar'),
          deathDateStructured: parseStructuredGenealogyDate(spouseSolarDeathDate || spouseDeathYear, 'solar'),
          deathAnniversaryLunarStructured: parseStructuredGenealogyDate(spouseLunarAnniversary, 'lunar'),
          email: spouseEmail
        };

        if (!node.spouseDetails) node.spouseDetails = [];
        node.spouseDetails.push(newSpouseDetail);
        return true;
      }
      if (node.children) {
        for (const child of node.children) {
          if (traverseAndAddSpouse(child)) return true;
        }
      }
      return false;
    };

    const treeCopy = JSON.parse(JSON.stringify(treeData));
    traverseAndAddSpouse(treeCopy);
    setTreeData(treeCopy);
    savePersistedTreeData(treeCopy);
    
    setIsAddingNode(false);
    setNewMemberSpouse('');
    setSpouseBirthYear('');
    setSpouseDeathYear('');
    setSpouseBirthPlace('');
    setSpouseDeathPlace('');
    setSpouseResidence('');
    setSpouseLunarAnniversary('');
    setSpousePhone1('');
    setSpousePhone2('');
    setSpousePhone3('');
    setSpouseIsLiving(false);
    setSpouseSolarBirthDate('');
    setSpouseSolarDeathDate('');
    setSpouseEmail('');
    
    const updatedAncestor = findNodeById(treeCopy, nodeId);
    if (updatedAncestor) setSelectedNode(updatedAncestor);
  };

  // Traverses and edits a spouse
  const handleEditSpouse = (nodeId: string) => {
    if (!newMemberSpouse.trim() || !editingSpouseOriginalName) return;

    const traverseAndEditSpouse = (node: AncestorNode): boolean => {
      if (node.id === nodeId) {
        // Update name in spouse list
        const spousesList = parseSpouses(node.spouse || '');
        const spouseIdx = spousesList.findIndex(s => s === editingSpouseOriginalName);
        if (spouseIdx !== -1) {
          spousesList[spouseIdx] = newMemberSpouse;
        }
        node.spouse = spousesList.join(', ');
        node.spouseList = spousesList;

        const updatedDetail = {
          name: newMemberSpouse,
          birthYear: spouseBirthYear,
          deathYear: spouseDeathYear,
          birthPlace: spouseBirthPlace,
          deathPlace: spouseDeathPlace,
          residence: spouseResidence,
          lunarAnniversary: spouseLunarAnniversary,
          phone1: spousePhone1,
          phone2: spousePhone2,
          phone3: spousePhone3,
          isLiving: spouseIsLiving,
          solarBirthDate: spouseSolarBirthDate,
          solarDeathDate: spouseSolarDeathDate,
          birthDateStructured: parseStructuredGenealogyDate(spouseSolarBirthDate || spouseBirthYear, 'solar'),
          deathDateStructured: parseStructuredGenealogyDate(spouseSolarDeathDate || spouseDeathYear, 'solar'),
          deathAnniversaryLunarStructured: parseStructuredGenealogyDate(spouseLunarAnniversary, 'lunar'),
          email: spouseEmail
        };

        if (!node.spouseDetails) node.spouseDetails = [];
        const detailIndex = node.spouseDetails.findIndex(d => {
          const dName = d.name.toLowerCase().replace(/\s*\(.*\)\s*/g, '').trim();
          const cleanOriginalName = editingSpouseOriginalName.toLowerCase().replace(/\s*\(.*\)\s*/g, '').trim();
          return dName === cleanOriginalName || dName.includes(cleanOriginalName) || cleanOriginalName.includes(dName);
        });

        if (detailIndex !== -1) {
          node.spouseDetails[detailIndex] = updatedDetail;
        } else {
          node.spouseDetails.push(updatedDetail);
        }
        return true;
      }
      if (node.children) {
        for (const child of node.children) {
          if (traverseAndEditSpouse(child)) return true;
        }
      }
      return false;
    };

    const treeCopy = JSON.parse(JSON.stringify(treeData));
    traverseAndEditSpouse(treeCopy);
    setTreeData(treeCopy);
    savePersistedTreeData(treeCopy);
    
    setIsAddingNode(false);
    setNewMemberSpouse('');
    setSpouseBirthYear('');
    setSpouseDeathYear('');
    setSpouseBirthPlace('');
    setSpouseDeathPlace('');
    setSpouseResidence('');
    setSpouseLunarAnniversary('');
    setSpousePhone1('');
    setSpousePhone2('');
    setSpousePhone3('');
    setSpouseIsLiving(false);
    setSpouseSolarBirthDate('');
    setSpouseSolarDeathDate('');
    setSpouseEmail('');
    setEditingSpouseOriginalName(null);
    
    const updatedAncestor = findNodeById(treeCopy, nodeId);
    if (updatedAncestor) setSelectedNode(updatedAncestor);
  };

  // Traverses and edits a node
  const handleEditNode = (nodeId: string) => {
    const traverseAndEdit = (node: AncestorNode): boolean => {
      if (node.id === nodeId) {
        node.name = newMemberName;
        node.rankRole = newMemberRankRole;
        node.customSuffix = newMemberCustomSuffix;
        node.title = formatNodeTitle({
          generation: node.generation,
          isLiving: newMemberIsLiving,
          birthYear: newMemberBirthYear,
          deathYear: newMemberDeathYear,
          rankRole: newMemberRankRole,
          customSuffix: newMemberCustomSuffix
        });
        node.birthYear = newMemberBirthYear;
        node.deathYear = newMemberDeathYear;
        node.birthPlace = newMemberBirthPlace;
        node.deathPlace = newMemberDeathPlace;
        node.description = newMemberDescription;
        node.residence = newMemberResidence;
        node.burialPlace = newMemberBurial;
        node.lunarAnniversary = newMemberLunarAnniversary;
        node.isLiving = newMemberIsLiving;
        node.phone1 = newMemberPhone1;
        node.phone2 = newMemberPhone2;
        node.phone3 = newMemberPhone3;
        node.solarBirthDate = newMemberSolarBirthDate;
        node.solarDeathDate = newMemberSolarDeathDate;
        node.birthDateStructured = parseStructuredGenealogyDate(newMemberSolarBirthDate || newMemberBirthYear, 'solar');
        node.deathDateStructured = parseStructuredGenealogyDate(newMemberSolarDeathDate || newMemberDeathYear, 'solar');
        node.deathAnniversaryLunarStructured = parseStructuredGenealogyDate(newMemberLunarAnniversary, 'lunar');
        node.email = newMemberEmail;
        node.gender = newMemberGender;
        syncSpouseDetailsFromText(node, newMemberSpouse);
        return true;
      }
      if (node.children) {
        for (const child of node.children) {
          if (traverseAndEdit(child)) return true;
        }
      }
      return false;
    };

    const treeCopy = JSON.parse(JSON.stringify(treeData));
    traverseAndEdit(treeCopy);
    setTreeData(treeCopy);
    savePersistedTreeData(treeCopy);
    
    setIsAddingNode(false);
    
    const updatedAncestor = findNodeById(treeCopy, nodeId);
    if (updatedAncestor) setSelectedNode(updatedAncestor);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNode) return;
    if (addType === 'child') {
      handleAddChild(selectedNode.id);
    } else if (addType === 'spouse') {
      handleAddSpouse(selectedNode.id);
    } else if (addType === 'edit_spouse') {
      handleEditSpouse(selectedNode.id);
    } else if (addType === 'edit') {
      handleEditNode(selectedNode.id);
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Default password is empty/admin but provide automatic direct fast-pass bypass for developers
    if (adminPasswordInput.trim() === '123') {
      setIsAdmin(true);
      setShowAdminLoginModal(false);
      setAdminLoginError('');
      setAdminPasswordInput('');
    } else {
      setAdminLoginError('Sai mật mã định danh. Nhập "123" để tiếp tục.');
    }
  };

  // Toggle Collapse on specific ancestor nodes
  const toggleCollapse = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedNodes(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Expand all nodes
  const handleExpandAll = () => {
    setCollapsedNodes({});
  };

  // Collapse all nodes except root
  const handleCollapseAll = () => {
    const list: Record<string, boolean> = {};
    const traverse = (node: AncestorNode) => {
      if (node.id !== treeData.id) {
        list[node.id] = true;
      }
      if (node.children) {
        node.children.forEach(traverse);
      }
    };
    traverse(treeData);
    setCollapsedNodes(list);
  };

  // Dynamic search tracking highlight
  const isSearchMatched = (node: AncestorNode) => {
    return doesNodeMatchSearch(node, searchTerm);
  };

  const connectorThickness = Math.max(1, Number(settings.treeLineThickness) || 1);
  const connectorBase = {
    backgroundColor: settings.treeLineColor,
    opacity: 0.74,
    borderRadius: 999
  };
  const connectorHorizontalStyle = (width: string = 'auto'): React.CSSProperties => ({
    ...connectorBase,
    width,
    height: `${connectorThickness}px`
  });
  const connectorVerticalStyle = (height: string): React.CSSProperties => ({
    ...connectorBase,
    width: `${connectorThickness}px`,
    height
  });

  // RECURSIVE RENDERER FOR VERTICAL TREE DESCENDANT
  const renderVerticalNode = (node: AncestorNode): React.ReactNode => {
    const childNodes = (node.children || []).filter(child => child?.name?.trim());
    const hasChildren = childNodes.length > 0;
    const isCollapsed = collapsedNodes[node.id];
    const isSelected = selectedNode?.id === node.id;
    const matched = isSearchMatched(node);
    const spouses = getSpouseNames(node);
    const ancestralTierLabel = getAncestralTierLabel(node.generation);
    const ancestralPrimaryTextClass = node.generation <= 0 ? '!text-[#fff8df]' : node.generation === 1 ? '!text-primary' : '';
    const ancestralSecondaryTextClass = node.generation <= 0 ? '!text-[#ffe8a8]' : node.generation === 1 ? '!text-[#7b5800]' : '';
    const ancestralMetaTextClass = node.generation <= 0 ? '!text-[#fff2c4]' : node.generation === 1 ? '!text-ink-charcoal/60' : '';
    const confirmedLineageTextClass = node.generation <= 0 ? '!text-[#f8d56a]' : node.generation === 1 ? '!text-rose-900' : '';
    const unknownLineageTextClass = (value?: string) => {
      if (!isUnknownText(value)) return '';
      if (node.generation <= 0) return '!text-[#fff8df]';
      if (node.generation === 1) return isSelected ? 'text-silk-paper/90' : 'text-rose-900';
      return '';
    };
    
    // Living state check: true if marked isLiving or if there is no year of death recorded
    const isLiving = node.isLiving || (!node.deathYear && node.birthYear && parseInt(node.birthYear) > 1920);

    const dynamicSpec = clanLeaderRuleActive ? leaderSpecsMap[node.id] : undefined;
    const effectiveRankRole = isNgoaiTonNode(node) ? 'Ngoại tôn' : dynamicSpec?.role;
    const formattedTitle = effectiveRankRole 
      ? formatNodeTitle({
          generation: node.generation,
          isLiving: node.isLiving,
          birthYear: node.birthYear,
          deathYear: node.deathYear,
          rankRole: effectiveRankRole,
          customSuffix: node.customSuffix
        })
      : formatNodeTitle(node);

    const titleLower = formattedTitle.toLowerCase();
    
    let isTruongToc = false;
    let isTruongNam = false;
    let isDichTon = false;

    if (clanLeaderRuleActive && dynamicSpec && !isNgoaiTonNode(node)) {
      isTruongToc = dynamicSpec.role === 'Trưởng tộc';
      isTruongNam = dynamicSpec.role === 'Trưởng nam';
      isDichTon = dynamicSpec.role === 'Đích tôn';
    } else {
      isTruongToc = titleLower.includes('trưởng tộc');
      isTruongNam = titleLower.includes('trưởng nam');
      isDichTon = titleLower.includes('đích tôn');
    }

    // Dynamic borders and backgrounds
    let cardClasses = `transition-all duration-300 relative select-none cursor-pointer text-center border p-2.5 hover:shadow-md ${settings.nodeBorderRadius} `;
    if (isSelected) {
      cardClasses += "bg-primary text-silk-paper shadow-lg scale-105 z-20 ";
      if (isLiving) {
        if (isTruongToc) {
          cardClasses += "border-red-500 ring-2 ring-red-400/60 shadow-[0_0_12px_rgba(239,68,68,0.6)] ";
        } else if (isTruongNam) {
          cardClasses += "border-orange-500 ring-2 ring-orange-400/60 shadow-[0_0_12px_rgba(249,115,22,0.6)] ";
        } else if (isDichTon) {
          cardClasses += "border-blue-500 ring-2 ring-blue-400/60 shadow-[0_0_12px_rgba(59,130,246,0.6)] ";
        } else {
          cardClasses += "border-amber-400 ring-2 ring-amber-300/60 shadow-[0_0_12px_rgba(245,158,11,0.6)] ";
        }
      } else {
        if (isTruongToc) {
          cardClasses += "border-red-300/80 ring-1 ring-red-300/40 shadow-[0_0_8px_rgba(239,68,68,0.4)] ";
        } else if (isTruongNam) {
          cardClasses += "border-orange-300/80 ring-1 ring-orange-300/40 shadow-[0_0_8px_rgba(249,115,22,0.4)] ";
        } else {
          cardClasses += "border-primary ";
        }
      }
    } else {
      if (isLiving) {
        if (isTruongToc) {
          cardClasses += "bg-red-50/10 border-red-500 text-ink-charcoal shadow-[0_0_8px_rgba(239,68,68,0.25)] ring-1 ring-red-500/30 hover:bg-red-50/20 ";
        } else if (isTruongNam) {
          cardClasses += "bg-orange-50/10 border-orange-500 text-ink-charcoal shadow-[0_0_8px_rgba(249,115,22,0.25)] ring-1 ring-orange-500/30 hover:bg-orange-50/20 ";
        } else if (isDichTon) {
          cardClasses += "bg-blue-50/10 border-blue-500 text-ink-charcoal shadow-[0_0_8px_rgba(59,130,246,0.25)] ring-1 ring-blue-500/30 hover:bg-blue-50/20 ";
        } else {
          cardClasses += "bg-amber-50/10 border-amber-400 text-ink-charcoal shadow-[0_0_8px_rgba(245,158,11,0.25)] ring-1 ring-amber-400/30 hover:bg-amber-50/20 ";
        }
      } else {
        if (isTruongToc) {
          cardClasses += "bg-white border-red-200 text-ink-charcoal shadow-[0_0_6px_rgba(239,68,68,0.1)] hover:border-red-300/80 ";
        } else if (isTruongNam) {
          cardClasses += "bg-white border-orange-200 text-ink-charcoal shadow-[0_0_6px_rgba(249,115,22,0.1)] hover:border-orange-300/80 ";
        } else if (matched) {
          cardClasses += "bg-secondary/10 border-secondary text-primary shadow-sm hover:bg-secondary/20 ";
        } else {
          cardClasses += "bg-white border-[#8c716e]/25 text-ink-charcoal hover:border-primary/50 ";
        }
      }
    }
    if (ancestralTierLabel) {
      cardClasses += `${getAncestralTierClassName(node.generation)} `;
    }

    const handleClickNode = () => {
      openNodeDetails(node);
    };

    return (
      <div key={node.id} className="flex flex-col items-center relative" id={`vt-node-col-${node.id}`}>
        {/* Node visual card box container */}
        <div 
          onClick={handleClickNode}
          className={cardClasses}
          id={`vt-node-card-${node.id}`}
          style={{ width: isMobile ? '135px' : `${settings.treeNodeWidth}px` }}
        >
          {/* Tag indicating generation centered at the top */}
          <span className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-[8px] font-mono rounded-full px-2 py-0.5 font-bold uppercase tracking-wider whitespace-nowrap shadow-sm border ${
            ancestralTierLabel
              ? node.generation <= 0
                ? 'bg-[#7f1f1b] border-[#d8b765]/80 text-[#fff8df]'
                : 'bg-[#f4e2a9] border-[#c89b3c]/75 text-[#7b5800]'
              : isSelected 
                ? 'bg-[#ffe4a4] border-amber-500 text-primary' 
                : 'bg-[#eeeee9] border-black/5 text-[#7b5800]'
          }`}>
            {ancestralTierLabel || `Đời ${node.generation}`}
          </span>

          {clanLeaderRuleActive && dynamicSpec?.dot && (
            <span 
              className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full ring-2 shadow-sm animate-pulse ${
                dynamicSpec.dot === 'green' 
                  ? 'bg-green-500 ring-green-300' 
                  : 'bg-blue-500 ring-blue-300'
              }`}
              title={dynamicSpec.dot === 'green' ? 'Người kế vị lâm thời (Dấu chấm xanh lá)' : 'Hậu duệ kế vị lâm thời (Dấu chấm xanh lam)'}
            />
          )}

          <div className="space-y-1 mt-1">
            {/* Full Name */}
            <h4 className={`font-serif text-[11px] md:text-[13px] font-bold tracking-tight line-clamp-1 leading-normal ${
              ancestralPrimaryTextClass || (isSelected ? 'text-silk-paper' : 'text-primary')
            }`}>
              {node.name}
            </h4>
            
            {/* Title / Rank */}
            {formattedTitle && (
              <p className={`text-[8.5px] md:text-[9.5px] font-sans font-semibold tracking-wide uppercase line-clamp-1 ${
                ancestralSecondaryTextClass || (isSelected ? 'text-silk-paper/85' : 'text-secondary')
              }`}>
                {formattedTitle}
              </p>
            )}

            {/* Birth/Death Year Correct Format (Sinh - Mất) */}
            <p className={`text-[8px] md:text-[9px] font-mono flex items-center justify-center space-x-0.5 ${
              ancestralMetaTextClass || (isSelected ? 'text-silk-paper/70' : 'text-ink-charcoal/40')
            }`}>
              <Calendar className="w-2.5 h-2.5" />
              <span>
                {node.birthYear || '?'} – {isLiving ? 'Còn sống' : (node.deathYear || '?')}
              </span>
            </p>

            {/* Maternal Lineage Distinction: Clarifies multi-wife children relationship */}
            {node.motherName && (
              <div className={`text-[8px] font-sans italic border-t border-dotted mt-1.5 pt-1 flex items-center justify-center gap-0.5 ${
                isSelected ? 'text-silk-paper/60 border-silk-paper/25' : 'text-rose-950/70 border-ink-charcoal/10'
              }`} title={`Con của bà ${node.motherName}`}>
                <span className={`font-semibold text-[8px] not-italic scale-90 px-0.5 border rounded ${
                  'bg-rose-50 border-rose-100/50 text-rose-800'
                }`}>Mẹ</span>
                <span className={`line-clamp-1 ${isUnknownText(node.motherName) ? `animate-pulse font-semibold ${unknownLineageTextClass(node.motherName)}` : confirmedLineageTextClass}`}>
                  {node.motherName.replace(/\(.*\)/, '').trim()}
                </span>
              </div>
            )}

            {/* Spouses overview indicators (Wives) */}
            {spouses.length > 0 && (
              <div className="flex flex-col gap-0.5 pt-1 mt-1 border-t border-dotted border-ink-charcoal/10 w-full text-left">
                {spouses.map((sp, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center justify-between text-[7.5px] md:text-[8px] w-full gap-1"
                  >
                    <span 
                      className={`inline-flex items-center space-x-0.5 truncate max-w-[65%] font-medium ${
                        isSelected ? 'text-silk-paper/90' : 'text-rose-900'
                      }`}
                      title={sp}
                    >
                      <Heart className="w-1.5 h-1.5 shrink-0 text-rose-500 fill-rose-500" />
                      <span className={`truncate ${isUnknownText(sp) ? `animate-pulse font-semibold ${unknownLineageTextClass(sp)}` : confirmedLineageTextClass}`}>
                        {sp.replace(/\(.*\)/, '').trim()}
                      </span>
                    </span>
                    {!isUnknownText(sp) && (
                      <span 
                        className={`text-[6.5px] md:text-[7px] font-mono leading-none shrink-0 border rounded px-0.5 scale-90 ${
                          isSelected 
                            ? node.generation === 1
                              ? 'bg-[#f4e2a9]/90 border-[#c89b3c]/70 text-rose-900 font-semibold'
                              : 'bg-silk-paper/20 border-silk-paper/30 text-silk-paper font-semibold' 
                            : 'bg-rose-100/50 border-rose-200/50 text-rose-850 font-semibold'
                        }`}
                      >
                        {node.gender === 'nữ' ? (spouses.length <= 1 ? 'Chồng' : (idx === 0 ? 'Chồng đầu' : 'Chồng thứ')) : (idx === 0 ? 'Chính thất' : idx === 1 ? 'Thứ thất' : `Cung thất`)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Expand/Collapse controller button */}
          {hasChildren && (
            <button
              onClick={(e) => toggleCollapse(node.id, e)}
              className={`absolute -bottom-2 right-1 lg:right-auto lg:left-1/2 lg:-translate-x-1/2 w-4.5 h-4.5 rounded-full border flex items-center justify-center shadow-md transition-colors ${
                isSelected 
                  ? 'bg-secondary border-primary text-silk-paper' 
                  : 'bg-white border-[#8c716e]/20 text-secondary hover:bg-silk-paper'
              }`}
            >
              {isCollapsed ? <ChevronRight className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
            </button>
          )}
        </div>

        {/* Connector lines to children dynamically rendered via relative position elements */}
        {hasChildren && !isCollapsed && (
          <div className="flex flex-col items-center w-full" id={`vt-node-branches-${node.id}`}>
            {/* Split parent bottom vertical node line */}
            <div style={connectorVerticalStyle('24px')}></div>

            {/* Horizontal line row container */}
            <div className="flex justify-center relative w-full">
              {childNodes.map((child, idx) => {
                const totalKids = childNodes.length;
                return (
                  <div key={child.id} className="relative flex flex-col items-center pt-6" style={{ minWidth: isMobile ? '140px' : `${settings.treeSpacingX}px` }}>
                    
                    {/* Horizontal link spanning across children */}
                    {totalKids > 1 && (
                      <div 
                        className={`absolute top-0 ${
                          idx === 0 
                            ? 'right-0 left-1/2' 
                            : idx === totalKids - 1 
                              ? 'left-0 right-1/2' 
                              : 'left-0 right-0'
                        }`} 
                        style={connectorHorizontalStyle()}
                      />
                    )}

                    {/* Small vertical link coming from above into each child card top */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2" style={connectorVerticalStyle('24px')}></div>

                    {/* Recursive tree call */}
                    {renderVerticalNode(child)}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // RECURSIVE RENDERER FOR HORIZONTAL LINEAGE NAVIGATION
  const renderHorizontalNode = (node: AncestorNode): React.ReactNode => {
    const childNodes = (node.children || []).filter(child => child?.name?.trim());
    const hasChildren = childNodes.length > 0;
    const isCollapsed = collapsedNodes[node.id];
    const isSelected = selectedNode?.id === node.id;
    const matched = isSearchMatched(node);
    const spouses = getSpouseNames(node);
    const ancestralTierLabel = getAncestralTierLabel(node.generation);
    const ancestralPrimaryTextClass = node.generation <= 0 ? '!text-[#fff8df]' : node.generation === 1 ? '!text-primary' : '';
    const ancestralSecondaryTextClass = node.generation <= 0 ? '!text-[#ffe8a8]' : node.generation === 1 ? '!text-[#7b5800]' : '';
    const ancestralMetaTextClass = node.generation <= 0 ? '!text-[#fff2c4]' : node.generation === 1 ? '!text-ink-charcoal/60' : '';
    const confirmedLineageTextClass = node.generation <= 0 ? '!text-[#f8d56a]' : node.generation === 1 ? '!text-rose-900' : '';
    const unknownLineageTextClass = (value?: string) => {
      if (!isUnknownText(value)) return '';
      if (node.generation <= 0) return '!text-[#fff8df]';
      if (node.generation === 1) return isSelected ? 'text-silk-paper/90' : 'text-rose-900';
      return '';
    };

    // Living state check: true if marked isLiving or if there is no year of death recorded
    const isLiving = node.isLiving || (!node.deathYear && node.birthYear && parseInt(node.birthYear) > 1920);

    const dynamicSpec = clanLeaderRuleActive ? leaderSpecsMap[node.id] : undefined;
    const effectiveRankRole = isNgoaiTonNode(node) ? 'Ngoại tôn' : dynamicSpec?.role;
    const formattedTitle = effectiveRankRole 
      ? formatNodeTitle({
          generation: node.generation,
          isLiving: node.isLiving,
          birthYear: node.birthYear,
          deathYear: node.deathYear,
          rankRole: effectiveRankRole,
          customSuffix: node.customSuffix
        })
      : formatNodeTitle(node);

    const titleLower = formattedTitle.toLowerCase();
    
    let isTruongToc = false;
    let isTruongNam = false;
    let isDichTon = false;

    if (clanLeaderRuleActive && dynamicSpec && !isNgoaiTonNode(node)) {
      isTruongToc = dynamicSpec.role === 'Trưởng tộc';
      isTruongNam = dynamicSpec.role === 'Trưởng nam';
      isDichTon = dynamicSpec.role === 'Đích tôn';
    } else {
      isTruongToc = titleLower.includes('trưởng tộc');
      isTruongNam = titleLower.includes('trưởng nam');
      isDichTon = titleLower.includes('đích tôn');
    }

    // Dynamic borders and backgrounds
    let cardClasses = "transition-all duration-300 relative select-none cursor-pointer rounded-md border p-2.5 w-[140px] md:w-[165px] hover:shadow-md ";
    if (isSelected) {
      cardClasses += "bg-primary text-silk-paper shadow-lg scale-105 z-20 ";
      if (isLiving) {
        if (isTruongToc) {
          cardClasses += "border-red-500 ring-2 ring-red-400/60 shadow-[0_0_12px_rgba(239,68,68,0.6)] ";
        } else if (isTruongNam) {
          cardClasses += "border-orange-500 ring-2 ring-orange-400/60 shadow-[0_0_12px_rgba(249,115,22,0.6)] ";
        } else if (isDichTon) {
          cardClasses += "border-blue-500 ring-2 ring-blue-400/60 shadow-[0_0_12px_rgba(59,130,246,0.6)] ";
        } else {
          cardClasses += "border-amber-400 ring-2 ring-amber-300/60 shadow-[0_0_12px_rgba(245,158,11,0.6)] ";
        }
      } else {
        if (isTruongToc) {
          cardClasses += "border-red-300/80 ring-1 ring-red-300/40 shadow-[0_0_8px_rgba(239,68,68,0.4)] ";
        } else if (isTruongNam) {
          cardClasses += "border-orange-300/80 ring-1 ring-orange-300/40 shadow-[0_0_8px_rgba(249,115,22,0.4)] ";
        } else {
          cardClasses += "border-primary ";
        }
      }
    } else {
      if (isLiving) {
        if (isTruongToc) {
          cardClasses += "bg-red-50/10 border-red-500 text-ink-charcoal shadow-[0_0_8px_rgba(239,68,68,0.25)] ring-1 ring-red-500/30 hover:bg-red-50/20 ";
        } else if (isTruongNam) {
          cardClasses += "bg-orange-50/10 border-orange-500 text-ink-charcoal shadow-[0_0_8px_rgba(249,115,22,0.25)] ring-1 ring-orange-500/30 hover:bg-orange-50/20 ";
        } else if (isDichTon) {
          cardClasses += "bg-blue-50/10 border-blue-500 text-ink-charcoal shadow-[0_0_8px_rgba(59,130,246,0.25)] ring-1 ring-blue-500/30 hover:bg-blue-50/20 ";
        } else {
          cardClasses += "bg-amber-50/10 border-amber-400 text-ink-charcoal shadow-[0_0_8px_rgba(245,158,11,0.25)] ring-1 ring-amber-400/30 hover:bg-amber-50/20 ";
        }
      } else {
        if (isTruongToc) {
          cardClasses += "bg-white border-red-200 text-ink-charcoal shadow-[0_0_6px_rgba(239,68,68,0.1)] hover:border-red-300/80 ";
        } else if (isTruongNam) {
          cardClasses += "bg-white border-orange-200 text-ink-charcoal shadow-[0_0_6px_rgba(249,115,22,0.1)] hover:border-orange-300/80 ";
        } else if (matched) {
          cardClasses += "bg-secondary/10 border-secondary text-primary shadow-sm hover:bg-secondary/20 ";
        } else {
          cardClasses += "bg-white border-[#8c716e]/25 text-ink-charcoal hover:border-primary/50 ";
        }
      }
    }
    if (ancestralTierLabel) {
      cardClasses += `${getAncestralTierClassName(node.generation)} `;
    }

    const handleClickNode = () => {
      openNodeDetails(node);
    };

    return (
      <div key={node.id} className="flex items-center relative py-2" id={`hz-node-row-${node.id}`}>
        {/* Node card */}
        <div 
          onClick={handleClickNode}
          className={cardClasses}
          id={`hz-node-card-${node.id}`}
        >
          {/* Tag indicating generation centered at top of card */}
          <span className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-[8px] font-mono rounded-full px-2 py-0.5 font-bold uppercase tracking-wider whitespace-nowrap shadow-sm border ${
            ancestralTierLabel
              ? node.generation <= 0
                ? 'bg-[#7f1f1b] border-[#d8b765]/80 text-[#fff8df]'
                : 'bg-[#f4e2a9] border-[#c89b3c]/75 text-[#7b5800]'
              : isSelected 
                ? 'bg-[#ffe4a4] border-amber-500 text-primary' 
                : 'bg-[#eeeee9] border-black/5 text-[#7b5800]'
          }`}>
            {ancestralTierLabel || `Đời ${node.generation}`}
          </span>

          {clanLeaderRuleActive && dynamicSpec?.dot && (
            <span 
              className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full ring-2 shadow-sm animate-pulse ${
                dynamicSpec.dot === 'green' 
                  ? 'bg-green-500 ring-green-300' 
                  : 'bg-blue-500 ring-blue-300'
              }`}
              title={dynamicSpec.dot === 'green' ? 'Người kế vị lâm thời (Dấu chấm xanh lá)' : 'Hậu duệ kế vị lâm thời (Dấu chấm xanh lam)'}
            />
          )}

          <div className="space-y-1 mt-1 text-left">
            <h4 className={`font-serif text-[11px] md:text-[13px] font-bold tracking-tight line-clamp-1 leading-normal ${ancestralPrimaryTextClass || (isSelected ? 'text-silk-paper' : 'text-primary')}`}>
              {node.name}
            </h4>
            
            {formattedTitle && (
              <p className={`text-[8.5px] md:text-[9.5px] font-sans font-semibold uppercase line-clamp-1 ${
                ancestralSecondaryTextClass || (isSelected ? 'text-silk-paper/85' : 'text-secondary')
              }`}>
                {formattedTitle}
              </p>
            )}

            <p className={`text-[8px] md:text-[9px] font-mono flex items-center space-x-0.5 ${
              ancestralMetaTextClass || (isSelected ? 'text-silk-paper/70' : 'text-ink-charcoal/40')
            }`}>
              <Calendar className="w-2.5 h-2.5 border-none" />
              <span>
                {node.birthYear || '?'} – {isLiving ? 'Còn sống' : (node.deathYear || '?')}
              </span>
            </p>

            {/* Maternal distinction details */}
            {node.motherName && (
              <div className={`text-[8px] font-sans italic border-t border-dotted mt-1 pt-1 flex items-center gap-0.5 ${
                isSelected ? 'text-silk-paper/60 border-silk-paper/25' : 'text-rose-950/70 border-ink-charcoal/10'
              }`} title={`Con của bà ${node.motherName}`}>
                <span className={`font-semibold text-[8px] scale-90 px-0.5 border rounded ${
                  'bg-rose-50 border-rose-100/50 text-rose-800'
                }`}>Mẹ</span>
                <span className={`line-clamp-1 ${isUnknownText(node.motherName) ? `animate-pulse font-semibold ${unknownLineageTextClass(node.motherName)}` : confirmedLineageTextClass}`}>
                  {node.motherName.replace(/\(.*\)/, '').trim()}
                </span>
              </div>
            )}

            {/* Spouses overview indicators */}
            {spouses.length > 0 && (
              <div className="flex flex-col gap-0.5 pt-1 mt-1 border-t border-dotted border-ink-charcoal/10 w-full text-left">
                {spouses.map((sp, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center justify-between text-[7.5px] md:text-[8px] w-full gap-1"
                  >
                    <span 
                      className={`inline-flex items-center space-x-0.5 truncate max-w-[65%] font-medium ${
                        isSelected ? 'text-silk-paper/90' : 'text-rose-900'
                      }`}
                      title={sp}
                    >
                      <Heart className="w-1.5 h-1.5 shrink-0 text-rose-500 fill-rose-500" />
                      <span className={`truncate ${isUnknownText(sp) ? `animate-pulse font-semibold ${unknownLineageTextClass(sp)}` : confirmedLineageTextClass}`}>
                        {sp.replace(/\(.*\)/, '').trim()}
                      </span>
                    </span>
                    {!isUnknownText(sp) && (
                      <span 
                        className={`text-[6.5px] md:text-[7px] font-mono leading-none shrink-0 border rounded px-0.5 scale-90 ${
                          isSelected 
                            ? node.generation === 1
                              ? 'bg-[#f4e2a9]/90 border-[#c89b3c]/70 text-rose-900 font-semibold'
                              : 'bg-silk-paper/20 border-silk-paper/30 text-silk-paper font-semibold' 
                            : 'bg-rose-100/50 border-rose-200/50 text-rose-850 font-semibold'
                        }`}
                      >
                        {node.gender === 'nữ' ? (spouses.length <= 1 ? 'Chồng' : (idx === 0 ? 'Chồng đầu' : 'Chồng thứ')) : (idx === 0 ? 'Chính thất' : idx === 1 ? 'Thứ thất' : `Cung thất`)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Collapse switch on horizontal edge */}
          {hasChildren && (
            <button
              onClick={(e) => toggleCollapse(node.id, e)}
              className={`absolute -right-2 top-1/2 -translate-y-1/2 w-4.5 h-4.5 rounded-full border flex items-center justify-center shadow-md transition-colors ${
                isSelected 
                  ? 'bg-secondary border-primary text-silk-paper font-bold' 
                  : 'bg-white border-[#8c716e]/20 text-secondary hover:bg-silk-paper'
              }`}
            >
              {isCollapsed ? <ChevronRight className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
            </button>
          )}
        </div>

        {/* Split connector paths into descendant child column list */}
        {hasChildren && !isCollapsed && (
          <div className="flex items-center" id={`hz-node-branches-${node.id}`}>
            {/* Outgoing horizontal line from current parent card right to grandchildren column */}
            <div style={connectorHorizontalStyle('22px')}></div>

            {/* Child column. The vertical rail only spans first child center to last child center. */}
            <div className="flex flex-col relative">
              {childNodes.map((child, idx) => {
                const totalKids = childNodes.length;
                return (
                  <div key={child.id} className="relative flex items-center pl-5 py-1">
                    {totalKids > 1 && (
                      <div
                        className={`absolute left-0 ${
                          idx === 0
                            ? 'top-1/2 bottom-0'
                            : idx === totalKids - 1
                              ? 'top-0 bottom-1/2'
                              : 'top-0 bottom-0'
                        }`}
                        style={{
                          ...connectorBase,
                          width: `${connectorThickness}px`
                        }}
                      />
                    )}
                    {/* Branch segment enters the child card at the middle of its left border. */}
                    <div className="absolute top-1/2 -translate-y-1/2 left-0" style={connectorHorizontalStyle('20px')}></div>
                    {renderHorizontalNode(child)}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const selectedNodeIsLiving = selectedNode
    ? (selectedNode.isLiving || (!selectedNode.deathYear && selectedNode.birthYear && parseInt(selectedNode.birthYear) > 1920))
    : false;
  const effectiveLunarAnniversary = selectedNode
    ? (selectedNode.lunarAnniversary || deriveLunarAnniversaryFromSolarDeathDate(selectedNode.solarDeathDate))
    : '';
  const anniversaryInfo = (selectedNode && !selectedNodeIsLiving && effectiveLunarAnniversary)
    ? getAnniversaryCountdown(effectiveLunarAnniversary)
    : null;
  const selectedSpouses = selectedNode ? getSpouseNames(selectedNode) : [];

  return (
    <div className="space-y-8 animate-fade-in" id="giapha-root-box">
      {/* Editorial Top Line and Filter actions */}
      <section className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 border-b border-[#8c716e]/10 pb-6">
        <TreeSectionHeader />

        <TreeToolbar
          zoomLevel={zoomLevel}
          orientation={orientation}
          isFullTreeView={isFullTreeView}
          isAdmin={isAdmin}
          clanLeaderRuleActive={clanLeaderRuleActive}
          onZoomOut={zoomOut}
          onZoomIn={zoomIn}
          onResetZoom={resetZoom}
          onOrientationChange={setOrientation}
          onToggleFullTreeView={() => setIsFullTreeView(prev => !prev)}
          onExpandAll={handleExpandAll}
          onCollapseAll={handleCollapseAll}
          onAdminButtonClick={() => {
            if (isAdmin) {
              setIsAdmin(false);
              setClanLeaderRuleActive(false);
            } else {
              setShowAdminLoginModal(true);
            }
          }}
          onToggleClanLeaderRule={() => setClanLeaderRuleActive(prev => !prev)}
        />
      </section>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-md border border-[#8c716e]/15 bg-[#fffdf7] px-4 py-3 shadow-sm">
        <div>
          <p className="font-serif text-sm font-bold text-primary">
            {canViewProfileDetails ? 'Đã mở quyền xem hồ sơ chi tiết' : 'Gia phả công khai, hồ sơ chi tiết cần đăng nhập và KYC'}
          </p>
          <p className="text-[11px] text-ink-charcoal/60">
            {isAdmin
              ? 'Quản trị viên đang đăng nhập nên có thể xem và chỉnh sửa hồ sơ.'
              : webviewAuthSession
                ? hasVerifiedKyc(webviewAuthSession)
                  ? `Đang đăng nhập bằng ${webviewAuthSession.provider === 'zalo' ? 'Zalo' : 'Gmail'}: ${webviewAuthSession.name}`
                  : `Đã đăng nhập bằng ${webviewAuthSession.provider === 'zalo' ? 'Zalo' : 'Gmail'}: ${webviewAuthSession.name}. Tài khoản cần được admin KYC trước khi xem hồ sơ chi tiết.`
                : 'Bạn vẫn xem được sơ đồ gia phả; khi bấm vào từng người hệ thống sẽ yêu cầu đăng nhập Zalo hoặc Gmail và chờ KYC.'}
          </p>
        </div>
        {webviewAuthSession ? (
          <button
            type="button"
            onClick={handleProfileLogout}
            className="rounded border border-[#8c716e]/25 bg-white px-3 py-2 text-xs font-bold text-primary hover:bg-[#f6efe5]"
          >
            Đăng xuất
          </button>
        ) : (
          <button
            type="button"
            onClick={() => openProfileLoginForNode(selectedNode)}
            className="rounded bg-primary px-4 py-2 text-xs font-bold text-silk-paper shadow-sm hover:bg-primary/90"
          >
            Đăng nhập Zalo/Gmail
          </button>
        )}
      </div>

      {/* Main Grid: Render panel with Scroll Canvas on Left, biography detailed worksheet on Right */}
      <section className={`${isFullTreeView ? 'block' : 'grid grid-cols-1 xl:grid-cols-12 gap-8'} items-start`}>
        
        {/* Visual responsive Scroll-box parent canvas */}
        <div className={`${isFullTreeView ? 'w-full' : 'xl:col-span-8'} bg-[#fafaf5] shadow-inner rounded-sm p-4 relative border border-[#8c716e]/10`} style={{ minHeight: '580px' }}>
          
          {/* Subtle watermark overlay layout background */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.02] text-primary select-none pointer-events-none text-[220px] font-serif font-black">
            高
          </div>

          <TreeCanvasLegend />

          <TreeSearchBox
            searchTerm={searchTerm}
            resultCount={searchMatches.length}
            onSearchTermChange={setSearchTerm}
            onSubmit={handleSearchSubmit}
            onReturnToRoot={handleReturnToRoot}
          />

          {/* TREE CANVAS PORT - SCROLLABLE PANEL */}
          <div 
            ref={viewportRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            className={`overflow-auto w-full ${isFullTreeView ? 'max-h-[calc(100vh-260px)]' : 'max-h-[640px]'} pb-10 scrollbar-thin relative ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            id="tree-viewport-canvas"
          >
            <div 
              className="origin-top-left py-6"
              style={{ 
                zoom: treeScale,
                width: orientation === 'vertical' ? 'max-content' : 'max-content',
                minWidth: '100%'
              } as React.CSSProperties}
            >
              {orientation === 'vertical' ? (
                // Classical vertical centered tree
                <div className="flex justify-center w-full px-6">
                  {renderVerticalNode(treeData)}
                </div>
              ) : (
                // Left-to-right horizontal lineage branches
                <div className="flex justify-start px-8">
                  {renderHorizontalNode(treeData)}
                </div>
              )}
            </div>
          </div>

          {/* Handcrafted Bottom instruction tip banner with high contrast definition */}
          <div className="mt-5 bg-amber-50 border-2 border-amber-500/35 rounded-lg p-3 text-[11.5px] font-sans text-amber-950 flex items-center gap-2.5 shadow-sm">
            <span className="shrink-0 bg-amber-600 text-white px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider">Lưu Ý</span>
            <span className="font-medium text-amber-900">
              💡 <strong>Kéo giữ chuột trái</strong> (trên máy tính) hoặc <strong>vuốt ngón tay vào khoảng trống</strong> (trên điện thoại) để di chuyển, chiêm bái các phân chi nhánh rẽ gia phả rộng lớn. Thu nhỏ/phóng to bằng thanh điều khiển phía trên.
            </span>
          </div>
        </div>

        {/* Biography detailed worksheet panel and Live modification form on Right */}
        <div className={`${isFullTreeView ? 'mt-6 max-w-4xl mx-auto' : 'xl:col-span-4'} space-y-6`} id="right-biography-sheet">
          {canViewProfileDetails && selectedNode ? (
            <div className="bg-[#fafaf5] rounded-sm border border-[#7b5800]/20 p-6 shadow-md space-y-6 relative overflow-hidden" id="tree-authoritative-profile">
              
              <SelectedNodeProfileDetails
                selectedNode={selectedNode}
                selectedNodeIsLiving={selectedNodeIsLiving}
                effectiveLunarAnniversary={effectiveLunarAnniversary}
                anniversaryInfo={anniversaryInfo}
                selectedSpouses={selectedSpouses}
                motherDetail={motherDetail}
                showExactDates={showExactDates}
                showAnniversaryDetails={showAnniversaryDetails}
                expandedSpouseNames={expandedSpouseNames}
                isAdmin={isAdmin}
                clanLeaderRuleActive={clanLeaderRuleActive}
                leaderSpecsMap={leaderSpecsMap}
                isNgoaiTonNode={isNgoaiTonNode}
                setShowExactDates={setShowExactDates}
                setShowAnniversaryDetails={setShowAnniversaryDetails}
                setExpandedSpouseNames={setExpandedSpouseNames}
                startEditSpouse={startEditSpouse}
              />

              <ProfileAdminActions
                selectedNode={selectedNode}
                isAdmin={isAdmin}
                setIsAdmin={setIsAdmin}
                isAddingNode={isAddingNode}
                addType={addType}
                editingSpouseOriginalName={editingSpouseOriginalName}
                selectedSpouses={selectedSpouses}
                clanLeaderRuleActive={clanLeaderRuleActive}
                setClanLeaderRuleActive={setClanLeaderRuleActive}
                startAddChild={startAddChild}
                startAddSpouse={startAddSpouse}
                startEditing={startEditing}
                handleCancelAdd={handleCancelAdd}
                handleFormSubmit={handleFormSubmit}
                newMemberName={newMemberName}
                setNewMemberName={setNewMemberName}
                newMemberGender={newMemberGender}
                setNewMemberGender={setNewMemberGender}
                newMemberRankRole={newMemberRankRole}
                setNewMemberRankRole={setNewMemberRankRole}
                newMemberCustomSuffix={newMemberCustomSuffix}
                setNewMemberCustomSuffix={setNewMemberCustomSuffix}
                newMemberBirthYear={newMemberBirthYear}
                setNewMemberBirthYear={setNewMemberBirthYear}
                newMemberDeathYear={newMemberDeathYear}
                setNewMemberDeathYear={setNewMemberDeathYear}
                newMemberDescription={newMemberDescription}
                setNewMemberDescription={setNewMemberDescription}
                newMemberSpouse={newMemberSpouse}
                setNewMemberSpouse={setNewMemberSpouse}
                newMemberMother={newMemberMother}
                setNewMemberMother={setNewMemberMother}
                newMemberResidence={newMemberResidence}
                setNewMemberResidence={setNewMemberResidence}
                newMemberBurial={newMemberBurial}
                setNewMemberBurial={setNewMemberBurial}
                newMemberLunarAnniversary={newMemberLunarAnniversary}
                setNewMemberLunarAnniversary={setNewMemberLunarAnniversary}
                newMemberIsLiving={newMemberIsLiving}
                setNewMemberIsLiving={setNewMemberIsLiving}
                newMemberPhone1={newMemberPhone1}
                setNewMemberPhone1={setNewMemberPhone1}
                newMemberPhone2={newMemberPhone2}
                setNewMemberPhone2={setNewMemberPhone2}
                newMemberPhone3={newMemberPhone3}
                setNewMemberPhone3={setNewMemberPhone3}
                newMemberBirthPlace={newMemberBirthPlace}
                setNewMemberBirthPlace={setNewMemberBirthPlace}
                newMemberDeathPlace={newMemberDeathPlace}
                setNewMemberDeathPlace={setNewMemberDeathPlace}
                newMemberEmail={newMemberEmail}
                setNewMemberEmail={setNewMemberEmail}
                newMemberSolarBirthDate={newMemberSolarBirthDate}
                setNewMemberSolarBirthDate={setNewMemberSolarBirthDate}
                newMemberSolarDeathDate={newMemberSolarDeathDate}
                setNewMemberSolarDeathDate={setNewMemberSolarDeathDate}
                spouseBirthYear={spouseBirthYear}
                setSpouseBirthYear={setSpouseBirthYear}
                spouseDeathYear={spouseDeathYear}
                setSpouseDeathYear={setSpouseDeathYear}
                spouseBirthPlace={spouseBirthPlace}
                setSpouseBirthPlace={setSpouseBirthPlace}
                spouseDeathPlace={spouseDeathPlace}
                setSpouseDeathPlace={setSpouseDeathPlace}
                spouseResidence={spouseResidence}
                setSpouseResidence={setSpouseResidence}
                spouseLunarAnniversary={spouseLunarAnniversary}
                setSpouseLunarAnniversary={setSpouseLunarAnniversary}
                spousePhone1={spousePhone1}
                setSpousePhone1={setSpousePhone1}
                spousePhone2={spousePhone2}
                setSpousePhone2={setSpousePhone2}
                spousePhone3={spousePhone3}
                setSpousePhone3={setSpousePhone3}
                spouseEmail={spouseEmail}
                setSpouseEmail={setSpouseEmail}
                spouseIsLiving={spouseIsLiving}
                setSpouseIsLiving={setSpouseIsLiving}
                spouseSolarBirthDate={spouseSolarBirthDate}
                setSpouseSolarBirthDate={setSpouseSolarBirthDate}
                spouseSolarDeathDate={spouseSolarDeathDate}
                setSpouseSolarDeathDate={setSpouseSolarDeathDate}
              />
            </div>
          ) : (
            <div className="bg-[#fafaf5] border border-dashed border-[#8c716e]/30 p-12 text-center rounded text-ink-charcoal/40" id="tree-profile-empty">
              <Scroll className="w-12 h-12 text-[#7b5800]/30 mx-auto mb-4 animate-bounce" />
              <p className="font-serif text-sm text-primary">Cây gia phả vẫn xem được công khai.</p>
              <p className="mt-2 text-xs text-ink-charcoal/55">
                Đăng nhập bằng Zalo hoặc Gmail và được admin KYC để xem thông tin chi tiết từng người trong phả hệ.
              </p>
              {!canViewProfileDetails && (
                <button
                  type="button"
                  onClick={() => openProfileLoginForNode(selectedNode)}
                  className="mt-5 rounded bg-primary px-4 py-2 text-xs font-bold text-silk-paper shadow-sm hover:bg-primary/90"
                >
                  Đăng nhập/KYC để xem chi tiết
                </button>
              )}
            </div>
          )}
        </div>

      </section>

      <SelectedNodeMobileProfileDialog
        isOpen={isMobileModalOpen && canViewProfileDetails}
        selectedNode={canViewProfileDetails ? selectedNode : null}
        selectedNodeIsLiving={selectedNodeIsLiving}
        effectiveLunarAnniversary={effectiveLunarAnniversary}
        anniversaryInfo={anniversaryInfo}
        selectedSpouses={selectedSpouses}
        motherDetail={motherDetail}
        showExactDates={showExactDates}
        showAnniversaryDetails={showAnniversaryDetails}
        expandedSpouseNames={expandedSpouseNames}
        isAdmin={isAdmin}
        isFullTreeView={isFullTreeView}
        isNgoaiTonNode={isNgoaiTonNode}
        setIsMobileModalOpen={setIsMobileModalOpen}
        setShowExactDates={setShowExactDates}
        setShowAnniversaryDetails={setShowAnniversaryDetails}
        setExpandedSpouseNames={setExpandedSpouseNames}
        startEditSpouse={startEditSpouse}
      />

      {showMobileLoginHint && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/45 p-3 sm:hidden" id="mobile-login-hint-overlay">
          <div className="w-full rounded-t-xl border border-[#7b5800]/25 bg-[#fafaf5] p-5 shadow-2xl space-y-4 animate-fade-in">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="font-serif text-base font-bold text-primary">Chỉ dẫn xem gia phả</p>
                <p className="text-sm leading-relaxed text-ink-charcoal/70">
                  Hãy đăng nhập và chờ admin KYC để xem thông tin chi tiết từng người. Bạn vẫn có thể vuốt và xem sơ đồ gia phả trước khi được duyệt.
                </p>
              </div>
              <button
                type="button"
                onClick={dismissMobileLoginHint}
                className="shrink-0 rounded-full border border-[#8c716e]/20 bg-white p-2 text-ink-charcoal/60"
                aria-label="Đóng chỉ dẫn"
              >
                <X className="h-4 w-4 border-none" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={dismissMobileLoginHint}
                className="rounded border border-[#8c716e]/25 bg-white px-3 py-2.5 text-sm font-bold text-primary"
              >
                Để sau
              </button>
              <button
                type="button"
                onClick={startMobileHintLogin}
                className="rounded bg-primary px-3 py-2.5 text-sm font-bold text-silk-paper shadow-sm"
              >
                Đăng nhập ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {showProfileLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 transition-opacity animate-fade-in" id="profile-login-overlay">
          <div className="w-full max-w-md rounded-lg border-2 border-[#7b5800]/35 bg-[#fafaf5] p-6 shadow-2xl relative space-y-5">
            <button
              type="button"
              onClick={() => {
                setShowProfileLoginModal(false);
                setPendingProfileNode(null);
                setProfileLoginError('');
              }}
              className="absolute top-4 right-4 text-ink-charcoal/50 hover:text-black"
              aria-label="Đóng đăng nhập"
            >
              <X className="w-4 h-4 border-none" />
            </button>

            <div className="space-y-1 pr-8">
              <p className="font-serif text-lg font-bold text-primary">Đăng nhập và KYC để xem hồ sơ chi tiết</p>
              <p className="text-xs leading-relaxed text-ink-charcoal/60">
                Sơ đồ gia phả vẫn xem được công khai. Thông tin chi tiết từng người chỉ mở sau khi đăng nhập Zalo/Gmail và được admin quy chiếu KYC.
              </p>
              {pendingProfileNode && (
                <p className="text-[11px] font-semibold text-[#7b5800]">
                  Đang yêu cầu xem: {pendingProfileNode.name}
                </p>
              )}
            </div>

            {profileLoginError && (
              <p className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                {profileLoginError}
              </p>
            )}

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => startOAuthLogin('zalo')}
                className="w-full rounded bg-[#008fe5] px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#0078c2]"
              >
                Đăng nhập bằng Zalo
              </button>
              <button
                type="button"
                onClick={() => startOAuthLogin('gmail')}
                className="w-full rounded border border-[#8c716e]/25 bg-white px-4 py-3 text-sm font-bold text-primary hover:bg-[#f6efe5]"
              >
                Đăng nhập bằng Gmail
              </button>
            </div>

            <p className="border-t border-[#8c716e]/10 pt-3 text-[11px] leading-relaxed text-ink-charcoal/50">
              Hệ thống sẽ chuyển sang trang ủy quyền chính thức của Zalo hoặc Google. Sau khi đăng nhập, admin cần KYC tài khoản trước khi hồ sơ chi tiết được mở.
            </p>
          </div>
        </div>
      )}

      {/* ADMIN PASSWORD LOGIN DIALOG MODAL OVERLAY */}
      {showAdminLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 transition-opacity animate-fade-in" id="admin-login-overlay">
          <div className="bg-[#fafaf5] border-2 border-amber-600 rounded-lg max-w-sm w-full p-6 shadow-2xl relative space-y-4">
            
            <button
              onClick={() => setShowAdminLoginModal(false)}
              className="absolute top-4 right-4 text-ink-charcoal/50 hover:text-black hover:font-bold"
            >
              <X className="w-4 h-4 border-none" />
            </button>

            <div className="flex items-center gap-1.5 text-amber-900 font-serif font-bold text-sm">
              <ShieldCheck className="w-5 h-5 text-amber-700 animate-pulse" />
              <span>XÁC DIỆN QUẢN TRỊ VIÊN GIA PHẢ</span>
            </div>

            <p className="text-[11px] text-ink-charcoal/60 leading-relaxed">
              Vui lòng nhập mật mã định danh quản trị chi họ để mở khoá tính năng sửa đổi, sáp nhập con cháu mới. Mật mã test tạm thời là <strong>"123"</strong>.
            </p>

            <form onSubmit={handleAdminLogin} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] font-mono text-ink-charcoal/50 uppercase">Mật mã Quản trị *</label>
                <input
                  type="password"
                  required
                  placeholder="Nhập '123'..."
                  value={adminPasswordInput}
                  onChange={(e) => setAdminPasswordInput(e.target.value)}
                  className="w-full bg-white border border-[#8c716e]/30 rounded p-2 text-xs focus:outline-none focus:border-amber-600"
                />
              </div>

              {adminLoginError && (
                <p className="text-[9px] text-red-700 bg-red-50 p-1.5 rounded border border-red-200 lider-tight">
                  {adminLoginError}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdmin(true);
                    setShowAdminLoginModal(false);
                    setAdminPasswordInput('');
                    setAdminLoginError('');
                  }}
                  className="py-2 bg-amber-100 hover:bg-amber-200 text-amber-950 font-sans font-bold text-xs rounded transition-all text-center cursor-pointer"
                >
                  Xác Thực Nhanh ⚡
                </button>
                <button
                  type="submit"
                  className="py-2 bg-amber-600 hover:bg-amber-700 text-silk-paper font-sans font-bold text-xs rounded transition-all text-center cursor-pointer"
                >
                  Kiểm tra mật mã
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
