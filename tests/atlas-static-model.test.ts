import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectAtlasGlb } from '../artifacts/atlas/src/components/atlas-3d/atlas-model';
import { staticGlb } from './fixtures/static-glb';

const inspect = (bytes: Buffer) => inspectAtlasGlb(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
test('static GLB does not require a skeleton or any animation clips', () => {
  const json = inspect(staticGlb());
  assert.equal(json.meshes.length, 1);
  assert.equal(json.skins, undefined);
  assert.equal(json.animations, undefined);
});
test('static model validation still blocks remote dependencies and unsafe image types', () => {
  assert.throws(() => inspect(staticGlb({ buffers: [{ byteLength: 36, uri: 'https://example.invalid/model.bin' }] })), /harici/);
  assert.throws(() => inspect(staticGlb({ images: [{ mimeType: 'image/svg+xml', uri: 'data:image/svg+xml,ignored' }] })), /desteklenmeyen/);
});
