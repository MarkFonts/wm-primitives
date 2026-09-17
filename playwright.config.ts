import { defineConfig, devices } from '@playwright/test'

/* EVAL.md §3. Two pointer profiles (Q2): a desktop mouse in Chromium, and WebKit wearing
   the iPhone descriptor -- the nearest a runner gets to Safari. No tablet.
   Baselines are cut on linux in CI and committed; a run on a laptop compares against
   those and reports, which is information, not a verdict (EVAL §3). */
export default defineConfig({
  testDir: 'tests',
  outputDir: 'test-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  updateSnapshots: process.env.CI ? 'none' : 'missing',
  expect: {
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.002 },
  },
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node tests/serve.mjs',
    url: 'http://localhost:4173/font-proofer/',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'iphone',  use: { ...devices['iPhone 14'] } },
  ],
})
