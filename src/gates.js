import * as THREE from 'three';
import { labelTexture } from './textures.js';

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

// Titreşen holografik enerji perdesi
const frag = /* glsl */ `
  uniform float uTime;
  uniform float uFlash;
  uniform float uFade;
  uniform vec3 uColor;
  varying vec2 vUv;
  float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    vec2 uv = vUv;
    float bx = min(uv.x, 1.0 - uv.x);
    float by = min(uv.y, 1.0 - uv.y);
    float border = (1.0 - smoothstep(0.0, 0.05, bx)) + (1.0 - smoothstep(0.0, 0.035, by)) * 0.7;
    vec2 g = uv * vec2(16.0, 11.0);
    g.x += mod(floor(g.y), 2.0) * 0.5;
    vec2 gf = abs(fract(g) - 0.5);
    float grid = smoothstep(0.43, 0.5, max(gf.x, gf.y)) * 0.28;
    float scan = pow(max(0.0, 0.5 + 0.5 * sin(uv.y * 70.0 - uTime * 9.0)), 10.0) * 0.22;
    float sweep = pow(max(0.0, 1.0 - abs(fract(uTime * 0.45) * 1.4 - 0.2 - uv.y) * 6.0), 2.0) * 0.5;
    float arc = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float y = 0.5 + 0.38 * sin(uv.x * (5.0 + fi * 3.0) + uTime * (3.0 + fi) + fi * 2.1) * sin(uTime * 1.3 + fi * 1.7);
      y += (h(vec2(floor(uv.x * 46.0), floor(uTime * 24.0) + fi * 7.0)) - 0.5) * 0.035;
      arc += (1.0 - smoothstep(0.0, 0.012, abs(uv.y - y))) * step(0.4, h(vec2(fi, floor(uTime * 8.0))));
    }
    float noise = (h(uv * 300.0 + floor(uTime * 30.0)) - 0.5) * 0.08;
    vec3 col = uColor * (0.5 + grid * 1.2 + scan * 1.5 + sweep * 1.5 + border * 2.0 + arc * 2.0 + noise);
    col += vec3(1.0) * (arc * 0.5 + uFlash * 1.5);
    float a = (0.16 + grid * 0.8 + scan + sweep * 0.5 + border + arc * 0.8 + uFlash) * uFade;
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  }`;

class Gate {
  constructor(scene, def, z) {
    this.def = def;
    const positive = def.op === 'x' || def.op === '+';
    const color = positive ? new THREE.Color(0.15, 0.7, 1.25) : new THREE.Color(1.3, 0.18, 0.2);
    const H = 5.2;
    this.group = new THREE.Group();
    this.group.position.set(def.x, 0, z);

    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      uniforms: {
        uTime: { value: Math.random() * 10 },
        uFlash: { value: 0 },
        uFade: { value: 1 },
        uColor: { value: color },
      },
    });
    const field = new THREE.Mesh(new THREE.PlaneGeometry(def.w - 0.4, H), this.mat);
    field.position.y = H / 2;
    field.renderOrder = 6;
    this.group.add(field);

    const postMat = new THREE.MeshStandardMaterial({ color: 0xdfe6ee, metalness: 0.9, roughness: 0.25 });
    const glowMat = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(2.2), toneMapped: false });
    this.glowMat = glowMat;
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, H + 0.4, 14), postMat);
      post.position.set((s * def.w) / 2 - s * 0.2, (H + 0.4) / 2, 0);
      post.castShadow = true;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.1, H, 0.42), glowMat);
      strip.position.copy(post.position);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), glowMat);
      cap.position.set(post.position.x, H + 0.55, 0);
      this.group.add(post, strip, cap);
    }

    const text = `${{ x: 'x', '+': '+', '-': '−', '/': '÷' }[def.op]}${def.v}`;
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(Math.min(4.6, def.w * 0.7), Math.min(2.3, def.w * 0.35)),
      new THREE.MeshBasicMaterial({
        map: labelTexture(text, positive ? 'rgba(0,70,150,0.9)' : 'rgba(140,0,10,0.9)'), transparent: true, depthWrite: false, toneMapped: false,
        color: new THREE.Color(1.25, 1.25, 1.25),
      }),
    );
    label.position.set(0, 3.1, 0.06);
    label.renderOrder = 7;
    this.label = label;
    this.group.add(label);
    scene.add(this.group);
  }

  contains(x) {
    return Math.abs(x - this.def.x) <= this.def.w / 2;
  }

  apply(n) {
    const { op, v } = this.def;
    if (op === 'x') return n * v;
    if (op === '+') return n + v;
    if (op === '-') return n - v;
    if (op === '/') return Math.ceil(n / v);
    return n;
  }
}

export class GateManager {
  constructor(scene, rows) {
    this.rows = rows.map((r) => ({ z: r.z, used: false, fade: 1, gates: r.gates.map((d) => new Gate(scene, d, r.z)) }));
  }

  // Squad merkezi kapıdan geçtiğinde (op uygulanmış) yeni sayı döner
  check(squad, onPass) {
    for (const row of this.rows) {
      if (row.used || squad.center.z > row.z) continue;
      row.used = true;
      const x = squad.center.x;
      const gate = row.gates.find((g) => g.contains(x)) ??
        row.gates.reduce((a, b) => (Math.abs(a.def.x - x) < Math.abs(b.def.x - x) ? a : b));
      gate.mat.uniforms.uFlash.value = 1;
      row.chosen = gate;
      onPass(gate, gate.apply(squad.count));
    }
  }

  update(dt) {
    for (const row of this.rows) {
      for (const g of row.gates) {
        const u = g.mat.uniforms;
        u.uTime.value += dt;
        u.uFlash.value = Math.max(0, u.uFlash.value - dt * 2.5);
        if (row.used) {
          row.fade = Math.max(0, row.fade - dt * 1.6);
          u.uFade.value = row.fade;
          g.label.material.opacity = row.fade;
          if (g === row.chosen) g.group.scale.y = 1 + (1 - row.fade) * 0.4;
          if (row.fade <= 0) g.group.visible = false;
        }
      }
    }
  }
}
