import { AncestorNode } from '../types';

export interface LineageSpec {
  role: string;
  dot?: 'green' | 'blue';
  borderColor?: string;
  isTruongToc?: boolean;
}

export const MIN_TREE_ZOOM = 50;
export const MAX_TREE_ZOOM = 200;
export const TREE_ZOOM_STEP = 10;

const getHanNomNumber = (num: number): string => {
  const hanNomDigits = ["", "Nhất", "Nhị", "Tam", "Tứ", "Ngũ", "Lục", "Thất", "Bát", "Cửu", "Thập"];
  if (num <= 10) return hanNomDigits[num];
  if (num < 20) return "Thập " + hanNomDigits[num - 10];
  if (num === 20) return "Nhị Thập";
  if (num < 30) return "Nhị Thập " + hanNomDigits[num - 20];
  if (num === 30) return "Tam Thập";
  if (num < 40) return "Tam Thập " + hanNomDigits[num - 30];
  return num.toString();
};

const normalizeDisplayText = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\u0111/g, 'd')
  .replace(/\u0110/g, 'D')
  .toLowerCase();

export const stripGeneratedLineageTitlePrefix = (title?: string): string => {
  let cleanTitle = String(title || '').trim();
  const generatedPrefixPatterns = [
    /^Cao\s+Tổ\s+đời\s+0(?:\s*-\s*|\s+)?/i,
    /^Thủy\s+tổ\s*(?:\([^)]*\))?(?:\s*-\s*|\s+)?/i,
    /^Đời\s+thứ\s+\d+(?:\s*-\s*|\s+)?/i,
    /^Đệ\s+[A-Za-zĂăÂâĐđÊêÔôƠơƯưỨứ\s]+\s+thế\s+tổ(?:\s*-\s*|\s+)?/i,
    /^Hậu\s+duệ\s+đời\s+\d+(?:\s*-\s*|\s+)?/i,
    /^Ngoại\s+tôn\s+đời\s+\d+(?:\s*-\s*|\s+)?/i
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of generatedPrefixPatterns) {
      const nextTitle = cleanTitle.replace(pattern, '').trim();
      if (nextTitle !== cleanTitle) {
        cleanTitle = nextTitle.replace(/^\s*-\s*/, '').trim();
        changed = true;
      }
    }
  }
  return cleanTitle;
};

export const formatNodeTitle = (node: {
  generation: number;
  isLiving?: boolean;
  birthYear?: string;
  deathYear?: string;
  title?: string;
  rankRole?: string;
  customSuffix?: string;
}): string => {
  const isLiving = node.isLiving || (!node.deathYear && node.birthYear && parseInt(node.birthYear) > 1920);

  let role = node.rankRole || '';
  let suffix = stripGeneratedLineageTitlePrefix(node.customSuffix || '');

  if (!node.rankRole && node.title) {
    let cleanTitle = node.title;
    cleanTitle = stripGeneratedLineageTitlePrefix(cleanTitle);

    const roles = ["trưởng chi", "trưởng tộc", "đệ nhị", "đệ tam", "gái cả", "gái thứ 1-2-3", "gái thứ 1", "gái thứ 2", "gái thứ 3", "đích tôn"];
    const foundRole = roles.find(r => cleanTitle.toLowerCase().includes(r));
    if (foundRole) {
      const index = cleanTitle.toLowerCase().indexOf(foundRole);
      role = cleanTitle.substring(index, index + foundRole.length);
      const part1 = cleanTitle.substring(0, index).trim();
      const part2 = cleanTitle.substring(index + foundRole.length).trim();
      suffix = [part1, part2].filter(Boolean).join(' ').replace(/^\s*-\s*|\s*-\s*$/g, '').trim();
    } else {
      role = '';
      suffix = cleanTitle.trim();
    }
  }

  const roleFormatted = role ? role.trim() : '';
  const suffixFormatted = suffix ? suffix.trim() : '';

  if (roleFormatted.toLowerCase() === 'ngoại tôn') {
    return `Ngoại tôn đời ${node.generation}`;
  }

  if (node.generation <= 0) {
    return ['Cao Tổ đời 0', roleFormatted, suffixFormatted].filter(Boolean).join(' - ');
  }

  if (node.generation === 1) {
    const sourceText = normalizeDisplayText([node.title, roleFormatted, suffixFormatted].filter(Boolean).join(' '));
    if ((sourceText.includes('thuy to') || sourceText.includes('hau due doi 1')) && !roleFormatted && !suffixFormatted) {
      return 'Th\u1ee7y t\u1ed5 (\u59cb\u7956)';
    }
    return ['Th\u1ee7y t\u1ed5 (\u59cb\u7956)', roleFormatted, suffixFormatted].filter(Boolean).join(' - ');
  }

  if (isLiving) {
    return [`Hậu duệ đời ${node.generation}`, roleFormatted, suffixFormatted].filter(Boolean).join(' - ');
  }

  return [`Đệ ${getHanNomNumber(node.generation)} thế tổ`, roleFormatted, suffixFormatted].filter(Boolean).join(' - ');
};

export const isMaleNode = (node: AncestorNode): boolean => {
  if (node.gender === 'nữ') return false;
  if (node.gender === 'nam') return true;
  const name = node.name || "";
  const words = name.split(/\s+/);
  return !words.some(w => w.toLowerCase() === 'thị');
};

const isNodeLiving = (node: AncestorNode): boolean => {
  return !!(node.isLiving || (!node.deathYear && node.birthYear && parseInt(node.birthYear) > 1920));
};

const getSons = (node: AncestorNode): AncestorNode[] => {
  if (!node.children) return [];
  return node.children.filter(isMaleNode);
};

const hasSons = (node: AncestorNode): boolean => {
  return getSons(node).length > 0;
};

const hasActiveLineageDescendant = (node: AncestorNode): boolean => {
  const sons = getSons(node);
  if (sons.some(isNodeLiving)) return true;
  if (sons.some(s => getSons(s).length > 0)) return true;
  for (const son of sons) {
    if (hasActiveLineageDescendant(son)) return true;
  }
  return false;
};

export const computeClanLeaderRules = (root: AncestorNode): Record<string, LineageSpec> => {
  const specs: Record<string, LineageSpec> = {};

  const parentMap: Record<string, AncestorNode> = {};
  const buildParentMap = (node: AncestorNode, parent: AncestorNode | null) => {
    if (parent) parentMap[node.id] = parent;
    if (node.children) node.children.forEach(child => buildParentMap(child, node));
  };
  buildParentMap(root, null);

  const findByNodeId = (node: AncestorNode, id: string): AncestorNode | null => {
    if (node.id === id) return node;
    if (node.children) {
      for (const child of node.children) {
        const result = findByNodeId(child, id);
        if (result) return result;
      }
    }
    return null;
  };

  const leaderByGen: Record<number, string> = {};
  leaderByGen[1] = root.id;

  for (let generation = 1; generation < 20; generation++) {
    const leaderId = leaderByGen[generation];
    if (!leaderId) break;

    const leaderNode = findByNodeId(root, leaderId);
    if (!leaderNode) continue;

    const leaderIsLiving = isNodeLiving(leaderNode);
    const sons = getSons(leaderNode);

    let primarySuccessor: AncestorNode | null = null;
    for (const son of sons) {
      if (isNodeLiving(son) || hasActiveLineageDescendant(son)) {
        primarySuccessor = son;
        break;
      }
    }

    if (primarySuccessor) {
      if (!leaderIsLiving) leaderByGen[generation + 1] = primarySuccessor.id;
    } else if (!leaderIsLiving) {
      const parent = parentMap[leaderNode.id];
      if (parent) {
        const brothers = getSons(parent);
        const leaderIdx = brothers.findIndex(brother => brother.id === leaderNode.id);
        const youngerSeq = brothers.slice(leaderIdx + 1);

        let activeBrother: AncestorNode | null = null;
        for (const brother of youngerSeq) {
          if (isNodeLiving(brother) || hasActiveLineageDescendant(brother)) {
            activeBrother = brother;
            break;
          }
        }

        if (activeBrother) {
          if (isNodeLiving(activeBrother)) {
            leaderByGen[generation] = activeBrother.id;
            generation--;
          } else {
            const brotherSons = getSons(activeBrother);
            if (brotherSons.length > 0) leaderByGen[generation + 1] = brotherSons[0].id;
          }
        }
      }
    }
  }

  const assignSpecs = (node: AncestorNode) => {
    const parent = parentMap[node.id];
    const living = isNodeLiving(node);
    let role = '';
    let borderColor = '';

    let siblingString = '';
    if (parent) {
      const parentSons = getSons(parent);
      const idx = parentSons.findIndex(son => son.id === node.id);
      if (idx >= 0) {
        if (idx === 0) siblingString = 'Trưởng nam';
        else if (idx === 1) siblingString = 'Đệ nhị';
        else if (idx === 2) siblingString = 'Đệ tam';
        else siblingString = `Đệ ${idx + 1}`;
      }
    }

    const isLeaderOfItsGen = Object.values(leaderByGen).includes(node.id);

    if (parent && !isMaleNode(parent)) {
      role = 'Ngoại tôn';
      borderColor = living ? 'border-teal-400' : 'border-[#8c716e]/25';
    } else if (isLeaderOfItsGen) {
      role = 'Trưởng tộc';
      borderColor = living
        ? 'border-red-500 ring-2 ring-red-400/60 shadow-[0_0_12px_rgba(239,68,68,0.6)]'
        : 'border-red-300 ring-1 ring-red-300/40 shadow-[0_0_8px_rgba(239,68,68,0.4)]';
    } else {
      const parentLeaderId = parent ? leaderByGen[parent.generation] : null;
      if (parentLeaderId && parent.id === parentLeaderId) {
        const leaderSons = getSons(parent);
        let eligibleHeir: AncestorNode | null = null;
        for (const son of leaderSons) {
          if (isNodeLiving(son) || hasActiveLineageDescendant(son)) {
            eligibleHeir = son;
            break;
          }
        }

        if (eligibleHeir && node.id === eligibleHeir.id) {
          role = hasSons(node) ? 'Trưởng nam' : 'Đích tôn';
          borderColor = role === 'Trưởng nam'
            ? living
              ? 'border-orange-500 ring-2 ring-orange-400/60 shadow-[0_0_12px_rgba(249,115,22,0.6)] font-bold'
              : 'border-orange-300 ring-1 ring-orange-300/40 shadow-[0_0_8px_rgba(249,115,22,0.4)]'
            : living
              ? 'border-blue-500 ring-2 ring-blue-400/60 shadow-[0_0_12px_rgba(59,130,246,0.6)] font-bold'
              : 'border-[#8c716e]/25 text-ink-charcoal';
        } else {
          if (isMaleNode(node)) {
            role = siblingString || 'Hậu duệ';
          } else {
            const daughters = parent.children ? parent.children.filter(child => !isMaleNode(child)) : [];
            const daughterIdx = daughters.findIndex(daughter => daughter.id === node.id);
            if (daughterIdx === 0) role = 'Gái cả';
            else if (daughterIdx >= 1) role = `Gái thứ ${daughterIdx + 1}`;
            else role = 'Hậu duệ';
          }
          borderColor = living ? 'border-amber-400' : 'border-[#8c716e]/25';
        }
      } else {
        const grandParent = parent ? parentMap[parent.id] : null;
        const grandParentLeaderId = grandParent ? leaderByGen[grandParent.generation] : null;
        let isDichTonGrandson = false;

        if (grandParentLeaderId && grandParent && grandParent.id === grandParentLeaderId) {
          const grandParentSons = getSons(grandParent);
          let grandParentHeir: AncestorNode | null = null;
          for (const son of grandParentSons) {
            if (isNodeLiving(son) || hasActiveLineageDescendant(son)) {
              grandParentHeir = son;
              break;
            }
          }

          if (grandParentHeir && parent.id === grandParentHeir.id) {
            const parentSons = getSons(parent);
            if (parentSons.length > 0 && node.id === parentSons[0].id) isDichTonGrandson = true;
          }
        }

        let isDichTonGreatGrandson = false;
        if (!isDichTonGrandson && parent) {
          const parentParent = parentMap[parent.id];
          if (parentParent) {
            const greatGrandParent = parentMap[parentParent.id];
            const greatGrandParentLeaderId = greatGrandParent ? leaderByGen[greatGrandParent.generation] : null;
            if (greatGrandParentLeaderId && greatGrandParent && greatGrandParent.id === greatGrandParentLeaderId) {
              const greatGrandParentSons = getSons(greatGrandParent);
              let greatGrandParentHeir: AncestorNode | null = null;
              for (const son of greatGrandParentSons) {
                if (isNodeLiving(son) || hasActiveLineageDescendant(son)) {
                  greatGrandParentHeir = son;
                  break;
                }
              }
              if (greatGrandParentHeir && parentParent.id === greatGrandParentHeir.id) {
                const parentParentSons = getSons(parentParent);
                if (parentParentSons.length > 0 && parent.id === parentParentSons[0].id) {
                  const parentSons = getSons(parent);
                  if (parentSons.length > 0 && node.id === parentSons[0].id) isDichTonGreatGrandson = true;
                }
              }
            }
          }
        }

        if (isDichTonGrandson || isDichTonGreatGrandson) {
          role = 'Đích tôn';
          borderColor = living
            ? 'border-blue-500 ring-2 ring-blue-400/60 shadow-[0_0_12px_rgba(59,130,246,0.6)] font-bold'
            : 'border-[#8c716e]/25 text-ink-charcoal';
        } else {
          if (isMaleNode(node)) {
            role = siblingString || 'Hậu duệ';
          } else if (parent) {
            const daughters = parent.children ? parent.children.filter(child => !isMaleNode(child)) : [];
            const daughterIdx = daughters.findIndex(daughter => daughter.id === node.id);
            if (daughterIdx === 0) role = 'Gái cả';
            else if (daughterIdx >= 1) role = `Gái thứ ${daughterIdx + 1}`;
            else role = 'Hậu duệ';
          } else {
            role = 'Hậu duệ';
          }
          borderColor = living ? 'border-amber-400' : 'border-[#8c716e]/25';
        }
      }
    }

    specs[node.id] = { role, borderColor, isTruongToc: role === 'Trưởng tộc' };
    if (node.children) node.children.forEach(assignSpecs);
  };

  assignSpecs(root);

  Object.keys(specs).forEach(id => {
    const spec = specs[id];
    if (!spec.isTruongToc) return;
    const node = findByNodeId(root, id);
    if (!node || !isNodeLiving(node)) return;

    const hasActiveSon = getSons(node).some(son => isNodeLiving(son) || hasActiveLineageDescendant(son));
    if (hasActiveSon) return;

    const parent = parentMap[node.id];
    if (!parent) return;

    const youngerSeq = getSons(parent).slice(getSons(parent).findIndex(son => son.id === node.id) + 1);
    for (const brother of youngerSeq) {
      const brotherSons = getSons(brother);
      if (brotherSons.length > 0) {
        specs[brother.id].dot = 'green';
        specs[brotherSons[0].id].dot = 'blue';
        break;
      }
    }
  });

  return specs;
};

export const getAncestralTierLabel = (generation?: number) => {
  if (generation === undefined) return "";
  if (generation <= 0) return "CAO TỔ";
  if (generation === 1) return "THỦY TỔ";
  return "";
};

export const getAncestralTierClassName = (generation?: number) => {
  if (generation === undefined) return "";
  if (generation <= 0) return "!bg-[#a3312b] !border-[#d8b765] !text-silk-paper ring-2 ring-[#d8b765]/55 shadow-[0_8px_24px_rgba(139,28,28,0.24)]";
  if (generation === 1) return "!bg-[#fff3c7] !border-[#c89b3c] !text-ink-charcoal ring-2 ring-[#c89b3c]/40 shadow-[0_8px_20px_rgba(123,88,0,0.14)]";
  return "";
};

export const isUnknownText = (value?: string) => {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  return normalized === "khong ro" || normalized === "chua ro" || normalized === "khong xac dinh";
};
