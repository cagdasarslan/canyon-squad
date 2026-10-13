import * as THREE from 'three';
import { softDotTexture } from './textures.js';
import { sfx } from './audio.js';

// CPU tarafında güncellenen, tek draw-call'lık parçacık sistemi
class ParticleSystem {
  constructor(scene, max, additive, map) {
    this.max = max;
    this.n = 0;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max);
    this.s1 = new Float32Array(max);
    this.a0 = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);

    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.aPos);
    geo.setAttribute('color', this.aCol);
    geo.setAttribute('size', this.aSize);
    geo.setAttribute('alpha', this.aAlpha);
    geo.setDrawRange(0, 0);
    this.geo = geo;

    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { uMap: { value: map }, uScale: { value: 400 } },
      vertexShader: /* glsl */ `
        attribute float size;
        attribute float alpha;
        attribute vec3 color;
        uniform float uScale;
        varying float vA;
        varying vec3 vC;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = size * uScale / -mv.z;
          vA = alpha;
          vC = color;
        }`,
      fragmentShader: additive
        ? /* glsl */ `
          uniform sampler2D uMap;
          varying float vA;
          varying vec3 vC;
          void main() {
            float a = texture2D(uMap, gl_PointCoord).a * vA;
            gl_FragColor = vec4(vC * a, a);
          }`
        : /* glsl */ `
          uniform sampler2D uMap;
          varying float vA;
          varying vec3 vC;
          void main() {
            float a = texture2D(uMap, gl_PointCoord).a * vA;
            gl_FragColor = vec4(vC, a);
            #include <colorspace_fragment>
          }`,
    });
    if (additive) this.mat.toneMapped = false;
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 10 : 9;
    scene.add(this.points);
  }

  emit(x, y, z, vx, vy, vz, r, g, b, s0, s1, life, a0 = 1, grav = 0, drag = 0) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
    this.s0[i] = s0; this.s1[i] = s1;
    this.life[i] = this.maxLife[i] = life;
    this.a0[i] = a0;
    this.grav[i] = grav;
    this.drag[i] = drag;
    this.size[i] = s0;
    this.alpha[i] = a0;
  }

  copy(from, to) {
    for (let k = 0; k < 3; k++) {
      this.pos[to * 3 + k] = this.pos[from * 3 + k];
      this.vel[to * 3 + k] = this.vel[from * 3 + k];
      this.col[to * 3 + k] = this.col[from * 3 + k];
    }
    this.life[to] = this.life[from]; this.maxLife[to] = this.maxLife[from];
    this.s0[to] = this.s0[from]; this.s1[to] = this.s1[from];
    this.a0[to] = this.a0[from]; this.grav[to] = this.grav[from]; this.drag[to] = this.drag[from];
  }

  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.copy(--this.n, i);
        continue;
      }
      const t = 1 - this.life[i] / this.maxLife[i];
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3 + 1] -= this.grav[i] * dt;
      this.vel[i * 3] *= d; this.vel[i * 3 + 1] *= d; this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] = Math.max(0.05, this.pos[i * 3 + 1] + this.vel[i * 3 + 1] * dt);
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * (1 - (1 - t) * (1 - t));
      this.alpha[i] = this.a0[i] * Math.min(1, t * 12) * (1 - t);
      i++;
    }
    this.geo.setDrawRange(0, this.n);
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = this.aAlpha.needsUpdate = true;
  }
}

// Fizikli enkaz parçaları
class Debris {
  constructor(scene, max = 700) {
    this.max = max;
    this.items = [];
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.5 });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color());
    this.mesh.count = 0;
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
  }

  emit(x, y, z, color, power, size, life = 1.6) {
    if (this.items.length >= this.max) this.items.shift();
    this.items.push({
      p: new THREE.Vector3(x, y, z),
      v: new THREE.Vector3((Math.random() - 0.5) * power, Math.random() * power * 1.1 + 2, (Math.random() - 0.5) * power),
      r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0),
      w: new THREE.Vector3((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, 0),
      s: size * (0.5 + Math.random()),
      life, max: life,
      c: color.clone().multiplyScalar(0.7 + Math.random() * 0.5),
    });
  }

  update(dt) {
    const d = this.dummy;
    let n = 0;
    for (let k = this.items.length - 1; k >= 0; k--) {
      const it = this.items[k];
      it.life -= dt;
      if (it.life <= 0) { this.items.splice(k, 1); continue; }
      it.v.y -= 26 * dt;
      it.p.addScaledVector(it.v, dt);
      const half = it.s * 0.5;
      if (it.p.y < half) {
        it.p.y = half;
        it.v.y *= -0.35;
        it.v.x *= 0.6; it.v.z *= 0.6;
        it.w.multiplyScalar(0.6);
      }
      it.r.x += it.w.x * dt;
      it.r.y += it.w.y * dt;
    }
    for (const it of this.items) {
      const fade = Math.min(1, it.life / (it.max * 0.3));
      d.position.copy(it.p);
      d.rotation.copy(it.r);
      d.scale.setScalar(it.s * fade);
      d.updateMatrix();
      this.mesh.setMatrixAt(n, d.matrix);
      this.mesh.setColorAt(n, it.c);
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// Zeminde genişleyen şok dalgası halkaları
class Rings {
  constructor(scene, max = 16) {
    this.list = [];
    const geo = new THREE.RingGeometry(0.85, 1, 48);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < max; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
      }));
      m.visible = false;
      m.renderOrder = 8;
      scene.add(m);
      this.list.push({ m, t: 1, max: 1, r: 1 });
    }
  }

  emit(x, z, color, radius, life = 0.5) {
    const it = this.list.find((r) => r.t >= r.max) ?? this.list[0];
    it.t = 0; it.max = life; it.r = radius;
    it.m.material.color.copy(color);
    it.m.position.set(x, 0.08, z);
    it.m.visible = true;
  }

  update(dt) {
    for (const it of this.list) {
      if (it.t >= it.max) { it.m.visible = false; continue; }
      it.t += dt;
      const k = Math.min(1, it.t / it.max);
      it.m.scale.setScalar(0.2 + it.r * (1 - (1 - k) * (1 - k)));
      it.m.material.opacity = 1 - k;
    }
  }
}

export class Effects {
  constructor(scene) {
    const dot = softDotTexture();
    this.glow = new ParticleSystem(scene, 4000, true, dot);
    this.smoke = new ParticleSystem(scene, 2500, false, dot);
    this.debris = new Debris(scene);
    this.rings = new Rings(scene);
    this.shake = 0;
    this.tmpC = new THREE.Color();
  }

  setPointScale(s) {
    this.glow.mat.uniforms.uScale.value = s;
    this.smoke.mat.uniforms.uScale.value = s;
  }

  explosion(p, color, scale = 1, debrisColor = color) {
    sfx.explosion(scale);
    const g = this.glow;
    g.emit(p.x, p.y, p.z, 0, 0, 0, color.r * 3, color.g * 3, color.b * 3, 2.5 * scale, 7 * scale, 0.28, 1);
    g.emit(p.x, p.y, p.z, 0, 0, 0, 3, 2.6, 2.2, 1.2 * scale, 3.5 * scale, 0.18, 1);
    for (let i = 0; i < 22 * scale; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2, sp = (6 + Math.random() * 12) * scale;
      g.emit(p.x, p.y, p.z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + 2, Math.sin(a) * Math.cos(e) * sp,
        color.r * 2.5 + 0.6, color.g * 2.5 + 0.5, color.b * 2.5 + 0.4, 0.35 * scale, 0.05, 0.35 + Math.random() * 0.4, 1, 14, 2.5);
    }
    for (let i = 0; i < 8 * scale; i++) {
      this.smoke.emit(p.x + (Math.random() - 0.5), p.y * 0.5, p.z + (Math.random() - 0.5),
        (Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3,
        0.85, 0.66, 0.48, 1.2 * scale, 3.5 * scale, 0.9 + Math.random() * 0.6, 0.45, -1, 2);
    }
    for (let i = 0; i < 9 * scale; i++) {
      this.debris.emit(p.x, p.y + 0.5, p.z, i % 3 ? debrisColor : this.tmpC.setRGB(0.12, 0.12, 0.14), 9 * scale, 0.16 * scale);
    }
    this.rings.emit(p.x, p.z, color, 2.6 * scale, 0.45);
    this.shake = Math.min(1.2, this.shake + 0.06 * scale);
  }

  spark(p, color) {
    for (let i = 0; i < 4; i++) {
      this.glow.emit(p.x, p.y, p.z, (Math.random() - 0.5) * 8, Math.random() * 5, Math.random() * 6,
        color.r * 2, color.g * 2, color.b * 2, 0.3, 0.05, 0.22, 1, 10);
    }
    this.glow.emit(p.x, p.y, p.z, 0, 0, 0, color.r * 2, color.g * 2, color.b * 2, 0.9, 1.6, 0.1, 1);
  }

  muzzle(x, y, z, color) {
    this.glow.emit(x, y, z, 0, 0, -4, color.r, color.g, color.b, 0.55, 0.15, 0.07, 1);
  }

  dust(x, z) {
    this.smoke.emit(x + (Math.random() - 0.5) * 0.3, 0.15, z + 0.2, (Math.random() - 0.5) * 1.2, 0.6 + Math.random() * 0.8, 2 + Math.random() * 2,
      0.92, 0.74, 0.55, 0.35, 1.4, 0.55 + Math.random() * 0.3, 0.32, 0, 2.5);
  }

  sparkle(p, color) {
    for (let i = 0; i < 6; i++) {
      this.glow.emit(p.x + (Math.random() - 0.5) * 0.6, p.y + Math.random() * 1.8, p.z + (Math.random() - 0.5) * 0.6,
        0, 2 + Math.random() * 2, 0, color.r * 2, color.g * 2, color.b * 2, 0.5, 0.05, 0.5 + Math.random() * 0.3, 1);
    }
  }

  update(dt) {
    this.glow.update(dt);
    this.smoke.update(dt);
    this.debris.update(dt);
    this.rings.update(dt);
    this.shake = Math.max(0, this.shake - dt * 2.5);
  }
}
