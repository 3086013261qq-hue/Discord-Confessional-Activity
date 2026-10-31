import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
const blocked = JSON.parse(
  readFileSync(new URL('./public/assets/tarot/manifest.json', import.meta.url), 'utf8'),
)
  .assets.filter((a: { enabled: boolean; adult_only: boolean }) => !a.enabled || a.adult_only)
  .map((a: { path: string }) => a.path.replace(/^public\//, ''));
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'exclude-disabled-runtime-art',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          let path;
          try {
            path = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\//, '');
          } catch {
            res.statusCode = 400;
            res.end();
            return;
          }
          if (blocked.includes(path)) {
            res.statusCode = 404;
            res.end();
            return;
          }
          next();
        });
      },
    },
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/ws': { target: 'ws://localhost:3001', ws: true },
      '/cloud': 'http://localhost:3001',
    },
  },
  build: { outDir: 'dist' },
});
