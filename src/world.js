import * as THREE from 'three';
import { fbm, noise3, smoothstep } from './noise.js';
import { sandTexture, rockTexture, softDotTexture, crackTexture } from './textures.js';

const CEIL = 28; // mağara tavanı yüksekliği

export class World {
  // scene: sabit dünya (gökyüzü), track: oyuncuya doğru akan harita (zemin, kayalıklar, kemerler, toz)
  // theme: maps.js içindeki harita teması (renkler, mağara mı, kristal/lav/sarkıt vb.)
  constructor(scene, track, { pathHalf, zStart, zEnd, arches, bossZ, sunDir, theme }) {
    this.scene = scene;
    this.track = track;
    this.pathHalf = pathHalf;
    this.zStart = zStart;
    this.zEnd = zEnd;
    this.sunDir = sunDir.clone().normalize();
    this.theme = theme;
    this.strata = theme.strata.map((c) => new THREE.Color(...c));
    this.time = { value: 0 };

    this.rockMap = rockTexture();
    this.rockMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: this.rockMap,
      bumpMap: this.rockMap,
      bumpScale: 1.4,
      roughness: theme.id === 'ice' ? 0.35 : 0.93,
      metalness: theme.id === 'ice' ? 0.15 : 0,
      side: THREE.DoubleSide,
    });

    if (theme.cave) {
      scene.background = new THREE.Color(theme.background);
      this.buildCeiling();
      this.buildStalactites();
    } else {
      this.buildSky();
    }
    this.buildGround();
    this.buildCliff(-1);
    this.buildCliff(1);
    for (const z of arches) this.buildArch(z, 1);
    this.buildArch(bossZ - 4, 1.35);
    this.buildRocks();
    if (theme.crystals) for (const c of theme.crystals) this.buildCrystals(c);
    if (theme.lava) this.buildLava();
    this.buildDust();
  }

  // Tabaka paleti: yüksekliğe göre bant rengi
  strataColor(y, n, out) {
    const S = this.strata;
    const band = y / 3.1 + (n - 0.5) * 2.2;
    const i = Math.floor(band);
    const f = band - i;
    const a = S[((i % S.length) + S.length) % S.length];
    const b = S[(((i + 1) % S.length) + S.length) % S.length];
    return out.copy(a).lerp(b, smoothstep(0.82, 1.0, f));
  }

  buildSky() {
    const k = this.theme.sky;
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uSun: { value: this.sunDir },
        uZen: { value: new THREE.Color(...k.zen) },
        uHor: { value: new THREE.Color(...k.hor) },
        uLow: { value: new THREE.Color(...k.low) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSun, uZen, uHor, uLow;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 c = mix(uHor, uZen, smoothstep(0.0, 0.6, h));
          c = mix(uLow, c, smoothstep(-0.25, 0.02, h));
          float s = max(dot(d, uSun), 0.0);
          c += vec3(1.0, 0.72, 0.38) * pow(s, 6.0) * 0.55;
          c += vec3(1.0, 0.92, 0.75) * pow(s, 600.0) * 8.0;
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
    this.sky.renderOrder = -1;
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);
  }

  buildGround() {
    const g = this.theme.ground;
    const W = 70;
    const L = this.zStart - this.zEnd;
    const geo = new THREE.PlaneGeometry(W, L, 70, Math.floor(L / 2));
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, (this.zStart + this.zEnd) / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const ph = this.pathHalf;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const ax = Math.abs(x);
      const edge = Math.max(0, ax - ph + 0.5);
      const dune = (fbm(x * 0.08, z * 0.08, 3.3, 3) - 0.5) * (0.3 + edge * 0.5);
      let y = Math.pow(edge, 1.5) * 0.45 + dune * smoothstep(ph - 2, ph + 1, ax);
      if (this.theme.lava) {
        // yolun iki yanında lav kanalı
        const ch = smoothstep(ph + 0.2, ph + 0.9, ax) * (1 - smoothstep(ph + 2.6, ph + 3.4, ax));
        y = y * (1 - ch) - 0.45 * ch;
      }
      pos.setY(i, y);
      // kayalıkların dibinde ortam kapanması (AO)
      const ao = 1 - smoothstep(ph - 3, ph + 3, ax) * 0.35;
      const tint = 0.92 + fbm(x * 0.05, z * 0.05, 9, 2) * 0.16;
      c.setRGB(ao * tint, ao * tint * 0.97, ao * tint * 0.93);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const map = sandTexture(g.base, g.ripple);
    map.repeat.set(W / 7, L / 7);
    const mat = new THREE.MeshStandardMaterial({
      map,
      bumpMap: map,
      bumpScale: 1.2,
      vertexColors: true,
      roughness: g.roughness,
      metalness: g.metalness,
    });
    if (g.cracks) {
      // lav mağarası: zeminde parlayan çatlaklar
      const cracks = crackTexture();
      cracks.repeat.set(W / 12, L / 12);
      mat.emissive = new THREE.Color(g.cracks);
      mat.emissiveMap = cracks;
      mat.emissiveIntensity = 0.9;
    }
    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    this.track.add(ground);
  }

  buildCliff(side) {
    const cave = this.theme.cave;
    const H = cave ? CEIL + 6 : 58;
    const L = this.zStart - this.zEnd;
    const segZ = Math.floor(L / 1.25);
    const segY = cave ? 34 : 52;
    const verts = (segZ + 1) * (segY + 1);
    const positions = new Float32Array(verts * 3);
    const colors = new Float32Array(verts * 3);
    const uvs = new Float32Array(verts * 2);
    const col = new THREE.Color();
    let k = 0;
    for (let j = 0; j <= segY; j++) {
      const y = Math.pow(j / segY, 1.25) * H;
      for (let i = 0; i <= segZ; i++) {
        const z = this.zStart - (i / segZ) * L;
        const n = fbm(z * 0.045, y * 0.05, side * 7.1, 4);
        const n2 = fbm(z * 0.22, y * 0.22, side * 3.7 + 11, 3);
        // tabaka çıkıntıları (ledge)
        const band = y / 3.1 + (n - 0.5) * 2.2;
        const frac = band - Math.floor(band);
        const ledge = smoothstep(0.7, 0.95, frac) - smoothstep(0.95, 1.0, frac);
        const bandOff = (noise3(Math.floor(band) * 1.7, z * 0.03, side) - 0.5) * 1.6;
        // kanyon: yukarı doğru açılır; mağara: ortada şişip tavana doğru kapanır
        const shape = cave ? Math.sin(Math.min(1, y / CEIL) * Math.PI) * 4.5 + Math.max(0, y - CEIL) * 1.5 : y * 0.16;
        const out = this.pathHalf + 1.4 + shape + (n - 0.5) * (cave ? 6 : 10) + (n2 - 0.5) * 1.5 - ledge * 0.7 + bandOff
          - smoothstep(4, 0, y) * 0.6;
        positions[k * 3] = side * Math.max(this.pathHalf + 0.6, out);
        positions[k * 3 + 1] = y;
        positions[k * 3 + 2] = z;

        this.strataColor(y, n, col);
        const crevice = 0.72 + 0.4 * n2;
        const ao = 0.55 + 0.45 * smoothstep(0, 6, y);
        const lip = 1 + ledge * 0.12;
        col.multiplyScalar(crevice * ao * lip * (cave ? 1 - smoothstep(CEIL * 0.5, CEIL, y) * 0.45 : 1));
        colors[k * 3] = col.r;
        colors[k * 3 + 1] = col.g;
        colors[k * 3 + 2] = col.b;
        uvs[k * 2] = z / 9;
        uvs[k * 2 + 1] = y / 9;
        k++;
      }
    }
    const idx = [];
    for (let j = 0; j < segY; j++) {
      for (let i = 0; i < segZ; i++) {
        const a = j * (segZ + 1) + i;
        const b = a + 1;
        const c = a + segZ + 1;
        const d = c + 1;
        if (side < 0) idx.push(a, c, b, b, c, d);
        else idx.push(a, b, c, b, d, c);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, this.rockMat);
    mesh.receiveShadow = true;
    this.track.add(mesh);
  }

  // Mağara tavanı: aşağı sarkan düzensiz kaya yüzeyi
  buildCeiling() {
    const L = this.zStart - this.zEnd;
    const geo = new THREE.PlaneGeometry(70, L, 60, Math.floor(L / 2.5));
    geo.rotateX(Math.PI / 2);
    geo.translate(0, CEIL, (this.zStart + this.zEnd) / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const base = new THREE.Color(...this.theme.ceiling);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const n = fbm(x * 0.07, z * 0.07, 21, 4);
      pos.setY(i, CEIL - n * 5 + Math.abs(x) * 0.08);
      c.copy(base).multiplyScalar(0.6 + n * 0.8);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    this.track.add(new THREE.Mesh(geo, this.rockMat));
  }

  // Tavandan sarkıtlar, kenarlarda dikitler
  buildStalactites() {
    const st = this.theme.stalactites;
    const geo = new THREE.ConeGeometry(0.6, 1, 7, 3);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const f = 0.8 + noise3(p.getX(i) * 3, p.getY(i) * 3, p.getZ(i) * 3) * 0.4;
      p.setX(i, p.getX(i) * f);
      p.setZ(i, p.getZ(i) * f);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial(st.ice
      ? { color: st.color, roughness: 0.08, metalness: 0.1, emissive: 0x1a4a7a, emissiveIntensity: 0.6, transparent: true, opacity: 0.88, flatShading: true }
      : { color: st.color, roughness: 0.9, map: this.rockMap, flatShading: true });
    const L = this.zStart - this.zEnd;
    const count = 260;
    const down = new THREE.InstancedMesh(geo, mat, count);
    const up = new THREE.InstancedMesh(geo, mat, 140);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
    for (let i = 0; i < count; i++) {
      const len = 2 + Math.pow(Math.random(), 2) * 5;
      const w = 0.5 + Math.random() * 0.9;
      const x = (Math.random() - 0.5) * 30;
      const z = this.zStart - Math.random() * L;
      q.copy(flip);
      m.compose(new THREE.Vector3(x, CEIL - 1 - len / 2 + Math.abs(x) * 0.08, z), q, new THREE.Vector3(w, len, w));
      down.setMatrixAt(i, m);
    }
    for (let i = 0; i < 140; i++) {
      const side = i % 2 ? 1 : -1;
      const len = 1 + Math.random() * 4;
      const w = 0.6 + Math.random() * 0.8;
      const x = side * (this.pathHalf + 1 + Math.random() * 4);
      const z = this.zStart - Math.random() * L;
      q.identity();
      m.compose(new THREE.Vector3(x, len / 2 + 0.2, z), q, new THREE.Vector3(w, len, w));
      up.setMatrixAt(i, m);
    }
    up.castShadow = true;
    up.receiveShadow = true;
    this.track.add(down, up);
  }

  // Parlayan kristal kümeleri (zemin kenarı ve duvarlar)
  buildCrystals({ color, emissive, intensity, count }) {
    const geo = new THREE.OctahedronGeometry(0.5, 0);
    geo.scale(0.6, 1.8, 0.6);
    const mat = new THREE.MeshStandardMaterial({
      color, emissive, emissiveIntensity: intensity, roughness: 0.15, metalness: 0.2, flatShading: true,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const L = this.zStart - this.zEnd;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    for (let i = 0; i < count; i++) {
      const side = Math.random() < 0.5 ? 1 : -1;
      const onWall = Math.random() < 0.35;
      const s = 0.9 + Math.pow(Math.random(), 2) * 3.2;
      const y = onWall ? 2 + Math.random() * 10 : s * 0.5;
      const x = side * (this.pathHalf + (onWall ? 2.6 + y * 0.25 : 0.9 + Math.random() * 3));
      const z = this.zStart - Math.random() * L;
      e.set((Math.random() - 0.5) * 0.8, Math.random() * 3, side * (onWall ? 0.9 : 0.25) + (Math.random() - 0.5) * 0.5);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s));
      mesh.setMatrixAt(i, m);
    }
    mesh.castShadow = true;
    this.track.add(mesh);
  }

  // Yolun iki yanında akan lav
  buildLava() {
    const L = this.zStart - this.zEnd;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: this.time },
      vertexShader: /* glsl */ `
        varying vec3 vW;
        void main() {
          vW = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vW;
        float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y);
        }
        void main() {
          vec2 p = vW.xz * vec2(0.9, 0.35) + vec2(0.0, uTime * 0.25);
          float v = n(p) * 0.6 + n(p * 2.3 - uTime * 0.2) * 0.4;
          float crust = smoothstep(0.55, 0.75, v);
          vec3 hot = mix(vec3(3.2, 0.9, 0.12), vec3(4.0, 2.2, 0.5), 1.0 - smoothstep(0.0, 0.2, v));
          vec3 col = mix(hot, vec3(0.12, 0.04, 0.02), crust);
          gl_FragColor = vec4(col, 1.0);
        }`,
      toneMapped: false,
      fog: false,
    });
    for (const s of [-1, 1]) {
      const geo = new THREE.PlaneGeometry(2.8, L, 1, 1);
      geo.rotateX(-Math.PI / 2);
      geo.translate(s * (this.pathHalf + 1.75), -0.12, (this.zStart + this.zEnd) / 2);
      this.track.add(new THREE.Mesh(geo, mat));
    }
  }

  // Duvarlar arasında köprü kuran oymalı antik taş kemer
  buildArch(z, scale) {
    const R = (this.pathHalf + 3.6) * scale;
    const tube = 2.4 * scale;
    const baseY = 5 * scale;
    const geo = new THREE.TorusGeometry(R, tube, 22, 120, Math.PI);
    const pos = geo.attributes.position;
    const nrm = geo.attributes.normal;
    const colors = new Float32Array(pos.count * 3);
    const uvs = geo.attributes.uv;
    const col = new THREE.Color();
    const v = new THREE.Vector3();
    const nv = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      nv.fromBufferAttribute(nrm, i);
      const ang = Math.atan2(v.y, v.x);
      const wy = v.y + baseY;
      const n = fbm(v.x * 0.15 + z, v.y * 0.15, v.z * 0.15, 4);
      // oyma bantlar: ön/arka yüzlerde girintili şeritler
      const faceZ = Math.abs(nv.z);
      const carve = faceZ > 0.6 ? (Math.sin(ang * 46) > 0.55 ? -0.18 : 0) + (Math.abs(Math.sin(ang * 9)) > 0.97 ? -0.35 : 0) : 0;
      // ufalanan kenarlar
      const crumble = (n - 0.5) * tube * 0.75 + (fbm(v.x * 0.6, v.y * 0.6, z, 2) - 0.5) * 0.5;
      v.addScaledVector(nv, crumble + carve * scale);
      pos.setXYZ(i, v.x, v.y, v.z);
      this.strataColor(wy, n, col);
      col.multiplyScalar((0.82 + 0.3 * n) * (carve < 0 ? 0.68 : 1));
      colors.set([col.r, col.g, col.b], i * 3);
      uvs.setXY(i, ang * R / 6, (v.z + v.y) / 6);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const arch = new THREE.Mesh(geo, this.rockMat);
    arch.position.set(0, baseY, z);
    arch.castShadow = true;
    arch.receiveShadow = true;
    this.track.add(arch);

    // Kemer ayakları
    for (const s of [-1, 1]) {
      const pg = new THREE.CylinderGeometry(tube * 1.15, tube * 1.6, baseY + 1, 14, 6);
      const pp = pg.attributes.position;
      const pc = new Float32Array(pp.count * 3);
      for (let i = 0; i < pp.count; i++) {
        const x = pp.getX(i), y = pp.getY(i), zz = pp.getZ(i);
        const n = fbm(x * 0.4 + s * 5, y * 0.4, zz * 0.4 + z, 3);
        const f = 1 + (n - 0.5) * 0.5;
        pp.setXYZ(i, x * f, y, zz * f);
        this.strataColor(y + baseY / 2, n, col);
        col.multiplyScalar(0.7 + 0.3 * n);
        pc.set([col.r, col.g, col.b], i * 3);
      }
      pg.setAttribute('color', new THREE.BufferAttribute(pc, 3));
      pg.computeVertexNormals();
      const pillar = new THREE.Mesh(pg, this.rockMat);
      pillar.position.set(s * R, (baseY + 1) / 2 - 0.5, z);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      this.track.add(pillar);
    }

    if (this.theme.rays) this.buildRays(z, R);
  }

  // Kemer açıklığından süzülen hacimsel ışık huzmeleri (sahte god-rays)
  buildRays(z, R) {
    if (!this.rayMat) {
      this.rayMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uTime: this.time, uColor: { value: new THREE.Color(...this.theme.rays) } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          varying float vFres;
          void main() {
            vUv = uv;
            vec3 n = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vFres = abs(dot(n, normalize(-mv.xyz)));
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform vec3 uColor;
          varying vec2 vUv;
          varying float vFres;
          void main() {
            float along = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
            float soft = pow(clamp(vFres, 0.0, 1.0), 2.5);
            float flick = 0.85 + 0.15 * sin(uTime * 0.7 + vUv.x * 12.0);
            float a = along * soft * flick * 0.11;
            gl_FragColor = vec4(uColor * a, a);
          }`,
      });
    }
    // mağarada huzmeler tavan çatlaklarından dik iner
    const dir = this.theme.cave ? new THREE.Vector3(0.15, -1, 0.25).normalize() : this.sunDir.clone().negate();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
    const len = this.theme.cave ? CEIL + 4 : 48;
    for (let i = 0; i < 4; i++) {
      const geo = new THREE.CylinderGeometry(1.2 + Math.random() * 1.2, 2.6 + Math.random() * 1.5, len, 20, 1, true);
      const ray = new THREE.Mesh(geo, this.rayMat);
      // huzmenin alt ucu kemerin altındaki zemine değsin
      const ground = new THREE.Vector3((Math.random() - 0.5) * R * 1.2, 0, z + 4 + Math.random() * 6);
      ray.position.copy(ground.clone().addScaledVector(dir, -len / 2));
      ray.quaternion.copy(q);
      ray.renderOrder = 5;
      this.track.add(ray);
    }
  }

  buildRocks() {
    const geo = new THREE.DodecahedronGeometry(1, 1);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const f = 0.75 + noise3(x * 2 + 3, y * 2, z * 2) * 0.5;
      p.setXYZ(i, x * f, y * f * 0.8, z * f);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, map: this.rockMap, flatShading: true });
    const count = 320;
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const c = new THREE.Color();
    const L = this.zStart - this.zEnd;
    const r = this.theme.rock;
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1;
      const s = 0.3 + Math.pow(Math.random(), 2.5) * 2.4;
      const x = side * (this.pathHalf + 0.6 + Math.random() * 3 + s * 0.4 + (this.theme.lava ? 2.6 : 0));
      const z = this.zStart - Math.random() * L;
      e.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(x, s * 0.25, z), q, new THREE.Vector3(s, s, s));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, c.setHSL(r.h + Math.random() * 0.03, r.s, r.l + Math.random() * 0.12));
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.track.add(mesh);
  }

  // Havadaki parçacıklar: 0 toz, 1 kar, 2 kıvılcım, 3 parıltı
  buildDust() {
    const N = 900;
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 22;
      pos[i * 3 + 1] = Math.random() * 18;
      pos[i * 3 + 2] = -Math.random() * 70;
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const d = this.theme.dust;
    this.dustMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: this.time,
        uOrigin: { value: new THREE.Vector3() },
        uMap: { value: softDotTexture() },
        uScale: { value: 400 },
        uMode: { value: d.mode },
        uColor: { value: new THREE.Color(...d.color) },
      },
      vertexShader: /* glsl */ `
        attribute float seed;
        uniform float uTime;
        uniform vec3 uOrigin;
        uniform float uScale;
        uniform int uMode;
        varying float vA;
        void main() {
          vec3 p = position;
          float size = 0.06 + seed * 0.1;
          float tw = 0.5 + 0.5 * sin(uTime * 1.5 + seed * 60.0);
          if (uMode == 1) {          // kar: aşağı süzülür
            p.y = mod(p.y - uTime * (1.0 + seed * 1.5), 18.0);
            p.x += sin(uTime * 0.8 + seed * 30.0) * 0.6;
            size = 0.1 + seed * 0.14;
            tw = 0.8;
          } else if (uMode == 2) {   // kıvılcım: yükselir ve söner
            p.y = mod(p.y + uTime * (1.5 + seed * 2.5), 18.0);
            p.x += sin(uTime * 2.0 + seed * 50.0) * 0.4;
            size = 0.05 + seed * 0.08;
            tw *= 1.0 - p.y / 18.0;
          } else {
            p.x += sin(uTime * 0.3 + seed * 40.0) * 0.8;
            p.y += sin(uTime * 0.2 + seed * 20.0) * 0.6;
            if (uMode == 3) tw = pow(tw, 4.0) * 1.6;
          }
          // kameraya göre z ekseninde sar (wrap)
          float z = mod(p.z - uOrigin.z + uTime * 0.6 * (seed - 0.5), 70.0);
          p.z = uOrigin.z - z + 6.0;
          p.x += uOrigin.x;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = size * uScale / -mv.z;
          vA = (0.35 + 0.65 * tw) * (1.0 - smoothstep(40.0, 70.0, z));
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        uniform vec3 uColor;
        varying float vA;
        void main() {
          float a = texture2D(uMap, gl_PointCoord).a * vA * 0.55;
          gl_FragColor = vec4(uColor * a, a);
        }`,
    });
    const pts = new THREE.Points(geo, this.dustMat);
    pts.frustumCulled = false;
    this.track.add(pts);
  }

  setPointScale(s) {
    this.dustMat.uniforms.uScale.value = s;
  }

  update(dt, t, camera, focus) {
    const camLocalZ = camera.position.z - this.track.position.z;
    if (this.sky) this.sky.position.copy(camera.position);
    this.time.value = t;
    this.dustMat.uniforms.uOrigin.value.set(focus.x * 0.5, 0, camLocalZ);
  }
}
