// Tüm ses efektleri ve müzik Web Audio ile gerçek zamanlı sentezlenir — harici ses dosyası yok.
// Gerçek ses dosyasına geçmek istersen ilgili metodu bir AudioBuffer çalacak şekilde değiştirmen yeterli.

class Sfx {
  constructor() {
    this.ctx = null;
    this.sfxOn = true;
    this.musicOn = true;
    this.last = {};
    this.coinStreak = 0;
    this.coinT = 0;
  }

  // Tarayıcılar sesi ancak bir kullanıcı etkileşiminden sonra açar
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = 0.8;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      this.master.connect(comp).connect(c.destination);
      this.sfxBus = c.createGain();
      this.sfxBus.gain.value = this.sfxOn ? 0.9 : 0;
      this.sfxBus.connect(this.master);
      this.musicBus = c.createGain();
      this.musicBus.gain.value = this.musicOn ? 0.32 : 0;
      this.musicBus.connect(this.master);
      const len = c.sampleRate;
      this.noise = c.createBuffer(1, len, c.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setSfx(on) {
    this.sfxOn = on;
    if (this.sfxBus) this.sfxBus.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05);
  }

  setMusic(on) {
    this.musicOn = on;
    if (this.musicBus) this.musicBus.gain.setTargetAtTime(on ? 0.32 : 0, this.ctx.currentTime, 0.05);
  }

  block() {
    if (!this.throttle('block', 10)) return;
    this.tone('triangle', 1600, 2400, 0.12, 0.12);
    this.tone('sine', 3200, 3200, 0.2, 0.05, this.sfxBus, 0.03);
  }

  purchase() {
    if (!this.ctx) return;
    [1047, 1319, 1568, 2093].forEach((f, i) => this.tone('square', f, f, 0.09, 0.07, this.sfxBus, i * 0.05));
    this.noiseBurst(0.3, 0.08, 'bandpass', 7000, 10000, 0.05, 2);
  }

  deny() {
    if (!this.ctx) return;
    this.tone('square', 220, 160, 0.18, 0.08);
  }

  click() {
    if (!this.ctx) return;
    this.tone('triangle', 880, 1320, 0.07, 0.12);
  }

  // Boss girişinde yer sarsıntısı
  rumble(dur = 2.2) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 160;
    f.Q.value = 3;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t);
    src.stop(t + dur + 0.1);
    this.tone('sine', 45, 32, dur, 0.5);
  }

  // Aynı sesin saniyede en fazla `perSec` kez çalmasını sağlar (yüzlerce lazer aynı anda ateşlenir)
  throttle(key, perSec) {
    if (!this.ctx) return false;
    const now = this.ctx.currentTime;
    if (now - (this.last[key] ?? -1) < 1 / perSec) return false;
    this.last[key] = now;
    return true;
  }

  env(gainNode, t, attack, peak, decay) {
    gainNode.gain.setValueAtTime(0.0001, t);
    gainNode.gain.exponentialRampToValueAtTime(peak, t + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  tone(type, f0, f1, dur, vol, bus = this.sfxBus, when = 0) {
    const c = this.ctx;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    this.env(g, t, 0.005, vol, dur);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noiseBurst(dur, vol, filterType, f0, f1, when = 0, q = 0.8) {
    const c = this.ctx;
    const t = c.currentTime + when;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter();
    f.type = filterType;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    this.env(g, t, 0.004, vol, dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  // ---------- Efektler ----------
  laser() {
    if (!this.throttle('laser', 16)) return;
    const f = 1400 + Math.random() * 500;
    this.tone('square', f, f * 0.28, 0.09, 0.035);
    this.tone('sine', f * 0.5, f * 0.2, 0.08, 0.04);
  }

  hit() {
    if (!this.throttle('hit', 20)) return;
    this.noiseBurst(0.05, 0.08, 'highpass', 3000, 1500);
  }

  explosion(scale = 1) {
    if (!this.throttle('boom', 14)) return;
    const v = Math.min(1, 0.35 + scale * 0.25);
    this.noiseBurst(0.35 + scale * 0.15, 0.5 * v, 'lowpass', 2400, 120);
    this.tone('sine', 140, 38, 0.3 + scale * 0.1, 0.6 * v);
  }

  gate(positive) {
    if (!this.ctx) return;
    const notes = positive ? [523, 659, 784, 1047] : [392, 330, 262, 196];
    notes.forEach((f, i) => this.tone(positive ? 'triangle' : 'sawtooth', f, f, 0.16, positive ? 0.18 : 0.08, this.sfxBus, i * 0.055));
    if (positive) this.noiseBurst(0.4, 0.06, 'bandpass', 6000, 9000, 0, 2);
  }

  coin() {
    if (!this.throttle('coin', 22)) return;
    const now = this.ctx.currentTime;
    this.coinStreak = now - this.coinT < 0.25 ? Math.min(this.coinStreak + 1, 14) : 0;
    this.coinT = now;
    const f = 988 * Math.pow(2, this.coinStreak / 24);
    this.tone('square', f, f, 0.06, 0.05);
    this.tone('square', f * 1.335, f * 1.335, 0.12, 0.05, this.sfxBus, 0.055);
  }

  bossHit() {
    if (!this.throttle('bossHit', 12)) return;
    const f = 900 + Math.random() * 300;
    this.tone('triangle', f, f * 0.7, 0.07, 0.05);
  }

  roar() {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(70, t);
    o.frequency.linearRampToValueAtTime(110, t + 0.4);
    o.frequency.linearRampToValueAtTime(48, t + 1.6);
    const lfo = c.createOscillator();
    lfo.frequency.value = 28;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 18;
    lfo.connect(lfoGain).connect(o.frequency);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 700;
    const g = c.createGain();
    this.env(g, t, 0.15, 0.5, 1.5);
    o.connect(f).connect(g).connect(this.sfxBus);
    o.start(t); lfo.start(t);
    o.stop(t + 1.8); lfo.stop(t + 1.8);
    this.noiseBurst(1.4, 0.25, 'bandpass', 500, 200, 0, 1.5);
  }

  strike() {
    if (!this.ctx) return;
    this.noiseBurst(0.25, 0.3, 'bandpass', 600, 3000, 0, 1.2);
    this.tone('sine', 90, 30, 0.45, 0.8, this.sfxBus, 0.18);
    this.noiseBurst(0.4, 0.4, 'lowpass', 1500, 100, 0.18);
  }

  bossDeath() {
    if (!this.ctx) return;
    for (let i = 0; i < 6; i++) {
      this.noiseBurst(0.6, 0.45, 'lowpass', 3000, 90, i * 0.12);
      this.tone('sine', 120 - i * 10, 30, 0.6, 0.6, this.sfxBus, i * 0.12);
    }
  }

  win() {
    if (!this.ctx) return;
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => {
      this.tone('square', f, f, 0.2, 0.08, this.sfxBus, i * 0.11);
      this.tone('triangle', f / 2, f / 2, 0.22, 0.12, this.sfxBus, i * 0.11);
    });
  }

  lose() {
    if (!this.ctx) return;
    [392, 370, 349, 262].forEach((f, i) => this.tone('sawtooth', f, f * 0.97, 0.32, 0.09, this.sfxBus, i * 0.26));
  }

  // ---------- Müzik: basit döngüsel ritim + bas (lookahead zamanlayıcı) ----------
  startMusic(intense = false) {
    if (!this.ctx) return;
    this.intense = intense;
    if (this.musicTimer) return;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.musicTimer = setInterval(() => this.schedule(), 25);
  }

  setIntense(v) {
    this.intense = v;
  }

  stopMusic() {
    clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  schedule() {
    const c = this.ctx;
    const bpm = this.intense ? 138 : 124;
    const stepDur = 60 / bpm / 4; // 16'lık
    const bass = [55, 55, 65.4, 55, 73.4, 55, 65.4, 49];
    while (this.nextTime < c.currentTime + 0.12) {
      const s = this.step % 16;
      const when = this.nextTime - c.currentTime;
      if (s % 4 === 0) this.kick(when);
      if (s === 4 || s === 12) this.snare(when);
      if (s % 2 === 1 || this.intense) this.hat(when, s % 4 === 2 ? 0.05 : 0.025);
      if (s % 2 === 0) {
        const f = bass[(this.step >> 1) % bass.length];
        this.tone('sawtooth', f, f, stepDur * 1.6, 0.16, this.musicBus, when);
      }
      this.nextTime += stepDur;
      this.step++;
    }
  }

  kick(when) {
    this.tone('sine', 150, 42, 0.22, 0.9, this.musicBus, when);
  }

  snare(when) {
    const c = this.ctx;
    const t = c.currentTime + when;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 1200;
    const g = c.createGain();
    this.env(g, t, 0.002, 0.35, 0.14);
    src.connect(f).connect(g).connect(this.musicBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.2);
  }

  hat(when, vol) {
    const c = this.ctx;
    const t = c.currentTime + when;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = c.createGain();
    this.env(g, t, 0.001, vol, 0.04);
    src.connect(f).connect(g).connect(this.musicBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.06);
  }
}

export const sfx = new Sfx();
