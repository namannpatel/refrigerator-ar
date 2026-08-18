import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  /** Set VITE_BASE_PATH=/your-repo-name/ when building for GitHub Pages project sites. */
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [basicSsl()],
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
  },
  server: {
    host: true,
    port: 5173,
    https: true,
  },
  preview: {
    host: true,
    port: 4173,
    https: true,
  },
});
