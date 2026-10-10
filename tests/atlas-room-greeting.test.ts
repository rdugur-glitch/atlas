import test from 'node:test';
import assert from 'node:assert/strict';
import { roomGreeting, validTimeZone } from '../artifacts/atlas/src/lib/room-greeting';

test('greeting respects chosen zone and saved name without claiming microphone activity', () => {
  const now = new Date('2026-10-08T09:00:00Z');
  assert.equal(roomGreeting('Uğur', 'Europe/Istanbul', now), 'İyi günler Uğur, buradayım.');
  assert.equal(roomGreeting(' Uğur ', 'Europe/London', now), 'Günaydın Uğur, buradayım.');
  assert.equal(roomGreeting('', 'UTC', now), 'Günaydın, buradayım.');
  assert.equal(roomGreeting('', 'Asia/Tokyo', now), 'İyi akşamlar, buradayım.');
  assert.equal(validTimeZone('not/a-zone'), false);
});
