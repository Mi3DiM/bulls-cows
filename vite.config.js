import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

/**
 * The site is deployed as a static bundle to GitHub Pages / Netlify / Vercel.
 *
 * On GitHub Pages the app is served from `https://<user>.github.io/<repo>/`,
 * so `base` must include the repository segment. We read it from the
 * `GITHUB_REPOSITORY` env var that the Pages workflow provides, and fall back
 * to `/` for Netlify / Vercel where the app lives at the domain root.
 */
const repo = process.env.GITHUB_REPOSITORY;
const base = repo ? `/${repo.split('/')[1]}/` : '/';

export default defineConfig({
  base,
  plugins: [tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    // Keep the shipped payload small: the whole game must load fast on mobile data.
    chunkSizeWarningLimit: 300,
    rollupOptions: {
      output: {
        // Keep PeerJS in its own chunk so the app shell can paint before the
        // transport is parsed.
        manualChunks(id) {
          if (id.includes('node_modules/peerjs')) return 'peerjs';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  preview: {
    port: 4173,
  },
});
