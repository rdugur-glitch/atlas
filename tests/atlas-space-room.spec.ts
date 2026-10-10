import { expect, test } from '@playwright/test';

// Uses the public scene only: no sign-in, API posts, keys, or personal-record reads.
for (const size of [{ width: 1366, height: 768 }, { width: 1440, height: 810 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
  test(`uploaded space room, no chairs or invented characters: ${size.width}`, async ({ page }) => {
    test.setTimeout(150000);
    await page.setViewportSize(size);
    const errors: string[] = [], posts: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (r.method() === 'POST' && /\/api\/atlas/.test(r.url())) posts.push(r.url().split('?')[0]); });
    const started = Date.now();
    await page.goto('/atlas-3d');
    const scene = page.getByTestId('atlas-viewport');
    await expect(scene).toHaveAttribute('data-ready', 'true', { timeout: 60000 });
    console.log(`scene ${size.width}: WebGL ready`);
    await expect(scene).toHaveAttribute('data-scene-source', 'uploaded-atlas-room');
    await expect(scene).toHaveAttribute('data-chairs', '0');
    await expect(scene).toHaveAttribute('data-hologram-slots', '7');
    await expect(scene).toHaveAttribute('data-standing-areas', '6');
    await expect(scene).toHaveAttribute('data-model-count', '6', { timeout: 90000 });
    await expect(scene).toHaveAttribute('data-has-character', 'true');
    await expect(scene).toHaveAttribute('data-animation', 'static');
    expect((await scene.getAttribute('data-loaded-models'))?.split(',').sort()).toEqual(['atlas', 'luna', 'mira', 'nova', 'orion', 'vex']);
    await expect(page.getByTestId('test-idle')).toHaveCount(0);
    await expect(page.getByTestId('test-listening')).toHaveCount(0);
    await expect(page.getByTestId('test-speaking')).toHaveCount(0);
    await expect.poll(() => scene.getAttribute('data-fps'), { timeout: 30000 }).not.toBeNull();
    console.log(`scene ${size.width}: fps=${await scene.getAttribute('data-fps')}, triangles=${await scene.getAttribute('data-triangles')}`);
    expect(Number(await scene.getAttribute('data-triangles'))).toBeGreaterThan(1000);
    const boxes: { x: number; y: number; width: number; height: number }[] = [];
    for (const id of ['mira', 'nova', 'atlas', 'vex', 'luna', 'orion']) {
      const label = page.locator(`.a3d-seat[data-seat-id="${id}"]`);
      await expect(label).toBeVisible();
      await expect(label).toContainText('Gerçek model');
      boxes.push((await label.boundingBox())!);
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      expect(overlap, `labels ${i}/${j} overlap`).toBe(false);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    console.log(`scene ${size.width}: six labels clear, capturing`);
    await page.screenshot({ path: `/tmp/atlas-space-room-${size.width}.png`, fullPage: true, timeout: 10000 });
    console.log(`scene ${size.width}: screenshot saved`);
    // Full-page capture can temporarily resize R3F. Wait for the restored viewport's actual home angle.
    const homeZ = await scene.evaluate(el => {
      const r = el.getBoundingClientRect();
      return Math.max(9, 5 / (Math.tan(26 * Math.PI / 180) * r.width / r.height));
    });
    await expect.poll(async () => Math.abs(Number((await scene.getAttribute('data-camera'))?.split(',')[2]) - homeZ), { timeout: 15000 }).toBeLessThan(.01);
    const original = `0.000,2.650,${homeZ.toFixed(3)}`;
    await page.getByTestId('button-camera-table').click();
    await expect.poll(() => scene.getAttribute('data-camera')).not.toBe(original);
    await page.getByTestId('button-camera-free').click();
    await page.getByTestId('button-camera-cine').click();
    await page.getByTestId('button-reset-camera').click();
    await expect.poll(() => scene.getAttribute('data-camera'), { timeout: 10000 }).toBe(original);
    await page.locator('.a3d-seat[data-seat-id="mira"]').click();
    await expect(page.locator('.a3d-seat[data-seat-id="mira"]')).toHaveAttribute('data-active', 'true');
    expect(posts).toEqual([]);
    expect(errors).toEqual([]);
    await expect(page.getByRole('alert')).toHaveCount(0);
    console.log(JSON.stringify({ viewport: size, readyMs: Date.now() - started, fps: await scene.getAttribute('data-fps'), triangles: await scene.getAttribute('data-triangles'), drawCalls: await scene.getAttribute('data-draw-calls'), renderer: await scene.getAttribute('data-renderer-class'), warning: 'Real static Meshy models in software Chromium; not physical Safari/performance verification' }));
  });
}
