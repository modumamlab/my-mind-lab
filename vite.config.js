import { resolve } from 'node:path';

export default {
  root: '.',
  publicDir: 'public',
  server: {
    host: '0.0.0.0',
    port: 5190,
    strictPort: true,
    open: false
  },
  preview: {
    host: '0.0.0.0',
    port: 5190,
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
};
