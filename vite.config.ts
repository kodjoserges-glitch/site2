import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // On GitHub Pages le site est servi sous /nom-du-repo/
  // La variable VITE_BASE_PATH est injectée par le workflow GitHub Actions
  base: process.env.VITE_BASE_PATH ?? '/',
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
