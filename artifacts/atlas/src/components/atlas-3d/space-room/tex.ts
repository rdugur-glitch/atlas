import * as THREE from 'three';

export function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function brushedTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const x = c.getContext('2d')!;
  x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, 512, 512);
  let s = 7;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 1400; i++) {
    const v = 110 + Math.floor(r() * 110);
    x.strokeStyle = `rgba(${v},${v},${v},${0.08 + r() * 0.18})`;
    x.lineWidth = 0.5 + r() * 1.2;
    const y = r() * 512, x0 = r() * 512;
    x.beginPath(); x.moveTo(x0, y); x.lineTo(x0 + 80 + r() * 380, y + (r() - 0.5) * 2); x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(0.5, 0.5); return t;
}

export function signTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 192;
  const x = c.getContext('2d')!;
  x.font = '700 120px "Helvetica Neue", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const sp = text.split('').join('\u200A\u200A');
  x.shadowColor = '#5ee7ff'; x.shadowBlur = 28; x.fillStyle = '#7fdcff'; x.fillText(sp, 512, 92);
  x.shadowBlur = 8; x.fillStyle = '#eaf9ff'; x.fillText(sp, 512, 92);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
