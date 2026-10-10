// Offline only: originals stay in the uploaded archive; runtime needs no CLI.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, textureCompress, prune } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { readdir, mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

const input = resolve(process.argv[2] ?? '/tmp/atlas-character-import/karakterler');
const output = resolve(process.argv[3] ?? 'artifacts/atlas/public/models/council');
const ids = ['atlas', 'mira', 'nova', 'vex', 'luna', 'orion'];
const files = await readdir(input);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
await MeshoptSimplifier.ready;
await mkdir(output, { recursive: true });
const report = [];
const triangles = doc => doc.getRoot().listMeshes().reduce((sum, mesh) =>
  sum + mesh.listPrimitives().reduce((n, p) => n + (p.getIndices()?.getCount() ?? 0) / 3, 0), 0);

for (const id of ids) {
  const matches = files.filter(f => f.toLowerCase().includes(id) && f.endsWith('.glb'));
  if (matches.length !== 1) throw new Error(`Ambiguous or missing real model for ${id}`);
  const original = await readFile(join(input, matches[0]));
  const doc = await io.readBinary(original);
  const before = triangles(doc);
  // Error bounded to 0.15% of mesh radius; never force collapse beyond this.
  await doc.transform(
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, 80000 / before), error: .0015 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [2048, 2048], quality: 92 }),
    textureCompress({ encoder: sharp, targetFormat: 'webp', slots: /normalTexture|metallicRoughnessTexture|occlusionTexture/, resize: [1024, 1024], quality: 95 }),
    prune(),
  );
  const data = await io.writeBinary(doc);
  await writeFile(join(output, `${id.toUpperCase()}.glb`), data);
  const item = {
    id, source: matches[0], sourceBytes: original.length,
    sourceSha256: createHash('sha256').update(original).digest('hex'),
    file: `${id.toUpperCase()}.glb`, bytes: data.length,
    sha256: createHash('sha256').update(data).digest('hex'),
    sourceTriangles: before, triangles: triangles(doc),
    skins: doc.getRoot().listSkins().length,
    animations: doc.getRoot().listAnimations().map(a => a.getName()),
  };
  report.push(item);
  console.log(JSON.stringify(item));
}
await writeFile(join(output, 'manifest.json'), JSON.stringify({
  note: 'Real Meshy static models. Error-bounded web derivatives; original uploaded archive preserved. No body animation.',
  models: report,
}, null, 2));
