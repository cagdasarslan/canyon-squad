import * as THREE from 'three';
import { GAME } from './config.js';
import { sfx } from './audio.js';

const GOLDEN = 2.399963;
const SHADOW_CASTERS = 40; // gölgeyi sadece öndeki askerler düşürür (performans)
const easeOutBack = (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);

// Tim sahnede z≈0'da sabit koşar; harita (track) ona doğru akar. center.z, timin harita üzerindeki ilerlemesidir.
//
// total: gerçek asker sayısı (sınırsız; kapı x2 → iki katı).
// units: ekranda çizilen askerler (modelin maxVisible sınırına kadar). Her görünen asker ortalama
// `ratio = total / units.length` askeri temsil eder: lazer hasarı ve boss kayıpları bu oranla ölçeklenir.
export class Squad {
  constructor(scene, factory, fx, lasers) {
    this.scene = scene;
    this.factory = factory;
    this.fx = fx;
    this.lasers = lasers;
    this.units = [];
    this.total = 0;
    this.visibleMul = 1; // düşük grafikte ekrandaki asker sınırı azalır
    this.center = new THREE.Vector3(0, 0, 0);
    this.targetX = 0;
    this.running = true;
    this.firing = false;
    this.fireInterval = GAME.fireInterval;
    this.armor = 0; // ölümcül vuruşu engelleme şansı (Zırh yükseltmesi)
    this.color = new THREE.Color();
    this.muzzleColor = new THREE.Color();
    this.blockColor = new THREE.Color(0.6, 1.6, 2.4);
    this.lossColor = new THREE.Color(1, 0.3, 0.3);
    this.tmp = new THREE.Vector3();
    this.spacing = GAME.spacing;
    this.setSkin('cyan');
  }

  get count() {
    return this.total;
  }

  // Bir görünen askerin temsil ettiği gerçek asker sayısı
  get ratio() {
    return this.units.length ? Math.max(1, this.total / this.units.length) : 1;
  }

  get visibleCap() {
    return Math.max(20, Math.round(this.factory.maxVisible(this.skin) * this.visibleMul));
  }

  setVisible(v) {
    for (const u of this.units) u.c.obj.visible = v;
  }

  // Görünüm değiştir (kostüm ya da karakter). Modelin önceden factory.ensure() ile yüklenmiş olması gerekir.
  setSkin(id) {
    const def = this.factory.def(id);
    this.skin = id;
    this.muzzleY = this.factory.muzzleY(id);
    this.spacing = this.factory.spacing(id) ?? GAME.spacing;
    this.color.setRGB(...def.glow).multiplyScalar(0.5);
    this.muzzleColor.setRGB(...def.glow);
    this.blockColor.setRGB(...def.glow).multiplyScalar(0.6);
    this.lasers.setColor(def.glow);
    if (!this.units.length) return this.syncVisible();
    for (const u of this.units) this.factory.release(u.c);
    this.units = [];
    this.syncVisible();
    for (const u of this.units) {
      u.spawn = 0;
      this.fx.sparkle(u.pos, this.color);
    }
  }

  setVisibleMul(m) {
    this.visibleMul = m;
    this.syncVisible();
  }

  radius() {
    return this.spacing * Math.sqrt(Math.max(1, this.units.length)) + 0.4;
  }

  slot(i, out) {
    const r = this.spacing * Math.sqrt(i);
    const a = i * GOLDEN;
    return out.set(Math.cos(a) * r, 0, Math.sin(a) * r * 1.12);
  }

  // Gerçek asker sayısını ayarla (kapılar); ekrandakiler buna göre eklenir/çıkarılır
  setCount(n) {
    this.total = Math.max(0, Math.round(n));
    this.syncVisible();
  }

  // Ekrandaki asker sayısını min(total, sınır) yapar
  syncVisible() {
    const want = Math.min(this.total, this.visibleCap);
    if (want > this.units.length) this.addUnits(want - this.units.length);
    else if (want < this.units.length) this.removeUnits(this.units.length - want);
    this.units.forEach((u, i) => u.c.setShadow(i < SHADOW_CASTERS));
  }

  // Yeni askerler mevcut askerlerin pozisyonundan "kopyalanarak" çıkar
  addUnits(n) {
    const old = this.units.length;
    for (let k = 0; k < n; k++) {
      const c = this.factory.acquire(this.skin);
      c.setClip(this.running ? 'run' : 'idle');
      const off = old ? this.units[k % old].off.clone() : new THREE.Vector3();
      // pos: harita (track) uzayında konum — çarpışma/ateş için; obj: sahnede sabit duran görsel
      const pos = new THREE.Vector3(this.center.x + off.x, 0, this.center.z + off.z);
      c.obj.position.set(pos.x, 0, off.z);
      c.obj.rotation.set(0, 0, 0);
      this.scene.add(c.obj);
      const u = { c, off, pos, spawn: old ? 0 : 1, fireCd: Math.random() * this.fireInterval };
      this.units.push(u);
      if (old) this.fx.sparkle(pos, this.color);
    }
  }

  removeUnits(n) {
    for (let k = 0; k < n && this.units.length; k++) {
      const u = this.units.pop();
      this.fx.sparkle(u.pos, this.lossColor);
      this.factory.release(u.c);
    }
  }

  explodeUnit(u, scale = 0.8) {
    this.tmp.copy(u.pos);
    this.tmp.y = 1;
    this.fx.explosion(this.tmp, this.color, scale, new THREE.Color(0.4, 0.75, 1));
  }

  // Düşman/boss vuruşu: `amount` kadar gerçek asker ölür. Zırh şansı tutarsa kalkanla engellenir.
  // Yedek asker varsa (total > görünen) görünen asker yerinde kalır, yerini yedek doldurur.
  kill(u, amount = 1) {
    const i = this.units.indexOf(u);
    if (i < 0) return false;
    if (this.armor > 0 && Math.random() < this.armor) {
      this.fx.rings.emit(u.pos.x, u.pos.z, this.blockColor, 1.3, 0.35);
      this.fx.sparkle(u.pos, this.color);
      sfx.block();
      this.onBlock?.();
      return false;
    }
    this.total = Math.max(0, this.total - Math.max(1, Math.round(amount)));
    this.explodeUnit(u);
    if (this.units.length > Math.min(this.total, this.visibleCap)) {
      this.units.splice(i, 1);
      this.factory.release(u.c);
      this.syncVisible();
    } else {
      u.spawn = 0.4; // yedek asker yerine geçti: küçük bir "yeniden doğma"
    }
    return true;
  }

  setRunning(running) {
    if (this.running === running) return;
    this.running = running;
    for (const u of this.units) u.c.setClip(running ? 'run' : 'idle');
  }

  update(dt) {
    const k = 1 - Math.exp(-dt * 10);
    const r = this.radius();
    const lim = Math.max(0, GAME.pathHalf - 0.5 - r * 0.85);
    this.targetX = THREE.MathUtils.clamp(this.targetX, -lim, lim);
    this.center.x += (this.targetX - this.center.x) * k;

    const follow = 1 - Math.exp(-dt * 7);
    const slot = this.tmp;
    const dmg = this.ratio; // her lazer temsil ettiği asker sayısı kadar vurur
    const dustRate = dt * 2.2 * Math.min(1, 40 / Math.max(1, this.units.length));
    for (let i = 0; i < this.units.length; i++) {
      const u = this.units[i];
      const o = u.c.obj;
      this.slot(i, slot);
      u.off.x += (slot.x - u.off.x) * follow;
      u.off.z += (slot.z - u.off.z) * follow;
      u.pos.set(this.center.x + u.off.x, 0, this.center.z + u.off.z);
      o.position.set(u.pos.x, 0, u.off.z);
      if (u.spawn < 1) {
        u.spawn = Math.min(1, u.spawn + dt * 3.2);
        o.scale.setScalar(Math.max(0.01, easeOutBack(u.spawn)));
      }

      if (this.firing) {
        u.fireCd -= dt;
        if (u.fireCd <= 0) {
          u.fireCd += this.fireInterval * (0.85 + Math.random() * 0.3);
          const mx = u.pos.x + 0.2, my = this.muzzleY, mz = u.pos.z - 0.9;
          this.lasers.fire(mx, my, mz, (Math.random() - 0.5) * 0.6, dmg);
          sfx.laser();
          if (Math.random() < 0.5) this.fx.muzzle(mx, my, mz, this.muzzleColor);
        }
      }
      if (this.running && Math.random() < dustRate) this.fx.dust(u.pos.x, u.pos.z);
    }
  }
}
