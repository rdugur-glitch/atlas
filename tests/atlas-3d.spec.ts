import { expect, test } from '@playwright/test';
import { glbFixture } from './atlas-3d-fixture';

test('local 3D upload is public and honest: room visible but leader chair empty until the actual file is selected', async ({page}) => {
  await page.goto('/atlas-3d');
  await expect(page.getByTestId('atlas-model-drop')).toContainText('ATLAS modelini yükle');
  await expect(page.getByTestId('atlas-model-drop')).toContainText('Sayfayı yenilerseniz yeniden seçmeniz gerekir');
  await expect(page.getByTestId('atlas-model-drop')).toContainText('Ayrı animasyon, konum veya iskelet ayarı gerekmez');
  await expect(page.getByTestId('atlas-viewport')).toHaveAttribute('data-has-character','false');
  await expect(page.getByTestId('atlas-webgl-canvas')).toHaveCount(1);
  for (const m of ['idle','listening','speaking']) await expect(page.getByTestId(`test-${m}`)).toBeDisabled();
  await page.getByTestId('atlas-model-input').setInputFiles({ name:'bad.glb',mimeType:'model/gltf-binary',buffer:Buffer.from('not a model') });
  await expect(page.getByTestId('atlas-model-error')).toContainText('geçerli bir GLB değil');
});

test('missing skeleton, clips, and external resources produce explicit Turkish errors', async ({page}) => {
  await page.goto('/atlas-3d');
  for (const [opts, text] of [[{rig:false},'iskelet bulunamadı'],[{clips:false},'animasyonları eksik'],[{external:true},'harici dosya']] as const) {
    await page.getByTestId('atlas-model-input').setInputFiles({name:'technical-test.glb',mimeType:'model/gltf-binary',buffer:glbFixture(opts)});
    await expect(page.getByTestId('atlas-model-error')).toContainText(text);
    await expect(page.getByTestId('atlas-viewport')).toHaveAttribute('data-has-character','false');
  }
});

test('technical GLB fixture genuinely loads, uses one rig, plays all clips, and orbits/zooms/resets', async ({page}) => {
  test.setTimeout(90000); // Software WebGL in CI is considerably slower than device GPUs.
  await page.setViewportSize({width:1440,height:900});
  let posts = 0;
  page.on('request',r => { if (r.method() === 'POST' && /\/api\/atlas/.test(r.url())) posts++; });
  await page.goto('/atlas-3d');
  await page.getByTestId('atlas-model-input').setInputFiles({name:'technical-test.glb',mimeType:'model/gltf-binary',buffer:glbFixture({movingHips:true})});
  await expect(page.getByTestId('atlas-model-info')).toContainText('2 kemik');
  const viewport = page.getByTestId('atlas-viewport');
  await expect(viewport).toHaveAttribute('data-model-loaded','true');
  await expect(viewport).toHaveAttribute('data-empty-seats','5');
  await expect(page.locator('input[type=range]')).toHaveCount(0);
  const pelvis = (await viewport.getAttribute('data-pelvis'))!.split(',').map(Number);
  expect(Number(await viewport.getAttribute('data-table-back'))).toBeGreaterThan(Number(await viewport.getAttribute('data-body-max-z')));
  await page.getByTestId('animation-test-toggle').click();
  for (const m of ['idle','listening','speaking','idle','speaking','listening','idle']) {
    await page.getByTestId(`test-${m}`).click();
    await expect(viewport).toHaveAttribute('data-clip',`ATLAS_SEATED_${m.toUpperCase()}`);
    await expect(page.getByTestId('atlas-webgl-canvas')).toHaveCount(1);
    const now = (await viewport.getAttribute('data-pelvis'))!.split(',').map(Number);
    expect(Math.abs(now[0] - pelvis[0])).toBeLessThan(.001);
    expect(Math.abs(now[1] - pelvis[1])).toBeLessThan(.03);
    expect(Math.abs(now[2] - pelvis[2])).toBeLessThan(.001);
  }
  await page.getByTestId('test-live').click();
  await expect(viewport).toHaveAttribute('data-animation','idle');
  const initial = await viewport.getAttribute('data-camera');
  await page.getByTestId('atlas-webgl-canvas').scrollIntoViewIfNeeded();
  const box = await page.getByTestId('atlas-webgl-canvas').boundingBox(); expect(box).not.toBeNull();
  await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);
  await page.mouse.down(); await page.mouse.move(box!.x+box!.width/2+100,box!.y+box!.height/2+20,{steps:10}); await page.mouse.up();
  await expect.poll(() => viewport.getAttribute('data-camera')).not.toBe(initial);
  const orbited = await viewport.getAttribute('data-camera');
  await page.mouse.wheel(0,-200);
  await expect.poll(() => viewport.getAttribute('data-camera')).not.toBe(orbited);
  await page.getByTestId('button-reset-camera').click();
  await expect.poll(() => viewport.getAttribute('data-camera')).toBe(initial);
  await page.getByTestId('atlas-model-input').setInputFiles({name:'bad.glb',mimeType:'model/gltf-binary',buffer:Buffer.from('bad')});
  await expect(page.getByTestId('atlas-model-error')).toBeVisible();
  await expect(page.getByTestId('atlas-model-info')).toContainText('technical-test.glb');
  expect(posts).toBe(0);
  await page.reload();
  await expect(page.getByTestId('atlas-model-drop')).toBeVisible();
});

test('drag and drop imports a real GLB; no horizontal overflow at 320/390/768', async ({page}) => {
  await page.goto('/atlas-3d');
  const bytes = [...glbFixture()];
  await page.getByTestId('atlas-model-drop').evaluate((el, data) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(data)],'technical-drop.glb',{type:'model/gltf-binary'}));
    el.dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:transfer}));
  },bytes);
  await expect(page.getByTestId('atlas-model-info')).toContainText('technical-drop.glb');
  await expect(page.getByTestId('atlas-viewport')).toHaveAttribute('data-model-loaded','true');
  for (const width of [320,390,768]) {
    await page.setViewportSize({width,height:844});
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
  }
});

test('WebGL unavailable reports honest fallback rather than claiming animation works', async ({page}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type: any,...args: any[]) {
      if (String(type).includes('webgl')) return null;
      return original.call(this,type,...args);
    } as any;
  });
  await page.goto('/atlas-3d');
  await page.getByTestId('atlas-model-input').setInputFiles({name:'technical-test.glb',mimeType:'model/gltf-binary',buffer:glbFixture()});
  await expect(page.getByTestId('atlas-model-error')).toContainText('3D/WebGL açılamadı');
  await expect(page.getByTestId('test-speaking')).toBeDisabled();
  await expect(page.getByTestId('atlas-animation-mode')).toContainText('kullanılamıyor');
});

test('project model is loaded automatically and maps original Meshy names without user choices (technical fixture)', async ({page}) => {
  test.setTimeout(90000);
  await page.route('**/models/ATLAS_Animated.glb', r => r.fulfill({
    contentType:'model/gltf-binary',
    body:glbFixture({names:['Chair_Sit_Idle_M','Listening_Gesture','Sitting_Answering_Questions'],movingHips:true}),
  }));
  await page.goto('/atlas-3d');
  await expect(page.getByTestId('atlas-model-info')).toContainText('Projedeki gerçek dosyadan otomatik açıldı');
  await expect(page.getByTestId('atlas-viewport')).toHaveAttribute('data-clip','Chair_Sit_Idle_M');
  await expect(page.locator('input[type=range]')).toHaveCount(0);
  await expect(page.getByTestId('animation-test-toggle')).toBeVisible();
  await expect(page.getByTestId('test-speaking')).not.toBeVisible();
  await page.getByTestId('animation-test-toggle').click();
  await page.getByTestId('test-listening').click();
  await expect(page.getByTestId('atlas-viewport')).toHaveAttribute('data-clip','Listening_Gesture');
  await page.getByTestId('test-speaking').click();
  await expect(page.getByTestId('atlas-viewport')).toHaveAttribute('data-clip','Sitting_Answering_Questions');
  await page.getByTestId('animation-test-toggle').click();
  await expect(page.getByTestId('atlas-viewport')).toHaveAttribute('data-animation','idle');
});

test('one local selection survives in-app back/forward navigation without re-upload', async ({page}) => {
  test.setTimeout(90000);
  await page.goto('/');
  await page.locator('a[href="/atlas-3d"]').click();
  await page.getByTestId('atlas-model-input').setInputFiles({name:'technical-session.glb',mimeType:'model/gltf-binary',buffer:glbFixture()});
  await expect(page.getByTestId('atlas-viewport')).toHaveAttribute('data-model-loaded','true');
  await page.goBack();
  await expect(page.getByTestId('atlas-3d-experience')).toHaveCount(0);
  await page.goForward();
  await expect(page.getByTestId('atlas-model-info')).toContainText('technical-session.glb');
  await expect(page.getByTestId('atlas-viewport')).toHaveAttribute('data-model-loaded','true');
  await expect(page.getByTestId('atlas-webgl-canvas')).toHaveCount(1);
});

test('native TTS onstart/end/cancel/error drive real voice context playback, not enqueue', async ({page}) => {
  await page.addInitScript(() => {
    const win = window as any;
    win.__tts = [];
    win.SpeechSynthesisUtterance = class { constructor(public text: string) {} };
    Object.defineProperty(window,'speechSynthesis',{ configurable:true,value:{
      getVoices:() => [{lang:'tr-TR',localService:true}],
      addEventListener:() => {}, removeEventListener:() => {},
      cancel:() => {}, speak:(u: any) => win.__tts.push(u),
    }});
  });
  // Isolated test-only document; no auth bypass added to app code or personal endpoints.
  await page.route('**/__atlas3d-voice-test',r => r.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script type="module">
    import React from '/node_modules/.vite/deps/react.js';
    import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
    import RefreshRuntime from '/@react-refresh';
    RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
    const {VoiceProvider,useVoice}=await import('/src/components/voice/voice-provider.tsx');
    const {Router}=await import('/node_modules/.vite/deps/wouter.js');
    function Probe(){const v=useVoice();return React.createElement('div',{},
      React.createElement('div',{'data-testid':'playing'},v.playingId??'idle'),
      React.createElement('div',{'data-testid':'queued'},v.speakingId??'idle'),
      React.createElement('button',{onClick:()=>v.setPrefs({sound:true})},'sound'),
      React.createElement('button',{onClick:()=>v.speak('atlas:probe','Merhaba.')},'speak'),
      React.createElement('button',{onClick:v.stopSpeaking},'stop'))}
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Router,{},React.createElement(VoiceProvider,{},React.createElement(Probe))));
    </script></body></html>`}));
  await page.goto('/__atlas3d-voice-test');
  await page.getByRole('button',{name:'sound',exact:true}).click();
  await page.getByRole('button',{name:'speak',exact:true}).click();
  await expect(page.getByTestId('queued')).toHaveText('atlas:probe');
  await expect(page.getByTestId('playing')).toHaveText('idle');
  await page.evaluate(() => (window as any).__tts.at(-1).onstart());
  await expect(page.getByTestId('playing')).toHaveText('atlas:probe');
  await page.evaluate(() => (window as any).__tts.at(-1).onend());
  await expect(page.getByTestId('playing')).toHaveText('idle');
  for (const error of ['canceled','interrupted','network']) {
    await page.getByRole('button',{name:'speak',exact:true}).click();
    await page.evaluate(() => (window as any).__tts.at(-1).onstart());
    await expect(page.getByTestId('playing')).toHaveText('atlas:probe');
    await page.evaluate(code => (window as any).__tts.at(-1).onerror({error:code}),error);
    await expect(page.getByTestId('playing')).toHaveText('idle');
  }
  await page.getByRole('button',{name:'speak',exact:true}).click();
  await page.evaluate(() => (window as any).__tts.at(-1).onstart());
  await page.getByRole('button',{name:'stop',exact:true}).click();
  await expect(page.getByTestId('playing')).toHaveText('idle');
});
