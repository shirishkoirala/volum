import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8090';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    watch: {
      ignored: ['**/src/assets/**']
    },
    proxy: {
      '/api': apiProxyTarget,
      '/healthz': apiProxyTarget
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  }
});
