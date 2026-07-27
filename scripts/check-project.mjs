import { existsSync } from 'node:fs';

const required = [
  'index.html',
  'admin/index.html',
  'js/app.jsx',
  'netlify/functions',
  'vite.config.js',
  'netlify.toml'
];

const missing = required.filter((item) => !existsSync(item));
if (missing.length) {
  console.error('필수 파일 누락:', missing.join(', '));
  process.exit(1);
}
console.log('프로젝트 구조 확인 완료');
