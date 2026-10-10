import { expect, test, type Page } from '@playwright/test';

const order = ['mira', 'nova', 'atlas', 'vex', 'luna', 'orion'];
const roles = ['Müşteri & Satış', 'Muhasebe & Finans', 'Şahsi Asistan & Strateji', 'Reklam & Büyüme', 'Sosyal Medya & İçerik', 'Operasyon & Proje'];
const assetRoute = '**/assets/atlas-council-master.png';

// Network-only solid image fixture: NOT approved artwork, never saved or shipped.
const imageFixture = '<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024"><rect width="1536" height="1024" fill="#060a14"/></svg>';
async function loadFixture(page: Page) {
  await page.route(assetRoute, route => route.fulfill({ contentType: 'image/svg+xml', body: imageFixture }));
}

test('missing approved asset is explicit; no old robot portraits are rendered', async ({ page }) => {
  await page.route(assetRoute, route => route.fulfill({ status: 404, body: '' }));
  await page.goto('/', { waitUntil: 'commit' });
  await expect(page.getByTestId('scene-asset-note')).toContainText('Sahne görseli bekleniyor');
  await expect(page.getByTestId('scene-master-image')).toHaveCount(0);
  await expect(page.locator('.cc-body,.cc-head,.cc-fig')).toHaveCount(0);
  await expect(page.getByTestId('hologram-zone')).toHaveCount(0);
  await expect(page.getByTestId('text-preview-note')).toContainText('Kimse dinlemiyor');
  await expect(page.locator('[data-testid^="control-"]')).toHaveCount(0);
});

test('an HTML 200 response is not accepted as the scene image', async ({ page }) => {
  await page.route(assetRoute, route => route.fulfill({ contentType: 'text/html', body: '<html>Not an image</html>' }));
  await page.goto('/', { waitUntil: 'commit' });
  await expect(page.getByTestId('scene-canvas')).toHaveAttribute('data-asset', 'error');
  await expect(page.getByTestId('scene-asset-note')).toBeVisible();
});

for (const width of [1366, 1440, 1920]) {
  test(`1536×1024 image, hotspots and HTML stay aligned on ${width}px 16:9 desktop`, async ({ page }) => {
    await loadFixture(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width, height: Math.round(width * 9 / 16) });
    await page.goto('/', { waitUntil: 'commit' });
    const canvas = page.getByTestId('scene-canvas');
    await expect(canvas).toHaveAttribute('data-asset', 'ok');
    const frame = (await canvas.boundingBox())!;
    const image = (await page.getByTestId('scene-master-image').boundingBox())!;
    expect(Math.abs(frame.width / frame.height - 1.5)).toBeLessThan(0.01);
    expect(image).toEqual(frame);
    expect(frame.x).toBeGreaterThanOrEqual(0);
    expect(frame.x + frame.width).toBeLessThanOrEqual(width);
    const positions = [];
    const labels = [];
    for (let i = 0; i < order.length; i++) {
      const id = order[i];
      const seat = page.getByTestId(`seat-${id}`);
      const r = (await seat.boundingBox())!;
      expect(r.x).toBeGreaterThanOrEqual(frame.x - 1);
      expect(r.x + r.width).toBeLessThanOrEqual(frame.x + frame.width + 1);
      expect(r.y).toBeGreaterThanOrEqual(frame.y - 1);
      expect(r.y + r.height).toBeLessThanOrEqual(frame.y + frame.height + 1);
      positions.push(r.x + r.width / 2);
      await expect(page.getByTestId(`label-${id}`)).toContainText(roles[i]);
      const label = (await page.getByTestId(`label-${id}`).boundingBox())!;
      expect(label.x).toBeGreaterThanOrEqual(frame.x - 1);
      expect(label.x + label.width).toBeLessThanOrEqual(frame.x + frame.width + 1);
      labels.push(label);
      await seat.click();
      await expect(seat).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId(`glow-${id}`)).toBeVisible();
    }
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(Math.abs(positions[2] - (frame.x + frame.width / 2))).toBeLessThan(1);
    for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
      const a = labels[i], b = labels[j];
      expect(a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y,
        `${order[i]} / ${order[j]} HTML labels overlap`).toBe(false);
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  });
}

test('mobile pans to each real hotspot without reducing HTML labels to unreadable text', async ({ page }) => {
  await loadFixture(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/', { waitUntil: 'commit' });
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    for (let i = 0; i < order.length; i++) {
      const id = order[i];
      await page.getByRole('button', { name: `${id.toUpperCase()}, ${roles[i]} kişisine odaklan` }).click();
      await expect(page.getByTestId(`seat-${id}`)).toHaveAttribute('aria-pressed', 'true');
      const r = (await page.getByTestId(`seat-${id}`).boundingBox())!;
      expect(r.x + r.width).toBeGreaterThan(0);
      expect(r.x).toBeLessThan(width);
      const size = await page.getByTestId(`label-${id}`).evaluate(el => parseFloat(getComputedStyle(el.children[1]).fontSize));
      expect(size).toBeGreaterThanOrEqual(11);
    }
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 810 });
  await expect.poll(() => page.locator('.cc-pan').evaluate(el => el.scrollLeft)).toBe(0);
});

// Isolated presentational component in an intercepted HTML document.
// No auth bypass, API calls, user records, real mic permission or provider fixture.
test('real scene props drive voice pulses, bubble, detail and control callbacks', async ({ page }) => {
  await loadFixture(page);
  await page.route('**/scene-component-test.html', route => route.fulfill({ contentType: 'text/html', body: `
    <html><head><meta charset="utf-8"/><link rel="stylesheet" href="/src/index.css"/></head><body><div id="root" style="height:720px"></div>
    <script type="module">
    import React from '/node_modules/.vite/deps/react.js';
    import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
    const {useState}=React;
    const {createRoot}=ReactDOM;
    import RefreshRuntime from '/@react-refresh';
    RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$=()=>{};
    window.$RefreshSig$=()=>type=>type;
    window.__vite_plugin_react_preamble_installed__=true;
    const {TableScene}=await import('/src/components/table/table-scene.tsx');
    function Harness(){
      const [props,setProps]=useState({status:'idle'});
      window.setSceneProps=setProps;
      return React.createElement(TableScene,{...props,className:'h-full',atlasSpeech:'Gerçek mesaj fixture metni',
        onSelect:id=>{window.selected=id},onDetail:id=>{window.detail=id},onControl:id=>{window.control=id}});
    }
    createRoot(document.getElementById('root')).render(React.createElement(Harness));
    </script></body></html>` }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/scene-component-test.html', { waitUntil: 'commit' });
  await expect(page.getByTestId('scene-canvas')).toHaveAttribute('data-asset', 'ok');
  await expect(page.getByTestId('atlas-speech')).toContainText('Gerçek mesaj fixture metni');
  for (const status of ['listening', 'thinking', 'speaking']) {
    await page.evaluate(status => (window as any).setSceneProps({ status, activeId: 'nova', speechBeat: 2 }), status);
    await expect(page.getByTestId('seat-nova')).toHaveAttribute('data-state', status);
    await expect(page.getByTestId('glow-nova')).toHaveAttribute('data-s', status);
    await expect(page.getByTestId('table-waveform')).toHaveAttribute('data-state', status);
  }
  await page.getByTestId('seat-mira').click();
  expect(await page.evaluate(() => [(window as any).selected, (window as any).detail])).toEqual(['mira', 'mira']);
  for (const id of ['gorevler', 'ajanda', 'hafiza', 'raporlar', 'ayarlar']) {
    await page.getByTestId(`control-${id}`).click();
    expect(await page.evaluate(() => (window as any).control)).toBe(id);
  }
  const wave = (await page.getByTestId('table-waveform-zone').boundingBox())!;
  const controls = (await page.getByTestId('table-control-zone').boundingBox())!;
  expect(wave.y + wave.height).toBeLessThanOrEqual(controls.y);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const loops = await page.getByTestId('table-scene').evaluate(el =>
    el.getAnimations({ subtree: true }).filter(a => a.playState === 'running' && a.effect?.getTiming().iterations === Infinity).length);
  expect(loops).toBe(0);
});
