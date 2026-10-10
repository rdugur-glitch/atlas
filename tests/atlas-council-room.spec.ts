import { expect, test } from '@playwright/test';

// Genuine room renders without inventing a person; no authenticated data or API calls.
for (const width of [1366, 1440, 1920]) {
  test(`real night chamber at ${width}: six labelled vacant seats, no character or camera drift`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: Math.round(width * 9 / 16) });
    let apiPosts = 0;
    page.on('request', r => { if (r.method() === 'POST' && /\/api\/atlas/.test(r.url())) apiPosts++; });
    const started = Date.now();
    await page.goto('/atlas-3d');
    const scene = page.getByTestId('atlas-viewport');
    await expect(scene).toHaveAttribute('data-has-character', 'false', { timeout: 45000 });
    await expect.poll(() => scene.getAttribute('data-fps'), { timeout: 30000 }).not.toBeNull();
    expect(Number(await scene.getAttribute('data-triangles'))).toBeGreaterThan(1000);
    expect(Number(await scene.getAttribute('data-draw-calls'))).toBeLessThan(220);
    console.log(JSON.stringify({ width, roomReadyMs:Date.now()-started, fps:await scene.getAttribute('data-fps'), renderMs:await scene.getAttribute('data-render-ms'), drawCalls:await scene.getAttribute('data-draw-calls'), triangles:await scene.getAttribute('data-triangles'), quality:await scene.getAttribute('data-quality'), environment:'software/emulated Chromium; not a phone measurement' }));
    const seats = page.locator('.a3d-seat');
    const canvasBox = (await page.getByTestId('atlas-webgl-canvas').boundingBox())!;
    const sceneBox = (await scene.boundingBox())!;
    expect(Math.abs(canvasBox.width-sceneBox.width)).toBeLessThan(1);
    expect(Math.abs(canvasBox.height-sceneBox.height)).toBeLessThan(1);
    await expect(seats).toHaveCount(6);
    const boxes = [];
    for (const id of ['mira','nova','atlas','vex','luna','orion']) {
      const label = page.locator(`[data-seat-id="${id}"]`);
      await expect(label).toBeVisible();
      await expect(label).toContainText('Boş koltuk');
      boxes.push((await label.boundingBox())!);
    }
    for (let i=0;i<boxes.length;i++) for(let j=i+1;j<boxes.length;j++) {
      const a=boxes[i],b=boxes[j];
      expect(a.x+a.width<=b.x || b.x+b.width<=a.x || a.y+a.height<=b.y || b.y+b.height<=a.y).toBeTruthy();
    }
    const camera = await scene.getAttribute('data-camera');
    await page.waitForTimeout(1300);
    expect(await scene.getAttribute('data-camera')).toBe(camera);
    expect(apiPosts).toBe(0);
  });
}

test('mobile room degrades quality, does not overflow, and respects reduced motion', async ({ page }) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion:'reduce' });
  for(const width of [320,390,768]) {
    await page.setViewportSize({width,height:844});
    await page.goto('/atlas-3d');
    await expect(page.getByTestId('atlas-viewport')).toHaveAttribute('data-has-character','false',{timeout:45000});
    await expect.poll(() => page.getByTestId('atlas-viewport').getAttribute('data-camera')).not.toBeNull();
    if(width<640) await expect(page.getByTestId('atlas-viewport')).toHaveAttribute('data-quality','economy');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const animations = await page.locator('.a3d-wave i').evaluateAll(els=>els.map(el=>getComputedStyle(el).animationName));
    expect(animations.every(a=>a==='none')).toBe(true);
    await expect(page.getByTestId('button-choose-model')).toBeVisible();
    const canvasBox=(await page.getByTestId('atlas-webgl-canvas').boundingBox())!;
    const sceneBox=(await page.getByTestId('atlas-viewport').boundingBox())!;
    expect(Math.abs(canvasBox.width-sceneBox.width)).toBeLessThan(1);
    expect(Math.abs(canvasBox.height-sceneBox.height)).toBeLessThan(1);
    if(width<640){
      const uploadBox=(await page.getByTestId('atlas-model-drop').boundingBox())!;
      expect(uploadBox.y).toBeGreaterThanOrEqual(sceneBox.y+sceneBox.height);
    }
    const boxes=[];
    for (const id of ['mira','nova','atlas','vex','luna','orion']) {
      const label=page.locator(`[data-seat-id="${id}"]`);
      await expect(label).toBeVisible();boxes.push((await label.boundingBox())!);
    }
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
      const a=boxes[i],b=boxes[j];
      expect(a.x+a.width<=b.x || b.x+b.width<=a.x || a.y+a.height<=b.y || b.y+b.height<=a.y).toBeTruthy();
    }
  }
});
