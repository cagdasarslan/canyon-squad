import * as THREE from 'three';

export class Hud {
  constructor() {
    const $ = (s) => document.querySelector(s);
    this.el = {
      count: $('#count'),
      countVal: $('#count span'),
      coins: $('#coins'),
      coinVal: $('#coins .coin-val'),
      progress: $('.progress-fill'),
      bossbar: $('#bossbar'),
      bossFill: $('.boss-fill'),
      hud: $('#hud'),
      cine: $('#cine'),
      bossCard: $('.boss-card'),
      bossCardSub: $('.boss-card-sub'),
      bossCardName: $('.boss-card-name'),
      end: $('#overlay-end'),
      endTitle: $('.end-title'),
      endCoins: $('.end-coin-val'),
      loading: $('#loading'),
      loadFill: $('.load-fill'),
      restart: $('#btn-restart'),
      lvlNum: $('#level .lvl-num'),
      bossName: $('.boss-name'),
      endSub: $('.end-sub'),
    };
    this.v = new THREE.Vector3();
    this.lastCount = -1;
  }

  setLevel(n, bossName, mapName) {
    this.el.lvlNum.textContent = n;
    this.el.bossName.textContent = bossName;
    this.el.bossCardName.textContent = bossName;
    this.el.bossCardSub.textContent = n === 50 ? `${mapName.toLocaleUpperCase('tr-TR')} · SON BOSS` : `BÖLÜM ${n} BOSS`;
  }

  // Menüdeyken veya sinematikteyken HUD gizlenir
  setMode(mode) {
    this.el.hud.classList.toggle('in-menu', mode === 'menu');
    this.el.hud.classList.toggle('cinematic', mode === 'cinematic');
  }

  showCinematic(show) {
    this.el.cine.classList.toggle('hidden', !show);
  }

  showBossCard() {
    const c = this.el.bossCard;
    c.classList.remove('out');
    c.classList.add('show');
    clearTimeout(this.cardT);
    this.cardT = setTimeout(() => {
      c.classList.remove('show');
      c.classList.add('out');
    }, 1500);
  }

  // Oyun içi kısa bildirim (görev tamamlandı vb.)
  // Bildirimler sırayla gösterilir (aynı anda birden çok başarım/görev açılabilir)
  toast(text) {
    (this.toasts ??= []).push(text);
    if (!this.toastBusy) this.nextToast();
  }

  nextToast() {
    const el = document.getElementById('toast');
    const text = this.toasts.shift();
    if (!text) {
      this.toastBusy = false;
      return;
    }
    this.toastBusy = true;
    el.textContent = text;
    el.classList.add('show');
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => this.nextToast(), 350);
    }, 2000);
  }

  setLoading(p) {
    this.el.loadFill.style.width = `${Math.round(p * 100)}%`;
  }

  loaded() {
    this.el.loading.classList.add('hidden');
  }

  setCount(n, worldPos, camera, rect) {
    if (n !== this.lastCount) {
      const cls = n > this.lastCount ? 'pop' : 'hurt';
      if (this.lastCount >= 0) {
        this.el.count.classList.add(cls);
        clearTimeout(this.popT);
        this.popT = setTimeout(() => this.el.count.classList.remove('pop', 'hurt'), 140);
      }
      this.lastCount = n;
      this.el.countVal.textContent = n.toLocaleString('tr-TR');
    }
    this.v.copy(worldPos).project(camera);
    const x = (this.v.x * 0.5 + 0.5) * rect.width;
    const y = (-this.v.y * 0.5 + 0.5) * rect.height;
    this.el.count.style.left = `${x}px`;
    this.el.count.style.top = `${y}px`;
    this.el.count.style.opacity = n > 0 ? 1 : 0;
  }

  setCoins(n) {
    this.el.coinVal.textContent = n;
    this.el.coins.classList.add('pop');
    clearTimeout(this.coinT);
    this.coinT = setTimeout(() => this.el.coins.classList.remove('pop'), 90);
  }

  setProgress(p) {
    this.el.progress.style.width = `${Math.max(0, Math.min(1, p)) * 100}%`;
  }

  showBoss(show) {
    this.el.bossbar.classList.toggle('hidden', !show);
  }

  setBossHp(p) {
    this.el.bossFill.style.width = `${Math.max(0, p) * 100}%`;
  }

  showEnd(win, coins, { level, final, score = 0, isRecord = false, rank = 0, mapName = '', nextMapName = null }) {
    document.querySelector('.end-score-val').textContent = score.toLocaleString('tr-TR');
    document.querySelector('.end-record').classList.toggle('hidden-tab', !isRecord);
    document.querySelector('.end-rank').textContent = rank ? `Sıralama: #${rank}` : '';
    this.el.endTitle.textContent = win ? (final ? 'EFSANE!' : 'ZAFER!') : 'TİM YOK OLDU';
    this.el.endTitle.classList.toggle('lose', !win);
    this.el.endSub.textContent = win
      ? (final ? (nextMapName ? `${mapName} tamamlandı! Sırada: ${nextMapName}` : 'Tüm haritalar tamamlandı!') : `${mapName} · Bölüm ${level} tamamlandı`)
      : `${mapName} · Bölüm ${level}`;
    this.el.restart.textContent = win ? (final ? (nextMapName ? 'SONRAKİ HARİTA' : 'BAŞTAN OYNA') : 'SONRAKİ BÖLÜM') : 'TEKRAR DENE';
    this.el.restart.dataset.action = win ? 'next' : 'retry';
    this.el.endCoins.textContent = coins;
    this.el.end.classList.remove('hidden');
  }
}
