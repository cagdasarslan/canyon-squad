// Başarımlar: ömür boyu istatistiklere bağlı, bir kez açılan ve para ödülü veren hedefler.

const KEY = 'canyon-squad-achievements';

// 'max' türündeki istatistikler toplanmaz, en yüksek değer saklanır
const MAX_STATS = new Set(['squad', 'highestLevel', 'skins', 'chars', 'maps', 'vehicles', 'streak', 'flawless', 'closeCall']);

export const ACHIEVEMENTS = [
  { id: 'kill1', icon: '💀', name: 'Acemi Avcı', desc: '100 düşman yok et', stat: 'kill', target: 100, reward: 100 },
  { id: 'kill2', icon: '💀', name: 'Usta Avcı', desc: '1.000 düşman yok et', stat: 'kill', target: 1000, reward: 300 },
  { id: 'kill3', icon: '☠️', name: 'Efsanevi Avcı', desc: '5.000 düşman yok et', stat: 'kill', target: 5000, reward: 1000 },
  { id: 'boss1', icon: '🦂', name: 'İlk Av', desc: 'İlk boss\'u yen', stat: 'boss', target: 1, reward: 200 },
  { id: 'boss2', icon: '🐉', name: 'Canavar Avcısı', desc: '10 boss yen', stat: 'boss', target: 10, reward: 600 },
  { id: 'boss3', icon: '⚔️', name: 'Efsane Avcı', desc: '50 boss yen', stat: 'boss', target: 50, reward: 2000 },
  { id: 'lvl1', icon: '🏁', name: 'İlk Zafer', desc: 'İlk bölümü bitir', stat: 'highestLevel', target: 1, reward: 100 },
  { id: 'lvl5', icon: '🗺️', name: 'Kanyon Gezgini', desc: 'Bir haritada 10. bölümü bitir', stat: 'highestLevel', target: 10, reward: 300 },
  { id: 'lvl25', icon: '⛰️', name: 'Yarı Yol', desc: 'Bir haritada 25. bölümü bitir', stat: 'highestLevel', target: 25, reward: 800 },
  { id: 'lvl10', icon: '👑', name: 'Kanyon Fatihi', desc: 'Bir haritanın 50. bölümünü bitir', stat: 'highestLevel', target: 50, reward: 2500 },
  { id: 'map2', icon: '❄️', name: 'Mağara Kâşifi', desc: 'Yeni bir harita aç', stat: 'maps', target: 2, reward: 300 },
  { id: 'map4', icon: '💎', name: 'Mağara Ustası', desc: 'Bütün haritaları aç', stat: 'maps', target: 4, reward: 1500 },
  { id: 'squad50', icon: '👥', name: 'Kalabalık', desc: 'Timi 50 askere ulaştır', stat: 'squad', target: 50, reward: 150 },
  { id: 'squad100', icon: '🪖', name: 'Ordu', desc: 'Timi 100 askere ulaştır', stat: 'squad', target: 100, reward: 400 },
  { id: 'squad110', icon: '⚔️', name: 'Lejyon', desc: 'Timi 250 askere ulaştır', stat: 'squad', target: 250, reward: 600 },
  { id: 'squad1000', icon: '🏰', name: 'İmparatorluk Ordusu', desc: 'Timi 1.000 askere ulaştır', stat: 'squad', target: 1000, reward: 1500 },
  { id: 'coin1', icon: '🪙', name: 'Biriktirici', desc: 'Toplam 1.000 para topla', stat: 'coins', target: 1000, reward: 150 },
  { id: 'coin2', icon: '💰', name: 'Altın Babası', desc: 'Toplam 10.000 para topla', stat: 'coins', target: 10000, reward: 800 },
  { id: 'gate1', icon: '🚪', name: 'Kapı Ustası', desc: '25 artı kapıdan geç', stat: 'gates', target: 25, reward: 150 },
  { id: 'gate2', icon: '🧮', name: 'Matematik Dahisi', desc: '100 artı kapıdan geç', stat: 'gates', target: 100, reward: 400 },
  { id: 'up1', icon: '⬆️', name: 'Geliştirici', desc: '5 yükseltme al', stat: 'upgrade', target: 5, reward: 200 },
  { id: 'up2', icon: '🔧', name: 'Teknoloji Devi', desc: '25 yükseltme al', stat: 'upgrade', target: 25, reward: 800 },
  { id: 'skin2', icon: '🎨', name: 'Moda Tutkunu', desc: 'Yeni bir kostüm al', stat: 'skins', target: 2, reward: 150 },
  { id: 'skin6', icon: '👗', name: 'Gardırop', desc: 'Bütün kostümleri topla', stat: 'skins', target: 5, reward: 600 },
  { id: 'char2', icon: '👤', name: 'Yeni Yüz', desc: 'İkinci bir karakter aç', stat: 'chars', target: 2, reward: 300 },
  { id: 'char6', icon: '🤖', name: 'Karakter Koleksiyoncusu', desc: 'Bütün karakterleri aç', stat: 'chars', target: 8, reward: 2500 },
  { id: 'veh1', icon: '🚀', name: 'Garaj', desc: 'İlk aracını al', stat: 'vehicles', target: 1, reward: 300 },
  { id: 'veh10', icon: '🛸', name: 'Uzay Filosu', desc: 'Bütün araçları topla', stat: 'vehicles', target: 10, reward: 3000 },
  { id: 'streak7', icon: '📅', name: 'Sadık Asker', desc: '7 gün üst üste ödül al', stat: 'streak', target: 7, reward: 500 },
  { id: 'missions10', icon: '📋', name: 'Görev Adamı', desc: '10 günlük görev tamamla', stat: 'missions', target: 10, reward: 300 },
  { id: 'flawless', icon: '✨', name: 'Kusursuz', desc: 'Boss\'u hiç asker kaybetmeden yen', stat: 'flawless', target: 1, reward: 500 },
  { id: 'close', icon: '😅', name: 'Kıl Payı', desc: 'Bir bölümü 3 veya daha az askerle kazan', stat: 'closeCall', target: 1, reward: 300 },
  { id: 'blocks', icon: '🛡️', name: 'Çelik Kalkan', desc: 'Zırhla 50 vuruş engelle', stat: 'blocks', target: 50, reward: 300 },
];

export function loadAchievements() {
  try {
    const st = JSON.parse(localStorage.getItem(KEY));
    if (st && typeof st === 'object') {
      return { stats: st.stats ?? {}, unlocked: st.unlocked ?? [], claimed: st.claimed ?? [] };
    }
  } catch { /* depolama kapalı olabilir */ }
  return { stats: {}, unlocked: [], claimed: [] };
}

export function saveAchievements(st) {
  try {
    localStorage.setItem(KEY, JSON.stringify(st));
  } catch { /* yok say */ }
}

// İstatistiği günceller; yeni açılan başarımları döndürür
export function record(st, stat, amount = 1) {
  const cur = st.stats[stat] ?? 0;
  st.stats[stat] = MAX_STATS.has(stat) ? Math.max(cur, amount) : cur + amount;
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (a.stat === stat && !st.unlocked.includes(a.id) && st.stats[stat] >= a.target) {
      st.unlocked.push(a.id);
      fresh.push(a);
    }
  }
  return fresh;
}

export const hasClaimableAchievement = (st) => st.unlocked.some((id) => !st.claimed.includes(id));

export function claimAchievement(st, progress, id) {
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a || !st.unlocked.includes(id) || st.claimed.includes(id)) return 0;
  st.claimed.push(id);
  progress.coins += a.reward;
  return a.reward;
}

export class AchievementsUI {
  constructor() {
    this.list = document.querySelector('.ach-list');
    this.count = document.querySelector('.ach-count');
  }

  render(st) {
    // sıralama: alınabilir → devam eden → alınmış
    const rank = (a) => (st.claimed.includes(a.id) ? 2 : st.unlocked.includes(a.id) ? 0 : 1);
    const items = [...ACHIEVEMENTS].sort((a, b) => rank(a) - rank(b));
    this.count.textContent = `${st.unlocked.length} / ${ACHIEVEMENTS.length} açıldı`;
    this.list.innerHTML = items.map((a) => {
      const val = Math.min(st.stats[a.stat] ?? 0, a.target);
      const unlocked = st.unlocked.includes(a.id);
      const claimed = st.claimed.includes(a.id);
      const btn = claimed
        ? '<button class="up-buy max" disabled>✓</button>'
        : unlocked
          ? `<button class="up-buy" data-action="claim-ach" data-id="${a.id}"><span class="coin-icon"></span>${a.reward}</button>`
          : `<button class="up-buy poor" disabled><span class="coin-icon"></span>${a.reward}</button>`;
      return `<div class="up-row ach${unlocked ? '' : ' locked-ach'}${claimed ? ' done' : ''}">
        <div class="up-icon">${a.icon}</div>
        <div class="up-info">
          <b>${a.name}</b>
          <span>${a.desc}</span>
          ${unlocked ? '' : `<div class="mbar"><div style="width:${(val / a.target) * 100}%"></div><span>${val} / ${a.target}</span></div>`}
        </div>
        ${btn}
      </div>`;
    }).join('');
  }
}
