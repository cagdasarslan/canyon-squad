import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { ASSETS, GAME } from './config.js';
import { crackTexture } from './textures.js';
import { smoothstep } from './noise.js';
import { sfx } from './audio.js';

// Scorpion.glb iskeletsiz tek parça bir model; kuyruk vuruşu, kıskaç şaklatma ve bacak yürüyüşü
// her karede köşe noktaları (vertex) deforme edilerek yapılır. Koordinatlar modelin kendi uzayında:
// baş +X, kuyruk −X'te yukarı kıvrık, Y yukarı.
const TAIL_PIVOT = { x: -3.2, y: 4.2 };
const CLAW_X = 5;

// İskeletli canavar (Yeti, Taş Dev, İblis, Ejderha): kendi animasyonlarıyla yürür, saldırır, ölür.
class RiggedBody {
  constructor(boss, gltf, def, glowColor) {
    this.def = def;
    this.model = SkeletonUtils.clone(gltf.scene);
    // boyunu tanımdaki yüksekliğe ölçekle; model oyuncuya (+Z) bakar
    this.model.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(this.model).getSize(new THREE.Vector3());
    const sc = (def.height * boss.sizeMul) / Math.max(0.01, size.y);
    this.model.scale.setScalar(sc);
    this.height = def.height * boss.sizeMul;
    this.mats = [];
    this.model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.frustumCulled = false;
      o.material = o.material.clone();
      o.material.emissive = new THREE.Color(glowColor);
      o.material.emissiveIntensity = 0;
      this.mats.push(o.material);
    });
    boss.root.add(this.model);

    this.mixer = new THREE.AnimationMixer(this.model);
    const find = (name) => gltf.animations.find((a) => a.name === name || a.name.endsWith('|' + name));
    this.actions = {};
    for (const [k, name] of Object.entries(def.clips)) {
      const clip = find(name);
      if (!clip) continue;
      const a = this.mixer.clipAction(clip);
      if (k === 'attack' || k === 'death' || k === 'roar') {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = k === 'death';
      }
      this.actions[k] = a;
    }
    this.current = null;
    this.play('idle');
    this.mixer.addEventListener('finished', (e) => {
      if (e.action === this.actions.attack || e.action === this.actions.roar) this.play(this.base ?? 'idle', 0.2);
    });
  }

  play(name, fade = 0.25) {
    const a = this.actions[name];
    if (!a || a === this.current) return;
    a.reset().setEffectiveWeight(1).play();
    if (this.current) this.current.crossFadeTo(a, fade, false);
    this.current = a;
  }

  // yürüme/bekleme gibi süregelen hareket
  setBase(name) {
    this.base = name;
    const busy = this.current === this.actions.attack || this.current === this.actions.roar || this.current === this.actions.death;
    if (!busy) this.play(name);
  }

  attack() {
    this.play('attack', 0.15);
  }

  roar() {
    this.play(this.actions.roar ? 'roar' : 'attack', 0.15);
  }

  die() {
    this.play('death', 0.2);
  }

  setGlow(v) {
    for (const m of this.mats) m.emissiveIntensity = v;
  }

  update(dt, t) {
    this.mixer.update(dt);
    // ejderha havada süzülür
    if (this.def.fly) this.model.position.y = this.def.fly + Math.sin(t * 2.2) * 0.6;
  }
}

export class Boss {
  // opts.def: bosses.js tanımı (yoksa akrep); gltf: o canavarın modeli
  constructor(scene, fx, coins, z, gltf, opts = {}) {
    this.scene = scene;
    this.fx = fx;
    this.coins = coins;
    this.maxHp = opts.hp ?? GAME.bossHp;
    this.speed = opts.speed ?? 0.9;
    this.hp = this.maxHp;
    this.damage = 1; // Lazer Gücü yükseltmesi
    this.state = 'dormant';
    this.t = 0;
    this.flash = 0;
    this.strikeT = 0;
    this.attackT = 0;
    this.cfg = ASSETS.scorpion;
    this.def = opts.def ?? { id: 'scorpion', strike: [0.9, 0.25, 1.4] };
    this.strikeColor = new THREE.Color(...this.def.strike);
    this.sizeMul = opts.scale ?? 1;

    this.root = new THREE.Group();
    this.root.position.set(0, 0, z);
    scene.add(this.root);
    this.sand = new THREE.Color(0.86, 0.6, 0.36);

    if (this.def.id !== 'scorpion') {
      this.rig = new RiggedBody(this, gltf, this.def, opts.crack ?? 0xff6a1a);
      this.depth = this.rig.height * 1.1 + (this.def.fly ?? 0);
      this.root.visible = false;
      this.root.position.y = -this.depth;
      return;
    }

    const cracks = crackTexture();
    // zırh rengi ve çatlak parıltısı haritanın temasından gelir
    this.gold = new THREE.MeshStandardMaterial({
      color: opts.color ?? 0xe0a83c, metalness: 1, roughness: 0.24, envMapIntensity: 1.6,
      emissive: opts.crack ?? 0xff6a1a, emissiveMap: cracks, emissiveIntensity: 0, flatShading: true,
    });
    this.ether = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.5, 3.6), toneMapped: false });

    // Model: başı oyuncuya (+Z) baksın
    this.model = new THREE.Group();
    this.model.rotation.y = -Math.PI / 2;
    this.model.scale.setScalar(this.cfg.scale * this.sizeMul);
    this.root.add(this.model);

    this.parts = [];
    let tip = null;
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
      geo.deleteAttribute('normal');
      const base = Float32Array.from(geo.attributes.position.array);
      // çatlak dokusu için kutu izdüşümlü UV
      const uv = new Float32Array((base.length / 3) * 2);
      for (let i = 0; i < base.length / 3; i++) {
        uv[i * 2] = base[i * 3] * 0.09 + base[i * 3 + 2] * 0.06;
        uv[i * 2 + 1] = base[i * 3 + 1] * 0.11 + base[i * 3 + 2] * 0.04;
        if (!tip || base[i * 3] < tip.x) tip = { x: base[i * 3], y: base[i * 3 + 1], z: base[i * 3 + 2] };
      }
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.attributes.position.setUsage(THREE.DynamicDrawUsage);
      // gövde altın zırh, işaret (vurgu malzemesi) eterik parıltı
      const accent = o.material.name === this.cfg.accentMaterial;
      const mesh = new THREE.Mesh(geo, accent ? this.ether : this.gold);
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      this.model.add(mesh);
      this.parts.push({ mesh, base });
    });

    // İğne ucunda mor aura ve ışık
    this.tipBase = tip;
    this.tip = new THREE.Group();
    const aura = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 16, 12),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.2, 1.4), transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    );
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), this.ether);
    const light = new THREE.PointLight(0xc060ff, 10, 14, 2);
    this.tip.add(aura, core, light);
    this.aura = aura;
    this.model.add(this.tip);

    this.pose = { tail: 0, tailSide: 0, claw: [0, 0], snap: 0, walk: 0, walkAmp: 0.4, breath: 0 };
    this.v = { x: 0, y: 0, z: 0 };
    this.deform();

    // Giriş sahnesine kadar kumun altında saklı
    this.depth = 12 * this.cfg.scale * this.sizeMul;
    this.root.visible = false;
    this.root.position.y = -this.depth;
  }

  // ---------- Giriş sahnesi: sarsıntı → kumdan yükseliş → kükreme ----------
  startIntro() {
    if (this.state !== 'dormant') return;
    this.state = 'intro';
    this.introT = 0;
    this.roared = false;
    this.root.visible = true;
    this.root.position.y = -this.depth;
    this.fx.shake = Math.max(this.fx.shake, 0.4);
  }

  skipIntro() {
    if (this.state !== 'intro') return;
    this.root.position.y = 0;
    if (!this.roared) this.roar();
    this.endIntro();
  }

  roar() {
    this.roared = true;
    sfx.roar();
    this.rig?.roar();
    const p = this.root.position;
    this.fx.rings.emit(p.x, p.z + 4, new THREE.Color(1, 0.75, 0.35), 16, 0.9);
    this.fx.rings.emit(p.x, p.z + 4, new THREE.Color(0.9, 0.3, 1.3), 10, 0.6);
    this.fx.shake = 1.4;
    this.onIntroEvent?.('roar');
  }

  endIntro() {
    this.state = 'fight';
    this.onIntroEvent?.('done');
  }

  // Bossun çevresinde kum püskürmesi
  sandBurst(n, radius, power) {
    const p = this.root.position;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = radius * (0.4 + Math.random() * 0.6);
      const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r * 1.3;
      this.fx.smoke.emit(x, 0.3, z, Math.cos(a) * power, 2 + Math.random() * power * 1.5, Math.sin(a) * power,
        0.88, 0.64, 0.42, 2 + Math.random() * 2, 6 + Math.random() * 5, 1.4 + Math.random() * 1.2, 0.55, 2, 1.5);
      if (Math.random() < 0.35) this.fx.debris.emit(x, 0.4, z, this.sand, power * 1.6, 0.35, 2);
    }
  }

  updateIntro(dt) {
    const T = (this.introT += dt);
    const P = this.pose;
    const rise = THREE.MathUtils.clamp((T - 0.7) / 1.6, 0, 1);
    const k = 1 - Math.pow(1 - rise, 3);
    this.root.position.y = -this.depth * (1 - k);
    if (T < 2.3) {
      this.fx.shake = Math.max(this.fx.shake, 0.35 + rise * 0.5);
      if (Math.random() < dt * (T < 0.7 ? 18 : 40)) this.sandBurst(T < 0.7 ? 2 : 4, 7 + rise * 5, 3 + rise * 5);
    }
    if (T >= 2.15 && !this.roared) {
      this.roar();
      this.sandBurst(30, 12, 9);
    }
    if (T >= 3.9) this.endIntro();
    if (this.rig) {
      this.rig.setBase(T < 2.1 ? 'walk' : 'idle');
      this.rig.update(dt, this.t);
      return;
    }
    // yükselirken bacaklar debelenir, sonra kükreme pozu: kuyruk geride, kıskaçlar açık
    P.walk += dt * 9;
    P.walkAmp = T < 2.3 ? 1 : 0.3;
    const pose = THREE.MathUtils.smoothstep(T, 2.0, 2.4) * (1 - THREE.MathUtils.smoothstep(T, 3.3, 3.8));
    P.tail = pose * 0.38 + Math.sin(T * 9) * 0.04 * pose;
    P.claw[0] = P.claw[1] = -pose * 0.45;
    P.snap = pose > 0.5 ? Math.pow(Math.max(0, Math.sin(T * 14)), 4) : 0;
    P.breath = pose * 0.04 * Math.sin(T * 20);
    this.deform();
    this.aura.scale.setScalar(1 + Math.sin(T * 6) * 0.15 + pose * 0.6);
  }

  // Tek bir köşeyi mevcut poza göre deforme eder
  deformPoint(x, y, z) {
    const P = this.pose;
    // Kuyruk: pivot etrafında Z ekseninde bükülme (negatif açı = öne vuruş)
    if (x < -3 && y > 3.6) {
      const dx = x - TAIL_PIVOT.x, dy = y - TAIL_PIVOT.y;
      const w = Math.min(1, Math.hypot(dx, dy) / 7);
      const a = P.tail * w;
      const c = Math.cos(a), s = Math.sin(a);
      x = TAIL_PIVOT.x + dx * c - dy * s;
      y = TAIL_PIVOT.y + dx * s + dy * c;
      z += P.tailSide * w * 2;
    }
    // Kıskaçlar: omuz etrafında Y ekseninde salınım + parmak şaklatma
    if (x > CLAW_X) {
      const side = z >= 0 ? 1 : -1;
      const w = smoothstep(CLAW_X, CLAW_X + 3, x);
      const a = P.claw[side > 0 ? 1 : 0] * side * w;
      const dx = x - CLAW_X, dz = z - side * 2.2;
      const c = Math.cos(a), s = Math.sin(a);
      x = CLAW_X + dx * c + dz * s;
      z = side * 2.2 - dx * s + dz * c;
      z -= side * P.snap * smoothstep(10, 14.5, x) * 1.4;
    }
    // Bacaklar: alt uçlar sırayla ileri-geri ve yukarı hareket eder
    if (y < 2.4 && x > -4 && x < 5.5 && Math.abs(z) > 2.6) {
      const side = z > 0 ? 1 : 0;
      const leg = Math.floor((x + 4) / 2.4);
      const ph = P.walk + leg * 1.7 + side * Math.PI;
      const w = 1 - y / 2.4;
      x += Math.sin(ph) * 0.8 * w * P.walkAmp;
      y += Math.max(0, Math.cos(ph)) * 0.5 * w * P.walkAmp;
    }
    const v = this.v;
    v.x = x;
    v.y = y * (1 + P.breath);
    v.z = z;
    return v;
  }

  deform() {
    for (const { mesh, base } of this.parts) {
      const arr = mesh.geometry.attributes.position.array;
      for (let i = 0; i < base.length; i += 3) {
        const v = this.deformPoint(base[i], base[i + 1], base[i + 2]);
        arr[i] = v.x; arr[i + 1] = v.y; arr[i + 2] = v.z;
      }
      mesh.geometry.attributes.position.needsUpdate = true;
    }
    const tv = this.deformPoint(this.tipBase.x, this.tipBase.y, this.tipBase.z);
    this.tip.position.set(tv.x, tv.y, tv.z);
  }

  get alive() {
    return this.state !== 'dead';
  }

  // Model ölçeğine göre dünya uzunlukları
  get front() {
    return this.rig ? this.def.front * this.sizeMul : 14 * this.cfg.scale * this.sizeMul;
  }

  get halfWidth() {
    return this.rig ? (this.def.width * this.sizeMul) / 2 : 5;
  }

  hit(x, y, z, dmg = 1) {
    if (this.state !== 'fight') return false;
    const p = this.root.position;
    if (z < p.z + this.front * 0.75 && Math.abs(x - p.x) < this.halfWidth) {
      this.hp -= this.damage * dmg;
      this.flash = 1;
      sfx.bossHit();
      if (Math.random() < 0.35) this.fx.spark({ x, y: y + 0.6, z }, { r: 1, g: 0.7, b: 0.25 });
      if (this.hp <= 0) this.die();
      return true;
    }
    return false;
  }

  die() {
    this.state = 'dying';
    this.deathT = 0;
    sfx.bossDeath();
    this.fx.shake = 1.5;
    this.rig?.die();
  }

  update(dt, squad) {
    this.t += dt;
    const t = this.t;
    if (this.state === 'dead' || this.state === 'dormant') return;
    if (this.state === 'intro') {
      this.updateIntro(dt);
      return;
    }
    const P = this.pose;
    const fight = this.state === 'fight';

    if (this.rig) {
      this.updateRigged(dt, squad, fight);
      return;
    }

    P.walk = t * (fight ? 6 : 2.5);
    P.walkAmp = fight ? 1 : 0.35;
    P.breath = Math.sin(t * 2) * 0.012;
    P.claw[0] = Math.sin(t * 1.4) * 0.16;
    P.claw[1] = Math.sin(t * 1.4 + 1.3) * 0.16;
    P.snap = Math.pow(Math.max(0, Math.sin(t * 2.4)), 6);

    // Kuyruk: salınım + periyodik vuruş
    let strike = 0;
    if (fight) {
      this.strikeT += dt;
      const s = this.strikeT % 3.4;
      if (s > 2.2 && s < 2.8) strike = -((s - 2.2) / 0.6); // geri çekil
      else if (s >= 2.8 && s < 3.0) strike = -1 + ((s - 2.8) / 0.2) * 2.4; // vur
      else if (s >= 3.0) strike = 1.4 * (1 - (s - 3.0) / 0.4);
      if (s >= 2.95 && !this.struck) {
        this.struck = true;
        this.tailImpact(squad);
      }
      if (s < 2.9) this.struck = false;
    }
    P.tail = Math.sin(t * 2) * 0.05 - strike * 0.42;
    P.tailSide = Math.sin(t * 1.2) * 0.12;
    this.deform();
    this.aura.scale.setScalar(1 + Math.sin(t * 6) * 0.15);

    // Çatlak parıltısı ve isabet flaşı
    this.flash = Math.max(0, this.flash - dt * 12);
    const dmg = 1 - this.hp / this.maxHp;
    this.gold.emissiveIntensity = Math.pow(dmg, 1.3) * 3.2 * (0.85 + Math.sin(t * 9) * 0.15) + this.flash * 0.6;

    if (fight && squad.count) {
      // yavaşça ilerle, yakındaysa kıskaçla saldır
      const front = squad.center.z - squad.radius();
      const reach = this.root.position.z + this.front;
      if (reach < front - 1) this.root.position.z += this.speed * dt;
      else {
        this.attackT -= dt;
        if (this.attackT <= 0) {
          this.attackT = 0.45;
          const u = this.nearest(squad);
          if (u) squad.kill(u, squad.ratio);
        }
      }
      this.root.position.x += (squad.center.x * 0.4 - this.root.position.x) * dt * 0.5;
    }

    if (this.state === 'dying') this.updateDeath(dt);
  }

  // İskeletli canavar: yürü, menzile girince bekle ve vur; periyodik alan saldırısı
  updateRigged(dt, squad, fight) {
    const rig = this.rig;
    if (fight) {
      this.strikeT += dt;
      const s = this.strikeT % 3.4;
      if (s >= 2.3 && !this.swung) {
        this.swung = true;
        rig.attack();
      }
      if (s >= 2.75 && !this.struck) {
        this.struck = true;
        this.tailImpact(squad);
      }
      if (s < 2.2) this.swung = this.struck = false;
    }
    this.flash = Math.max(0, this.flash - dt * 12);
    const dmg = 1 - this.hp / this.maxHp;
    // hasar aldıkça hafifçe kızarır, her isabette kısa bir parlama
    rig.setGlow(this.state === 'dying' ? 0.8 + this.deathT * 2 : Math.pow(dmg, 1.5) * 0.35 * (0.8 + Math.sin(this.t * 9) * 0.2) + this.flash * 0.25);

    let moving = false;
    if (fight && squad.count) {
      const front = squad.center.z - squad.radius();
      const reach = this.root.position.z + this.front;
      if (reach < front - 1) {
        this.root.position.z += this.speed * dt;
        moving = true;
      } else {
        this.attackT -= dt;
        if (this.attackT <= 0) {
          this.attackT = 0.45;
          const u = this.nearest(squad);
          if (u) squad.kill(u, squad.ratio);
        }
      }
      this.root.position.x += (squad.center.x * 0.4 - this.root.position.x) * dt * 0.5;
    }
    if (this.state !== 'dying') rig.setBase(moving ? 'walk' : 'idle');
    rig.update(dt, this.t);
    if (this.state === 'dying') this.updateDeath(dt);
  }

  nearest(squad) {
    let best = null, bd = Infinity;
    for (const u of squad.units) {
      const d = (u.pos.x - this.root.position.x) ** 2 + (u.pos.z - this.root.position.z) ** 2;
      if (d < bd) { bd = d; best = u; }
    }
    return best;
  }

  tailImpact(squad) {
    const u = this.nearest(squad);
    if (!u) return;
    const at = u.pos.clone();
    const col = this.strikeColor;
    sfx.strike();
    this.fx.explosion(at.clone().setY(0.8), col, 1.6, col);
    this.fx.rings.emit(at.x, at.z, col, 5, 0.6);
    this.fx.shake = Math.min(1.5, this.fx.shake + 0.5);
    const victims = squad.units.filter((v) => v.pos.distanceToSquared(at) < 2.2).slice(0, 4);
    const per = squad.ratio; // her görünen asker birden çok gerçek askeri temsil eder
    for (const v of victims) squad.kill(v, per);
  }

  updateDeath(dt) {
    this.deathT += dt;
    const p = this.root.position;
    this.root.position.x += (Math.random() - 0.5) * 0.3;
    if (this.gold) this.gold.emissiveIntensity = 3 + this.deathT * 6;
    if (Math.random() < dt * 22) {
      const at = new THREE.Vector3(p.x + (Math.random() - 0.5) * 8, 1 + Math.random() * 6, p.z + (Math.random() - 0.5) * 12);
      this.fx.explosion(at, new THREE.Color(1, 0.6, 0.2), 1.3, new THREE.Color(0.9, 0.65, 0.2));
    }
    if (this.deathT > (this.rig ? 1.8 : 1.3)) {
      this.state = 'dead';
      this.root.visible = false;
      const c = new THREE.Vector3(p.x, 3, p.z);
      this.fx.explosion(c, new THREE.Color(1, 0.7, 0.3), 4, new THREE.Color(0.95, 0.7, 0.25));
      for (let i = 0; i < 90; i++) this.fx.debris.emit(c.x, c.y, c.z, new THREE.Color(0.95, 0.68, 0.22), 22, 0.6, 2.6);
      this.fx.shake = 2;
      this.coins.burst(c, 420, 1.6);
      this.onDead?.();
    }
  }
}
