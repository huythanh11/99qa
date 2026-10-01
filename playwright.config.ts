import { defineConfig, devices } from '@playwright/test';
import { environment } from './src/config/environment.js';

const uiTests = 'ui/**/*.spec.ts';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  workers: environment.workers,
  retries: environment.retries,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  outputDir: 'reports/artifacts',
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'reports/html' }],
    ['junit', { outputFile: 'reports/junit.xml' }],
    ['json', { outputFile: 'reports/results.json' }],
  ],
  use: {
    baseURL: environment.baseURL,
    actionTimeout: 12_000,
    navigationTimeout: 25_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: process.env.RECORD_VIDEO === '1' ? 'on' : 'retain-on-failure',
  },
  // Projects pick the browser or device. Suites (@smoke, @regression, @mobile, @known-bug) are tags.
  projects: [
    { name: 'chromium', testMatch: uiTests, grepInvert: /@mobile/, use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', testMatch: uiTests, grepInvert: /@mobile/, use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', testMatch: uiTests, grepInvert: /@mobile/, use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', testMatch: uiTests, use: { ...devices['Pixel 7'] } },
    { name: 'api', testMatch: 'api/**/*.spec.ts' },
    { name: 'performance', testMatch: 'performance/**/*.spec.ts' },
    // Unit tests sit next to the helper they cover, under src/.
    { name: 'unit', testDir: './src', testMatch: '**/*.test.ts', use: { ...devices['Desktop Chrome'] } },
  ],
});
