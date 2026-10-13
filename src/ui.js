import { LEVEL_COUNT } from './levels.js';
import { MAPS, UNLOCK_AT, mapState, isMapUnlocked, levelsUnlocked } from './maps.js';
import { BLOCK, BOSSES } from './bosses.js';

// Menü ekranları: ana menü, bölüm seçimi, ayarlar, duraklatma.
// Tüm düğmeler data-action ile tek bir dinleyiciye bağlanır; eylemler main.js'te işlenir.
export class Menu {
  constructor(onAction) {
    const $ = (s) => document.querySelector(s);
    this.screens = {
      menu: $('#menu'),
      levels: $('#panel-levels'),
      settings: $('#panel-settings'),
      pause: $('#panel-pause'),
      shop: $('#panel-shop'),
      daily: $('#panel-daily'),
      missions: $('#panel-missions'),
      achievements: $('#panel-achievements'),
      leaderboard: $('#panel-leaderboard'),
      chars: $('#panel-chars'),
    };
    this.el = {
      levelNum: $('.menu-level-num'),
      levelName: $('.menu-level-name'),
      coins: $('.menu-coin-val'),
      grid: $('.level-grid'),
      maps: $('.map-strip'),
      pageTitle: $('.lv-page-title'),
      prev: $('[data-action="lv-prev"]'),
      next: $('[data-action="lv-next"]'),
      dots: $('.lv-dots'),
      mapInfo: $('.level-info'),
      sfx: $('#opt-sfx'),
      music: $('#opt-music'),
      hq: $('#opt-hq'),
      test: $('#opt-test'),
      reset: $('[data-action="reset"]'),
      badge: $('.badge-shop'),
      badgeChars: $('.badge-chars'),
      badgeDaily: $('.badge-daily'),
      badgeMissions: $('.badge-missions'),
      badgeAch: $('.badge-ach'),
    };
    this.stack = [];
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn || btn.classList.contains('locked')) return;
      if (btn.dataset.action === 'back') return this.back();
      onAction(btn.dataset.action, btn);
    });
  }

  get isOpen() {
    return this.stack.length > 0;
  }

  get top() {
    return this.stack[this.stack.length - 1];
  }

  open(name) {
    if (this.top) this.screens[this.top].classList.add('hidden');
    this.stack.push(name);
    this.screens[name].classList.remove('hidden');
  }

  back() {
    const cur = this.stack.pop();
    if (cur) this.screens[cur].classList.add('hidden');
    if (this.top) this.screens[this.top].classList.remove('hidden');
    this.resetConfirm();
  }

  closeAll() {
    for (const name of this.stack) this.screens[name].classList.add('hidden');
    this.stack = [];
  }

  setCharBadge(on) {
    this.el.badgeChars.classList.toggle('hidden', !on);
  }

  setMain(level, name, coins, shopBadge = false) {
    this.el.levelNum.textContent = level;
    this.el.levelName.textContent = name;
    this.el.coins.textContent = coins;
    this.el.badge.classList.toggle('hidden', !shopBadge);
  }

  setBadges(daily, missions, achievements) {
    this.el.badgeDaily.classList.toggle('hidden', !daily);
    this.el.badgeMissions.classList.toggle('hidden', !missions);
    this.el.badgeAch.classList.toggle('hidden', !achievements);
  }

  // Harita kartları + seçili haritanın 10'arlı bölüm sayfası (her sayfa bir boss bloğu)
  renderLevels(progress, picked, currentMap, currentLevel, page) {
    this.el.maps.innerHTML = MAPS.map((m, i) => {
      const open = isMapUnlocked(progress, i);
      const done = Math.max(0, mapState(progress, m.id).unlocked - 1);
      return `<button class="map-card${i === picked ? ' picked' : ''}${open ? '' : ' locked'}" data-action="map-pick" data-map="${i}">
        <span class="map-icon">${open ? m.icon : '🔒'}</span>
        <b>${m.name}</b>
        <small>${open ? `${done}/${LEVEL_COUNT}` : 'Kilitli'}</small>
      </button>`;
    }).join('');

    const map = MAPS[picked];
    const open = isMapUnlocked(progress, picked);
    this.el.mapInfo.textContent = open
      ? `${map.icon} ${map.name}`
      : `🔒 ${MAPS[picked - 1].name} haritasında ${UNLOCK_AT}. bölümü geç`;
    const unlocked = open ? levelsUnlocked(progress, map.id) : 0;
    const pages = LEVEL_COUNT / BLOCK;
    const first = page * BLOCK + 1;
    const boss = BOSSES[Math.min(BOSSES.length - 1, page)];
    this.el.pageTitle.innerHTML = `Bölüm ${first}–${first + BLOCK - 1}<br><b>${boss.icon} ${map.boss.prefix} ${boss.name}</b>`;
    this.el.prev.disabled = page <= 0;
    this.el.next.disabled = page >= pages - 1;
    this.el.dots.innerHTML = Array.from({ length: pages }, (_, i) => `<i class="${i === page ? 'on' : ''}"></i>`).join('');

    const g = this.el.grid;
    g.innerHTML = '';
    for (let n = first; n < first + BLOCK; n++) {
      const b = document.createElement('button');
      const locked = n > unlocked;
      const current = picked === currentMap && n === currentLevel;
      const bossLevel = n % BLOCK === 0;
      b.className = 'level-cell' + (locked ? ' locked' : '') + (current ? ' current' : '') + (bossLevel && !locked && !current ? ' boss10' : '');
      b.textContent = locked ? '🔒' : bossLevel ? `${n}` : n;
      b.title = bossLevel ? `${n} · ${boss.name}` : `${n}`;
      b.dataset.action = 'select';
      b.dataset.level = n;
      b.dataset.map = picked;
      g.appendChild(b);
    }
  }

  // Bölüm ızgarasında sağa/sola kaydırma
  onSwipe(fn) {
    let x0 = null;
    this.el.grid.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    this.el.grid.addEventListener('pointerup', (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 40) fn(dx < 0 ? 1 : -1);
    });
    this.el.grid.addEventListener('pointercancel', () => { x0 = null; });
  }

  // sayfa değişiminde küçük kayma animasyonu
  slide(dir, render) {
    const g = this.el.grid;
    g.classList.add(dir > 0 ? 'slide-l' : 'slide-r');
    setTimeout(() => {
      render();
      g.classList.remove('slide-l', 'slide-r');
    }, 120);
  }

  bindSettings(settings, onChange) {
    const { sfx, music, hq, test } = this.el;
    sfx.checked = settings.sfx;
    music.checked = settings.music;
    hq.checked = settings.hq;
    test.checked = settings.unlockAll;
    for (const [key, input] of Object.entries({ sfx, music, hq, unlockAll: test })) {
      input.addEventListener('change', () => onChange(key, input.checked));
    }
  }

  // "İlerlemeyi sıfırla" iki dokunuşla onaylanır
  confirmReset() {
    if (this.resetArmed) {
      this.resetConfirm();
      return true;
    }
    this.resetArmed = true;
    this.el.reset.textContent = 'EMİN MİSİN? TEKRAR DOKUN';
    return false;
  }

  resetConfirm() {
    this.resetArmed = false;
    this.el.reset.textContent = 'İLERLEMEYİ SIFIRLA';
  }
}
