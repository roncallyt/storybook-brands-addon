import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.STORYBOOK_TEST_PORT ?? '4173');
const staticDirectory = process.env.STORYBOOK_STATIC_DIRECTORY;

if (staticDirectory === undefined) {
  throw new Error('STORYBOOK_STATIC_DIRECTORY must identify a built consumer Storybook');
}

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  retries: 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node scripts/serve-storybook.mjs',
    url: `http://127.0.0.1:${port}/index.json`,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
