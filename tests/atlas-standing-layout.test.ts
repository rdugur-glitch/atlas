import assert from 'node:assert/strict';
import test from 'node:test';
import { STANDING_ELLIPSE as ellipse, STANDING_SPOTS as spots } from '../artifacts/atlas/src/components/atlas-3d/space-room/StandingSlots';

test('six named character anchors follow the rear oval outside the tabletop', () => {
  assert.deepEqual(spots.map(p => p.id), ['mira', 'nova', 'atlas', 'vex', 'luna', 'orion']);
  for (const p of spots) {
    assert.ok(p.z < ellipse.centerZ, `${p.id} must be behind the table`);
    const oval = (p.x / ellipse.radiusX) ** 2 + ((p.z - ellipse.centerZ) / ellipse.radiusZ) ** 2;
    assert.ok(Math.abs(oval - 1) < 1e-8);
    const tabletop = (p.x / 2.73) ** 2 + ((p.z - ellipse.centerZ) / 1.58) ** 2;
    assert.ok(tabletop > 1.3, `${p.id} must not stand on the tabletop`);
    const backX = p.x - .48 * Math.sin(p.yaw), backZ = p.z - .48 * Math.cos(p.yaw);
    assert.ok((backX / ellipse.radiusX) ** 2 + ((backZ - ellipse.centerZ) / ellipse.radiusZ) ** 2 > 1, `${p.id} neon must be behind the character`);
  }
  const atlas = spots.find(p => p.id === 'atlas')!;
  assert.ok(Math.abs(atlas.x) < 1e-8);
  assert.equal(atlas.z, Math.min(...spots.map(p => p.z)));
});
