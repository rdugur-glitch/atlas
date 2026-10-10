import { test, expect, type Page } from '@playwright/test';
// Account ownership requires a genuine authenticated fixture, not an auth bypass.
test.skip(true, 'Voice UI suite requires an isolated authenticated fixture.');
test.setTimeout(60000);
test.use({ reducedMotion: 'reduce' });

// Simulates browser voice services, not a physical microphone or live Claude.
async function voiceBrowser(page: Page, supported = true) {
  await page.route('**/fonts.googleapis.com/**', route => route.abort());
  await page.route('**/fonts.gstatic.com/**', route => route.abort());
  await page.addInitScript(({ supported }) => {
    const w = window as any;
    w.voiceTest = { rec: null, spoken: [], utterance: null, cancellations: 0 };
    class Recognition {
      onresult: any; onerror: any; onend: any; onstart: any;
      start() { w.voiceTest.rec = this; this.onstart?.(); }
      stop() { this.onend?.(); }
      abort() { this.onerror?.({ error: 'aborted' }); this.onend?.(); }
      result(text: string, final = true) {
        this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: final })] });
      }
      finish(text: string) { this.result(text); this.onend?.(); }
      fail(error: string) { this.onerror?.({ error }); this.onend?.(); }
    }
    Object.defineProperty(window, 'SpeechRecognition', { configurable: true, value: supported ? Recognition : undefined });
    Object.defineProperty(window, 'webkitSpeechRecognition', { configurable: true, value: undefined });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: class {
      text: string;
      constructor(text: string) { this.text = text; }
    } });
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      getVoices: () => [{ lang: 'tr-TR', name: 'Türkçe test sesi', localService: true }],
      addEventListener() {}, removeEventListener() {},
      cancel() { w.voiceTest.cancellations++; },
      speak(u: any) { if (u.text.trim()) { w.voiceTest.spoken.push(u.text); w.voiceTest.utterance = u; } },
    } });
  }, { supported });
}

async function apiFixture(page: Page) {
  const date = new Date().toISOString();
  const items: any[] = [];
  const messages: any[] = [];
  const sent: any[] = [];
  let applications = 0;
  const conversation = () => ({ id: 'voice-chat', title: 'Sesli komut', createdAt: date, updatedAt: date, messages });
  await page.route('**/api/atlas/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    let body: any;
    if (path.endsWith('/state')) body = {
      settings: { hasKey: true, connected: true, model: 'claude-sonnet-5-5', name: '', verifiedAt: date },
      items, conversations: messages.length ? [conversation()] : [],
      summary: { pendingTasks: items.length, completedTasks: 0, eventsToday: 0, memories: 0 },
    };
    else if (path.endsWith('/conversations') && method === 'POST') body = conversation();
    else if (path.endsWith('/messages') && method === 'POST') {
      const input = route.request().postDataJSON();
      sent.push(input);
      messages.push({ id: `u-${sent.length}`, role: 'user', content: input.content, source: input.source, createdAt: date });
      messages.push({ id: `a-${sent.length}`, role: 'assistant', content: 'Öneri hazır. Onayınız bekleniyor.', createdAt: date,
        actions: sent.length === 1 ? [{ id: 'proposal-1', type: 'create_task', label: 'Süt ekle', title: 'Alışveriş: süt', status: 'pending' }] : [],
      });
      body = conversation();
    } else if (path.endsWith('/actions/proposal-1/apply')) {
      applications++;
      const approve = route.request().postDataJSON().approve;
      const action = messages[1].actions[0];
      if (action.status === 'pending' && approve) items.push({ id: 'milk', kind: 'task', title: 'Alışveriş: süt', content: '', completed: false, startsAt: null, createdAt: date });
      action.status = approve ? 'applied' : 'dismissed';
      body = { action, message: approve ? 'Görev eklendi.' : 'Öneri iptal edildi.', navigateTo: null };
    } else if (path.endsWith('/conversations/voice-chat')) {
      body = structuredClone(conversation());
      if (!messages.length) await new Promise(resolve => setTimeout(resolve, 350));
    }
    else return route.fulfill({ status: 404, json: { message: 'Test endpointi bulunamadı' } });
    await route.fulfill({ json: body });
  });
  return { sent, items, applications: () => applications };
}

test('voice transcript sends once, persists as voice, proposals require approval; next typed message is text', async ({ page }) => {
  await voiceBrowser(page);
  const api = await apiFixture(page);
  await page.goto('/');
  await page.getByTestId('button-voice-start').click();
  await expect(page.getByTestId('text-voice-status')).toHaveText('Dinliyorum…');
  await page.evaluate(() => (window as any).voiceTest.rec.finish('Alışveriş listeme süt ekle'));
  await expect(page.getByTestId('badge-voice')).toBeVisible();
  await expect(page.getByTestId('card-action-proposal-1')).toBeVisible();
  expect(api.sent).toHaveLength(1);
  expect(api.sent[0]).toMatchObject({ content: 'Alışveriş listeme süt ekle', source: 'voice' });
  expect(api.sent[0].timezone).toBeTruthy();
  expect(page.url()).not.toContain('Alışveriş');
  expect(api.items).toHaveLength(0);
  await page.getByTestId('button-approve-proposal-1').click();
  await expect(page.getByTestId('status-action-proposal-1')).toContainText('Uygulandı');
  expect(api.items).toHaveLength(1);
  await page.getByTestId('input-message').fill('Teşekkürler');
  await page.getByTestId('button-send').click();
  await expect.poll(() => api.sent.length).toBe(2);
  expect(api.sent[1].source).toBe('text');
  await page.reload();
  await expect(page.getByTestId('badge-voice')).toBeVisible();
  await expect(page.getByTestId('status-action-proposal-1')).toContainText('Uygulandı');
  expect(api.applications()).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('unsupported browsers offer keyboard dictation and focus composer', async ({ page }) => {
  await voiceBrowser(page, false);
  const api = await apiFixture(page);
  await page.goto('/');
  await expect(page.getByTestId('voice-unsupported')).toContainText('dikte');
  await page.getByTestId('link-voice-fallback').click();
  await expect(page.getByTestId('input-message')).toBeFocused();
  expect(api.sent).toHaveLength(0);
});

test('denied permission, canceled recording, interim-only and recognition errors never send', async ({ page }) => {
  await voiceBrowser(page);
  const api = await apiFixture(page);
  await page.goto('/');
  await page.getByTestId('button-voice-start').click();
  await page.evaluate(() => (window as any).voiceTest.rec.fail('not-allowed'));
  await expect(page.getByTestId('text-voice-error')).toContainText('Mikrofon izni');
  await page.getByTestId('button-voice-error-close').click();
  await page.getByTestId('button-voice-start').click();
  await page.evaluate(() => (window as any).voiceTest.rec.result('Geçici metin', false));
  await page.getByTestId('button-voice-stop').click();
  await expect(page.getByTestId('text-voice-error')).toContainText('Ses duyulmadı');
  await page.getByTestId('button-voice-error-close').click();
  await page.getByTestId('button-voice-start').click();
  await page.evaluate(() => (window as any).voiceTest.rec.result('Yanlışlıkla gönderilmesin'));
  await page.getByTestId('button-voice-cancel').click();
  await page.getByTestId('button-voice-start').click();
  await page.evaluate(() => { (window as any).voiceTest.rec.result('Ağ hatasından önce'); (window as any).voiceTest.rec.fail('network'); });
  await expect(page.getByTestId('text-voice-error')).toContainText('internet');
  expect(api.sent).toHaveLength(0);
  expect(page.url()).not.toContain('sohbetler');
});

test('microphone test does not send chats; manual TTS can stop and exposes blocked playback', async ({ page }) => {
  await voiceBrowser(page);
  const api = await apiFixture(page);
  await page.goto('/ayarlar');
  await page.getByTestId('button-mic-test').click();
  await page.evaluate(() => (window as any).voiceTest.rec.finish('Mikrofon denemesi'));
  await expect(page.getByTestId('section-voice')).toContainText('Mikrofon denemesi');
  expect(api.sent).toHaveLength(0);
  await page.goto('/');
  await page.getByTestId('button-voice-start').click();
  await page.evaluate(() => (window as any).voiceTest.rec.finish('Süt ekle'));
  await page.getByTestId('button-read-a-1').click();
  await expect(page.getByTestId('button-read-a-1')).toHaveAttribute('aria-label', 'Okumayı durdur');
  expect(await page.evaluate(() => (window as any).voiceTest.spoken.length)).toBeGreaterThan(0);
  await page.getByTestId('button-read-a-1').click();
  await expect(page.getByTestId('button-read-a-1')).toHaveAttribute('aria-label', 'Sesli oku');
  await page.getByTestId('button-read-a-1').click();
  await page.evaluate(() => (window as any).voiceTest.utterance.onerror({ error: 'not-allowed' }));
  await expect(page.getByTestId('tts-error')).toContainText(/tarayıcı/i);
});

test('voice handoff works even if session storage is blocked', async ({ page }) => {
  await voiceBrowser(page);
  await page.addInitScript(() => Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('Storage blocked', 'SecurityError'); } }));
  const api = await apiFixture(page);
  await page.goto('/');
  await page.getByTestId('button-voice-start').click();
  await page.evaluate(() => (window as any).voiceTest.rec.finish('Süt ekle'));
  await expect(page.getByTestId('badge-voice')).toBeVisible();
  await expect.poll(() => api.sent.length).toBe(1);
});
