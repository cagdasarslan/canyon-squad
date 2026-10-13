// Harita başına 50 bölüm: her bölüm sabit tohumlu (seed) rastgelelikle üretilir, yani her açılışta aynıdır.
// 10 bölümlük her blokta farklı bir boss canavarı gelir (bosses.js). Zorluk (d: 0 → 1) 50 bölüme yayılır;
// her bloğun içinde de yol uzar, düşmanlar kalabalıklaşır, blok sonu boss'u daha güçlü olur.

import { MAPS } from './maps.js';
import { BLOCK, bossForLevel, minionForLevel, specialsForLevel } from './bosses.js';

export const LEVEL_COUNT = 50;
const ROMAN = ['', 'II', 'III', 'IV', 'V'];
const titleCase = (t) => t.toLocaleLowerCase('tr-TR').replace(/(^|\s)(\S)/g, (m, sp, c) => sp + c.toLocaleUpperCase('tr-TR'));



function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

// Bir iyi + bir kötü (veya iyi + daha iyi) seçenekli kapı çifti
function gatePair(r, d, step) {
  const add = 4 + Math.round(step * 1.6 + d * 10 + r() * 4);
  const sub = 5 + Math.round(step * 1.4 + d * 14 + r() * 5);
  const templates = [
    [{ op: '+', v: add }, { op: 'x', v: 2 }],
    [{ op: 'x', v: 2 }, { op: '-', v: sub }],
    [{ op: '+', v: add }, { op: '-', v: sub }],
    [{ op: '+', v: add }, { op: '+', v: Math.round(add * 0.5) }],
    [{ op: 'x', v: 3 }, { op: '-', v: sub + 5 }],
  ];
  if (d > 0.3) templates.push([{ op: 'x', v: 2 }, { op: '/', v: 2 }]);
  if (d > 0.6) templates.push([{ op: '+', v: add }, { op: '/', v: 3 }], [{ op: 'x', v: 3 }, { op: '/', v: 2 }]);
  const pair = pick(r, templates);
  if (r() < 0.5) pair.reverse();
  return [
    { x: -3.5, w: 7, ...pair[0] },
    { x: 3.5, w: 7, ...pair[1] },
  ];
}

// mapIdx: harita sırası — sonraki haritalar daha kalabalık, düşmanlar ve boss daha dayanıklı
export function makeLevel(n, mapIdx = 0) {
  n = Math.max(1, Math.min(LEVEL_COUNT, n));
  const map = MAPS[mapIdx] ?? MAPS[0];
  const r = rng(n * 9973 + 17 + mapIdx * 7919);
  const d = (n - 1) / (LEVEL_COUNT - 1);
  const block = Math.floor((n - 1) / BLOCK); // 0–4: hangi boss bloğu
  const k = (n - 1) % BLOCK;                 // blok içindeki sıra (9 = blok sonu)
  const minion = minionForLevel(n);
  // düşman canı: tür + blok içi ilerleme + harita; hız ve temas gücü haritayla da artar
  const enemyHp = 2 + minion.hpBonus + Math.floor(k / 4) + mapIdx;
  const enemySpeed = minion.speed * (1 + k * 0.015 + mapIdx * 0.06);
  const enemyPower = minion.power + Math.floor(mapIdx / 2);
  const pairs = 4 + Math.floor(k / 2) + block; // kapı + düşman çifti sayısı (en fazla 12)
  const boss = bossForLevel(n);

  const events = [];
  let z = -32;
  // ilk kapı her zaman güçlendirir
  events.push({ z, type: 'gate', gates: [{ x: 0, w: 14, op: k >= 4 ? '+' : 'x', v: k >= 4 ? 6 + block * 4 : 2 }] });
  z -= 38 + r() * 6;
  for (let i = 1; i <= pairs; i++) {
    const t = i / pairs;
    const count = Math.round(5 + i * 2 + d * 30 * (0.5 + t) + r() * 3 + mapIdx * 4);
    // özel düşmanlar: bloğun 3. bölümünden itibaren dalgaya karışır (ilk bölümler öğretici kalsın)
    const extras = k >= 2 || block > 0
      ? specialsForLevel(n).map((sp) => ({
        kind: sp.id,
        count: Math.max(1, Math.round(count * sp.share)),
        hp: Math.max(1, Math.round(enemyHp * sp.hpMul)),
        speed: sp.speed * (1 + mapIdx * 0.06),
        power: sp.power + Math.floor(mapIdx / 2),
      }))
      : [];
    events.push({ z, type: 'enemies', count: Math.min(60, count), hp: enemyHp, kind: minion.id, speed: enemySpeed, power: enemyPower, extras });
    z -= 32 + r() * 6;
    if (i < pairs) {
      events.push({ z, type: 'gate', gates: gatePair(r, d, i) });
      z -= 32 + r() * 6;
    }
  }
  // boss öncesi son takviye kapısı
  events.push({ z, type: 'gate', gates: gatePair(r, d * 0.5, pairs) });
  z -= 36;

  const bossZ = Math.round(z - 30);
  const arches = [];
  for (let a = -58 - r() * 10; a > bossZ + 45; a -= 62 + r() * 14) arches.push(Math.round(a));

  return {
    index: n,
    mapIdx,
    // blok sonu bölümü o bloğun canavarının arenasıdır
    name: k === BLOCK - 1 ? `${titleCase(boss.name)} Arenası` : map.levelNames[k] + (block ? ' ' + ROMAN[block] : ''),
    boss,
    minion,
    bossName: `${map.boss.prefix} ${boss.name}`,
    bossZ,
    bossStopOffset: 28,
    // tim sınırsız büyüyebildiği için boss canı da 50 bölüm boyunca katlanarak artar
    bossHp: Math.round(1800 * (1 + d * 6) * (1 + 0.4 * mapIdx) * (k === BLOCK - 1 ? 1.4 : 1)),
    bossScale: 1 + k * 0.03 + block * 0.04,
    bossSpeed: 0.8 + d * 0.6,
    arches,
    events,
  };
}

// İlerleme kaydı (tarayıcıda)
const KEY = 'canyon-squad-progress';

// { map, maps: {haritaId: {level, unlocked}}, coins, upgrades, skins, skin, characters, character }
export function loadProgress() {
  const def = {
    map: 'canyon', maps: { canyon: { level: 1, unlocked: 1 } },
    coins: 0, upgrades: {}, skins: ['cyan'], skin: 'cyan', characters: ['soldier'], character: 'soldier',
    vehicles: [], vehiclesOn: [],
  };
  try {
    const p = JSON.parse(localStorage.getItem(KEY));
    if (p && (p.maps || p.level >= 1)) {
      const level = Math.min(LEVEL_COUNT, p.level || 1);
      let skins = Array.isArray(p.skins) && p.skins.length ? p.skins : ['cyan'];
      const characters = Array.isArray(p.characters) && p.characters.length ? p.characters : ['soldier'];
      let character = characters.includes(p.character) ? p.character : 'soldier';
      // eski kayıt: robot eskiden bir kostümdü, artık karakter
      if (skins.includes('robot')) {
        skins = skins.filter((x) => x !== 'robot');
        if (!characters.includes('robot')) characters.push('robot');
        if (p.skin === 'robot') character = 'robot';
      }
      // eski kayıt: tek harita (Kanyon) ilerlemesi → maps.canyon
      const maps = p.maps && typeof p.maps === 'object'
        ? p.maps
        : { canyon: { level, unlocked: Math.min(LEVEL_COUNT, Math.max(level, p.unlocked | 0)) } };
      return {
        characters,
        character,
        map: MAPS.some((m) => m.id === p.map) ? p.map : 'canyon',
        maps,
        coins: Math.max(0, p.coins | 0),
        upgrades: p.upgrades && typeof p.upgrades === 'object' ? p.upgrades : {},
        skins,
        skin: skins.includes(p.skin) ? p.skin : skins[0],
        vehicles: Array.isArray(p.vehicles) ? p.vehicles : [],
        vehiclesOn: Array.isArray(p.vehiclesOn) ? p.vehiclesOn.filter((v) => (p.vehicles ?? []).includes(v)) : [],
      };
    }
  } catch { /* depolama kapalı olabilir */ }
  return def;
}

export function resetProgress() {
  try {
    localStorage.removeItem(KEY);
  } catch { /* yok say */ }
}

export function saveProgress(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch { /* yok say */ }
}
