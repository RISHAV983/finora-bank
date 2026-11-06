import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(frontendDir, '..');
const backendDir = path.join(projectRoot, 'backend');
const windows = process.platform === 'win32';
const localPython = path.join(backendDir, '.venv', windows ? 'Scripts/python.exe' : 'bin/python');
const python =
  process.env.PYTHON || (existsSync(localPython) ? localPython : windows ? 'python' : 'python3');
const quote = (value) => `"${value}"`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : 'list',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  outputDir: 'test-results',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `${quote(python)} app.py`,
      cwd: backendDir,
      url: 'http://127.0.0.1:5000/api/health',
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        FLASK_HOST: '127.0.0.1',
        PORT: '5000',
        FINORA_TEST_LLM: '1',
        // The suite registers many users from one IP; raise limits for tests only.
        FINORA_REGISTER_LIMIT: '1000',
        FINORA_LOGIN_IP_LIMIT: '1000',
        FINORA_LOGIN_ACCOUNT_LIMIT: '1000',
        FINORA_CHAT_PER_MINUTE: '1000',
        FINORA_CHAT_PER_DAY: '10000',
      },
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'npm run dev -- --host 127.0.0.1',
      cwd: frontendDir,
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
});
