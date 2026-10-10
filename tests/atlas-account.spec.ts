import { test, expect } from '@playwright/test';

test.use({ reducedMotion: 'reduce', baseURL: process.env.ATLAS_TEST_URL || 'http://127.0.0.1:80' });
test('public mobile entry and sign-in remain responsive; private routes fail closed', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, route => route.abort());
  const response = await request.get('/api/atlas/state');
  expect(response.status()).toBe(401);
  expect((await response.json()).code).toBe('sign_in_required');
  expect(response.headers()['cache-control']).toContain('no-store');
  expect(response.headers()['set-cookie'] ?? '').not.toContain('atlas_workspace=');
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('link-header-sign-in')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.getByTestId('link-header-sign-in').click();
  await expect(page.getByText('ATLAS hesabınıza girin', { exact: true })).toBeVisible();
  await expect(page.getByLabel('E-posta adresi', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.goto('/profil', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('link-header-sign-in')).toBeVisible();
  expect(errors).toEqual([]);
});
