import { test, expect } from '@playwright/test';
import { staticGlb } from './fixtures/static-glb';

test('local unrigged, animation-free GLB loads as a fixed pose without an API upload', async ({ page }) => {
  const posts: string[] = [];
  page.on('request', r => { if (r.method() === 'POST' && /\/api\/atlas\//.test(r.url())) posts.push(r.url()); });
  await page.goto('/atlas-3d');
  const scene = page.getByTestId('atlas-viewport');
  await expect(scene).toHaveAttribute('data-ready', 'true', { timeout: 40000 });
  await page.getByTestId('atlas-model-input').setInputFiles({ name: 'technical-static-fixture.glb', mimeType: 'model/gltf-binary', buffer: staticGlb() });
  await expect(scene).toHaveAttribute('data-model-loaded', 'true', { timeout: 30000 });
  await expect(scene).toHaveAttribute('data-animation', 'static');
  await page.getByText('Model bilgisi', { exact: true }).click();
  await expect(page.getByTestId('atlas-model-info')).toContainText('0 kemik');
  await expect(page.getByTestId('atlas-model-info')).toContainText('Klipler: yok');
  await expect(page.getByTestId('atlas-model-info')).toContainText('animasyonlar oynatılmaz');
  await expect(page.getByTestId('test-speaking')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(scene).toHaveAttribute('data-animation', 'static');
  expect(posts).toEqual([]);
});
