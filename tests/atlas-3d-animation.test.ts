import assert from 'node:assert/strict';
import { test } from 'node:test';
import { atlasLiveMode, resolveAtlasClips } from '../artifacts/atlas/src/components/atlas-3d/atlas-animation';

const silent = {playingId:null, recognitionOpen:true, transcript:'', busy:false};
test('microphone permission/open recognition alone leaves ATLAS idle', () => {
  assert.equal(atlasLiveMode(silent),'idle');
});
test('actual recognized words trigger listening, not pending API', () => {
  assert.equal(atlasLiveMode({...silent,transcript:'Atlas merhaba'}),'listening');
  assert.equal(atlasLiveMode({...silent,transcript:'Atlas merhaba',busy:true}),'idle');
  assert.equal(atlasLiveMode({...silent,transcript:'Atlas merhaba',recognitionOpen:false}),'idle');
});
test('only actual ATLAS TTS playback causes speaking', () => {
  assert.equal(atlasLiveMode({...silent,playingId:'atlas:message'}),'speaking');
  assert.equal(atlasLiveMode({...silent,playingId:'mira:message'}),'idle');
  assert.equal(atlasLiveMode({...silent,playingId:'atlas:message',soundEnabled:false}),'idle');
});
test('recognizes the prepared and original Meshy clip names without asking for selection', () => {
  assert.deepEqual(resolveAtlasClips(['ATLAS_SEATED_IDLE','ATLAS_SEATED_LISTENING','ATLAS_SEATED_SPEAKING']),{
    idle:'ATLAS_SEATED_IDLE',listening:'ATLAS_SEATED_LISTENING',speaking:'ATLAS_SEATED_SPEAKING',
  });
  assert.deepEqual(resolveAtlasClips(['Chair_Sit_Idle_M','Listening_Gesture','Sitting_Answering_Questions']),{
    idle:'Chair_Sit_Idle_M',listening:'Listening_Gesture',speaking:'Sitting_Answering_Questions',
  });
  assert.throws(() => resolveAtlasClips(['ATLAS_SEATED_IDLE']),/eksik/);
});
test('stop/end/error fall back to idle; recognition error is not listening', () => {
  assert.equal(atlasLiveMode({...silent,recognitionOpen:false}),'idle');
  assert.equal(atlasLiveMode({...silent,transcript:'Atlas',error:'network'}),'idle');
});
