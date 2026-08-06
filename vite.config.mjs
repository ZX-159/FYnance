import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Renderer build for Electron: relative base so the app works from file://
export default defineConfig({
  root: 'src-renderer',
  base: './',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'chrome120',
    sourcemap: false,
    assetsInlineLimit: 0,
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});
