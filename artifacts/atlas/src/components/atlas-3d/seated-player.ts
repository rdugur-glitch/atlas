import * as THREE from 'three';
import type { PreparedAtlasModel, AtlasAnimationMode } from './atlas-model';

/** One rig: continuous idle lower body, cross-faded head/arms/torso. No mesh copies. */
export function makeSeatedPlayer(model: PreparedAtlasModel) {
  const root = model.scene;
  const bones: THREE.Bone[] = [];
  root.traverse(o => { if (o instanceof THREE.Bone) bones.push(o); });
  const hip = bones.find(b => /hips|pelvis|hip$/i.test(b.name)) ?? bones.find(b => !(b.parent instanceof THREE.Bone)) ?? bones[0];
  const lowerObjects = new Set<THREE.Object3D>();
  if (hip) {
    for (let p: THREE.Object3D | null = hip; p && p !== root; p = p.parent) lowerObjects.add(p);
    bones.filter(b => /leg|thigh|calf|shin|knee|ankle|foot|toe/i.test(b.name)).forEach(b => b.traverse(o => lowerObjects.add(o)));
  }
  const lowerNames = new Set([...lowerObjects].flatMap(o => [o.name, o.uuid]).filter(Boolean));
  const isLower = (track: THREE.KeyframeTrack) => {
    const binding = THREE.PropertyBinding.parseTrackName(track.name);
    return lowerNames.has(String(binding.objectIndex ?? binding.nodeName));
  };
  const mixer = new THREE.AnimationMixer(root);
  const idle = model.clips.find(c => c.name === model.bindings.idle)!;
  const lower = mixer.clipAction(new THREE.AnimationClip('ATLAS_CONTINUOUS_SEATED_BASE', idle.duration, idle.tracks.filter(isLower)));
  lower.setLoop(THREE.LoopRepeat, Infinity).play();
  const actions = new Map<AtlasAnimationMode, THREE.AnimationAction>();
  for (const mode of ['idle', 'listening', 'speaking'] as const) {
    const clip = model.clips.find(c => c.name === model.bindings[mode])!;
    actions.set(mode, mixer.clipAction(new THREE.AnimationClip(clip.name, clip.duration, clip.tracks.filter(t => !isLower(t)))).setLoop(THREE.LoopRepeat, Infinity));
  }
  let current = actions.get('idle')!;
  current.play(); mixer.update(0); root.updateMatrixWorld(true);
  const anchorXZ = hip ? [hip.position.x, hip.position.z] : null;
  const update = (dt: number) => {
    mixer.update(dt);
    if (hip && anchorXZ) { hip.position.x = anchorXZ[0]; hip.position.z = anchorXZ[1]; }
    root.updateMatrixWorld(true);
  };
  const play = (mode: AtlasAnimationMode) => {
    const next = actions.get(mode)!;
    if (next === current) return;
    actions.forEach(a => { if (a !== current && a !== next) a.stopFading().stop(); });
    const time = current.time;
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1);
    next.time = time % next.getClip().duration;
    next.play().crossFadeFrom(current, .32, false);
    current = next;
  };
  const envelope = () => {
    const bounds = new THREE.Box3();
    // Fit furniture to motion, not just to the first idle frame.
    for (const action of actions.values()) {
      actions.forEach(a => a.stopFading().stop());
      action.reset().play();
      for (let i = 0; i <= 12; i++) {
        action.time = action.getClip().duration * i / 12;
        lower.time = action.time % idle.duration;
        update(0);
        bounds.union(new THREE.Box3().setFromObject(root, true));
      }
    }
    actions.forEach(a => a.stopFading().stop());
    lower.reset().play(); current = actions.get('idle')!; current.reset().play(); update(0);
    return bounds;
  };
  const footFloor = () => {
    let y = Infinity;
    const v = new THREE.Vector3();
    root.traverse(o => {
      if (!(o instanceof THREE.SkinnedMesh)) return;
      const indices = o.geometry.getAttribute('skinIndex'), weights = o.geometry.getAttribute('skinWeight');
      if (!indices || !weights) return;
      const feet = new Set(o.skeleton.bones.map((b, i) => /foot|toe|ankle/i.test(b.name) ? i : -1).filter(i => i >= 0));
      if (!feet.size) return;
      for (let i = 0; i < indices.count; i++) {
        if (![0, 1, 2, 3].some(k => weights.getComponent(i, k) > .25 && feet.has(indices.getComponent(i, k)))) continue;
        o.getVertexPosition(i, v); o.localToWorld(v); y = Math.min(y, v.y);
      }
    });
    return Number.isFinite(y) ? y : new THREE.Box3().setFromObject(root, true).min.y;
  };
  return { hip, update, play, envelope, footFloor, clip: () => current.getClip().name,
    dispose: () => { mixer.stopAllAction(); mixer.uncacheRoot(root); } };
}
