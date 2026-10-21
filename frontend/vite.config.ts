import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: Object.fromEntries(
      ['/api', '/docs', '/redoc', '/openapi.json', '/llms.txt', '/llms-full.txt', '/health'].map(
        (path) => [path, process.env.CMMI_API_TARGET ?? 'http://127.0.0.1:8000'],
      ),
    ),
  },
  test: {
    environment: 'jsdom',
    include: ['src/tests/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/tests/setup.ts'],
    restoreMocks: true,
    testTimeout: 15000,
  },
});
