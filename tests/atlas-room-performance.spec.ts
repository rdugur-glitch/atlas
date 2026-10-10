import { expect, test } from '@playwright/test';

test('measure warm steady software-rendered room separately from shader startup and real phones',async({page})=>{
  test.setTimeout(60000);
  await page.setViewportSize({width:1440,height:900});
  const started=Date.now();
  await page.goto('/atlas-3d');
  const viewport=page.getByTestId('atlas-viewport');
  await expect.poll(()=>viewport.getAttribute('data-fps'),{timeout:30000}).not.toBeNull();
  const roomReadyMs=Date.now()-started;
  await page.waitForTimeout(6000); // Exclude first shader compilation window.
  const samples=[];
  for(let i=0;i<4;i++){
    samples.push(await viewport.evaluate(el=>({fps:Number((el as HTMLElement).dataset.fps),renderMs:Number((el as HTMLElement).dataset.renderMs)})));
    await page.waitForTimeout(1250);
  }
  console.log(JSON.stringify({width:1440,roomReadyMs,quality:await viewport.getAttribute('data-quality'),renderer:await viewport.getAttribute('data-renderer-class'),samples,scope:'Chromium software rendering/emulation only, no actual ATLAS model and no physical phone'}));
  expect(samples.every(s=>Number.isFinite(s.fps)&&s.fps>0)).toBe(true);
});
