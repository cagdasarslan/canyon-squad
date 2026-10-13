// Oyundaki tüm asset'ler ve ayarlar burada — asset değiştirmek için sadece bu dosyayı düzenle.

export const ASSETS = {
  // three.js örnek deposundan: examples/models/gltf/Soldier.glb (Idle, Run, Walk, TPose)
  soldier: {
    url: '/assets/models/Soldier.glb',
    maxVisible: 110,            // ekranda aynı anda çizilecek en fazla karakter
    clips: { run: 'Run', idle: 'Idle' },
    bodyMaterial: 'VanguardBodyMat',
    visorMaterial: 'Vanguard_VisorMat',
    handBone: 'mixamorigRightHand', // blaster bu kemiğe (sağ el) takılır
    muzzleY: 1.22,
  },
  // three.js örnek deposundan: examples/models/gltf/RobotExpressive (Running, Idle, Dance...)
  robot: {
    url: '/assets/models/RobotExpressive.glb',
    maxVisible: 45,            // ekranda aynı anda çizilecek en fazla karakter
    clips: { run: 'Running', idle: 'Idle' },
    bodyMaterial: 'Main',
    visorMaterial: 'Black',
    visorIntensity: 0.35,        // yüz paneli geniş; düşük parıltı
    // silah yok: kolları çok salınıyor ve kafası omuzları kapatıyor; lazerleri parlayan yüz ekranından atar
    rotationY: Math.PI,          // model +Z'ye bakıyor → -Z'ye çevir
    height: 1.5,                 // otomatik ölçeklenecek boy (gövdesi geniş olduğu için askerden kısa)
    muzzleY: 1.05,
  },
  // three.js örnek deposundan: examples/models/gltf/Xbot.glb (mixamo)
  xbot: {
    url: '/assets/models/chars/Xbot.glb',
    maxVisible: 45,            // ekranda aynı anda çizilecek en fazla karakter
    clips: { run: 'run', idle: 'idle' },
    bodyMaterial: 'asdf1:Beta_HighLimbsGeoSG2',
    visorMaterial: 'Beta_Joints_MAT',   // eklemler kostüm renginde parlar
    visorIntensity: 0.5,
    handBone: 'mixamorig:RightHand',
    rotationY: Math.PI,
    height: 1.8,
    muzzleY: 1.2,
  },
  // Quaternius (CC0) — elinde kendi tabancası var, silahla koşma animasyonu
  frog: {
    url: '/assets/models/chars/Frog.glb',
    maxVisible: 90,            // ekranda aynı anda çizilecek en fazla karakter
    clips: { run: 'CharacterArmature|Run_Gun', idle: 'CharacterArmature|Idle_Gun' },
    rotationY: Math.PI,
    height: 1.55,
    muzzleY: 0.95,
  },
  bee: {
    url: '/assets/models/chars/Bee.glb',
    maxVisible: 90,            // ekranda aynı anda çizilecek en fazla karakter
    clips: { run: 'CharacterArmature|Run_Gun', idle: 'CharacterArmature|Idle_Gun' },
    rotationY: Math.PI,
    height: 1.55,
    muzzleY: 0.95,
  },
  spacesuit: {
    url: '/assets/models/chars/SpaceSuit.glb',
    maxVisible: 50,            // ekranda aynı anda çizilecek en fazla karakter
    clips: { run: 'CharacterArmature|Run', idle: 'CharacterArmature|Idle_Neutral' },
    handBone: 'Wrist.R',
    rotationY: Math.PI,
    height: 1.9,
    muzzleY: 1.25,
  },
  // Ultimate Space Kit (Quaternius, CC0): astronot ve Mech (robot zırh) karakterleri
  flamingo: {
    url: '/assets/models/chars/Flamingo.glb',
    clips: { run: 'Run_Gun', idle: 'Idle_Gun' },
    rotationY: Math.PI, height: 1.65, muzzleY: 1.0, maxVisible: 90,
  },
  mechRae: {
    url: '/assets/models/chars/MechRae.glb',
    clips: { run: 'Run', idle: 'Idle' },
    rotationY: Math.PI, height: 2.0, muzzleY: 1.2, maxVisible: 45, spacing: 0.85,
  },
  mechFrog: {
    url: '/assets/models/chars/MechFrog.glb',
    clips: { run: 'Run', idle: 'Idle' },
    rotationY: Math.PI, height: 2.1, muzzleY: 1.25, maxVisible: 45, spacing: 0.85,
  },
  mechBee: {
    url: '/assets/models/chars/MechBee.glb',
    clips: { run: 'Run', idle: 'Idle' },
    rotationY: Math.PI, height: 2.1, muzzleY: 1.25, maxVisible: 45, spacing: 0.85,
  },
  mechFlamingo: {
    url: '/assets/models/chars/MechFlamingo.glb',
    clips: { run: 'Run', idle: 'Idle' },
    rotationY: Math.PI, height: 2.2, muzzleY: 1.3, maxVisible: 45, spacing: 0.85,
  },
  // Ultimate Space Kit düşmanları: iki ayaklı robot (ateş eder) ve uzaylılar
  robotEnemy: {
    url: '/assets/models/minions/Robot.glb',
    clips: { run: 'Run', idle: 'Idle', attack: 'Shoot' },
    rotationY: Math.PI, height: 2.2, muzzleY: 1, maxVisible: 60,
  },
  alienLarge: {
    url: '/assets/models/minions/AlienLarge.glb',
    clips: { run: 'Run', idle: 'Idle' },
    rotationY: Math.PI, height: 2.6, muzzleY: 1, maxVisible: 60,
  },
  alienFlying: {
    url: '/assets/models/minions/AlienFlying.glb',
    clips: { run: 'Fast_Flying', idle: 'Flying_Idle' },
    rotationY: Math.PI, height: 1.5, muzzleY: 1, maxVisible: 60,
  },
  alienSmall: {
    url: '/assets/models/minions/AlienSmall.glb',
    clips: { run: 'Fast_Flying', idle: 'Flying_Idle' },
    rotationY: Math.PI, height: 1.0, muzzleY: 1, maxVisible: 60,
  },
  // Düşman canavarlar — Quaternius (CC0). Kendi yönleri +Z; diğer Quaternius modelleri gibi çevrilir.
  yetiling: {
    url: '/assets/models/minions/Yetiling.glb',
    clips: { run: 'Walk', idle: 'Idle' },
    rotationY: Math.PI, height: 1.6, muzzleY: 1, maxVisible: 60,
  },
  cubeling: {
    url: '/assets/models/minions/Cubeling.glb',
    clips: { run: 'Run', idle: 'Idle' },
    rotationY: Math.PI, height: 1.9, muzzleY: 1, maxVisible: 60,
  },
  imp: {
    url: '/assets/models/minions/Imp.glb',
    clips: { run: 'Fast_Flying', idle: 'Flying_Idle' },
    rotationY: Math.PI, height: 1.4, muzzleY: 1, maxVisible: 60,
  },
  drake: {
    url: '/assets/models/minions/Drake.glb',
    clips: { run: 'Fast_Flying', idle: 'Flying_Idle' },
    rotationY: Math.PI, height: 1.7, muzzleY: 1, maxVisible: 60,
  },
  // Poly Pizza: "Scorpion" — jeremy, CC-BY 3.0 (poly.pizza/m/cJfrRPiSgA4) — bkz. CREDITS.md
  scorpion: {
    url: '/assets/models/Scorpion.glb',
    scale: 1.0,                  // model ~25.6 birim uzun, ~10.7 birim yüksek
    accentMaterial: 'F44336',    // kafadaki kırmızı işaret → eterik mor parıltı
  },
};

// Düşman takımı (kırmızı Soldier). Oyuncu timinin görünümü aşağıdaki SKINS listesinden gelir.
export const TEAMS = {
  blue: {
    body: [0.45, 0.85, 1.3],
    bodyEmissive: [0.0, 0.08, 0.14],
    visor: [0.35, 1.8, 3.0],
    glow: [0.4, 2.2, 4.0],
  },
  red: {
    body: [1.35, 0.22, 0.18],
    bodyEmissive: [0.12, 0.0, 0.0],
    visor: [3.0, 0.6, 0.2],
    glow: [4.0, 0.5, 0.3],
  },
};

// Market: Asker karakterinin renk kostümleri
export const SKINS = [
  { id: 'cyan', name: 'Neon Mavi', price: 0, model: 'soldier',
    body: [0.45, 0.85, 1.3], bodyEmissive: [0, 0.08, 0.14], visor: [0.35, 1.8, 3.0], glow: [0.4, 2.2, 4.0] },
  { id: 'emerald', name: 'Zümrüt', price: 300, model: 'soldier',
    body: [0.4, 1.25, 0.6], bodyEmissive: [0, 0.12, 0.04], visor: [0.4, 3.0, 1.0], glow: [0.5, 4.0, 1.2] },
  { id: 'violet', name: 'Mor Şimşek', price: 600, model: 'soldier',
    body: [0.95, 0.55, 1.45], bodyEmissive: [0.1, 0.02, 0.16], visor: [2.4, 0.8, 3.4], glow: [2.6, 0.9, 4.0] },
  { id: 'gold', name: 'Altın Muhafız', price: 1200, model: 'soldier', metalness: 0.9,
    body: [1.5, 1.1, 0.45], bodyEmissive: [0.15, 0.08, 0], visor: [3.4, 2.2, 0.6], glow: [4.0, 2.8, 0.8] },
  { id: 'chrome', name: 'Krom', price: 2000, model: 'soldier', metalness: 1,
    body: [1.45, 1.45, 1.55], bodyEmissive: [0.04, 0.04, 0.05], visor: [2.5, 2.8, 3.4], glow: [3.0, 3.2, 4.0] },
];

// Karakter mağazası: her biri farklı bir 3D model ve küçük bir pasif yetenek.
// perk: { fire: ateş hızı, armor: zırh şansı, coin: para bonusu, squad: +asker, damage: hasar } (oranlar 0–1)
export const CHARACTERS = [
  { id: 'soldier', name: 'Asker', model: 'soldier', price: 0, rarity: 'Sıradan', perk: {},
    perkText: 'Dengeli · kostüm giyebilir', icon: '🪖' },
  { id: 'xbot', name: 'X-Bot', model: 'xbot', price: 1500, rarity: 'Nadir', perk: { fire: 0.12 },
    perkText: '+%12 ateş hızı', icon: '⚡',
    body: [0.75, 0.85, 1.0], bodyEmissive: [0, 0.03, 0.06], visor: [0.4, 2.4, 4.0], glow: [0.4, 2.2, 4.0] },
  { id: 'robot', name: 'Robo', model: 'robot', price: 2500, rarity: 'Nadir', perk: { armor: 0.1 },
    perkText: '+%10 zırh (vuruş engelleme)', icon: '🛡️',
    body: [0.05, 0.42, 1.0], bodyEmissive: [0, 0.02, 0.06], visor: [0.4, 2.4, 4.0], glow: [0.4, 2.2, 4.0] },
  { id: 'frog', name: 'Kurbağa Finn', model: 'frog', price: 4000, rarity: 'Epik', perk: { coin: 0.25 },
    perkText: '+%25 para', icon: '💰', glow: [0.7, 4.0, 0.8] },
  { id: 'bee', name: 'Arı Barbara', model: 'bee', price: 6000, rarity: 'Epik', perk: { squad: 3 },
    perkText: '+3 başlangıç askeri', icon: '👥', glow: [4.0, 3.0, 0.4] },
  { id: 'commando', name: 'Uzay Komandosu', model: 'spacesuit', price: 9000, rarity: 'Efsanevi', perk: { damage: 0.25 },
    perkText: '+%25 lazer hasarı', icon: '💥', glow: [4.0, 1.6, 0.4] },
  { id: 'flamingo', name: 'Flamingo Fernando', model: 'flamingo', price: 7500, rarity: 'Epik', perk: { fire: 0.15, coin: 0.1 },
    perkText: '+%15 ateş hızı, +%10 para', icon: '🦩', glow: [4.0, 0.9, 2.6] },
  { id: 'rae', name: 'Kızıl Panda Rae', model: 'mechRae', price: 12000, rarity: 'Efsanevi', perk: { fire: 0.2, armor: 0.12 },
    perkText: 'Kendi Mech\'inde: +%20 ateş hızı, +%12 zırh', icon: '🦊', glow: [4.0, 1.8, 0.5] },
];

// Karaktere özel araçlar (Ultimate Space Kit). Yalnızca `char` karakteri satın alabilir ve kullanabilir.
//  mech:    tüm tim karakterin robot zırhlı sürümüne dönüşür (model değişir) + perk
//  support: timle birlikte giden tek bir araç (rover önde gider ve ezer, gemi üstte uçar); ağır ateş açar
export const VEHICLES = [
  { id: 'rover', char: 'soldier', type: 'support', kind: 'rover', name: 'Kum Roverı', icon: '🚙', price: 3000,
    url: '/assets/models/vehicles/Rover.glb', length: 3.6, power: 10, perkText: 'Önde gider, düşmanları ezer, top atar', short: 'ezer + top' },
  { id: 'rover_round', char: 'robot', type: 'support', kind: 'rover', name: 'Yuvarlak Rover', icon: '🚙', price: 3500,
    url: '/assets/models/vehicles/RoverRound.glb', length: 3.4, power: 11, perkText: 'Önde gider, düşmanları ezer, top atar', short: 'ezer + top' },
  { id: 'rover_heavy', char: 'commando', type: 'support', kind: 'rover', name: 'Ağır Rover', icon: '🚛', price: 5000,
    url: '/assets/models/vehicles/RoverHeavy.glb', length: 4.2, power: 15, perkText: 'Önde gider, düşmanları ezer, ağır top', short: 'ezer + ağır top' },
  { id: 'mech_frog', char: 'frog', type: 'mech', name: 'Finn\'in Mech\'i', icon: '🤖', price: 6000,
    model: 'mechFrog', perk: { armor: 0.12, damage: 0.15 }, perkText: 'Tim Mech\'e biner: +%12 zırh, +%15 hasar', short: '+zırh +hasar' },
  { id: 'ship_frog', char: 'frog', type: 'support', kind: 'ship', name: 'Finn\'in Gemisi', icon: '🚀', price: 5000,
    url: '/assets/models/vehicles/ShipFrog.glb', length: 4, power: 12, perkText: 'Üstte uçar, ağır lazer yağdırır', short: 'ağır lazer' },
  { id: 'mech_bee', char: 'bee', type: 'mech', name: 'Barbara\'nın Mech\'i', icon: '🤖', price: 7000,
    model: 'mechBee', perk: { armor: 0.12, damage: 0.15 }, perkText: 'Tim Mech\'e biner: +%12 zırh, +%15 hasar', short: '+zırh +hasar' },
  { id: 'ship_bee', char: 'bee', type: 'support', kind: 'ship', name: 'Barbara\'nın Gemisi', icon: '🚀', price: 6000,
    url: '/assets/models/vehicles/ShipBee.glb', length: 4.4, power: 13, perkText: 'Üstte uçar, ağır lazer yağdırır', short: 'ağır lazer' },
  { id: 'mech_flamingo', char: 'flamingo', type: 'mech', name: 'Fernando\'nun Mech\'i', icon: '🤖', price: 8000,
    model: 'mechFlamingo', perk: { armor: 0.15, damage: 0.15 }, perkText: 'Tim Mech\'e biner: +%15 zırh, +%15 hasar', short: '+zırh +hasar' },
  { id: 'ship_flamingo', char: 'flamingo', type: 'support', kind: 'ship', name: 'Fernando\'nun Gemisi', icon: '🚀', price: 7000,
    url: '/assets/models/vehicles/ShipFlamingo.glb', length: 4.2, power: 14, perkText: 'Üstte uçar, ağır lazer yağdırır', short: 'ağır lazer' },
  { id: 'ship_rae', char: 'rae', type: 'support', kind: 'ship', name: 'Rae\'nin Gemisi', icon: '🚀', price: 9000,
    url: '/assets/models/vehicles/ShipRae.glb', length: 4, power: 18, perkText: 'Üstte uçar, en ağır lazer', short: 'en ağır lazer' },
];

// Market: kalıcı yükseltmeler. Fiyat = base * growth^seviye
export const UPGRADES = [
  { id: 'squad', name: 'Başlangıç Timi', icon: '👥', max: 10, base: 60, growth: 1.5 },
  { id: 'fire', name: 'Ateş Hızı', icon: '⚡', max: 8, base: 90, growth: 1.6 },
  { id: 'damage', name: 'Lazer Gücü', icon: '💥', max: 8, base: 110, growth: 1.62 },
  { id: 'armor', name: 'Zırh', icon: '🛡️', max: 8, base: 130, growth: 1.68 },
  { id: 'coin', name: 'Para Bonusu', icon: '💰', max: 8, base: 150, growth: 1.72 },
];

export const GAME = {
  speed: 10,              // ileri koşu hızı (birim/sn)
  pathHalf: 7,            // yol yarı genişliği
  startCount: 5,
  spacing: 0.62,          // formasyon aralığı
  fireInterval: 0.3,
  laserSpeed: 55,
  laserRange: 44,
  enemySpeed: 6,
  enemyHp: 2,
  enemyAggroRange: 40,
  bossHp: 2600,
};

// Seviye düzeni: z ekseninde ileri = negatif
export const LEVEL = {
  bossZ: -345,
  bossStopOffset: 28,     // squad, boss'un bu kadar önünde durur
  arches: [-58, -128, -196, -262],
  events: [
    { z: -32, type: 'gate', gates: [{ x: 0, w: 14, op: 'x', v: 2 }] },
    { z: -72, type: 'enemies', count: 6 },
    { z: -102, type: 'gate', gates: [{ x: -3.5, w: 7, op: '+', v: 8 }, { x: 3.5, w: 7, op: 'x', v: 2 }] },
    { z: -145, type: 'enemies', count: 14 },
    { z: -178, type: 'gate', gates: [{ x: -3.5, w: 7, op: 'x', v: 3 }, { x: 3.5, w: 7, op: '-', v: 10 }] },
    { z: -218, type: 'enemies', count: 22 },
    { z: -250, type: 'gate', gates: [{ x: -3.5, w: 7, op: '+', v: 25 }, { x: 3.5, w: 7, op: 'x', v: 2 }] },
    { z: -290, type: 'enemies', count: 30 },
  ],
};
