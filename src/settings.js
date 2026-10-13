// Oyuncu ayarları (tarayıcıda saklanır)
const KEY = 'canyon-squad-settings';
// unlockAll: test modu — geliştirme sırasında açık; yayından önce false yap
const DEFAULTS = { sfx: true, music: true, hq: true, unlockAll: true };

export function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY)) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch { /* depolama kapalı olabilir */ }
}
