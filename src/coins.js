import * as THREE from 'three';

// Parabolik yay çizip kumda seken, sonra squad'a mıknatıslanan altın paralar
export class Coins {
  constructor(scene, fx, max = 900) {
    this.fx = fx;
    this.max = max;
    this.items = [];
    const geo = new THREE.CylinderGeometry(0.34, 0.34, 0.07, 24);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffc23a, metalness: 1, roughness: 0.18, emissive: 0x5a3000, envMapIntensity: 1.6,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.dummy = new THREE.Object3D();
    this.gold = new THREE.Color(1, 0.75, 0.25);
  }

  burst(p, count, power = 1) {
    for (let i = 0; i < count && this.items.length < this.max; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (2 + Math.random() * 6) * power;
      this.items.push({
        p: new THREE.Vector3(p.x, p.y, p.z),
        v: new THREE.Vector3(Math.cos(a) * sp, (8 + Math.random() * 9) * Math.sqrt(power), Math.sin(a) * sp + 2 * power),
        rx: Math.random() * 6, ry: Math.random() * 6,
        wx: (Math.random() - 0.5) * 22, wy: (Math.random() - 0.5) * 14,
        state: 0,
        t: 0,
        rest: 0.9 + Math.random() * 1.1,
      });
    }
  }

  update(dt, target, onCollect) {
    for (let k = this.items.length - 1; k >= 0; k--) {
      const c = this.items[k];
      c.t += dt;
      if (c.state === 0) {
        c.v.y -= 30 * dt;
        c.p.addScaledVector(c.v, dt);
        if (c.p.y < 0.07) {
          c.p.y = 0.07;
          if (Math.abs(c.v.y) > 2) {
            c.v.y *= -0.42;
            c.v.x *= 0.7; c.v.z *= 0.7;
            c.wx *= 0.55; c.wy *= 0.55;
          } else {
            c.v.set(0, 0, 0);
          }
        }
        if (c.p.y <= 0.08 && c.v.lengthSq() < 0.1) c.rx += (Math.PI / 2 - c.rx) * Math.min(1, dt * 10);
        else { c.rx += c.wx * dt; c.ry += c.wy * dt; }
        if (c.t > c.rest) { c.state = 1; c.v.set(0, 6, 0); }
      } else {
        // squad'a doğru çekil
        const to = new THREE.Vector3(target.x, 1.2, target.z).sub(c.p);
        const d = to.length();
        if (d < 0.9) {
          this.fx.glow.emit(c.p.x, c.p.y, c.p.z, 0, 2, 0, 3, 2.2, 0.8, 0.9, 0.1, 0.25, 1);
          this.items.splice(k, 1);
          onCollect();
          continue;
        }
        const speed = 8 + c.t * 22;
        c.v.lerp(to.multiplyScalar(speed / d), Math.min(1, dt * 6));
        c.p.addScaledVector(c.v, dt);
        c.ry += 14 * dt;
      }
    }
    const dm = this.dummy;
    for (let i = 0; i < this.items.length; i++) {
      const c = this.items[i];
      dm.position.copy(c.p);
      dm.rotation.set(c.rx, c.ry, 0, 'YXZ');
      dm.updateMatrix();
      this.mesh.setMatrixAt(i, dm.matrix);
    }
    this.mesh.count = this.items.length;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
