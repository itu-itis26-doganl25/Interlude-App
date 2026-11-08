import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const frontendTests = fileURLToPath(new URL('../../tests/frontend/', import.meta.url));

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.DEV_API_PROXY_TARGET || 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: 'jsdom',
      dir: frontendTests,
      setupFiles: [fileURLToPath(new URL('../../tests/frontend/setup.ts', import.meta.url))],
      include: ['**/*.{test,spec}.{ts,tsx}'],
      css: true,
    },
  };
});
