// Günlük ödül (7 günlük seri) ve günlük görevler. Durum tarayıcıda saklanır.

const KEY = 'canyon-squad-daily';

export const DAILY_REWARDS = [100, 150, 200, 300, 400, 500, 1000];

// Görev havuzu: her gün tarihe göre 3 farklı tür seçilir, her biri 3 zorluk kademesinden birinde
const POOL = [
  { type: 'kill', icon: '💀', text: (n) => `${n} düşman yok et`, targets: [40, 80, 150], rewards: [100, 180, 300] },
  { type: 'coins', icon: '🪙', text: (n) => `${n} para topla`, targets: [200, 400, 700], rewards: [100, 180, 300] },
  { type: 'boss', icon: '🦂', text: (n) => (n > 1 ? `Akrep boss'u ${n} kez yen` : `Akrep boss'u yen`), targets: [1, 2, 3], rewards: [150, 250, 400] },
  { type: 'gates', icon: '🚪', text: (n) => `${n} artı kapıdan geç`, targets: [5, 10, 20], rewards: [80, 150, 250] },
  { type: 'squad', icon: '👥', text: (n) => `Timi ${n} askere ulaştır`, targets: [40, 70, 100], rewards: [100, 200, 350], max: true },
  { type: 'levels', icon: '🏁', text: (n) => `${n} bölüm tamamla`, targets: [1, 2, 4], rewards: [120, 220, 400] },
  { type: 'upgrade', icon: '⬆️', text: (n) => `Marketten ${n} yükseltme al`, targets: [1, 2, 3], rewards: [80, 150, 220] },
];
const poolOf = (type) => POOL.find((p) => p.type === type);

// Yerel saatle YYYY-MM-DD
export function dateKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dateKey(d);
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeMissions(day) {
  const r = rng([...day].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261));
  const types = POOL.map((p) => p.type).sort(() => r() - 0.5).slice(0, 3);
  return types.map((type) => {
    const tier = Math.floor(r() * 3);
    const p = poolOf(type);
    return { type, tier, target: p.targets[tier], reward: p.rewards[tier], progress: 0, claimed: false };
  });
}

export function loadDaily() {
  const today = dateKey();
  let st = null;
  try {
    st = JSON.parse(localStorage.getItem(KEY));
  } catch { /* depolama kapalı olabilir */ }
  if (!st || typeof st !== 'object') st = { streak: 0, lastClaim: null };
  if (st.day !== today || !Array.isArray(st.missions)) {
    st.day = today;
    st.missions = makeMissions(today);
  }
  return st;
}

export function saveDaily(st) {
  try {
    localStorage.setItem(KEY, JSON.stringify(st));
  } catch { /* yok say */ }
}

// ---------- Günlük ödül ----------
export const canClaimDaily = (st) => st.lastClaim !== dateKey();

// Seri hâlâ sürüyor mu? (bugün ya da dün alınmışsa)
function streakBase(st) {
  return st.lastClaim === dateKey() || st.lastClaim === yesterdayKey() ? st.streak : 0;
}

// 7 günlük döngüde kaç gün alındı ve bugün hangi gün
export function dailyCycle(st) {
  const base = streakBase(st);
  const claimable = canClaimDaily(st);
  let done = base > 0 ? ((base - 1) % 7) + 1 : 0;
  if (claimable && done === 7) done = 0; // döngü bitti, yeni hafta
  return { done, today: claimable ? done : done - 1, claimable };
}

export function claimDaily(st, progress) {
  if (!canClaimDaily(st)) return 0;
  const streak = streakBase(st) + 1;
  const reward = DAILY_REWARDS[(streak - 1) % 7];
  st.streak = streak;
  st.lastClaim = dateKey();
  progress.coins += reward;
  return reward;
}

// ---------- Görevler ----------
// Olay bildirir; yeni tamamlanan görevleri döndürür (bildirim için)
export function track(st, type, amount = 1) {
  const done = [];
  for (const m of st.missions) {
    if (m.type !== type || m.claimed) continue;
    const before = m.progress;
    m.progress = poolOf(type).max ? Math.max(m.progress, amount) : m.progress + amount;
    if (before < m.target && m.progress >= m.target) done.push(m);
  }
  return done;
}

export const missionText = (m) => poolOf(m.type).text(m.target);
export const missionIcon = (m) => poolOf(m.type).icon;
export const hasClaimableMission = (st) => st.missions.some((m) => !m.claimed && m.progress >= m.target);

export function claimMission(st, progress, index) {
  const m = st.missions[index];
  if (!m || m.claimed || m.progress < m.target) return 0;
  m.claimed = true;
  progress.coins += m.reward;
  return m.reward;
}

// Gece yarısına kalan süre (görev yenilenmesi / sonraki ödül)
export function untilMidnight() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  const s = Math.max(0, Math.floor((next - now) / 1000));
  const p = (n) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

// ---------- Arayüz ----------
export class DailyUI {
  constructor() {
    const $ = (s) => document.querySelector(s);
    this.el = {
      days: $('.daily-days'),
      claim: $('[data-action="claim-daily"]'),
      dailyNote: $('.daily-note'),
      missions: $('.mission-list'),
      missionNote: $('.mission-note'),
    };
    setInterval(() => this.tick(), 1000);
  }

  tick() {
    const t = untilMidnight();
    if (this.el.missionNote) this.el.missionNote.textContent = `Yeni görevler: ${t}`;
    if (this.claimed) this.el.dailyNote.textContent = `Sonraki ödül: ${t}`;
  }

  renderDaily(st) {
    const { done, today, claimable } = dailyCycle(st);
    this.el.days.innerHTML = DAILY_REWARDS.map((r, i) => {
      const cls = i < done ? 'claimed' : i === today && claimable ? 'today' : '';
      return `<div class="day ${cls}${i === 6 ? ' big' : ''}">
        <small>${i + 1}. GÜN</small>
        <span class="coin-icon"></span>
        <b>${r}</b>
        ${i < done ? '<i class="check">✓</i>' : ''}
      </div>`;
    }).join('');
    this.claimed = !claimable;
    this.el.claim.disabled = !claimable;
    this.el.claim.textContent = claimable ? `ÖDÜLÜ AL` : 'ALINDI';
    this.el.dailyNote.textContent = claimable ? 'Her gün gel, seriyi bozma!' : `Sonraki ödül: ${untilMidnight()}`;
  }

  renderMissions(st) {
    this.el.missions.innerHTML = st.missions.map((m, i) => {
      const p = Math.min(m.progress, m.target);
      const ready = !m.claimed && m.progress >= m.target;
      const btn = m.claimed
        ? '<button class="up-buy max" disabled>✓</button>'
        : `<button class="up-buy${ready ? '' : ' poor'}" data-action="claim-mission" data-index="${i}"${ready ? '' : ' disabled'}><span class="coin-icon"></span>${m.reward}</button>`;
      return `<div class="up-row mission${m.claimed ? ' done' : ''}">
        <div class="up-icon">${missionIcon(m)}</div>
        <div class="up-info">
          <b>${missionText(m)}</b>
          <div class="mbar"><div style="width:${(p / m.target) * 100}%"></div><span>${p} / ${m.target}</span></div>
        </div>
        ${btn}
      </div>`;
    }).join('');
    this.tick();
  }
}
