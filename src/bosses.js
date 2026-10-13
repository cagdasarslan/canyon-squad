// Bölüm sonu canavarları: her haritada 10 bölümde bir sıradaki canavar gelir (1–10, 11–20, … 41–50).
// Akrep kodla canlandırılır; diğerleri Quaternius (CC0) iskeletli modeller ve kendi animasyonlarını kullanır.
// clips: model içindeki animasyon adlarının sonu ("CharacterArmature|Walk" → "Walk").

export const BOSSES = [
  { id: 'scorpion', name: 'AKREP', icon: '🦂', strike: [0.9, 0.25, 1.4] },
  {
    id: 'yeti', name: 'YETİ', icon: '❄️', url: '/assets/models/bosses/Yeti.glb',
    height: 9, width: 6, front: 4,
    clips: { idle: 'Idle', walk: 'Walk', attack: 'Punch', death: 'Death', roar: 'Jump' },
    strike: [0.5, 1.1, 1.6],
  },
  {
    id: 'giant', name: 'TAŞ DEV', icon: '🗿', url: '/assets/models/bosses/Giant.glb',
    height: 10, width: 7, front: 4.5,
    clips: { idle: 'Idle', walk: 'Walk', attack: 'Attack', death: 'Death', roar: 'Jump' },
    strike: [1.0, 0.7, 0.4],
  },
  {
    id: 'demon', name: 'İBLİS', icon: '👹', url: '/assets/models/bosses/Demon.glb',
    height: 9.5, width: 6.5, front: 4.5,
    clips: { idle: 'Idle', walk: 'Walk', attack: 'Weapon', death: 'Death', roar: 'Jump' },
    strike: [0.4, 0.7, 1.6],
  },
  {
    id: 'dragon', name: 'EJDERHA', icon: '🐉', url: '/assets/models/bosses/Dragon.glb',
    height: 8, width: 9, front: 5, fly: 3,
    clips: { idle: 'Flying_Idle', walk: 'Fast_Flying', attack: 'Headbutt', death: 'Death', roar: 'Punch' },
    strike: [1.6, 0.6, 0.15],
  },
];

// Normal düşmanlar: her 10 bölümlük blokta sıradaki tür gelir ve güçlenir.
// power: temas ettiğinde öldürdüğü asker sayısı, speed: koşu hızı, fly: uçma yüksekliği,
// size: isabet/temas yarıçapı çarpanı, hpBonus: temel cana eklenen dayanıklılık
export const MINIONS = [
  { id: 'red', name: 'Kızıl Asker', power: 1, speed: 6, size: 1, hpBonus: 0, color: [1.0, 0.25, 0.2] },
  { id: 'yetiling', name: 'Yavru Yeti', power: 2, speed: 6.5, size: 1.15, hpBonus: 1, color: [0.6, 0.9, 1.2] },
  { id: 'cubeling', name: 'Taşçık', power: 3, speed: 6, size: 1.3, hpBonus: 3, color: [0.85, 0.7, 0.5] },
  { id: 'imp', name: 'Şeytancık', power: 3, speed: 8, size: 1.1, hpBonus: 2, fly: 1.3, color: [0.7, 1.0, 0.3] },
  { id: 'drake', name: 'Yavru Ejder', power: 4, speed: 8.5, size: 1.3, hpBonus: 4, fly: 1.6, color: [1.2, 0.5, 0.15] },
];

// Özel düşmanlar (Ultimate Space Kit): ana dalgaların arasına karışır.
// shooter: belli mesafede durup tim üzerine ateş eder
export const SPECIALS = [
  { id: 'alienSmall', name: 'Minik Uzaylı', power: 1, speed: 9, size: 0.8, hpMul: 0.5, fly: 1.2, color: [0.5, 1.4, 0.4] },
  { id: 'robotEnemy', name: 'Robot', power: 2, speed: 5, size: 1.2, hpMul: 2.5, shooter: true, color: [1.4, 0.3, 0.2] },
  { id: 'alienLarge', name: 'İri Uzaylı', power: 5, speed: 4.5, size: 1.6, hpMul: 5, color: [0.4, 1.2, 0.3] },
  { id: 'alienFlying', name: 'Uçan Uzaylı', power: 2, speed: 9.5, size: 1.1, hpMul: 1, fly: 1.8, color: [0.6, 1.5, 0.5] },
];
const special = (id) => SPECIALS.find((s) => s.id === id);

// her blokta hangi özel düşmanlar, dalganın ne kadarı (oran) olarak gelir
const SPECIAL_MIX = [
  [['alienSmall', 0.25]],
  [['robotEnemy', 0.15]],
  [['alienLarge', 0.12], ['robotEnemy', 0.1]],
  [['alienFlying', 0.25], ['robotEnemy', 0.1]],
  [['robotEnemy', 0.15], ['alienLarge', 0.1], ['alienFlying', 0.1]],
];
export const specialsForLevel = (n) => SPECIAL_MIX[Math.min(SPECIAL_MIX.length - 1, Math.floor((n - 1) / 10))].map(([id, share]) => ({ ...special(id), share }));

export const BLOCK = 10; // kaç bölümde bir boss ve düşman türü değişir

export const minionForLevel = (n) => MINIONS[Math.min(MINIONS.length - 1, Math.floor((n - 1) / BLOCK))];

export const bossForLevel = (n) => BOSSES[Math.min(BOSSES.length - 1, Math.floor((n - 1) / BLOCK))];
