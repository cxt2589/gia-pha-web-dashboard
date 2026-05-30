const baseUrl = process.env.AI_EVAL_BASE_URL || 'http://127.0.0.1:5174';

const cases = [
  {
    id: 'alias-cao-to',
    message: 'Cao Tổ là ai?',
    expectedContains: ['Cao Đình Thuật', 'Cao Tổ'],
    mustNotContain: ['Cao Đình Thuật - Thủy Tổ']
  },
  {
    id: 'alias-thuy-to',
    message: 'Thủy Tổ là ai?',
    expectedContains: ['Cao Đình Lạng', 'Thủy Tổ'],
    mustNotContain: ['Cao Đình Thuật - Thủy Tổ']
  },
  {
    id: 'alias-cu-lang',
    message: 'cụ Lạng là ai?',
    expectedContains: ['Cao Đình Lạng', 'Thủy Tổ'],
    mustNotContain: ['Cao Đình Thuật']
  },
  {
    id: 'alias-thuan-unverified',
    message: 'Thuần là ai?',
    expectedContains: ['Thuần', 'Chưa có dữ liệu xác minh trong kho tri thức hiện tại.'],
    mustNotContain: ['đã xác minh']
  },
  {
    id: 'han-nom-rule',
    message: 'Quy tắc Hán Nôm nghi vấn là gì?',
    expectedContains: ['Hán'],
    mustNotContain: ['Cao Quý Công', 'Cao Văn Lãm']
  }
];

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

async function runCase(testCase) {
  const response = await fetch(`${baseUrl}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: testCase.message,
      type: 'chat',
      botType: 'eval',
      intent: 'quality_check',
      engine: 'local'
    })
  });
  const data = await response.json();
  const text = String(data.text || '');
  const normalizedText = normalize(text);
  const missing = testCase.expectedContains.filter((item) => !normalizedText.includes(normalize(item)));
  const forbidden = testCase.mustNotContain.filter((item) => normalizedText.includes(normalize(item)));
  return {
    id: testCase.id,
    status: response.status,
    passed: response.ok && missing.length === 0 && forbidden.length === 0,
    missing,
    forbidden,
    model: data.model,
    knowledgeMatchesCount: data.knowledgeMatchesCount || 0,
    text: text.slice(0, 360)
  };
}

const results = [];
for (const testCase of cases) {
  results.push(await runCase(testCase));
}

const failed = results.filter((item) => !item.passed);
console.log(JSON.stringify({
  ok: failed.length === 0,
  total: results.length,
  passed: results.length - failed.length,
  failed: failed.length,
  results
}, null, 2));

if (failed.length) process.exit(1);
