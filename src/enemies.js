import * as THREE from 'three';
import { GAME } from './config.js';
import { MINIONS, SPECIALS } from './bosses.js';

const defOf = (kind) => MINIONS.find((m) => m.id === kind) ?? SPECIALS.find((m) => m.id === kind) ?? MINIONS[0];

// Robotların attığı kırmızı mermiler: tim üzerine gelir, değdiği askeri (gücü kadar) öldürür
class EnemyShots {
  constructor(scene, fx, max = 120) {
    this.fx = fx;
    this.items = [];
    this.max = max;
    this.mesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.22, 10, 8),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.6, 0.3), toneMapped: false }),
      max,
    );
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);
    this.m = new THREE.Matrix4();
    this.color = new THREE.Color(1.4, 0.3, 0.2);
  }

  fire(from, to, power) {
    if (this.items.length >= this.max) return;
    const v = to.clone().sub(from).setY(0).normalize().multiplyScalar(16);
    this.items.push({ p: from.clone(), v, power, life: 3 });
  }

  update(dt, squad) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const s = this.items[i];
      s.p.addScaledVector(s.v, dt);
      s.life -= dt;
      let hit = null;
      if (Math.abs(s.p.z - squad.center.z) < squad.radius() + 1) {
        for (const u of squad.units) {
          const dx = u.pos.x - s.p.x, dz = u.pos.z - s.p.z;
          if (dx * dx + dz * dz < 0.35) { hit = u; break; }
        }
      }
      if (hit) {
        squad.kill(hit, s.power);
        this.fx.spark(s.p, this.color);
      }
      if (hit || s.life <= 0 || s.p.z > squad.center.z + 4) this.items.splice(i, 1);
    }
    this.items.forEach((s, i) => {
      this.m.makeTranslation(s.p.x, s.p.y, s.p.z);
      this.mesh.setMatrixAt(i, this.m);
    });
    this.mesh.count = this.items.length;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
import { sfx } from './audio.js';

const GOLDEN = 2.399963;

export class EnemyManager {
  constructor(scene, factory, fx, coins, waves) {
    this.scene = scene;
    this.factory = factory;
    this.fx = fx;
    this.coins = coins;
    this.waves = waves.map((w) => ({ ...w, spawned: false }));
    this.active = [];
    this.shots = new EnemyShots(scene, fx);
    this.damage = 1; // Lazer Gücü yükseltmesi
    this.colors = {};
    this.sparkColor = new THREE.Color(1, 0.55, 0.3);
    this.tmp = new THREE.Vector3();
  }

  // türün patlama/enkaz rengi
  colorOf(kind) {
    if (!this.colors[kind]) {
      const m = defOf(kind);
      this.colors[kind] = { glow: new THREE.Color(...m.color).multiplyScalar(0.6), debris: new THREE.Color(...m.color) };
    }
    return this.colors[kind];
  }

  spawnWave(w) {
    this.spawnGroup(w.kind ?? 'red', w.count, w.z, w);
    // özel düşmanlar ana grubun biraz gerisinde/yanında
    for (const ex of w.extras ?? []) this.spawnGroup(ex.kind, ex.count, w.z - 6 - Math.random() * 6, ex);
  }

  spawnGroup(kind, count, z0, w) {
    const def = defOf(kind);
    const spacing = 0.85 * def.size;
    for (let i = 0; i < count; i++) {
      const c = this.factory.acquire(kind);
      const r = spacing * Math.sqrt(i);
      const a = i * GOLDEN;
      const cx = THREE.MathUtils.clamp((Math.random() - 0.5) * 6, -3, 3);
      c.obj.position.set(
        THREE.MathUtils.clamp(cx + Math.cos(a) * r, -GAME.pathHalf + 0.8, GAME.pathHalf - 0.8),
        0,
        z0 + Math.sin(a) * r,
      );
      c.obj.rotation.set(0, Math.PI, 0);
      c.obj.position.y = def.fly ?? 0;
      c.setClip('idle');
      this.scene.add(c.obj);
      this.active.push({
        c, kind, hp: w.hp ?? GAME.enemyHp, state: 'idle', delay: Math.random() * 0.4,
        speed: w.speed ?? GAME.enemySpeed, power: w.power ?? 1, size: def.size, fly: def.fly ?? 0,
        phase: Math.random() * 6, shooter: !!def.shooter,
        keep: 15 + Math.random() * 5, shootTime: 3.5 + Math.random() * 2, shootCd: 0.4 + Math.random(),
      });
    }
  }

  // Mermi isabet kontrolü
  hit(x, y, z, dmg = 1) {
    for (let i = 0; i < this.active.length; i++) {
      const e = this.active[i];
      const p = e.c.obj.position;
      if (Math.abs(p.z - z) < 0.75 * e.size && Math.abs(p.x - x) < 0.55 * e.size) {
        e.hp -= this.damage * dmg;
        sfx.hit();
        this.tmp.set(x, y, z + 0.3);
        this.fx.spark(this.tmp, this.sparkColor);
        if (e.hp <= 0) this.kill(i, true);
        return true;
      }
    }
    return false;
  }

  kill(i, coin) {
    const e = this.active[i];
    this.active.splice(i, 1);
    this.onKill?.();
    this.tmp.copy(e.c.obj.position);
    this.tmp.y = 1 + e.fly;
    const col = this.colorOf(e.kind);
    this.fx.explosion(this.tmp, col.glow, e.size, col.debris);
    if (coin) this.coins.burst(this.tmp, 1, 0.5);
    this.factory.release(e.c);
  }

  // Boss ölünce kalan düşmanlar altına dönüşür
  shatterAll() {
    while (this.active.length) {
      const p = this.active[0].c.obj.position.clone();
      this.kill(0, false);
      this.coins.burst(p.setY(1), 6, 0.8);
    }
  }

  update(dt, squad) {
    this.t = (this.t ?? 0) + dt;
    for (const w of this.waves) {
      if (!w.spawned && squad.center.z - w.z < 80) {
        w.spawned = true;
        this.spawnWave(w);
      }
    }
    const cz = squad.center.z;
    this.shots.update(dt, squad);
    for (let i = this.active.length - 1; i >= 0; i--) {
      const e = this.active[i];
      const o = e.c.obj;
      const dz = o.position.z - cz;
      if (e.state === 'idle' && dz > -GAME.enemyAggroRange) {
        e.delay -= dt;
        if (e.delay <= 0) {
          e.state = 'run';
          e.c.setClip('run');
        }
      }
      // Robot: menzile girince geri geri giderek ateş eder, sonra hücuma geçer
      if (e.state === 'run' && e.shooter && dz > -e.keep && squad.count) {
        e.state = 'shoot';
        e.c.setClip('attack');
      }
      if (e.state === 'shoot') {
        o.position.z = cz - e.keep;
        o.position.x += THREE.MathUtils.clamp(squad.center.x - o.position.x, -1, 1) * dt * 0.8;
        e.shootCd -= dt;
        if (e.shootCd <= 0) {
          e.shootCd = 1.3 + Math.random() * 0.6;
          const target = squad.units[Math.floor(Math.random() * Math.min(10, squad.units.length))];
          if (target) this.shots.fire(this.tmp.set(o.position.x, 1.3, o.position.z + 0.8), target.pos, e.power);
        }
        e.shootTime -= dt;
        if (e.shootTime <= 0 || !squad.running) {
          e.state = 'run';
          e.shooter = false;
          e.c.setClip('run');
        }
      }
      if (e.state === 'run') {
        o.position.z += e.speed * dt;
        o.position.x += THREE.MathUtils.clamp(squad.center.x - o.position.x, -1, 1) * dt * 1.2;
      }
      // uçanlar havada dalgalanır
      if (e.fly) o.position.y = e.fly + Math.sin(this.t * 4 + e.phase) * 0.25;

      // Temas: düşman yok olur, gücü kadar asker götürür
      let touched = null;
      const reach = 0.6 * e.size * e.size;
      if (Math.abs(dz) < squad.radius() + 1) {
        for (const u of squad.units) {
          const p = u.pos;
          const dx = p.x - o.position.x, dd = p.z - o.position.z;
          if (dx * dx + dd * dd < reach) { touched = u; break; }
        }
      }
      if (touched) {
        squad.kill(touched, e.power);
        this.kill(i, false);
        continue;
      }
      if (dz > 8) {
        this.active.splice(i, 1);
        this.factory.release(e.c);
      }
    }
  }
}
