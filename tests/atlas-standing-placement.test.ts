import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../artifacts/atlas/node_modules/three';
import { fitStandingCharacter } from '../artifacts/atlas/src/components/atlas-3d/standing-placement';

test('standing placement is grounded, 1.85m and stable across repeated effect setup', () => {
  const scene = new THREE.Group(), rig = new THREE.Group();
  const shape = new THREE.Mesh(new THREE.BoxGeometry(.8, 1.903, .42));
  shape.position.set(.13, -.23, .11); scene.add(shape);
  for (const spot of [{ x: -3.47, z: -1.06, yaw: 1.31 }, { x: 0, z: -3.1, yaw: 0 }, { x: 2.6, z: -2.2, yaw: -.9 }]) {
    for (let n = 0; n < 3; n++) {
      fitStandingCharacter(rig, scene, spot);
      const box = new THREE.Box3().setFromObject(rig, true), center = box.getCenter(new THREE.Vector3());
      assert.ok(Math.abs(box.min.y) < 1e-6);
      assert.ok(Math.abs(box.max.y - 1.85) < 1e-6);
      assert.ok(Math.abs(center.x - spot.x) < 1e-6);
      assert.ok(Math.abs(center.z - spot.z) < 1e-6);
      assert.equal(rig.children.length, 1);
    }
  }
  shape.geometry.dispose();
});
