const hasVietnameseDiacritic = (value: string) => {
  const normalized = value.normalize("NFD");
  return /[\u0300-\u036f]/.test(normalized) || /[\u0111\u0110]/.test(value);
};

export type VietnameseSearchQuery = {
  raw: string;
  strict: string;
  loose: string;
  hasDiacritics: boolean;
  strictTokenGroups: string[][];
  looseTokenGroups: string[][];
};

type TokenAliasMap = Record<string, string[]>;

export const normalizeVietnameseSearchStrict = (value: unknown) => String(value ?? "")
  .toLowerCase()
  .replace(/[^\p{L}0-9\s]/gu, " ")
  .replace(/\s+/g, " ")
  .trim();

export const normalizeVietnameseSearchLoose = (value: unknown) => normalizeVietnameseSearchStrict(value)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/\u0111/g, "d")
  .replace(/\u0110/g, "D")
  .replace(/\s+/g, " ")
  .trim();

const buildTokenGroups = (normalized: string, aliases: TokenAliasMap = {}) => normalized
  .split(/\s+/)
  .filter(Boolean)
  .map((token) => Array.from(new Set([token, ...(aliases[token] || [])].filter(Boolean))));

export const createVietnameseSearchQuery = (
  value: unknown,
  {
    strictAliases = {},
    looseAliases = {}
  }: { strictAliases?: TokenAliasMap; looseAliases?: TokenAliasMap } = {}
): VietnameseSearchQuery => {
  const raw = String(value ?? "").trim();
  const strict = normalizeVietnameseSearchStrict(raw);
  const loose = normalizeVietnameseSearchLoose(raw);
  return {
    raw,
    strict,
    loose,
    hasDiacritics: hasVietnameseDiacritic(raw),
    strictTokenGroups: buildTokenGroups(strict, strictAliases),
    looseTokenGroups: buildTokenGroups(loose, looseAliases)
  };
};

const hasEveryTokenGroup = (haystack: string, groups: string[][]) =>
  groups.length > 0 && groups.every((group) => group.some((token) => haystack.includes(token)));

export const matchesVietnameseSearch = (value: unknown, query: VietnameseSearchQuery) => {
  if (!query.strict && !query.loose) return false;

  const strictHaystack = normalizeVietnameseSearchStrict(value);
  if (query.hasDiacritics) {
    return hasEveryTokenGroup(strictHaystack, query.strictTokenGroups);
  }

  const looseHaystack = normalizeVietnameseSearchLoose(value);
  return hasEveryTokenGroup(looseHaystack, query.looseTokenGroups);
};
