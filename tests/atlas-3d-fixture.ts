/** Technical skinned rectangle fixture only, NEVER shipped as the user's Meshy character. */
export function glbFixture(options: { rig?: boolean; clips?: boolean; external?: boolean; movingHips?: boolean; names?: string[] } = {}) {
  const chunks: Buffer[] = [];
  const views: any[] = [];
  const accessors: any[] = [];
  let size = 0;
  function add(values: number[], componentType: number, type: string, count: number, extra: object = {}) {
    const b = componentType === 5126 ? Buffer.from(new Float32Array(values).buffer) : Buffer.from(new Uint16Array(values).buffer);
    const padded = Buffer.alloc(Math.ceil(b.length / 4) * 4); b.copy(padded);
    const vi = views.length;
    views.push({ buffer: 0, byteOffset: size, byteLength: b.length });
    chunks.push(padded); size += padded.length;
    accessors.push({ bufferView: vi, componentType, type, count, ...extra });
    return accessors.length - 1;
  }
  const pos = add([-.25, 0, 0, .25, 0, 0, -.25, 1.4, 0, .25, 1.4, 0], 5126, 'VEC3', 4, { min: [-.25, 0, 0], max: [.25, 1.4, 0] });
  const joints = add([0,0,0,0, 0,0,0,0, 1,0,0,0, 1,0,0,0], 5123, 'VEC4', 4);
  const weights = add([1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], 5126, 'VEC4', 4);
  const indices = add([0,1,2, 2,1,3], 5123, 'SCALAR', 6);
  const ibm = add([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,-.6,0,1, 1,0,0,0, 0,1,0,0, 0,0,1,0, 0,-1,0,1], 5126, 'MAT4', 2);
  const time = add([0,.5,1], 5126, 'SCALAR', 3, { min:[0], max:[1] });
  const names = options.names ?? ['ATLAS_SEATED_IDLE', 'ATLAS_SEATED_LISTENING', 'ATLAS_SEATED_SPEAKING'];
  const animations = names.map((name, i) => {
    const a = [.03,.3,-.3][i];
    const output = add([0,0,0,1, 0,0,Math.sin(a/2),Math.cos(a/2), 0,0,0,1], 5126, 'VEC4', 3);
    const samplers = [{ input:time, output, interpolation:'LINEAR' }];
    const channels = [{ sampler:0, target:{ node:2, path:'rotation' } }];
    if (options.movingHips) {
      const positions = i === 0 ? [0,.6,0, 0,.61,0, 0,.6,0] : [2,3,2, 3,4,3, 2,3,2];
      samplers.push({ input:time, output:add(positions,5126,'VEC3',3), interpolation:'LINEAR' });
      channels.push({ sampler:1, target:{node:1,path:'translation'} });
    }
    return { name, samplers, channels };
  });
  const json = {
    asset:{ version:'2.0' }, scene:0, scenes:[{nodes:[0]}],
    nodes:[{name:'Rig',children:[1,3]},{name:'Hips',translation:[0,.6,0],children:[2]},{name:'UpperArm',translation:[0,.4,0]},{name:'TechnicalFixture',mesh:0,skin:options.rig === false ? undefined : 0}],
    meshes:[{primitives:[{attributes:{POSITION:pos,JOINTS_0:joints,WEIGHTS_0:weights},indices,material:0}]}],
    materials:[{doubleSided:true,pbrMetallicRoughness:{baseColorFactor:[.1,.5,.7,1]}}],
    skins:options.rig === false ? [] : [{ joints:[1,2],skeleton:1,inverseBindMatrices:ibm }],
    animations:options.clips === false ? [] : animations,
    buffers:[{byteLength:size,...(options.external ? {uri:'https://example.invalid/remote.bin'} : {})}], bufferViews:views,accessors,
  };
  const raw = Buffer.from(JSON.stringify(json));
  const text = Buffer.alloc(Math.ceil(raw.length/4)*4, 0x20); raw.copy(text);
  const binary = Buffer.concat(chunks);
  const out = Buffer.alloc(12 + 8 + text.length + 8 + binary.length);
  out.writeUInt32LE(0x46546c67,0); out.writeUInt32LE(2,4); out.writeUInt32LE(out.length,8);
  out.writeUInt32LE(text.length,12);out.writeUInt32LE(0x4e4f534a,16);text.copy(out,20);
  out.writeUInt32LE(binary.length,20+text.length);out.writeUInt32LE(0x004e4942,24+text.length);binary.copy(out,28+text.length);
  return out;
}
