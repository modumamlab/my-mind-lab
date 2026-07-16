import { cp, mkdir, rm, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const out = new URL('./dist/', import.meta.url);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const file of ['index.html']) {
  await copyFile(new URL(`./${file}`, import.meta.url), new URL(`./dist/${file}`, import.meta.url));
}

for (const dir of ['js', 'admin', 'ai']) {
  const source = new URL(`./${dir}/`, import.meta.url);
  if (existsSync(source)) {
    await cp(source, new URL(`./dist/${dir}/`, import.meta.url), { recursive: true });
  }
}

console.log('Static site copied to dist/');
