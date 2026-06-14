import { ANCESTRAL_TREE } from "../../data/lineageData";
import type { AncestorNode } from "../../types";
import { getPersistedTreeData, hydratePersistedTreeDataFromBackend, savePersistedTreeData, savePersistedTreeDataAsync } from "../../utils/configManager";
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

function normalizeListText(value: unknown) {
  return normalizeVietnameseText(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueNonEmptyTexts(values: unknown[]) {
  const seen = new Set<string>();
  return values
    .map((value) => String(value || "").trim())
    .filter((value) => {
      if (!value) return false;
      const key = normalizeListText(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function getDashboardAchievements(node: any) {
  return uniqueNonEmptyTexts(Array.isArray(node.achievements) ? node.achievements : []);
}

function isAutoBioSegment(value: unknown) {
  const key = normalizeListText(value);
  return [
    "noi o",
    "tru quan",
    "mau than",
    "phu than",
    "lien he",
    "dien thoai",
    "thu dien tu",
    "ban doi",
    "chau con gom"
  ].some((prefix) => key.startsWith(prefix));
}

function cleanDashboardBio(node: any) {
  const rawSegments = [node.bio, node.description]
    .flatMap((value) => String(value || "").split(/\s+\|\s+/g));
  const segments = uniqueNonEmptyTexts(rawSegments)
    .filter((segment) => !isAutoBioSegment(segment));
  return segments.join(" | ") || undefined;
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
    deathLunarYearText: node.deathLunarYearText,
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
    bio: cleanDashboardBio(node),
    achievements: getDashboardAchievements(node),
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
    customSuffix: member.customSuffix,
  });

  return {
    id: member.id.startsWith("custom-gen-") ? member.id : `custom-gen-${Date.now()}`,
    name: member.name,
    generation: member.generation,
    title,
    rankRole: member.rankRole,
    customSuffix: member.customSuffix,
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
    deathLunarYearText: member.isDeceased ? member.deathLunarYearText : undefined,
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

function addMemberToTree(tree: AncestorNode, member: FamilyMember, persist = true): FamilyMember[] {
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

  if (persist) savePersistedTreeData(tree);
  return collectMembers(tree);
}

function updateMemberInTree(tree: AncestorNode, member: FamilyMember, persist = true): FamilyMember[] {
  const node = findNodeById(tree, member.id);
  if (!node) {
    throw new Error("Không tìm thấy thành viên để sửa.");
  }

  applyMemberToExistingNode(node, {
    ...member,
    generation: Number.isFinite(Number(node.generation)) ? Number(node.generation) : member.generation,
    parentId: node.parentId || member.parentId,
  });

  if (persist) savePersistedTreeData(tree);
  return collectMembers(tree);
}

function countDescendants(node: AncestorNode): number {
  return (node.children ?? []).reduce((sum, child) => sum + 1 + countDescendants(child), 0);
}

function removeMemberFromTree(tree: AncestorNode, memberId: string, persist = true): FamilyMember[] {
  if (!memberId) {
    throw new Error("Thiếu mã thành viên cần xóa.");
  }
  const targetNode = findNodeById(tree, memberId);
  if (!targetNode) {
    throw new Error("Không tìm thấy thành viên để xóa.");
  }
  if (tree.id === memberId || Number(targetNode.generation) === 0) {
    throw new Error("Không thể xóa Cao Tổ / gốc phả hệ.");
  }

  let removedNode: AncestorNode | null = null;

  const walk = (node: AncestorNode) => {
    const nextChildren: AncestorNode[] = [];
    for (const child of node.children ?? []) {
      if (child.id === memberId) {
        removedNode = child;
        continue;
      }
      walk(child);
      nextChildren.push(child);
    }
    node.children = nextChildren;
  };

  walk(tree);

  if (!removedNode) {
    throw new Error("Không tìm thấy thành viên để xóa.");
  }

  const descendantCount = countDescendants(removedNode);
  if (descendantCount > 0) {
    console.warn(`Removed lineage member ${memberId} with ${descendantCount} descendant node(s).`);
  }

  if (persist) savePersistedTreeData(tree);
  return collectMembers(tree);
}

export function addDashboardMemberToSharedTree(member: FamilyMember): FamilyMember[] {
  const tree = structuredClone(getPersistedTreeData(ANCESTRAL_TREE)) as AncestorNode;
  return addMemberToTree(tree, member);
}

export function updateDashboardMemberInSharedTree(member: FamilyMember): FamilyMember[] {
  const tree = structuredClone(getPersistedTreeData(ANCESTRAL_TREE)) as AncestorNode;
  return updateMemberInTree(tree, member);
}

export function deleteDashboardMemberFromSharedTree(memberId: string): FamilyMember[] {
  const tree = structuredClone(getPersistedTreeData(ANCESTRAL_TREE)) as AncestorNode;
  return removeMemberFromTree(tree, memberId);
}

export async function addDashboardMemberToSharedTreeAsync(member: FamilyMember): Promise<FamilyMember[]> {
  const tree = structuredClone(await hydratePersistedTreeDataFromBackend(ANCESTRAL_TREE)) as AncestorNode;
  const nextMembers = addMemberToTree(tree, member, false);
  await savePersistedTreeDataAsync(tree);
  return nextMembers;
}

export async function updateDashboardMemberInSharedTreeAsync(member: FamilyMember): Promise<FamilyMember[]> {
  const tree = structuredClone(await hydratePersistedTreeDataFromBackend(ANCESTRAL_TREE)) as AncestorNode;
  const nextMembers = updateMemberInTree(tree, member, false);
  await savePersistedTreeDataAsync(tree);
  return nextMembers;
}

export async function deleteDashboardMemberFromSharedTreeAsync(memberId: string): Promise<FamilyMember[]> {
  const tree = structuredClone(await hydratePersistedTreeDataFromBackend(ANCESTRAL_TREE)) as AncestorNode;
  const nextMembers = removeMemberFromTree(tree, memberId, false);
  await savePersistedTreeDataAsync(tree);
  return nextMembers;
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
