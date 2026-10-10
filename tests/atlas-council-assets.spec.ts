import { expect, test } from '@playwright/test';

test('six genuine council assets and responsive command room', async ({ page, request }) => {
  test.setTimeout(150000);
  const ids = ['mira', 'nova', 'atlas', 'vex', 'luna', 'orion'];
  for (const id of ids) {
    const response = await request.get(`/models/council/${id.toUpperCase()}.glb`);
    expect(response.status(), id).toBe(200);
    expect(response.headers()['content-type'], id).not.toContain('text/html');
    const bytes = await response.body();
    expect(bytes.toString('ascii', 0, 4), id).toBe('glTF');
    expect(bytes.readUInt32LE(8), id).toBe(bytes.length);
  }
  let apiPosts = 0;
  const errors: string[] = [];
  page.on('request', r => { if (r.method() === 'POST' && /\/api\/atlas/.test(r.url())) apiPosts++; });
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 810 });
  await page.goto('/atlas-3d');
  const originalCanvas = await page.getByTestId('atlas-webgl-canvas').elementHandle();
  const scene = page.getByTestId('atlas-viewport');
  await expect(scene).toHaveAttribute('data-model-count', '6', { timeout: 90000 });
  await expect(scene).toHaveAttribute('data-ready', 'true', { timeout: 45000 });
  await expect(scene).toHaveAttribute('data-scene-source', 'uploaded-neon-chairless-room');
  await expect(scene).toHaveAttribute('data-chairs', '0');
  await expect(scene).toHaveAttribute('data-hologram-slots', '0');
  await expect(scene).toHaveAttribute('data-neon-style', 'indirect-floor-wash');
  await expect(scene).toHaveAttribute('data-animation', 'static');
  await expect(page.getByTestId('atlas-webgl-canvas')).toHaveAttribute('data-backdrop-status', 'ready');
  expect(await originalCanvas!.evaluate(el => el.isConnected)).toBe(true);
  for (const id of ids) {
    await expect(page.locator(`[data-seat-id="${id}"]`)).toContainText(id.toUpperCase());
    await expect(page.locator(`[data-seat-id="${id}"]`)).not.toContainText('Model bekleniyor');
  }
  await page.screenshot({ path: 'screenshots/atlas-council-desktop.png' });
  for (const width of [1366, 1920, 390]) {
    await page.setViewportSize({ width, height: width < 640 ? 844 : Math.round(width * 9 / 16) });
    await page.waitForTimeout(1200);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const canvas = (await page.getByTestId('atlas-webgl-canvas').boundingBox())!;
    const viewport = (await scene.boundingBox())!;
    expect(Math.abs(canvas.width - viewport.width)).toBeLessThan(1);
    expect(Math.abs(canvas.height - viewport.height)).toBeLessThan(1);
    await expect(scene).toHaveAttribute('data-model-count', '6');
    console.log(JSON.stringify({ width, fps: await scene.getAttribute('data-fps'), renderer: await scene.getAttribute('data-renderer-class'), quality: await scene.getAttribute('data-quality'), models: await scene.getAttribute('data-loaded-models') }));
  }
  await page.screenshot({ path: 'screenshots/atlas-council-mobile.png' });
  expect(errors).toEqual([]);
  expect(apiPosts).toBe(0);
});
