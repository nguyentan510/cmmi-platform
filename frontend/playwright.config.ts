import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const python =
  process.env.CMMI_TEST_PYTHON ??
  (existsSync('../.venv/Scripts/python.exe') ? resolve('../.venv/Scripts/python.exe') : 'python');
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5174',
    headless: true,
    viewport: { width: 1440, height: 980 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: `"${python}" ../backend/tests/serve_e2e.py`,
      url: 'http://127.0.0.1:8011/health',
      timeout: 60000,
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev -- --port 5174 --strictPort',
      url: 'http://127.0.0.1:5174',
      timeout: 60000,
      reuseExistingServer: false,
      env: { CMMI_API_TARGET: 'http://127.0.0.1:8011' },
    },
  ],
});
