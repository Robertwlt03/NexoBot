import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root,
  base: '/dashboard/',
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL('../dist/dashboard', import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // Dev mode: the bot (npm run dev) serves the API on :3000.
    proxy: { '/dashboard/api': 'http://localhost:3000', '/dashboard/auth': 'http://localhost:3000' },
  },
});
