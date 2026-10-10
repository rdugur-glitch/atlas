import { test, expect } from '@playwright/test';

// These tests predate account ownership. A fresh browser context no longer
// guarantees a disposable workspace. Never delete an authenticated user's
// entire profile as test cleanup; require a dedicated disposable identity
// and cleanup restricted to records created by the tests before re-enabling.
test.skip(true, 'Legacy anonymous UI suite requires an isolated authenticated fixture.');

test('all six sections render without runtime errors or horizontal overflow', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const [route, nav] of [['/', 'merkez'], ['/sohbetler', 'sohbetler'], ['/gorevler', 'gorevler'], ['/ajanda', 'ajanda'], ['/hafiza', 'hafiza'], ['/ayarlar', 'ayarlar']]) {
    await page.goto(route!);
    await expect(page.getByTestId(`nav-${nav}`)).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('error-note')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test('task add, complete, reload and delete use real persistence', async ({ page }) => {
  await page.goto('/gorevler');
  await page.getByRole('button', { name: 'Yeni', exact: false }).click();
  await page.getByTestId('input-item-title').fill('Denetim görevi');
  await page.getByTestId('input-item-content').fill('Kalıcı görev notu');
  await page.getByTestId('button-save-item').click();
  await expect(page.getByText('Denetim görevi', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tamamlandı olarak işaretle' }).click();
  await page.getByTestId('tab-done').click();
  await expect(page.getByText('Denetim görevi', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByTestId('tab-done').click();
  await expect(page.getByText('Denetim görevi', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sil', exact: true }).click();
  await page.getByTestId('button-confirm').click();
  await expect(page.getByText('Denetim görevi', { exact: true })).toHaveCount(0);
});

test('calendar event and memory note support add, edit and delete', async ({ page }) => {
  for (const [route, title] of [['/ajanda', 'Denetim etkinliği'], ['/hafiza', 'Denetim hafızası']]) {
    await page.goto(route!);
    await page.getByRole('button', { name: 'Yeni', exact: false }).click();
    await page.getByTestId('input-item-title').fill(title!);
    await page.getByTestId('input-item-content').fill('İlk ayrıntı');
    if (route === '/ajanda') await page.getByTestId('input-item-date').fill('2026-10-07T12:30');
    await page.getByTestId('button-save-item').click();
    await expect(page.getByText(title!, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /düzenle/i }).click();
    await page.getByTestId('input-item-content').fill('Düzenlenmiş ayrıntı');
    await page.getByTestId('button-save-item').click();
    await page.reload();
    await expect(page.getByText('Düzenlenmiş ayrıntı', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: /sil/i }).click();
    await page.getByTestId('button-confirm').click();
    await expect(page.getByText(title!, { exact: true })).toHaveCount(0);
  }
});

test('settings uses server storage and displays the real invalid-key error', async ({ page }) => {
  const fakeKey = 'atlas-intentionally-invalid-test-key';
  await page.goto('/ayarlar');
  await expect(page.getByTestId('input-model')).toHaveValue('claude-sonnet-5-5');
  await expect(page.getByTestId('input-model')).toHaveJSProperty('readOnly', true);
  await page.getByTestId('input-api-key').fill(fakeKey);
  const response = page.waitForResponse(r => r.url().endsWith('/api/atlas/settings') && r.request().method() === 'PUT');
  await page.getByTestId('button-save-settings').click();
  expect(JSON.stringify(await (await response).json())).not.toContain(fakeKey);
  await expect(page.getByTestId('input-api-key')).toHaveValue('');
  await page.getByTestId('button-verify').click();
  await expect(page.getByTestId('error-note')).toContainText('anahtarı geçersiz', { timeout: 20000 });
  await expect(page.getByTestId('error-note')).toContainText(/invalid bearer token/i);
  await expect(page.getByTestId('error-note')).not.toContainText(fakeKey);
  expect(await page.evaluate(() => JSON.stringify([localStorage, sessionStorage]))).not.toContain(fakeKey);
  await page.getByTestId('button-remove-key').click();
  await page.getByTestId('button-confirm').click();
  await expect(page.getByTestId('text-connection')).toHaveText('API anahtarı eksik');
});

test('chat errors keep the draft across reload and successful responses preserve a next draft', async ({ page }) => {
  await page.goto('/sohbetler?yeni=1');
  await page.getByTestId('input-message').fill('Korunan mesaj');
  await page.getByTestId('button-send').click();
  await expect(page.getByTestId('error-note')).toContainText('anahtarı');
  await page.reload();
  await expect(page.getByTestId('input-message')).toHaveValue('Korunan mesaj');

  // Browser-only success fixture; provider behavior is tested separately on the server.
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/atlas/conversations/*/messages', async route => {
    const id = new URL(route.request().url()).pathname.split('/')[4]!;
    await wait;
    const now = new Date().toISOString();
    await route.fulfill({ json: { id, title: 'Korunan mesaj', createdAt: now, updatedAt: now, messages: [
      { id: 'fixture-user', role: 'user', content: 'Korunan mesaj', createdAt: now },
      { id: 'fixture-ai', role: 'assistant', content: 'Test yanıtı', createdAt: now, truncated: true },
    ] } });
  });
  await page.getByTestId('button-send').click();
  await expect(page.getByTestId('status-thinking')).toBeVisible();
  await page.getByTestId('input-message').fill('Sonraki mesaj taslağı');
  release();
  await expect(page.getByTestId('message-assistant')).toContainText('Test yanıtı');
  await expect(page.getByTestId('message-assistant')).toContainText('kesildi');
  await expect(page.getByTestId('input-message')).toHaveValue('Sonraki mesaj taslağı');
});

test('quick commands replace an older draft and the keyboard keeps the composer visible', async ({ page }) => {
  await page.goto('/sohbetler?yeni=1');
  const chips = await page.locator('.chat-empty button').all();
  const composer = await page.locator('.chat-composer').boundingBox();
  for (const chip of chips) {
    await expect.poll(async () => {
      const bounds = await chip.boundingBox();
      return bounds!.y + bounds!.height;
    }).toBeLessThanOrEqual(composer!.y);
  }
  await page.getByTestId('input-message').fill('Eski taslak');
  await page.getByTestId('nav-merkez').click();
  await page.getByTestId('quick-0').click();
  await expect(page.getByTestId('input-message')).toHaveValue('Bugünkü görevlerim ve ajandam doğrultusunda günümü planlamama yardım et.');
  await page.getByTestId('input-message').focus();
  await page.evaluate(() => {
    // Desktop automation cannot open the real iOS software keyboard.
    const viewport = window.visualViewport!;
    Object.defineProperty(viewport, 'height', { configurable: true, value: window.innerHeight - 300 });
    Object.defineProperty(viewport, 'offsetTop', { configurable: true, value: 0 });
    viewport.dispatchEvent(new Event('resize'));
  });
  await expect(page.locator('html')).toHaveAttribute('data-keyboard-open', 'true');
  await expect(page.getByTestId('nav-merkez')).not.toBeVisible();
  const rect = await page.locator('.chat-composer').boundingBox();
  const height = await page.evaluate(() => window.innerHeight);
  expect(rect!.y + rect!.height).toBeLessThanOrEqual(height - 300);
});
