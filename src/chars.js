import { CHARACTERS } from './config.js';
import { vehiclesOf } from './shop.js';

export const RARITY_COLORS = {
  Sıradan: [0.75, 0.75, 0.8],
  Nadir: [0.3, 1.4, 3.0],
  Epik: [2.2, 0.6, 3.2],
  Efsanevi: [3.5, 2.2, 0.4],
};

const css = (c) => `rgb(${c.map((v) => Math.round(Math.min(1, v / 3.5 + 0.25) * 255)).join(',')})`;

// Karakter mağazası kartı. 3D önizleme sahnede (main.js) gösterilir; bu sınıf yalnızca alttaki kartı çizer.
export class CharStoreUI {
  constructor() {
    const $ = (s) => document.querySelector(s);
    this.el = {
      coins: $('.cs-coin-val'),
      rarity: $('.cs-rarity'),
      name: $('.cs-name'),
      perkIcon: $('.cs-perk-icon'),
      perkText: $('.cs-perk-text'),
      dots: $('.cs-dots'),
      buy: $('.cs-buy'),
      loading: $('.cs-loading'),
      card: $('.cs-card'),
      vehicles: $('.cs-vehicles'),
    };
  }

  setLoading(on) {
    this.el.loading.classList.toggle('hidden', !on);
  }

  render(progress, index) {
    const c = CHARACTERS[index];
    const owned = progress.characters.includes(c.id);
    const equipped = progress.character === c.id;
    this.el.coins.textContent = progress.coins;
    this.el.rarity.textContent = c.rarity.toLocaleUpperCase('tr-TR');
    this.el.rarity.style.background = css(RARITY_COLORS[c.rarity]);
    this.el.name.textContent = c.name;
    this.el.perkIcon.textContent = c.icon;
    this.el.perkText.textContent = c.perkText;
    this.el.dots.innerHTML = CHARACTERS.map((x, i) =>
      `<i class="${i === index ? 'on' : ''}${progress.characters.includes(x.id) ? ' owned' : ''}"></i>`).join('');
    // karaktere özel araçlar
    this.el.vehicles.innerHTML = vehiclesOf(c.id).map((v) => {
      const have = progress.vehicles.includes(v.id);
      const on = progress.vehiclesOn.includes(v.id);
      const cls = !owned ? 'locked' : on ? 'on' : have ? 'owned' : progress.coins < v.price ? 'poor' : '';
      const label = !owned ? '🔒' : on ? '✓' : have ? 'TAK' : `<span class="coin-icon"></span>${v.price.toLocaleString('tr-TR')}`;
      const type = v.type === 'mech' ? 'Mech' : v.kind === 'ship' ? 'Gemi' : 'Rover';
      return `<button class="veh ${cls}" data-action="veh" data-id="${v.id}" title="${v.name}: ${v.perkText}">
        <span class="veh-icon">${v.icon}</span>
        <span class="veh-info"><b>${type}</b><small>${v.short ?? ''}</small></span>
        <span class="veh-btn">${label}</span>
      </button>`;
    }).join('');

    const b = this.el.buy;
    b.classList.remove('poor', 'equipped');
    if (equipped) {
      b.textContent = 'KUŞANILDI ✓';
      b.classList.add('equipped');
    } else if (owned) {
      b.textContent = 'KUŞAN';
    } else {
      b.innerHTML = `<span class="coin-icon"></span> ${c.price.toLocaleString('tr-TR')}`;
      if (progress.coins < c.price) b.classList.add('poor');
    }
  }

  shake() {
    const b = this.el.buy;
    b.classList.add('shake');
    setTimeout(() => b.classList.remove('shake'), 300);
  }
}
