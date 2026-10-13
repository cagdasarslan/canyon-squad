// Liderlik tablosu.
// Şimdilik yerel: oyuncunun skorları tarayıcıda saklanır ve sabit tohumlu 40 rakiple (bot) sıralanır.
// Çevrimiçi tabloya geçmek için LocalLeaderboard ile aynı arayüze (submit / top / levelRecords / name)
// sahip, bir sunucuya (Firebase, Supabase, kendi API'n) istek atan bir sınıf yazıp main.js'te onu kullanman yeterli.

import { LEVEL_COUNT } from './levels.js';

const KEY = 'canyon-squad-scores';

// Bir bölüm sonu skoru
export function runScore({ kills, coins, win, survivors, level }) {
  const base = kills * 10 + coins * 2 + (win ? 500 * level + survivors * 25 : 0);
  return Math.round(base * (1 + 0.1 * (level - 1)));
}

// İsim HTML'e basıldığı için tehlikeli karakterler atılır
const clean = (name) => String(name ?? '').replace(/[<>&"'`]/g, '').trim().slice(0, 14);

export const fmt = (n) => Math.round(n).toLocaleString('tr-TR');

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// Sabit rakip listesi: her açılışta aynı isimler ve skorlar
function makeBots() {
  const r = rng(424242);
  const pre = ['Kum', 'Kızıl', 'Çöl', 'Altın', 'Gölge', 'Demir', 'Yıldız', 'Fırtına', 'Kartal', 'Akrep', 'Neon', 'Buz', 'Ateş', 'Kanyon'];
  const suf = ['Avcı', 'Kurt', 'Şahin', 'Kral', 'Ninja', 'Asker', 'Usta', 'Pilot', 'Komutan', 'Tilki', 'Aslan', 'Kaptan'];
  const used = new Set();
  const bots = [];
  for (let i = 0; i < 40; i++) {
    let name;
    do {
      name = pre[Math.floor(r() * pre.length)] + suf[Math.floor(r() * suf.length)] + (r() < 0.5 ? Math.floor(r() * 99) : '');
    } while (used.has(name));
    used.add(name);
    const score = Math.round(28000 * Math.pow(0.9, i) * (0.92 + r() * 0.16));
    bots.push({ name, score, bot: true });
  }
  return bots;
}

export class LocalLeaderboard {
  constructor() {
    this.bots = makeBots();
    this.data = { name: '', best: 0, levels: {} };
    try {
      Object.assign(this.data, JSON.parse(localStorage.getItem(KEY)) ?? {});
    } catch { /* depolama kapalı olabilir */ }
    this.data.name = clean(this.data.name) || `Oyuncu${Math.floor(1000 + Math.random() * 9000)}`;
    this.save();
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch { /* yok say */ }
  }

  get name() {
    return this.data.name;
  }

  setName(name) {
    const c = clean(name);
    if (c) this.data.name = c;
    this.save();
    return this.data.name;
  }

  get best() {
    return this.data.best;
  }

  // Skoru kaydeder; rekor olup olmadığını ve sıralamayı döndürür
  // Bölüm rekorları harita başına tutulur ("ice:3"); eski kayıtlarda anahtar yalnızca bölüm no (Kanyon)
  levelKey(level, mapId) {
    return mapId === 'canyon' && this.data.levels[level] && !this.data.levels[`canyon:${level}`] ? level : `${mapId}:${level}`;
  }

  submit(score, level, mapId = 'canyon') {
    const key = this.levelKey(level, mapId);
    const isRecord = score > this.data.best;
    const isLevelRecord = score > (this.data.levels[key] ?? 0);
    if (isRecord) this.data.best = score;
    if (isLevelRecord) this.data.levels[key] = score;
    this.save();
    return { isRecord, isLevelRecord, best: this.data.best, rank: this.rankOf(this.data.best) };
  }

  entries() {
    const me = { name: this.data.name, score: this.data.best, me: true };
    return [...this.bots, me].sort((a, b) => b.score - a.score).map((e, i) => ({ ...e, rank: i + 1 }));
  }

  rankOf(score) {
    return this.bots.filter((b) => b.score >= score).length + 1;
  }

  levelRecords(mapId = 'canyon') {
    return Array.from({ length: LEVEL_COUNT }, (_, i) => ({ level: i + 1, score: this.data.levels[this.levelKey(i + 1, mapId)] ?? 0 }));
  }
}

// ---------- Arayüz ----------
export class LeaderboardUI {
  constructor(board) {
    this.board = board;
    const $ = (s) => document.querySelector(s);
    this.el = {
      list: $('.lb-list'),
      me: $('.lb-me'),
      input: $('#lb-name-input'),
      tabs: [...document.querySelectorAll('#panel-leaderboard .tab')],
    };
    this.tab = 'all';
    this.el.input.addEventListener('change', () => {
      this.el.input.value = board.setName(this.el.input.value);
      this.render();
    });
    this.el.input.addEventListener('keydown', (e) => {
      e.stopPropagation(); // oyun kısayolları tetiklenmesin
      if (e.key === 'Enter') this.el.input.blur();
    });
  }

  setTab(tab) {
    this.tab = tab;
    for (const t of this.el.tabs) t.classList.toggle('active', t.dataset.tab === tab);
    this.render();
  }

  row(e) {
    const medal = ['🥇', '🥈', '🥉'][e.rank - 1];
    return `<div class="lb-row${e.me ? ' me' : ''}">
      <span class="lb-rank">${medal ?? e.rank}</span>
      <span class="lb-player">${e.me ? `${e.name} <small>(sen)</small>` : e.name}</span>
      <b class="lb-score">${e.score ? fmt(e.score) : '—'}</b>
    </div>`;
  }

  render() {
    this.el.input.value = this.board.name;
    if (this.tab === 'all') {
      const list = this.board.entries();
      const me = list.find((e) => e.me);
      this.el.list.innerHTML = list.slice(0, 30).map((e) => this.row(e)).join('');
      // oyuncu ilk 30'da değilse altta sabit satırda göster
      this.el.me.innerHTML = me.rank > 30 ? this.row(me) : '';
      this.el.me.classList.toggle('hidden-tab', me.rank <= 30);
    } else {
      this.el.list.innerHTML = this.board.levelRecords(this.mapId).map((r) => `<div class="lb-row">
        <span class="lb-rank">${r.level}</span>
        <span class="lb-player">Bölüm ${r.level}</span>
        <b class="lb-score">${r.score ? fmt(r.score) : '—'}</b>
      </div>`).join('');
      this.el.me.classList.add('hidden-tab');
    }
  }
}
