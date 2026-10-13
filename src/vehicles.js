import * as THREE from 'three';

// Karaktere özel destek aracı (Ultimate Space Kit): timle birlikte hareket eder ve ağır ateş açar.
//  rover: timin önünde yerde gider, çarptığı düşmanları ezer
//  ship:  timin üstünde süzülür
// Araç sahnede (z≈0 civarı) çizilir; ateş ve çarpışma harita (track) uzayında hesaplanır.
export class SupportVehicle {
  constructor(scene, gltf, def, glow) {
    this.def = def;
    this.obj = new THREE.Group();
    const model = gltf.scene.clone(true);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    // en uzun yatay kenarı tanımdaki uzunluğa ölçekle, tabanı yere otur, ortala
    const s = def.length / Math.max(size.x, size.z);
    model.position.set(-center.x * s, -box.min.y * s, -center.z * s);
    model.scale.setScalar(s);
    // modeller +Z'ye bakar; araç ileri (-Z) baksın
    const turn = new THREE.Group();
    turn.rotation.y = Math.PI;
    turn.add(model);
    this.obj.add(turn);
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.frustumCulled = false;
      }
    });
    this.height = size.y * s;
    this.fireCd = 0;
    this.side = 1;
    this.glow = glow;
    this.local = new THREE.Vector3();
    this.t = 0;
  }

  // squad: tim, lasers: mermiler, enemies: çarpışma için, dt: zaman
  update(dt, squad, lasers, enemies, fx, firing) {
    this.t += dt;
    const r = squad.radius();
    const ship = this.def.kind === 'ship';
    // hedef konum: rover timin önünde, gemi timin ortasının üstünde
    const offZ = ship ? -r * 0.2 : -r - this.def.length * 0.6 - 0.6;
    const y = ship ? 6.5 + Math.sin(this.t * 1.8) * 0.4 : Math.abs(Math.sin(this.t * 9)) * 0.06;
    const k = 1 - Math.exp(-dt * 6);
    this.obj.position.x += (squad.center.x - this.obj.position.x) * k;
    this.obj.position.z += (offZ - this.obj.position.z) * k;
    this.obj.position.y = y;
    this.obj.rotation.z = ship ? Math.sin(this.t * 1.3) * 0.06 : 0;
    this.local.set(this.obj.position.x, 0, squad.center.z + this.obj.position.z);

    if (firing) {
      this.fireCd -= dt;
      if (this.fireCd <= 0) {
        this.fireCd = ship ? 0.18 : 0.32;
        this.side = -this.side;
        // her mermi aracın gücü × timin temsil oranı kadar vurur (kalabalık tim → güçlü araç)
        const dmg = this.def.power * Math.max(1, squad.ratio * 0.5);
        const x = this.local.x + this.side * (ship ? 1.2 : 0.7);
        const yy = ship ? y - 0.4 : this.height * 0.7;
        lasers.fire(x, yy, this.local.z - this.def.length * 0.5, (Math.random() - 0.5) * 0.4, dmg);
        fx.muzzle(x, yy, this.local.z - this.def.length * 0.5, this.glow);
      }
    }

    // rover: önündeki düşmanları ezer
    if (!ship && enemies) {
      for (let i = enemies.active.length - 1; i >= 0; i--) {
        const p = enemies.active[i].c.obj.position;
        if (Math.abs(p.z - this.local.z) < this.def.length * 0.5 + 0.4 && Math.abs(p.x - this.local.x) < 1.3) {
          enemies.kill(i, true);
          fx.shake = Math.min(1, fx.shake + 0.05);
        }
      }
    }
  }

  dispose() {
    this.obj.removeFromParent();
  }
}
