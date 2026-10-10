import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../artifacts/atlas/', import.meta.url);
const source = new URL('public/models/council/', root);
const built = new URL('dist/public/models/council/', root);
const ids = ['atlas', 'mira', 'nova', 'vex', 'luna', 'orion'];
const manifest = JSON.parse(await readFile(new URL('manifest.json', source), 'utf8'));
assert.deepEqual(manifest.models.map(m => m.id).sort(), [...ids].sort(), 'Six real council models are required.');
for (const model of manifest.models) {
  assert.equal(model.file, `${model.id.toUpperCase()}.glb`, 'Unexpected council asset path.');
  const bytes = await readFile(new URL(model.file, built));
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF', `${model.file}: HTML or invalid model packaged.`);
  assert.equal(bytes.readUInt32LE(4), 2, `${model.file}: unsupported GLB version.`);
  assert.equal(bytes.readUInt32LE(8), bytes.length, `${model.file}: incomplete GLB.`);
  assert.equal(bytes.length, model.bytes, `${model.file}: size mismatch.`);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), model.sha256, `${model.file}: checksum mismatch.`);
  const jsonLength = bytes.readUInt32LE(12);
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a, `${model.file}: missing glTF metadata.`);
  const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength).trim());
  assert.ok(gltf.meshes?.length > 0, `${model.file}: no real mesh.`);
  assert.equal(gltf.animations?.length ?? 0, model.animations.length);
  assert.equal(gltf.skins?.length ?? 0, model.skins);
  for (const resource of [...(gltf.buffers ?? []), ...(gltf.images ?? [])]) {
    assert.ok(!resource.uri || resource.uri.startsWith('data:'), `${model.file}: unresolved external resource.`);
  }
  console.log(`PASS ${model.file}: actual self-contained GLB, SHA256, ${(bytes.length / 1048576).toFixed(2)} MB`);
}
assert.deepEqual(
  JSON.parse(await readFile(new URL('manifest.json', built), 'utf8')),
  manifest,
  'Built model manifest differs from source.',
);
console.log(`PASS: six production council assets verified in ${fileURLToPath(built)}`);
const background = 'assets/atlas-neon-room.png';
const original = await readFile(new URL(`public/${background}`, root));
const bundled = await readFile(new URL(`dist/public/${background}`, root));
assert.equal(bundled.readUInt32BE(0), 0x89504e47, 'Approved backdrop is not a PNG.');
assert.equal(createHash('sha256').update(bundled).digest('hex'), createHash('sha256').update(original).digest('hex'), 'Approved backdrop was not packaged correctly.');
assert.equal(createHash('sha256').update(bundled).digest('hex'), '69683b2796d76557e90ec8066533c0247cd8a283878b432f45f938a5e25ed892', 'Transferred backdrop differs from verified archive.');
console.log('PASS: transferred neon-room PNG packaged unchanged.');
