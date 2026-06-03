export function getLineageAddressByGeneration(generation) {
  const value = Number(generation);
  if (!Number.isFinite(value)) return '';
  if (value <= 0) return 'Cao Tổ';
  if (value === 1) return 'Thủy Tổ';
  if (value >= 2 && value <= 7) return 'Cụ';
  if (value === 8) return 'Ông';
  return 'Anh';
}

export function formatPersonDisplayAddress(person = {}) {
  const specialTitle = String(person.requiredTitle || person.required_title || person.title || person.displayTitle || '').trim();
  const generation = person.generation ?? person.generationIndex ?? person.generation_index;
  const ruleTitle = getLineageAddressByGeneration(generation);
  const address = specialTitle || ruleTitle;
  const name = String(person.fullName || person.full_name || person.name || person.canonicalName || person.canonical_name || '').trim();
  return [address, name].filter(Boolean).join(' ');
}
