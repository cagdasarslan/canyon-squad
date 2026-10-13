import * as THREE from 'three';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function finish(canvas, srgb = true, repeat = true) {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

// Rüzgar dalgalı zemin dokusu — kendini tekrarlayan (tileable). base: RGB 0–255, ripple: dalga gücü
export function sandTexture(base = [236, 176, 112], ripple = 1) {
  const s = 512;
  const c = makeCanvas(s, s);
  const g = c.getContext('2d');
  const img = g.createImageData(s, s);
  const TAU = Math.PI * 2;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const u = x / s, v = y / s;
      const warp = 0.12 * Math.sin(TAU * (3 * u + 0.3)) + 0.05 * Math.sin(TAU * (7 * u + 2 * v));
      const ripple = Math.sin(TAU * (9 * v + warp));
      const r = Math.pow(0.5 + 0.5 * ripple, 3);
      const grain = Math.random();
      const k = 0.88 + 0.05 * r * ripple + 0.09 * (grain - 0.5) + (grain > 0.985 ? 0.12 : 0);
      const i = (y * s + x) * 4;
      img.data[i] = Math.min(255, base[0] * k);
      img.data[i + 1] = Math.min(255, base[1] * k);
      img.data[i + 2] = Math.min(255, base[2] * k);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return finish(c);
}

// Kaya detayı: tabakalı çizgiler + tane
export function rockTexture() {
  const s = 256;
  const c = makeCanvas(s, s);
  const g = c.getContext('2d');
  const img = g.createImageData(s, s);
  const TAU = Math.PI * 2;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const u = x / s, v = y / s;
      const strata = 0.5 + 0.5 * Math.sin(TAU * (12 * v + 0.15 * Math.sin(TAU * 2 * u)));
      const streak = 0.5 + 0.5 * Math.sin(TAU * (24 * u + 0.4 * Math.sin(TAU * 3 * v)));
      const k = 0.78 + 0.08 * strata + 0.03 * streak + 0.18 * (Math.random() - 0.5);
      const i = (y * s + x) * 4;
      const val = Math.max(0, Math.min(255, 255 * k));
      img.data[i] = img.data[i + 1] = img.data[i + 2] = val;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return finish(c);
}

// Boss zırhındaki parlayan çatlaklar (emissive map)
export function crackTexture() {
  const s = 512;
  const c = makeCanvas(s, s);
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, s, s);
  g.lineCap = 'round';
  g.shadowColor = '#ff9a40';
  g.shadowBlur = 8;
  for (let n = 0; n < 46; n++) {
    let x = Math.random() * s, y = Math.random() * s;
    let a = Math.random() * Math.PI * 2;
    const steps = 6 + Math.random() * 14;
    g.strokeStyle = `rgba(255,${180 + Math.random() * 60},${90 + Math.random() * 60},1)`;
    g.lineWidth = 1 + Math.random() * 2.5;
    g.beginPath();
    g.moveTo(x, y);
    for (let i = 0; i < steps; i++) {
      a += (Math.random() - 0.5) * 1.3;
      const l = 6 + Math.random() * 16;
      x += Math.cos(a) * l;
      y += Math.sin(a) * l;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  return finish(c);
}

// Yumuşak parçacık sprite'ı
export function softDotTexture() {
  const s = 64;
  const c = makeCanvas(s, s);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.75)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.18)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  return finish(c, false, false);
}

// Kapı üzerindeki "x2" yazısı
export function labelTexture(text, outline = 'rgba(0,60,130,0.85)') {
  const c = makeCanvas(512, 256);
  const g = c.getContext('2d');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '190px "Lilita One", "Arial Black", Impact, sans-serif';
  g.lineJoin = 'round';
  g.shadowColor = outline;
  g.shadowBlur = 30;
  g.lineWidth = 22;
  g.strokeStyle = outline;
  g.strokeText(text, 256, 140);
  g.shadowBlur = 0;
  g.fillStyle = '#fff';
  g.fillText(text, 256, 140);
  return finish(c, true, false);
}
