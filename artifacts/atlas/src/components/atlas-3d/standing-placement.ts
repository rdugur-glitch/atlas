import * as THREE from 'three';

/** Idempotent across React effect replay: measure in source space, then rotate/translate. */
export function fitStandingCharacter(rig: THREE.Group, scene: THREE.Group, spot: { x: number; z: number; yaw: number }) {
  rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0); rig.scale.setScalar(1);
  scene.position.set(0, 0, 0); scene.rotation.set(0, 0, 0); scene.scale.setScalar(1);
  rig.add(scene); rig.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene, true);
  const height = box.max.y - box.min.y;
  if (!Number.isFinite(height) || height <= 0) {
    rig.remove(scene);
    throw new Error('Karakterin sabit model boyutu hesaplanamadı.');
  }
  const scale = 1.85 / height;
  scene.scale.setScalar(scale);
  scene.position.set(-(box.min.x + box.max.x) * .5 * scale, -box.min.y * scale, -(box.min.z + box.max.z) * .5 * scale);
  rig.position.set(spot.x, 0, spot.z); rig.rotation.set(0, spot.yaw, 0);
  rig.updateMatrixWorld(true);
}
