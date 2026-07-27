import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root=process.cwd();
const required=[
  'admin/index.html',
  'admin/js/admin-module-manifest.js',
  'admin/js/admin-bootstrap.js',
  'admin/js/admin.js',
  'admin/js/modules/assessment-center.js',
  'admin/js/modules/report-store.js',
  'admin/js/modules/clinical-assessment-store.js'
];
const missing=required.filter(file=>!existsSync(resolve(root,file)));
if(missing.length){
  console.error('필수 파일 누락:\n'+missing.map(x=>' - '+x).join('\n'));
  process.exit(1);
}
const manifest=readFileSync(resolve(root,'admin/js/admin-module-manifest.js'),'utf8');
const refs=[...manifest.matchAll(/src:'([^']+)'/g)].map(match=>match[1].split('?')[0]);
const missingRefs=refs.filter(src=>{
  const relative=src.replace(/^\.\//,'');
  return !existsSync(resolve(root,'admin',relative));
});
if(missingRefs.length){
  console.error('manifest 참조 파일 누락:\n'+missingRefs.map(x=>' - '+x).join('\n'));
  process.exit(1);
}
console.log(`관리자 필수 파일 정상: ${required.length}개`);
console.log(`manifest 참조 정상: ${refs.length}개`);
