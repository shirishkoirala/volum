import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8090';

const publicPath = process.env.VITE_PUBLIC_PATH ?? '';

export default defineConfig({
  base: publicPath || '/',
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
    setupFiles: ['./src/test/setup.ts'],
    environmentOptions: {
      jsdom: {
        url: 'http://localhost',
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/api/icons.ts',
        'src/assets/**',
        'src/**/*.d.ts',
      ],
    },
  }
});
