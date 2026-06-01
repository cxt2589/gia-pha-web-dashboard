import { ANCESTRAL_TREE } from "../../data/lineageData";
import type { AncestorNode } from "../../types";
import { getPersistedTreeData, hydratePersistedTreeDataFromBackend, savePersistedTreeData } from "../../utils/configManager";
import { formatNodeTitle, stripGeneratedLineageTitlePrefix } from "../../utils/lineageDisplay";
import type { FamilyMember, OutstandingMember } from "../types";

function normalizeVietnameseText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .toLowerCase();
}

function mapGender(gender: AncestorNode["gender"] | string | undefined): FamilyMember["gender"] {
  return normalizeVietnameseText(gender).includes("nu") ? "N\u1eef" : "Ngh\u1ecb";
}

function isCaoDinhThuat(name: string | undefined) {
  return normalizeVietnameseText(name).includes("cao dinh thuat");
}

function getDashboardBranch(node: any) {
  const generation = isCaoDinhThuat(node.name) ? 0 : Number(node.generation) || 1;
  const branch = String(node.branch || "").trim();
  if (branch && !(generation !== 1 && normalizeVietnameseText(branch).includes("thuy to gia toc"))) {
    return branch;
  }
  return generation === 1 ? "G\u1ed1c gia t\u1ed9c" : "Ch\u01b0a ph\u00e2n chi";
}

function toDashboardMember(node: any, parentId?: string): FamilyMember {
  const children = node.children ?? [];
  return {
    id: node.id,
    name: node.name,
    generation: isCaoDinhThuat(node.name) ? 0 : Number(node.generation) || 1,
    title: stripGeneratedLineageTitlePrefix(node.title) || node.title,
    rankRole: node.rankRole,
    customSuffix: node.customSuffix,
    branch: getDashboardBranch(node),
    gender: mapGender(node.gender),
    isDeceased: node.isLiving === false || Boolean(node.deathYear),
    birthYear: node.birthYear,
    deathYear: node.deathYear,
    birthPlace: node.birthPlace,
    deathPlace: node.deathPlace,
    solarBirthDate: node.solarBirthDate,
    solarDeathDate: node.solarDeathDate,
    deathAnniversaryLunar: node.lunarAnniversary || node.deathAnniversaryLunar,
    birthDateStructured: node.birthDateStructured,
    deathDateStructured: node.deathDateStructured,
    deathAnniversaryLunarStructured: node.deathAnniversaryLunarStructured,
    graveLocation: node.burialPlace || node.graveLocation,
    motherName: node.motherName,
    residence: node.residence,
    phone1: node.phone1,
    phone2: node.phone2,
    phone3: node.phone3,
    email: node.email,
    spouse: node.spouse,
    children: children.map((child: any) => child.id),
    parentId: node.parentId || parentId,
    photo: node.photo,
    bio: [
      node.bio,
      node.description,
      node.residence ? `N\u01a1i \u1edf: ${node.residence}` : "",
      node.motherName ? `M\u1eabu th\u00e2n: ${node.motherName}` : "",
      node.phone1 ? `Li\u00ean h\u1ec7: ${node.phone1}${node.phone2 ? ` - ${node.phone2}` : ""}` : "",
    ].filter(Boolean).join(" | ") || undefined,
    achievements: [
      ...(Array.isArray(node.achievements) ? node.achievements : []),
      node.customSuffix,
      node.title ? (stripGeneratedLineageTitlePrefix(node.title) || node.title) : "",
    ].filter(Boolean),
  };
}

function collectMembers(node: AncestorNode, parentId?: string): FamilyMember[] {
  const children = node.children ?? [];
  const member = toDashboardMember(node, parentId);
  return [member, ...children.flatMap((child) => collectMembers(child, node.id))];
}

export function mapLineageNodesToDashboardMembers(nodes: any[]): FamilyMember[] {
  return nodes.map((node) => toDashboardMember(node, node.parentId));
}

export function getWebViewFamilyMembers(): FamilyMember[] {
  return collectMembers(getPersistedTreeData(ANCESTRAL_TREE));
}

export async function hydrateWebViewFamilyMembers(): Promise<FamilyMember[]> {
  const backendTree = await hydratePersistedTreeDataFromBackend(ANCESTRAL_TREE);
  return collectMembers(backendTree);
}

function toLineageNode(member: FamilyMember): AncestorNode {
  const isLiving = !member.isDeceased;
  const title = formatNodeTitle({
    generation: member.generation,
    isLiving,
    birthYear: member.birthYear,
    deathYear: member.deathYear,
    rankRole: member.rankRole,
    customSuffix: member.customSuffix || member.achievements?.[0],
  });

  return {
    id: member.id.startsWith("custom-gen-") ? member.id : `custom-gen-${Date.now()}`,
    name: member.name,
    generation: member.generation,
    title,
    rankRole: member.rankRole,
    customSuffix: member.customSuffix || member.achievements?.[0],
    branch: member.branch,
    gender: member.gender === "N\u1eef" ? "n\u1eef" : "nam",
    isLiving,
    birthYear: member.birthYear,
    deathYear: member.isDeceased ? member.deathYear : undefined,
    birthPlace: member.birthPlace,
    deathPlace: member.deathPlace,
    solarBirthDate: member.solarBirthDate,
    solarDeathDate: member.isDeceased ? member.solarDeathDate : undefined,
    lunarAnniversary: member.isDeceased ? member.deathAnniversaryLunar : undefined,
    birthDateStructured: member.birthDateStructured,
    deathDateStructured: member.isDeceased ? member.deathDateStructured : undefined,
    deathAnniversaryLunarStructured: member.isDeceased ? member.deathAnniversaryLunarStructured : undefined,
    burialPlace: member.graveLocation,
    motherName: member.motherName,
    residence: member.residence,
    phone1: member.phone1,
    phone2: member.phone2,
    phone3: member.phone3,
    email: member.email,
    photo: member.photo,
    spouse: member.spouse,
    spouseList: member.spouse ? member.spouse.split(",").map((item) => item.trim()).filter(Boolean) : [],
    spouseDetails: member.spouse ? [{ name: member.spouse }] : [],
    parentId: member.parentId,
    bio: member.bio,
    description: member.bio,
    achievements: member.achievements ?? [],
    children: [],
  };
}

function applyMemberToExistingNode(node: AncestorNode, member: FamilyMember) {
  const nextNode = toLineageNode({ ...member, id: node.id });
  Object.assign(node, {
    ...node,
    ...nextNode,
    children: node.children ?? [],
  });
}

function findNodeById(node: AncestorNode, id: string): AncestorNode | null {
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

export function addDashboardMemberToSharedTree(member: FamilyMember): FamilyMember[] {
  const tree = structuredClone(getPersistedTreeData(ANCESTRAL_TREE)) as AncestorNode;
  const parent = member.parentId ? findNodeById(tree, member.parentId) : null;
  if (!parent) {
    throw new Error("C\u1ea7n ch\u1ecdn b\u1ed1 \u0111\u1ebb \u0111\u1ec3 ghi ph\u1ea3 th\u00e0nh vi\u00ean m\u1edbi theo \u0111\u00fang c\u01a1 ch\u1ebf web view.");
  }

  const nextGeneration = (Number(parent.generation) || 0) + 1;
  const isChildOfMother = normalizeVietnameseText(parent.gender).includes("nu");
  const newNode = toLineageNode({
    ...member,
    generation: nextGeneration,
    parentId: parent.id,
    rankRole: isChildOfMother ? "Ngo\u1ea1i t\u00f4n" : member.rankRole,
    branch: member.branch || parent.branch || (Number(parent.generation) === 1 ? "G\u1ed1c gia t\u1ed9c" : "Ch\u01b0a ph\u00e2n chi"),
  });

  if (!parent.children) parent.children = [];
  parent.children.push({
    ...newNode,
    parentId: parent.id,
    generation: nextGeneration,
  });

  savePersistedTreeData(tree);
  return collectMembers(tree);
}

export function updateDashboardMemberInSharedTree(member: FamilyMember): FamilyMember[] {
  const tree = structuredClone(getPersistedTreeData(ANCESTRAL_TREE)) as AncestorNode;
  const node = findNodeById(tree, member.id);
  if (!node) {
    throw new Error("Không tìm thấy thành viên để sửa.");
  }

  applyMemberToExistingNode(node, {
    ...member,
    generation: Number.isFinite(Number(node.generation)) ? Number(node.generation) : member.generation,
    parentId: node.parentId || member.parentId,
  });

  savePersistedTreeData(tree);
  return collectMembers(tree);
}

export function getOutstandingMembersFromFamilyMembers(members: FamilyMember[]): OutstandingMember[] {
  return members
    .filter((member) => member.achievements && member.achievements.length > 0)
    .slice(0, 8)
    .map((member) => ({
      id: `out_${member.id}`,
      name: member.name,
      achievement: member.achievements?.[0] || "Danh v\u1ecb trong ph\u1ea3 h\u1ec7",
      year: Number.parseInt(member.birthYear || "", 10) || 2026,
      branch: member.branch,
    }));
}

export const webViewFamilyMembers: FamilyMember[] = getWebViewFamilyMembers();
export const webViewOutstandingMembers: OutstandingMember[] = getOutstandingMembersFromFamilyMembers(webViewFamilyMembers);
