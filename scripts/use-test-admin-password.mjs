import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TEST_ADMIN_PASSWORD = '123';

const replacements = [
  {
    file: 'src/components/AdminDashboardSection.tsx',
    changes: [
      [
        'passwordInput === "admin" || passwordInput === "123456" || passwordInput === "caogia2026"',
        `passwordInput === "${TEST_ADMIN_PASSWORD}"`
      ],
      [
        'Mật khẩu Quản trị không chính xác! Thử lại \'123456\'.',
        `Mật khẩu Quản trị không chính xác! Thử lại '${TEST_ADMIN_PASSWORD}'.`
      ],
      [
        '*Mật khẩu dùng thử nhanh: <strong>123456</strong> hoặc <strong>admin</strong>',
        `*Mật khẩu dùng thử nhanh: <strong>${TEST_ADMIN_PASSWORD}</strong>`
      ]
    ]
  },
  {
    file: 'src/components/GiaPhaTree.tsx',
    changes: [
      [
        "adminPasswordInput.trim().toLowerCase() === 'admin' || !adminPasswordInput.trim()",
        `adminPasswordInput.trim() === '${TEST_ADMIN_PASSWORD}'`
      ],
      [
        'Sai mật mã định danh. Nhập "admin" hoặc bấm Xác Thực Nhanh để tiếp tục.',
        `Sai mật mã định danh. Nhập "${TEST_ADMIN_PASSWORD}" để tiếp tục.`
      ],
      [
        'Mật mã mặc định là <strong>"admin"</strong>.',
        `Mật mã test tạm thời là <strong>"${TEST_ADMIN_PASSWORD}"</strong>.`
      ],
      [
        "placeholder=\"Nhập 'admin'...\"",
        `placeholder="Nhập '${TEST_ADMIN_PASSWORD}'..."`
      ]
    ]
  }
];

for (const { file, changes } of replacements) {
  const path = resolve(file);
  let content = readFileSync(path, 'utf8');
  let updated = content;

  for (const [from, to] of changes) {
    updated = updated.replace(from, to);
  }

  if (updated !== content) {
    writeFileSync(path, updated, 'utf8');
    console.log(`Updated temporary admin password in ${file}`);
  }
}
