import { GAME, SKINS, UPGRADES, CHARACTERS, VEHICLES } from './config.js';

export const upgradeCost = (u, lvl) => Math.round((u.base * Math.pow(u.growth, lvl)) / 5) * 5;

export const skinById = (id) => SKINS.find((s) => s.id === id) ?? SKINS[0];
export const charById = (id) => CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];

export const vehicleById = (id) => VEHICLES.find((v) => v.id === id);
export const vehiclesOf = (charId) => VEHICLES.filter((v) => v.char === charId);

// Şu anki karakterin açık (takılı) araçları
export const activeVehicles = (p) => VEHICLES.filter((v) => v.char === p.character && p.vehiclesOn.includes(v.id));
export const activeMech = (p) => activeVehicles(p).find((v) => v.type === 'mech');
export const activeSupport = (p) => activeVehicles(p).find((v) => v.type === 'support');

// Timin görünüm anahtarı: Asker kostüm giyer; Mech takılıysa tim Mech'e biner; diğerleri kendi görünümünde
export function appearanceKey(progress) {
  if (progress.character === 'soldier') return progress.skin;
  return activeMech(progress)?.id ?? progress.character;
}

// Karakter + araç yetenekleri toplanır
export function mergePerks(...list) {
  const out = {};
  for (const p of list) for (const [k, v] of Object.entries(p ?? {})) out[k] = (out[k] ?? 0) + v;
  return out;
}

export const currentPerk = (p) => mergePerks(charById(p.character).perk, activeMech(p)?.perk);

// Araç: karakter açık değilse 'locked'; alınmamışsa parası yetiyorsa satın alıp takar; alınmışsa takar/çıkarır
export function buyOrToggleVehicle(p, id) {
  const v = vehicleById(id);
  if (!v || !p.characters.includes(v.char)) return 'locked';
  if (!p.vehicles.includes(id)) {
    if (p.coins < v.price) return 'poor';
    p.coins -= v.price;
    p.vehicles.push(id);
    p.vehiclesOn = p.vehiclesOn.filter((x) => vehicleById(x)?.type !== v.type || vehicleById(x)?.char !== v.char);
    p.vehiclesOn.push(id);
    return 'bought';
  }
  if (p.vehiclesOn.includes(id)) {
    p.vehiclesOn = p.vehiclesOn.filter((x) => x !== id);
    return 'off';
  }
  p.vehiclesOn.push(id);
  return 'on';
}

// Yükseltme seviyelerinden (ve karakter yeteneğinden) oyun değerlerini hesaplar
export function upgradeStats(levels = {}, perk = {}) {
  const l = (id) => levels[id] | 0;
  return {
    startCount: GAME.startCount + l('squad') + (perk.squad ?? 0),
    fireInterval: GAME.fireInterval * Math.pow(0.9, l('fire')) * (1 - (perk.fire ?? 0)),
    damage: (1 + 0.25 * l('damage')) * (1 + (perk.damage ?? 0)),
    armor: 0.05 * l('armor') + (perk.armor ?? 0),
    coinMul: 1 + 0.15 * l('coin') + (perk.coin ?? 0),
  };
}

// Market satırında gösterilen etki metni (şimdiki → sonraki)
export function upgradeText(id, lvl) {
  const s = upgradeStats({ [id]: lvl });
  switch (id) {
    case 'squad': return `${s.startCount} askerle başla`;
    case 'fire': return `+%${Math.round((GAME.fireInterval / s.fireInterval - 1) * 100)} ateş hızı`;
    case 'damage': return `${s.damage.toFixed(2)}x hasar`;
    case 'armor': return `%${Math.round(s.armor * 100)} vuruş engelleme`;
    case 'coin': return `+%${Math.round((s.coinMul - 1) * 100)} para`;
    default: return '';
  }
}

// Satın alınabilir bir şey var mı? (menüdeki market rozeti için)
export function hasAffordable(progress) {
  const ups = UPGRADES.some((u) => (progress.upgrades[u.id] | 0) < u.max && upgradeCost(u, progress.upgrades[u.id] | 0) <= progress.coins);
  const skins = SKINS.some((s) => !progress.skins.includes(s.id) && s.price <= progress.coins);
  return ups || skins;
}

export function buyUpgrade(progress, id) {
  const u = UPGRADES.find((x) => x.id === id);
  const lvl = progress.upgrades[id] | 0;
  if (!u || lvl >= u.max) return false;
  const cost = upgradeCost(u, lvl);
  if (progress.coins < cost) return false;
  progress.coins -= cost;
  progress.upgrades[id] = lvl + 1;
  return true;
}

// Sahipse kuşanır, değilse parası yetiyorsa satın alıp kuşanır
export function buyOrEquipSkin(progress, id) {
  const s = skinById(id);
  if (!progress.skins.includes(id)) {
    if (progress.coins < s.price) return 'poor';
    progress.coins -= s.price;
    progress.skins.push(id);
    progress.skin = id;
    progress.character = 'soldier';
    return 'bought';
  }
  progress.skin = id;
  progress.character = 'soldier'; // kostüm Asker'e giydirilir
  return 'equipped';
}

export const hasAffordableChar = (progress) =>
  CHARACTERS.some((c) => !progress.characters.includes(c.id) && c.price <= progress.coins);

// Karakter: sahipse kuşan, değilse parası yetiyorsa satın al ve kuşan
export function buyOrEquipCharacter(progress, id) {
  const c = charById(id);
  if (!progress.characters.includes(id)) {
    if (progress.coins < c.price) return 'poor';
    progress.coins -= c.price;
    progress.characters.push(id);
    progress.character = id;
    return 'bought';
  }
  progress.character = id;
  return 'equipped';
}

// ---------- Market arayüzü ----------
export class ShopUI {
  constructor() {
    const $ = (s) => document.querySelector(s);
    this.el = {
      coins: $('.shop-coin-val'),
      upgrades: $('#shop-upgrades'),
      skins: $('#shop-skins'),
      tabs: [...document.querySelectorAll('#panel-shop .tab')],
    };
  }

  setTab(tab) {
    this.tab = tab;
    for (const t of this.el.tabs) t.classList.toggle('active', t.dataset.tab === tab);
    this.el.upgrades.classList.toggle('hidden-tab', tab !== 'upgrades');
    this.el.skins.classList.toggle('hidden-tab', tab !== 'skins');
  }

  render(progress) {
    this.el.coins.textContent = progress.coins;
    this.el.upgrades.innerHTML = UPGRADES.map((u) => {
      const lvl = progress.upgrades[u.id] | 0;
      const maxed = lvl >= u.max;
      const cost = upgradeCost(u, lvl);
      const pips = Array.from({ length: u.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
      const effect = maxed ? upgradeText(u.id, lvl) : `${upgradeText(u.id, lvl)} → <em>${upgradeText(u.id, lvl + 1)}</em>`;
      const btn = maxed
        ? '<button class="up-buy max" disabled>MAKS</button>'
        : `<button class="up-buy${progress.coins < cost ? ' poor' : ''}" data-action="buy-up" data-id="${u.id}"><span class="coin-icon"></span>${cost}</button>`;
      return `<div class="up-row">
        <div class="up-icon">${u.icon}</div>
        <div class="up-info"><b>${u.name} <small>Sv.${lvl}</small></b><span>${effect}</span><div class="pips">${pips}</div></div>
        ${btn}
      </div>`;
    }).join('');

    this.el.skins.innerHTML = SKINS.map((s) => {
      const owned = progress.skins.includes(s.id);
      const equipped = progress.character === 'soldier' && progress.skin === s.id;
      const c = (v, k = 1) => `rgb(${v.map((x) => Math.round(Math.min(1, x * k) * 255)).join(',')})`;
      const swatch = `background: radial-gradient(circle at 50% 38%, ${c(s.glow, 0.25)} 0 18%, transparent 19%), linear-gradient(160deg, ${c(s.body, 0.75)}, ${c(s.body, 0.35)});`;
      const label = equipped ? 'KUŞANILDI' : owned ? 'KUŞAN' : `<span class="coin-icon"></span>${s.price}`;
      const cls = equipped ? 'equipped' : owned ? 'owned' : progress.coins < s.price ? 'poor' : '';
      return `<button class="skin-card ${cls}" data-action="skin" data-id="${s.id}">
        <div class="skin-swatch" style="${swatch}"></div>
        <b>${s.name}</b>
        <span class="skin-price">${label}</span>
      </button>`;
    }).join('');
  }
}
