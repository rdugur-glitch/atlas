/** Technical triangle fixture only; not a human/ATLAS model and never shipped as a scene asset. */
export function staticGlb(overrides: Record<string, unknown> = {}) {
  const positions = new Float32Array([-.3, 0, 0, .3, 0, 0, 0, 1.85, 0]);
  const json = {
    asset: { version: '2.0', generator: 'Technical static-loader fixture, not ATLAS' },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    materials: [{ doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [.2, .6, .7, 1], metallicFactor: 0, roughnessFactor: .8 } }],
    buffers: [{ byteLength: positions.byteLength }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: positions.byteLength }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [-.3, 0, 0], max: [.3, 1.85, 0] }],
    ...overrides,
  };
  const text = JSON.stringify(json), jsonBytes = Buffer.from(text + ' '.repeat((4 - Buffer.byteLength(text) % 4) % 4));
  const bytes = Buffer.alloc(12 + 8 + jsonBytes.length + 8 + positions.byteLength);
  bytes.writeUInt32LE(0x46546c67, 0); bytes.writeUInt32LE(2, 4); bytes.writeUInt32LE(bytes.length, 8);
  bytes.writeUInt32LE(jsonBytes.length, 12); bytes.writeUInt32LE(0x4e4f534a, 16); jsonBytes.copy(bytes, 20);
  const bin = 20 + jsonBytes.length;
  bytes.writeUInt32LE(positions.byteLength, bin); bytes.writeUInt32LE(0x004e4942, bin + 4);
  Buffer.from(positions.buffer).copy(bytes, bin + 8);
  return bytes;
}
