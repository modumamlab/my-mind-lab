import { defineConfig } from 'vite';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

function copyLegacyRuntimeFiles() {
  return {
    name: 'copy-legacy-runtime-files',
    closeBundle() {
      const outDir = resolve(process.cwd(), 'dist');
      const copies = [
        ['admin/js', 'admin/js'],
        ['ai', 'ai'],
        ['client', 'client'],
        ['js/report-viewer.js', 'js/report-viewer.js'],
        ['js/app.jsx', 'js/app.jsx']
      ];

      for (const [source, target] of copies) {
        const from = resolve(process.cwd(), source);
        const to = resolve(outDir, target);
        if (!existsSync(from)) continue;
        mkdirSync(resolve(to, '..'), { recursive: true });
        cpSync(from, to, { recursive: true, force: true });
      }
    }
  };
}

export default defineConfig({
  root: '.',
  appType: 'mpa',
  plugins: [copyLegacyRuntimeFiles()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/.netlify/functions': {
        target: 'http://localhost:8888',
        changeOrigin: true,
        secure: false
      }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), 'index.html'),
        admin: resolve(process.cwd(), 'admin/index.html')
      }
    }
  }
});
