import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // iPad 4 uses iOS 10.3.x and an older Safari/WebKit engine.
  // Keep generated JavaScript and CSS syntax within Safari 10 capabilities.
  build: {
    target: 'safari10',
    cssTarget: 'safari10',
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
