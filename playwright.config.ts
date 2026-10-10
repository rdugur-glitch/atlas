import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

const chromium = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
  (existsSync('/repl/tools/bin/chromium') ? '/repl/tools/bin/chromium' : undefined);

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: { timeout: 7000 },
  workers: 2,
  reporter: 'list',
  use: {
    baseURL: process.env.ATLAS_TEST_URL || 'http://localhost:80',
    trace: 'off', // Do not write screenshots/network bodies containing credentials.
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    { name: 'scene-chromium', use: { browserName: 'chromium', viewport: { width: 1440, height: 810 }, launchOptions: { executablePath: chromium, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } } },
    { name: 'mobile-chromium', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', launchOptions: { executablePath: chromium, args: ['--no-sandbox'] } } },
    { name: 'narrow-chromium', use: { browserName: 'chromium', viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true, launchOptions: { executablePath: chromium, args: ['--no-sandbox'] } } },
    // Run explicitly with --project=mobile-webkit on a host with WebKit dependencies.
    { name: 'mobile-webkit', use: { ...devices['iPhone 13'], browserName: 'webkit' } },
  ],
});
