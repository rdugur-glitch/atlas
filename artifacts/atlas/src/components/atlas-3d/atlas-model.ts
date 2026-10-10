import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { type AtlasAnimationMode } from './atlas-animation';
export { ATLAS_CLIPS, type AtlasAnimationMode } from './atlas-animation';
export interface PreparedAtlasModel {
  scene: THREE.Group;
  clips: THREE.AnimationClip[];
  fileName: string;
  bytes: number;
  skeletonBones: number;
  clipNames: string[];
  bindings: Record<AtlasAnimationMode, string>;
  warnings: string[];
}
export const MAX_MODEL_BYTES = 80 * 1024 * 1024;

/** Check the GLB before invoking a loader. Never allow a model to fetch remote resources. */
export function inspectAtlasGlb(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  if (buffer.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67)
    throw new Error('Dosya geçerli bir GLB değil. Ayakta pozda hazırlanmış gerçek bir GLB seçin.');
  if (view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== buffer.byteLength)
    throw new Error('GLB sürümü veya dosya uzunluğu geçersiz; dosya eksik indirilmiş olabilir.');
  const length = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a || length > buffer.byteLength - 20)
    throw new Error('GLB model bilgileri okunamadı.');
  let json: any;
  try { json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, length))); }
  catch { throw new Error('GLB model bilgileri bozuk. Dosyayı yeniden indirin.'); }
  if (json?.asset?.version !== '2.0') throw new Error('Yalnızca glTF 2.0 GLB dosyaları desteklenir.');
  for (const key of ['buffers', 'images', 'nodes', 'animations', 'skins']) {
    if (json[key] !== undefined && (!Array.isArray(json[key]) || json[key].some((v: any) => !v || typeof v !== 'object')))
      throw new Error('GLB veri yapısı geçersiz. Standart glTF 2.0 GLB dosyası kullanın.');
  }
  if (json.skins?.some((skin: any) => !Array.isArray(skin.joints)))
    throw new Error('Modelin iskelet eklem listesi geçersiz.');
  for (const resource of [...(json.buffers ?? []), ...(json.images ?? [])]) {
    if (resource.uri && !/^data:/i.test(resource.uri))
      throw new Error('Model harici dosya veya bağlantı içeriyor. Dokuları ve verileri içine gömülü tek GLB kullanın.');
  }
  for (const image of json.images ?? []) {
    if (image.mimeType && !/^image\/(png|jpeg|webp|avif)$/i.test(image.mimeType))
      throw new Error('Modelde desteklenmeyen doku biçimi var. PNG/JPEG gömülü dokulu GLB kullanın.');
  }
  if ((json.nodes?.length ?? 0) > 2000 || (json.images?.length ?? 0) > 128)
    throw new Error('Model bu yerel önizleme için fazla karmaşık.');
  // Skeletons and animation clips are optional: the room displays the authored static pose.
  return json;
}

export function disposeAtlasModel(model: PreparedAtlasModel) {
  const textures = new Set<THREE.Texture>();
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  model.scene.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    geometries.add(o.geometry);
    for (const material of Array.isArray(o.material) ? o.material : [o.material]) {
      materials.add(material);
      Object.values(material).forEach(v => { if (v instanceof THREE.Texture) textures.add(v); });
    }
  });
  textures.forEach(t => {
    const image = t.source?.data;
    if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) image.close();
    t.dispose();
  });
  materials.forEach(m => m.dispose());
  geometries.forEach(g => g.dispose());
}

export async function prepareAtlasFile(file: File, onProgress: (pct: number) => void): Promise<PreparedAtlasModel> {
  if (!/\.glb$/i.test(file.name)) throw new Error('Yalnızca .glb dosyası seçebilirsiniz.');
  if (!file.size || file.size > MAX_MODEL_BYTES) throw new Error('GLB dosyası boş veya 80 MB sınırını aşıyor.');
  onProgress(0);
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = e => { if (e.lengthComputable) onProgress(Math.round(e.loaded / e.total * 65)); };
    reader.onerror = () => reject(new Error('Dosya bilgisayardan okunamadı. Yeniden seçin.'));
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(file);
  });
  inspectAtlasGlb(buffer);
  onProgress(70);
  const manager = new THREE.LoadingManager();
  manager.setURLModifier(url => {
    if (!/^(blob:|data:)/i.test(url)) throw new Error('Modelin harici kaynaklara erişimi engellendi.');
    return url;
  });
  let gltf;
  try { gltf = await new GLTFLoader(manager).parseAsync(buffer, ''); }
  catch { throw new Error('GLB açılamadı. Dosya bozuk olabilir veya desteklenmeyen sıkıştırma kullanıyor; gömülü dokulu standart GLB dışa aktarın.'); }
  const model: PreparedAtlasModel = {
    scene: gltf.scene, clips: gltf.animations, clipNames: gltf.animations.map(a => a.name),
    fileName: file.name, bytes: file.size, skeletonBones: 0, bindings: { idle: '', listening: '', speaking: '' },
    warnings: ['Karakter dosyadaki sabit pozuyla gösterilir; varsa animasyonları oynatılmaz. Oturan bir poz otomatik olarak ayağa dönüştürülmez.'],
  };
  const bones = new Set<THREE.Bone>();
  model.scene.traverse(o => {
    if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; }
    if (o instanceof THREE.SkinnedMesh) {
      o.skeleton.bones.forEach(b => bones.add(b));
      o.frustumCulled = false;
      o.castShadow = true; o.receiveShadow = true;
    }
  });
  model.skeletonBones = bones.size;
  const bounds = new THREE.Box3().setFromObject(model.scene, true);
  const size = bounds.getSize(new THREE.Vector3());
  if (bounds.isEmpty() || ![size.x, size.y, size.z].every(Number.isFinite) || size.y <= 0) {
    disposeAtlasModel(model);
    throw new Error('Modelde görüntülenebilir, geçerli boyutlu bir 3D geometri bulunamadı.');
  }
  onProgress(100);
  return model;
}

