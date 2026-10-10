import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAtlasClips } from '../artifacts/atlas/src/components/atlas-3d/atlas-animation';
import { characterPosture } from '../artifacts/atlas/src/components/atlas-3d/character-posture';
import type { PreparedAtlasModel } from '../artifacts/atlas/src/components/atlas-3d/atlas-model';

const metadata = (idle: string) => ({ bindings: { idle, listening: 'listening', speaking: 'speaking' } }) as PreparedAtlasModel;
test('seated/unknown clips cannot pretend to be standing', () => {
  assert.equal(characterPosture(null), 'unknown');
  assert.equal(characterPosture(metadata('ATLAS_SEATED_IDLE')), 'seated');
  assert.equal(characterPosture(metadata('Chair_Sit_Idle_M')), 'seated');
  assert.equal(characterPosture(metadata('idle')), 'unknown');
  assert.equal(characterPosture(metadata('ATLAS_STANDING_IDLE')), 'standing');
});
test('three genuinely named standing clips bind automatically without renaming any clip', () => {
  const clips = ['ATLAS_STANDING_IDLE', 'ATLAS_STANDING_LISTENING', 'ATLAS_STANDING_SPEAKING'];
  assert.deepEqual(resolveAtlasClips(clips), { idle: clips[0], listening: clips[1], speaking: clips[2] });
  assert.throws(() => resolveAtlasClips(['ATLAS_STANDING_IDLE']), /eksik/);
});
