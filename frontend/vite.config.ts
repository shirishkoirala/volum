import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8090';
const apiProxyOrigin = new URL(apiProxyTarget).origin;

const publicPath = process.env.VITE_PUBLIC_PATH ?? '';

export default defineConfig({
  base: publicPath || '/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Origin', apiProxyOrigin);
          });
        },
      },
      '/healthz': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
});
