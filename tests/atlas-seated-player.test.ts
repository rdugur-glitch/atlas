import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from '../artifacts/atlas/node_modules/three/build/three.module.js';
import { makeSeatedPlayer } from '../artifacts/atlas/src/components/atlas-3d/seated-player';
import type { PreparedAtlasModel } from '../artifacts/atlas/src/components/atlas-3d/atlas-model';

test('continuous seated lower body rejects standing/root motion from listening and speaking clips', () => {
  const scene = new THREE.Group();
  const hips = new THREE.Bone(); hips.name = 'Hips'; scene.add(hips);
  const arm = new THREE.Bone(); arm.name = 'UpperArm'; hips.add(arm);
  const foot = new THREE.Bone(); foot.name = 'LeftFoot'; hips.add(foot);
  const bindings = {idle:'ATLAS_SEATED_IDLE',listening:'ATLAS_SEATED_LISTENING',speaking:'ATLAS_SEATED_SPEAKING'};
  const clips = Object.values(bindings).map((name, i) => new THREE.AnimationClip(name, 1, [
    new THREE.VectorKeyframeTrack('Hips.position',[0,1],i === 0 ? [0,.6,0, 0,.6,0] : [3,4,5, 3,4,5]),
    new THREE.VectorKeyframeTrack('LeftFoot.position',[0,1],i === 0 ? [0,-.6,0, 0,-.6,0] : [5,5,5, 5,5,5]),
    new THREE.QuaternionKeyframeTrack('UpperArm.quaternion',[0,1],[0,0,0,1, 0,0,Math.sin((i+1)*.15),Math.cos((i+1)*.15)]),
  ]));
  const model: PreparedAtlasModel = {scene,clips,bindings,fileName:'technical-rig',bytes:0,skeletonBones:3,clipNames:Object.values(bindings),warnings:[]};
  const player = makeSeatedPlayer(model);
  for (const mode of ['listening','speaking','idle','speaking','listening','idle'] as const) {
    player.play(mode);
    for (let frame = 0; frame < 30; frame++) {
      player.update(1/30);
      assert.ok(Math.abs(hips.position.y - .6) < 1e-5);
      assert.equal(hips.position.x,0); assert.equal(hips.position.z,0);
      assert.ok(Math.abs(foot.position.y + .6) < 1e-5);
    }
    assert.equal(player.clip(),bindings[mode]);
  }
  assert.equal(scene.children.length,1);
  player.dispose();
});
