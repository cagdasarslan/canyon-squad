import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ASSETS, TEAMS, SKINS, VEHICLES } from './config.js';
import { skinById, charById } from './shop.js';
import { MINIONS, SPECIALS } from './bosses.js';

// "CharacterArmature|Walk" gibi önekli adları da bulur
const findClip = (clips, name) => clips.find((c) => c.name === name || c.name.endsWith('|' + name));

// Karakter modellerinden (Soldier, Robot) kostüm renkli, silahlı, havuzlanmış karakterler üretir.
// key: 'red' (düşman), bir kostüm id'si (SKINS, Asker modeli) veya bir karakter id'si (CHARACTERS).
// Modeller ilk ihtiyaç anında yüklenir (ensure).
export class CharacterFactory {
  constructor(loader, gltfs = {}) {
    this.loader = loader;
    this.gltfs = {};
    this.clips = {};
    this.loading = {};
    for (const [model, gltf] of Object.entries(gltfs)) this.register(model, gltf);
    this.templates = {};
    this.pools = {};
    this.rigs = {};
  }

  register(model, gltf) {
    const cfg = ASSETS[model];
    this.gltfs[model] = gltf;
    // run/idle zorunlu; attack gibi ek animasyonlar varsa onlar da
    this.clips[model] = {};
    for (const [k, name] of Object.entries(cfg.clips)) this.clips[model][k] = findClip(gltf.animations, name);
  }

  isLoaded(key) {
    return !!this.gltfs[this.def(key).model];
  }

  // Görünüm anahtarının modelini (gerekirse) indirir
  ensure(key) {
    const model = this.def(key).model;
    if (this.gltfs[model]) return Promise.resolve();
    this.loading[model] ??= this.loader.loadAsync(ASSETS[model].url).then((g) => this.register(model, g));
    return this.loading[model];
  }

  def(key) {
    if (key === 'red') return { ...TEAMS.red, model: 'soldier' };
    const minion = MINIONS.find((m) => m.id === key) ?? SPECIALS.find((m) => m.id === key);
    if (minion) return { model: key, glow: minion.color };
    // Mech aracı: karakterin robot zırhlı modeli, karakterin lazer rengiyle
    const mech = VEHICLES.find((v) => v.id === key && v.type === 'mech');
    if (mech) return { model: mech.model, glow: charById(mech.char).glow };
    if (SKINS.some((s) => s.id === key)) return skinById(key);
    return charById(key);
  }

  template(key) {
    if (this.templates[key]) return this.templates[key];
    const def = this.def(key);
    const cfg = ASSETS[def.model];

    // dış grup her zaman -Z'ye bakan, ~1.8 boyunda bir karakter olur
    const root = new THREE.Group();
    const inner = SkeletonUtils.clone(this.gltfs[def.model].scene);
    inner.rotation.y = cfg.rotationY ?? 0;
    if (cfg.height) {
      inner.updateMatrixWorld(true);
      const size = new THREE.Box3().setFromObject(inner).getSize(new THREE.Vector3());
      inner.scale.setScalar(cfg.height / size.y);
    }
    root.add(inner);

    const mats = new Map();
    inner.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.frustumCulled = false;
      const name = o.material.name;
      if (!mats.has(name)) mats.set(name, this.material(o.material, cfg, def));
      o.material = mats.get(name);
    });

    // Blaster sağ ele takılır. Yönü, koşu animasyonunun bir anındaki el pozuna göre hesaplanır:
    // o anda namlu ileri (-Z) bakar, sonra el ile birlikte sallanır (elde taşınıyormuş gibi).
    // Kendi silahı olan modellerde (Kurbağa, Arı, Flamingo) handBone tanımlı değil.
    let bone = null;
    // GLTFLoader kemik adlarından '.', ':' gibi karakterleri siler ("Wrist.R" → "WristR")
    const handName = cfg.handBone && THREE.PropertyBinding.sanitizeNodeName(cfg.handBone).replace(/[.:\/\[\]]/g, '');
    if (handName) inner.traverse((o) => { if (!bone && o.isBone && o.name === handName) bone = o; });
    if (cfg.handBone && !bone) console.warn('El kemiği bulunamadı:', cfg.handBone);
    if (bone) {
      // kemiklerin dinlenme pozunu sakla, koşu pozunu örnekle
      const rest = [];
      inner.traverse((o) => { if (o.isBone) rest.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]); });
      const runClip = findClip(this.gltfs[def.model].animations, cfg.clips.run);
      if (runClip) {
        const mixer = new THREE.AnimationMixer(inner);
        mixer.clipAction(runClip).play();
        mixer.setTime(runClip.duration * (cfg.gunPoseT ?? 0.25));
      }
      root.updateMatrixWorld(true);
      const hand = bone.getWorldPosition(new THREE.Vector3());
      const [ox, oy, oz] = cfg.gunOffset ?? [0, -0.02, -0.12];
      const gun = makeBlaster(def.glow);
      const desired = new THREE.Matrix4().compose(
        new THREE.Vector3(hand.x + ox, hand.y + oy, hand.z + oz),
        new THREE.Quaternion(),
        new THREE.Vector3(1, 1, 1).multiplyScalar(cfg.gunScale ?? 1),
      );
      const local = bone.matrixWorld.clone().invert().multiply(desired);
      local.decompose(gun.position, gun.quaternion, gun.scale);
      bone.add(gun);
      for (const [o, pos, q, sc] of rest) {
        o.position.copy(pos);
        o.quaternion.copy(q);
        o.scale.copy(sc);
      }
      root.updateMatrixWorld(true);
    }

    mergeSkinned(inner); // silah dahil tüm parçalar: kemiğe bağlı → skinned, sonra malzemeye göre birleştir
    this.templates[key] = root;
    return root;
  }

  material(src, cfg, def) {
    if (src.name === cfg.visorMaterial) {
      return new THREE.MeshStandardMaterial({
        color: 0x050505,
        emissive: new THREE.Color(...def.visor),
        emissiveIntensity: 1.4 * (cfg.visorIntensity ?? 1),
        metalness: 0.2,
        roughness: 0.15,
      });
    }
    if (src.name === cfg.bodyMaterial) {
      const m = src.clone();
      const c = new THREE.Color(...def.body);
      // dokusuz malzemede renk çarpanı 1'i geçmesin
      if (!m.map) c.multiplyScalar(1 / Math.max(1, c.r, c.g, c.b));
      m.color = c;
      m.emissive = new THREE.Color(...def.bodyEmissive);
      m.metalness = def.metalness ?? 0.45;
      m.roughness = def.metalness ? 0.22 : 0.32;
      m.envMapIntensity = 1.3;
      return m;
    }
    return src; // diğer malzemeler (robotun gri metal parçaları vb.) olduğu gibi
  }

  muzzleY(key) {
    return ASSETS[this.def(key).model].muzzleY;
  }

  // Ekranda aynı anda çizilecek en fazla karakter (ağır modellerde daha az)
  // formasyon aralığı (iri modellerde daha geniş)
  spacing(key) {
    return ASSETS[this.def(key).model].spacing ?? null;
  }

  maxVisible(key) {
    return ASSETS[this.def(key).model].maxVisible ?? 110;
  }

  // ---------- Ortak iskelet (rig) ----------
  // Aynı görünüm + aynı animasyondaki tüm karakterler TEK bir iskeletin pozunu paylaşır.
  // 110 asker için 110 mixer/iskelet yerine her karede 1 mixer güncellenir.
  rig(key, clip) {
    const id = `${key}|${clip}`;
    if (this.rigs[id]) return this.rigs[id];
    const tpl = this.template(key);
    const master = SkeletonUtils.clone(tpl); // sahneye eklenmez, kökü orijinde kalır
    const mixer = new THREE.AnimationMixer(master);
    const clips = this.clips[this.def(key).model];
    mixer.clipAction(clips[clip] ?? clips.run).play();

    const skeletons = [];
    master.traverse((o) => { if (o.isSkinnedMesh) skeletons.push(o.skeleton); });

    // kemiğe bağlı sert parçalar (silahlar): her karede ustanın kemiğinden matris hesaplanır
    const bones = {};
    master.traverse((o) => { if (o.isBone) bones[o.name] = o; });
    const attachments = this.attachmentsOf(tpl).map((a) => ({ bone: bones[a.boneName], local: a.local, shared: new THREE.Matrix4() }));

    const r = { master, mixer, skeletons, attachments };
    this.rigs[id] = r;
    this.stepRig(r, 0);
    return r;
  }

  attachmentsOf(tpl) {
    if (tpl.userData.attachments) return tpl.userData.attachments;
    const list = [];
    tpl.updateMatrixWorld(true);
    tpl.traverse((o) => {
      let hasMesh = false;
      o.traverse((x) => { if (x.isMesh && !x.isSkinnedMesh) hasMesh = true; });
      if (!o.isBone && !o.isSkinnedMesh && o.parent?.isBone && hasMesh) {
        list.push({ obj: o, boneName: o.parent.name, local: o.matrix.clone() });
      }
    });
    tpl.userData.attachments = list;
    return list;
  }

  stepRig(r, dt) {
    r.mixer.update(dt);
    r.master.updateMatrixWorld(true);
    for (const a of r.attachments) if (a.bone) a.shared.multiplyMatrices(a.bone.matrixWorld, a.local);
  }

  // Her karede bir kez: tüm iskeletleri güncelle
  update(dt) {
    for (const id in this.rigs) this.stepRig(this.rigs[id], dt);
  }

  // Hafif kopya: iskeleti yok; skinned mesh'ler ustanın iskeletini kullanır
  build(key) {
    const tpl = this.template(key);
    const obj = new THREE.Group();
    const meshes = [];
    tpl.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      const m = new THREE.SkinnedMesh(o.geometry, o.material);
      // detached modda shader: model * bindMatrix⁻¹ * (ustanın kemikleri) * bindMatrix.
      // Yerel matrisi bindMatrix yapınca ikisi sadeleşir → kopya, ustanın pozunu kendi konumunda çizer.
      m.bindMode = 'detached';
      m.bindMatrix.copy(o.bindMatrix);
      m.matrixAutoUpdate = false;
      m.matrix.copy(o.bindMatrix);
      m.castShadow = true;
      m.frustumCulled = false;
      obj.add(m);
      meshes.push(m);
    });
    const attachments = this.attachmentsOf(tpl).map((a) => {
      const g = a.obj.clone();
      g.matrixAutoUpdate = false;
      obj.add(g);
      return g;
    });
    const c = {
      obj, team: key, meshes, attachments, clip: null,
      setClip: (clip) => {
        if (c.clip === clip) return c;
        const r = this.rig(key, clip);
        c.clip = clip;
        meshes.forEach((m, i) => { m.skeleton = r.skeletons[i]; });
        attachments.forEach((g, i) => { g.matrix = r.attachments[i].shared; });
        return c;
      },
      setShadow: (on) => {
        for (const m of meshes) m.castShadow = on;
        for (const g of attachments) g.traverse((o) => { if (o.isMesh) o.castShadow = on; });
      },
    };
    return c;
  }

  acquire(key) {
    const pool = (this.pools[key] ??= []);
    const c = pool.length ? pool.pop() : this.build(key);
    c.obj.scale.setScalar(1);
    c.obj.visible = true;
    c.setClip('run');
    return c;
  }

  release(c) {
    c.obj.removeFromParent();
    this.pools[c.team].push(c);
  }

  prewarm(key, n) {
    const tmp = [];
    for (let i = 0; i < n; i++) tmp.push(this.acquire(key));
    for (const c of tmp) this.release(c);
    this.rig(key, 'idle');
  }
}

// Kemiğe bağlı sert parçaları (robot kolları, silahlar) o kemiğe %100 ağırlıklı skinned mesh'e çevirir.
// Böylece hem ortak iskeletle hareket ederler hem de diğer parçalarla birleştirilebilirler.
function rigidToSkinned(root) {
  const skinned = [];
  root.traverse((o) => { if (o.isSkinnedMesh) skinned.push(o); });
  const rigid = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh) return;
    let b = o.parent;
    while (b && !b.isBone) b = b.parent;
    if (b) rigid.push([o, b]);
  });
  for (const [m, bone] of rigid) {
    const sm = skinned.find((x) => x.skeleton.bones.includes(bone));
    if (!sm) continue;
    const j = sm.skeleton.bones.indexOf(bone);
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    // bind uzayı: kemiğin bind pozu * (kemiğe göre parça konumu)
    const local = bone.matrixWorld.clone().invert().multiply(m.matrixWorld);
    g.applyMatrix4(sm.skeleton.boneInverses[j].clone().invert().multiply(local));
    const n = g.attributes.position.count;
    const si = sm.geometry.attributes.skinIndex;
    const sw = sm.geometry.attributes.skinWeight;
    const idx = new si.array.constructor(n * 4);
    const w = new sw.array.constructor(n * 4);
    const one = sw.normalized ? (sw.array.constructor === Uint8Array ? 255 : 65535) : 1;
    for (let i = 0; i < n; i++) {
      idx[i * 4] = j;
      w[i * 4] = one;
    }
    g.setAttribute('skinIndex', new THREE.BufferAttribute(idx, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(w, 4, sw.normalized));
    const s = new THREE.SkinnedMesh(g, m.material);
    s.name = m.name;
    s.castShadow = true;
    s.frustumCulled = false;
    sm.parent.add(s);
    s.bind(sm.skeleton, new THREE.Matrix4());
    skinned.push(s);
    m.removeFromParent();
  }
}

// Aynı iskeleti ve aynı malzemeyi kullanan skinned parçaları tek mesh'te birleştirir.
// Robot (19 parça) ve Komando (13 parça) gibi modellerde asker başına çizim çağrısını büyük ölçüde azaltır.
function mergeSkinned(root) {
  root.updateMatrixWorld(true);
  rigidToSkinned(root);
  const groups = new Map();
  root.traverse((o) => {
    if (!o.isSkinnedMesh || o.geometry.morphAttributes.position) return; // yüz ifadeli (morph) parçalar ayrı kalır
    const key = o.skeleton.bones.map((b) => b.uuid).join() + '|' + o.material.uuid;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(o);
  });
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    // her parçayı kendi bind uzayından ortak uzaya taşı (bindMatrix = birim)
    // yalnızca hepsinde ortak olan öznitelikler kalır; indeksli/indekssiz karışıksa hepsi indekssiz yapılır
    const common = ['position', 'normal', 'uv', 'skinIndex', 'skinWeight'].filter((k) => list.every((m) => m.geometry.attributes[k]));
    const mixedIndex = list.some((m) => m.geometry.index) && list.some((m) => !m.geometry.index);
    const geos = list.map((m) => {
      let g = m.geometry.clone();
      if (mixedIndex && g.index) g = g.toNonIndexed();
      g.applyMatrix4(m.bindMatrix);
      for (const k of Object.keys(g.attributes)) if (!common.includes(k)) g.deleteAttribute(k);
      g.morphAttributes = {};
      return g;
    });
    const merged = mergeGeometries(geos, false);
    if (!merged) continue; // öznitelikler uyuşmuyorsa parçalar olduğu gibi kalır
    const first = list[0];
    const mesh = new THREE.SkinnedMesh(merged, first.material);
    mesh.name = first.name;
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    first.parent.add(mesh);
    mesh.bind(first.skeleton, new THREE.Matrix4());
    for (const m of list) m.removeFromParent();
  }
}

function makeBlaster(glow) {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c2430, metalness: 0.85, roughness: 0.3 });
  const light = new THREE.MeshStandardMaterial({ color: 0xdfe8f0, metalness: 0.7, roughness: 0.25 });
  const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(...glow), toneMapped: false });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.5), light);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16, 0.08), dark);
  grip.position.set(0, -0.12, 0.12);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.32, 10), dark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = -0.38;
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.42), glowMat);
  strip.position.set(0.055, 0.03, -0.02);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), glowMat);
  tip.position.z = -0.55;
  g.add(body, grip, barrel, strip, tip);
  // aynı malzemeli parçaları birleştir: 5 çizim çağrısı → 3
  g.updateMatrixWorld(true);
  const out = new THREE.Group();
  const byMat = new Map();
  for (const m of g.children) {
    if (!byMat.has(m.material)) byMat.set(m.material, []);
    byMat.get(m.material).push(m.geometry.clone().applyMatrix4(m.matrix));
  }
  for (const [mat, geos] of byMat) {
    const merged = mergeGeometries(geos.map((x) => (x.index ? x.toNonIndexed() : x)), false);
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true;
    out.add(mesh);
  }
  return out;
}
