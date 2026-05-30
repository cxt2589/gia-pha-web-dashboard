import { AncestorNode } from '../types';

const normalizePersonName = (value: string) => {
  return value.toLowerCase().replace(/\s*\(.*\)\s*/g, '').trim();
};

export const parseSpouses = (spouseStr?: string): string[] => {
  if (!spouseStr) return [];
  return spouseStr.split(/[,\/;\-\+]+/).map(spouse => spouse.trim()).filter(Boolean);
};

export const getSpouseNames = (node: AncestorNode): string[] => {
  const names = parseSpouses(node.spouse);
  const seen = new Set(names.map(normalizePersonName));

  node.spouseDetails?.forEach(detail => {
    const name = detail?.name?.trim();
    if (!name) return;
    const key = normalizePersonName(name);
    if (!seen.has(key)) {
      seen.add(key);
      names.push(name);
    }
  });

  return names;
};

export const syncSpouseDetailsFromText = (node: AncestorNode, spouseText: string) => {
  const spouses = parseSpouses(spouseText);
  node.spouse = spouses.join(', ');
  node.spouseList = spouses;

  if (spouses.length === 0) {
    node.spouseDetails = [];
    return;
  }

  const existingDetails = node.spouseDetails || [];
  node.spouseDetails = spouses.map((spouseName) => {
    const cleanSpouseName = normalizePersonName(spouseName);
    const existing = existingDetails.find((detail) => {
      const detailName = normalizePersonName(String(detail?.name || ''));
      return detailName === cleanSpouseName || detailName.includes(cleanSpouseName) || cleanSpouseName.includes(detailName);
    });

    return existing ? { ...existing, name: spouseName } : { name: spouseName };
  });
};

export const findNodeById = (node: AncestorNode, id: string): AncestorNode | null => {
  if (node.id === id) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
  }
  return null;
};
