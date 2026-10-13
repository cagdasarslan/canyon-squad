import * as THREE from 'three';
import { GAME, TEAMS } from './config.js';

// Neon mavi lazer mermileri — iki InstancedMesh (çekirdek + parıltı) aynı matrisleri paylaşır
export class Lasers {
  constructor(scene, max = 1200) {
    this.max = max;
    this.n = 0;
    this.px = new Float32Array(max);
    this.py = new Float32Array(max);
    this.pz = new Float32Array(max);
    this.vx = new Float32Array(max);
    this.dmg = new Float32Array(max);
    this.dist = new Float32Array(max);
    const glow = TEAMS.blue.glow;

    this.core = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.07, 0.07, 1.3),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(glow[0] * 0.6 + 0.6, glow[1] * 0.6 + 0.6, glow[2] * 0.6 + 0.6), toneMapped: false }),
      max,
    );
    this.halo = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.24, 0.24, 1.7),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(glow[0] * 0.35, glow[1] * 0.35, glow[2] * 0.35),
        transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      }),
      max,
    );
    this.core.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.halo.instanceMatrix = this.core.instanceMatrix;
    for (const m of [this.core, this.halo]) {
      m.count = 0;
      m.frustumCulled = false;
      scene.add(m);
    }
    this.m = new THREE.Matrix4();
  }

  setColor(glow) {
    this.core.material.color.setRGB(glow[0] * 0.6 + 0.6, glow[1] * 0.6 + 0.6, glow[2] * 0.6 + 0.6);
    this.halo.material.color.setRGB(glow[0] * 0.35, glow[1] * 0.35, glow[2] * 0.35);
  }

  fire(x, y, z, vx = 0, dmg = 1) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.px[i] = x; this.py[i] = y; this.pz[i] = z;
    this.vx[i] = vx;
    this.dmg[i] = dmg;
    this.dist[i] = 0;
  }

  remove(i) {
    const j = --this.n;
    this.px[i] = this.px[j]; this.py[i] = this.py[j]; this.pz[i] = this.pz[j];
    this.vx[i] = this.vx[j]; this.dist[i] = this.dist[j]; this.dmg[i] = this.dmg[j];
  }

  // hitFn(x,y,z,hasar) true dönerse mermi yok olur
  update(dt, hitFn) {
    const step = GAME.laserSpeed * dt;
    let i = 0;
    while (i < this.n) {
      this.pz[i] -= step;
      this.px[i] += this.vx[i] * dt;
      this.dist[i] += step;
      if (this.dist[i] > GAME.laserRange || hitFn(this.px[i], this.py[i], this.pz[i], this.dmg[i])) {
        this.remove(i);
        continue;
      }
      i++;
    }
    for (let k = 0; k < this.n; k++) {
      this.m.makeTranslation(this.px[k], this.py[k], this.pz[k]);
      this.core.setMatrixAt(k, this.m);
    }
    this.core.count = this.halo.count = this.n;
    this.core.instanceMatrix.needsUpdate = true;
  }
}
