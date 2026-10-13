// Haritalar: her biri 10 bölümlük ayrı bir dünya. Görünüm (tema) ve zorluk buradan gelir.
// Yeni harita eklemek için bu listeye bir tema eklemen yeterli.

export const UNLOCK_AT = 10; // önceki haritanın bu bölümü (ilk boss) geçilince sıradaki harita açılır

export const MAPS = [
  {
    id: 'canyon',
    name: 'Altın Kanyon',
    icon: '🏜️',
    cave: false,
    levelNames: ['Kum Kapısı', 'Kızıl Geçit', 'Rüzgar Vadisi', 'Kayıp Kemerler', 'Güneş Tapınağı',
      'Yanık Kanyon', 'Akrep Yuvası', 'Altın Sütunlar', 'Fırtına Boğazı', 'Kraliçe Akrep'],
    strata: [[0.55, 0.23, 0.13], [0.78, 0.38, 0.17], [0.86, 0.52, 0.27], [0.70, 0.31, 0.16], [0.93, 0.66, 0.40], [0.62, 0.27, 0.15], [0.84, 0.46, 0.22]],
    ground: { base: [236, 176, 112], ripple: 1, roughness: 0.96, metalness: 0 },
    rock: { h: 0.05, s: 0.55, l: 0.38 },
    sky: { zen: [0.30, 0.50, 0.74], hor: [1.0, 0.70, 0.40], low: [0.92, 0.52, 0.30] },
    fog: { color: 0xe39a5c, near: 95, far: 380 },
    hemi: { sky: 0xffd2a0, ground: 0x8a3f1e, intensity: 0.85 },
    sun: { color: 0xffb966, intensity: 4.2 },
    fill: 0.7,
    exposure: 0.92,
    rays: [1.0, 0.78, 0.48],
    dust: { mode: 0, color: [1.0, 0.85, 0.6] },          // 0: süzülen toz
    boss: { prefix: 'ALTIN', color: 0xe0a83c, crack: 0xff6a1a },
  },
  {
    id: 'ice',
    name: 'Buz Mağarası',
    icon: '❄️',
    cave: true,
    levelNames: ['Donmuş Giriş', 'Kırağı Tüneli', 'Sarkıt Koridoru', 'Mavi Yankı', 'Buzul Kalbi',
      'Kristal Göl', 'Ayaz Labirenti', 'Kar Fırtınası', 'Donmuş Taht', 'Buz Akrebi'],
    strata: [[0.30, 0.46, 0.64], [0.44, 0.60, 0.76], [0.22, 0.36, 0.56], [0.55, 0.70, 0.84], [0.28, 0.42, 0.62], [0.38, 0.54, 0.72]],
    ground: { base: [150, 182, 212], ripple: 0.35, roughness: 0.4, metalness: 0 },
    rock: { h: 0.58, s: 0.35, l: 0.45 },
    background: 0x0a1424,
    ceiling: [0.20, 0.32, 0.48],
    fog: { color: 0x14263e, near: 40, far: 210 },
    hemi: { sky: 0x9fc8f0, ground: 0x1a3048, intensity: 0.7 },
    sun: { color: 0xcfe8ff, intensity: 1.9 },
    fill: 0.5,
    exposure: 0.85,
    rays: [0.55, 0.8, 1.0],
    dust: { mode: 1, color: [0.85, 0.95, 1.0] },          // 1: yağan kar
    crystals: [{ color: 0x9fdcff, emissive: 0x3aa8ff, intensity: 1.3, count: 200 }],
    stalactites: { color: 0xcde8ff, ice: true },
    boss: { prefix: 'BUZ', color: 0xa8dcff, crack: 0x40c0ff },
  },
  {
    id: 'lava',
    name: 'Lav Mağarası',
    icon: '🌋',
    cave: true,
    levelNames: ['Kükürt Kapısı', 'Kor Tüneli', 'Magma Nehri', 'Kül Vadisi', 'Obsidyen Salon',
      'Yanardağ Kalbi', 'Erimiş Köprü', 'Ateş Çukuru', 'Alev Tahtı', 'Lav Akrebi'],
    strata: [[0.16, 0.10, 0.09], [0.24, 0.14, 0.11], [0.12, 0.08, 0.08], [0.32, 0.17, 0.12], [0.20, 0.12, 0.10]],
    ground: { base: [70, 52, 46], ripple: 0.2, roughness: 0.85, metalness: 0.1, cracks: 0xff5a10 },
    rock: { h: 0.03, s: 0.25, l: 0.16 },
    background: 0x140604,
    ceiling: [0.12, 0.07, 0.06],
    fog: { color: 0x3a1408, near: 45, far: 220 },
    hemi: { sky: 0xff9a60, ground: 0x401008, intensity: 1.0 },
    sun: { color: 0xff7a3a, intensity: 2.8 },
    fill: 0.8,
    exposure: 1.05,
    rays: null,
    dust: { mode: 2, color: [1.0, 0.45, 0.12] },          // 2: yükselen kıvılcım
    lava: true,
    stalactites: { color: 0x2a1812 },
    boss: { prefix: 'LAV', color: 0x4a2418, crack: 0xff4a00 },
  },
  {
    id: 'crystal',
    name: 'Kristal Mağara',
    icon: '💎',
    cave: true,
    levelNames: ['Ametist Kapısı', 'Işıltı Tüneli', 'Prizma Salonu', 'Yankılanan Derinlik', 'Gökkuşağı Damarı',
      'Mor Uçurum', 'Elmas Koridor', 'Işık Labirenti', 'Kristal Taht', 'Kristal Akrep'],
    strata: [[0.22, 0.14, 0.32], [0.32, 0.20, 0.44], [0.18, 0.12, 0.28], [0.40, 0.26, 0.52], [0.26, 0.17, 0.38]],
    ground: { base: [66, 52, 92], ripple: 0.3, roughness: 0.5, metalness: 0.2 },
    rock: { h: 0.75, s: 0.3, l: 0.25 },
    background: 0x0e0718,
    ceiling: [0.16, 0.10, 0.24],
    fog: { color: 0x26143e, near: 45, far: 220 },
    hemi: { sky: 0xd0a8ff, ground: 0x2a1640, intensity: 1.1 },
    sun: { color: 0xe0c0ff, intensity: 2.4 },
    fill: 0.9,
    exposure: 1.05,
    rays: [0.8, 0.55, 1.0],
    dust: { mode: 3, color: [0.85, 0.6, 1.0] },           // 3: parıldayan zerreler
    crystals: [
      { color: 0xc080ff, emissive: 0x9a40ff, intensity: 1.8, count: 160 },
      { color: 0xff80d0, emissive: 0xff40b0, intensity: 1.6, count: 100 },
      { color: 0x80f0ff, emissive: 0x20c8ff, intensity: 1.6, count: 100 },
    ],
    stalactites: { color: 0x3a2654 },
    boss: { prefix: 'KRİSTAL', color: 0xc090ff, crack: 0xff60ff },
  },
];

export const mapIndex = (id) => Math.max(0, MAPS.findIndex((m) => m.id === id));

// Haritaya ait ilerleme (bulunduğu ve açılmış en yüksek bölüm)
export function mapState(progress, id) {
  progress.maps ??= {};
  return (progress.maps[id] ??= { level: 1, unlocked: 1 });
}

// Test modu (Ayarlar): tüm haritalar ve bölümler seçilebilir. Gerçek ilerleme ayrıca tutulur.
export const testMode = { unlockAll: false };

// Oyuncunun gerçekten kazandığı açılış (başarımlar ve "yeni harita" bildirimi bunu kullanır)
export function isMapEarned(progress, idx) {
  return idx === 0 || mapState(progress, MAPS[idx - 1].id).unlocked > UNLOCK_AT;
}

export const isMapUnlocked = (progress, idx) => testMode.unlockAll || isMapEarned(progress, idx);

// Haritada seçilebilen en yüksek bölüm
export const levelsUnlocked = (progress, id) => (testMode.unlockAll ? 50 : mapState(progress, id).unlocked);

export const unlockedMapCount = (progress) => MAPS.filter((_, i) => isMapEarned(progress, i)).length;
