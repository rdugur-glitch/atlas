import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { pool } from '@workspace/db';
import { testApp } from './atlas-test-app';
import { ensureAccountSchema, profileId } from './atlas-account';
import { claude, providerFailure } from './atlas-claude';
import { encrypt, AtlasFailure, type WorkspaceData } from './atlas-store';

const fakeKey = 'atlas-unit-test-not-a-real-provider-key';
const data: WorkspaceData = { items: [], conversations: [], settings: { name: '', model: 'claude-sonnet-5-5', hasKey: true, connected: false, verifiedAt: null } };
const encrypted = encrypt(fakeKey);
const realFetch = globalThis.fetch;
after(async () => { globalThis.fetch = realFetch; await pool.end(); });

test('provider errors are classified, retain safe messages and never echo keys', () => {
  for (const [status, message, code] of [
    [401, 'invalid x-api-key', 'invalid_key'],
    [400, 'Invalid request', 'provider_error'],
    [402, 'Payment required', 'insufficient_credit'],
    [400, 'Your credit balance is too low', 'insufficient_credit'],
    [404, 'model not found', 'model_access'],
    [400, 'Invalid model', 'model_access'],
    [403, 'Permission denied', 'permission_denied'],
    [429, 'rate limit exceeded', 'rate_limit'],
    [529, 'overloaded', 'provider_unavailable'],
  ] as const) {
    const error = providerFailure(status, `${message} ${fakeKey} sk-ant-synthetic-key`, fakeKey, '7');
    assert.equal(error.code, code);
    assert.ok(!error.providerMessage?.includes(fakeKey));
    assert.ok(!error.providerMessage?.includes('sk-ant-'));
    if (status === 429) assert.equal(error.retryAfter, 7);
  }
});

test('minimal check sends only required Messages fields with Bearer authentication', async () => {
  globalThis.fetch = async (input, init) => {
    assert.equal(input, 'https://api.anthropic.com/v1/messages');
    const body = JSON.parse(init!.body as string);
    assert.deepEqual(body, { model: 'claude-sonnet-5-5', max_tokens: 64, messages: [{ role: 'user', content: 'Merhaba.' }] });
    assert.equal(new Headers(init!.headers).get('Authorization'), `Bearer ${fakeKey}`);
    assert.equal(new Headers(init!.headers).get('x-api-key'), null);
    return new Response(JSON.stringify({ type: 'message', id: 'msg_test', role: 'assistant', content: [{ type: 'text', text: 'Bağlantı başarılı' }], stop_reason: 'end_turn' }));
  };
  assert.equal((await claude(data, encrypted, [{ role: 'user', content: 'Merhaba' }], true)).text, 'Bağlantı başarılı');
  globalThis.fetch = realFetch;
});

test('minimal verification accepts thinking-only Messages replies without fabricating chat text', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({
    type: 'message', id: 'msg_test', role: 'assistant',
    content: [{ type: 'thinking', thinking: 'Internal test thinking' }], stop_reason: 'max_tokens',
  }));
  assert.equal((await claude(data, encrypted, [], true)).text, '');
  await assert.rejects(claude(data, encrypted, [{ role: 'user', content: 'Test' }]), error => error instanceof AtlasFailure && error.code === 'empty_response');
  globalThis.fetch = async () => new Response('{}');
  await assert.rejects(claude(data, encrypted, [], true), error => error instanceof AtlasFailure && error.code === 'invalid_response');
  globalThis.fetch = realFetch;
});

test('truncation, missing text, network failure and unreadable key are explicit', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ content: [{ type: 'text', text: 'Yarım yanıt' }], stop_reason: 'max_tokens' }));
  assert.equal((await claude(data, encrypted, [{ role: 'user', content: 'Test' }])).truncated, true);
  globalThis.fetch = async () => new Response(JSON.stringify({ content: [], stop_reason: 'refusal' }));
  await assert.rejects(claude(data, encrypted, [{ role: 'user', content: 'Test' }]), error => error instanceof AtlasFailure && error.code === 'empty_response');
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(claude(data, encrypted, [{ role: 'user', content: 'Test' }]), error => error instanceof AtlasFailure && error.code === 'network_error');
  await assert.rejects(claude(data, 'broken', [{ role: 'user', content: 'Test' }]), error => error instanceof AtlasFailure && error.code === 'key_unreadable');
  globalThis.fetch = realFetch;
});

test('long histories and note contexts keep whole content and show a limit notice', async () => {
  const longData = structuredClone(data);
  longData.settings.model = 'claude-old-model';
  longData.items = Array.from({ length: 20 }, (_, i) => ({ id: `${i}`, kind: 'memory', title: 'Not', content: 'a'.repeat(5000), completed: false, startsAt: null, createdAt: new Date().toISOString() }));
  const messages = Array.from({ length: 130 }, (_, i) => ({ role: i % 2 ? 'assistant' as const : 'user' as const, content: `Mesaj ${i}` }));
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(init!.body as string);
    assert.equal(body.model, 'claude-sonnet-5-5');
    assert.equal(new Headers(init!.headers).get('Authorization'), `Bearer ${fakeKey}`);
    for (const field of ['thinking', 'tool_choice', 'temperature', 'top_p', 'top_k']) assert.ok(!(field in body));
    assert.ok(body.messages.length <= 120);
    assert.equal(body.messages[0].role, 'user');
    const context = JSON.parse(body.system.split('İzinli kullanıcı bağlamı: ')[1]);
    assert.ok(context.length < longData.items.length);
    return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Yanıt' }], stop_reason: 'end_turn' }));
  };
  assert.ok((await claude(longData, encrypted, messages)).contextNotice);
  globalThis.fetch = realFetch;
});

test('chat persistence, independent writes, concurrency and key removal race', async () => {
  await ensureAccountSchema();
  const actor = `claude-fixture-${randomUUID()}`;
  const server = createServer(testApp(actor));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}/api/atlas`;
  let cookie = '';
  let workspaceId = '';
  const request = async (path: string, method = 'GET', body?: unknown) => {
    const response = await realFetch(base + path, { method, headers: { cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    if (!cookie) {
      cookie = response.headers.get('set-cookie')!.split(';')[0]!;
      workspaceId = profileId(actor);
    }
    return { status: response.status, body: await response.json() as any };
  };
  try {
    await request('/account');
    await request('/state');
    await request('/settings', 'PUT', { model: 'claude-sonnet-5-5', apiKey: fakeKey });
    assert.equal((await request('/settings', 'PUT', { model: 'claude-other' })).body.code, 'model_fixed');
    globalThis.fetch = async (_input, init) => {
      assert.equal(new Headers(init!.headers).get('Authorization'), `Bearer ${fakeKey}`);
      assert.deepEqual(JSON.parse(init!.body as string), { model: 'claude-sonnet-5-5', max_tokens: 64, messages: [{ role: 'user', content: 'Merhaba.' }] });
      return new Response(JSON.stringify({ type: 'message', id: 'msg_verify', role: 'assistant', content: [{ type: 'thinking' }], stop_reason: 'max_tokens' }));
    };
    const verification = await request('/settings/verify', 'POST');
    assert.equal(verification.status, 200);
    assert.equal(verification.body.connected, true);
    assert.ok(verification.body.verifiedAt);
    assert.ok(!JSON.stringify(verification.body).includes(fakeKey));
    const created = await request('/conversations', 'POST', {});
    let release!: () => void;
    let started!: () => void;
    const start = new Promise<void>(resolve => { started = resolve; });
    const pending = new Promise<void>(resolve => { release = resolve; });
    globalThis.fetch = async (input, init) => {
      assert.equal(input, 'https://api.anthropic.com/v1/messages');
      const body = JSON.parse(init!.body as string);
      assert.equal(body.tools[0].name, 'atlas_actions');
      started();
      await pending;
      return new Response(JSON.stringify({ content: [{ type: 'tool_use', name: 'atlas_actions', input: {
        reply: 'Gerçek kayıt akışı test yanıtı',
        actions: [{ type: 'create_task', label: 'Süt ekle', title: 'Alışveriş: süt' }],
      } }], stop_reason: 'tool_use' }));
    };
    const send = request(`/conversations/${created.body.id}/messages`, 'POST', { content: 'Alışveriş listeme süt ekle', source: 'voice', timezone: 'Europe/Istanbul' });
    await start;
    const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Writes blocked by AI request')), 2000).unref());
    const task = await Promise.race([request('/items', 'POST', { kind: 'task', title: 'Test' }), timeout]);
    assert.equal(task.status, 200);
    assert.equal((await request(`/conversations/${created.body.id}/messages`, 'POST', { content: 'Duplicate' })).status, 409);
    await request('/settings', 'DELETE');
    release();
    assert.equal((await send).status, 200);
    const conversation = await request(`/conversations/${created.body.id}`);
    assert.equal(conversation.body.messages.length, 2);
    assert.match(conversation.body.messages[1].content, /Gerçek kayıt akışı test yanıtı/);
    assert.equal(conversation.body.messages[0].source, 'voice');
    const action = conversation.body.messages[1].actions[0];
    assert.equal(action.status, 'pending');
    assert.equal((await request('/state')).body.items.length, 1);
    const [applied, duplicate] = await Promise.all([
      request(`/actions/${action.id}/apply`, 'POST', { approve: true }),
      request(`/actions/${action.id}/apply`, 'POST', { approve: true }),
    ]);
    assert.equal(applied.status, 200);
    assert.equal(duplicate.status, 200);
    assert.equal(applied.body.action.status, 'applied');
    assert.equal((await request(`/actions/${action.id}/apply`, 'POST', { approve: true })).status, 200);
    assert.equal((await request('/actions/foreign-action/apply', 'POST', { approve: true })).status, 404);
    assert.equal((await request(`/actions/${action.id}/apply`, 'POST', { approve: 'true' })).status, 400);
    const state = await request('/state');
    assert.equal(state.body.settings.hasKey, false);
    assert.equal(state.body.settings.connected, false);
    assert.equal(state.body.items.length, 2);
    assert.ok(!JSON.stringify(state.body).includes(fakeKey));
    const crossSite = await realFetch(base + '/items', { method: 'POST', headers: { cookie, origin: 'https://evil.example', 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'task', title: 'CSRF' }) });
    assert.equal(crossSite.status, 403);
    await crossSite.text();
  } finally {
    globalThis.fetch = realFetch;
    if (workspaceId) await pool.query('DELETE FROM atlas_workspaces WHERE id=$1', [workspaceId]);
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('structured replies are validated; unsafe tool suggestions never mutate records', async () => {
  const snapshot = structuredClone(data);
  globalThis.fetch = async () => new Response(JSON.stringify({
    content: [{ type: 'tool_use', name: 'atlas_actions', input: {
      reply: 'Öneriyi değerlendirin', actions: [{ type: 'delete', label: 'Her şeyi sil' }],
    } }], stop_reason: 'tool_use',
  }));
  const reply = await claude(snapshot, encrypted, [{ role: 'user', content: 'Sil' }]);
  assert.equal(reply.actions?.length, 0);
  assert.match(reply.contextNotice!, /hiçbir işlem uygulanmadı/);
  assert.equal(snapshot.items.length, 0);
  globalThis.fetch = realFetch;
});
