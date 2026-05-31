import { ANCESTRAL_TREE } from '../src/data/lineageData';
import {
  computeClanLeaderRules,
  formatNodeTitle,
  getAncestralTierLabel,
  isUnknownText
} from '../src/utils/lineageDisplay';
import { findNodeById, getSpouseNames, parseSpouses, syncSpouseDetailsFromText } from '../src/utils/lineageTreeHelpers';

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(getAncestralTierLabel(0) === 'CAO TỔ', 'generation 0 should show CAO TỔ');
assert(getAncestralTierLabel(1) === 'THỦY TỔ', 'generation 1 should show THỦY TỔ');
assert(getAncestralTierLabel(2) === '', 'generation 2 should not show ancestral tier label');

assert(isUnknownText('Không rõ'), 'Không rõ should be treated as unknown');
assert(isUnknownText('chưa rõ'), 'chưa rõ should be treated as unknown');
assert(!isUnknownText('Nguyễn Thị Lan'), 'real name should not be treated as unknown');

assert(
  formatNodeTitle({ generation: 0, rankRole: 'Cao tổ' }) === 'Cao Tổ - Cao tổ',
  'generation 0 title should show Cao Tổ without đời 0'
);
assert(
  formatNodeTitle({
    generation: 0,
    title: 'Cao Tổ đời 0 - Cao Tổ đời 0 - Cao Cao Mãnh Đế Đại Tướng Quân'
  }) === 'Cao Tổ - Cao Cao Mãnh Đế Đại Tướng Quân',
  'legacy Cao Tổ đời 0 prefixes should be stripped before display'
);
assert(
  formatNodeTitle({ generation: 8, rankRole: 'Ngoại tôn' }) === 'Ngoại tôn đời 8',
  'Ngoại tôn title should be explicit'
);
assert(
  formatNodeTitle({ generation: 2, isLiving: false, deathYear: '1900' }).startsWith('Đệ Nhị thế tổ'),
  'deceased generation 2 should use old-style generation title'
);

const specs = computeClanLeaderRules(ANCESTRAL_TREE);
assert(specs[ANCESTRAL_TREE.id]?.role, 'root should receive a lineage role');

assert(parseSpouses('A, B / C; D').length === 4, 'parseSpouses should split common delimiters');

const spouseNode: any = {
  id: 'n1',
  name: 'Test',
  generation: 1,
  spouse: 'Nguyễn A',
  spouseDetails: [{ name: 'Nguyễn A', birthYear: '1900' }, { name: 'Trần B' }]
};
assert(getSpouseNames(spouseNode).join('|') === 'Nguyễn A|Trần B', 'getSpouseNames should merge text and details without duplicates');
syncSpouseDetailsFromText(spouseNode, 'Trần B');
assert(spouseNode.spouse === 'Trần B', 'syncSpouseDetailsFromText should update spouse text');
assert(spouseNode.spouseDetails[0]?.birthYear === undefined || spouseNode.spouseDetails[0]?.name === 'Trần B', 'syncSpouseDetailsFromText should preserve matching spouse detail shape');
assert(findNodeById(ANCESTRAL_TREE, ANCESTRAL_TREE.id)?.id === ANCESTRAL_TREE.id, 'findNodeById should find root');

console.log('Lineage display helpers OK');
