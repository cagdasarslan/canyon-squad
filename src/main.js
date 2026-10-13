import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ASSETS, GAME, CHARACTERS } from './config.js';
import { makeLevel, LEVEL_COUNT, loadProgress, saveProgress, resetProgress } from './levels.js';
import { MAPS, mapIndex, mapState, isMapUnlocked, isMapEarned, unlockedMapCount, testMode } from './maps.js';
import { sfx } from './audio.js';
import { World } from './world.js';
import { CharacterFactory } from './characters.js';
import { Squad } from './squad.js';
import { EnemyManager } from './enemies.js';
import { Lasers } from './lasers.js';
import { Effects } from './effects.js';
import { Coins } from './coins.js';
import { GateManager } from './gates.js';
import { Boss } from './boss.js';
import { Hud } from './hud.js';
import { SupportVehicle } from './vehicles.js';
import { Menu } from './ui.js';
import {
  ShopUI, upgradeStats, buyUpgrade, buyOrEquipSkin, hasAffordable,
  currentPerk, activeSupport, vehiclesOf, buyOrToggleVehicle,
  charById, appearanceKey, buyOrEquipCharacter, hasAffordableChar,
} from './shop.js';
import { CharStoreUI, RARITY_COLORS } from './chars.js';
import {
  DailyUI, loadDaily, saveDaily, canClaimDaily, claimDaily, track as trackMission, missionText, hasClaimableMission, claimMission,
} from './daily.js';
import {
  AchievementsUI, loadAchievements, saveAchievements, record, hasClaimableAchievement, claimAchievement,
} from './achievements.js';
import { LocalLeaderboard, LeaderboardUI, runScore } from './leaderboard.js';
import { loadSettings, saveSettings } from './settings.js';

const SUN_DIR = new THREE.Vector3(-0.28, 0.45, -1).normalize();
const app = document.getElementById('app');
const hud = new Hud();

// ?level=N bölüm seçer, ?play menüyü atlayıp başlatır; geliştirme: ?ts=3 zamanı hızlandırır
const params = new URLSearchParams(location.search);
const progress = loadProgress();
testMode.unlockAll = loadSettings().unlockAll; // harita seçiminden önce bilinmeli
// ?map=ice ile harita seçilir (açık değilse kayıtlı haritaya dönülür)
let mapIdx = mapIndex(params.get('map') ?? progress.map);
if (!isMapUnlocked(progress, mapIdx)) mapIdx = mapIndex(progress.map);
const MAP = MAPS[mapIdx];
const levelNum = Math.max(1, Math.min(LEVEL_COUNT, Number(params.get('level')) || mapState(progress, MAP.id).level));
const LEVEL = makeLevel(levelNum, mapIdx);

async function main() {
  // ---------- Renderer ----------
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = MAP.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  app.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(MAP.fog.color, MAP.fog.near, MAP.fog.far);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(58, 9 / 16, 0.5, 1200);

  // ---------- Işıklar: altın saat ----------
  scene.add(new THREE.HemisphereLight(MAP.hemi.sky, MAP.hemi.ground, MAP.hemi.intensity));
  const sun = new THREE.DirectionalLight(MAP.sun.color, MAP.sun.intensity);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -24; sc.right = 24; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 140;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xffe2c0, MAP.fill);
  scene.add(fill, fill.target);

  // ---------- Asset yükleme ----------
  const loader = new GLTFLoader();
  // bölümün boss canavarı: akrep ya da iskeletli canavar modeli
  const [gltf, bossGltf] = await Promise.all([
    loader.loadAsync(ASSETS.soldier.url, (e) => e.total && hud.setLoading((e.loaded / e.total) * 0.9)),
    loader.loadAsync(LEVEL.boss.url ?? ASSETS.scorpion.url),
    document.fonts.load('100px "Lilita One"').catch(() => {}),
  ]);

  // ---------- Dünya ve sistemler ----------
  // Tim sahnede sabit durur; harita (track) her karede oyuncuya doğru (+Z) kaydırılır.
  const track = new THREE.Group();
  scene.add(track);
  const world = new World(scene, track, {
    pathHalf: GAME.pathHalf,
    zStart: 90,
    zEnd: LEVEL.bossZ - 170,
    arches: LEVEL.arches,
    bossZ: LEVEL.bossZ,
    sunDir: SUN_DIR,
    theme: MAP,
  });
  const fx = new Effects(track);
  const lasers = new Lasers(track);
  const coins = new Coins(track, fx);
  // Asker her zaman yüklü (düşmanlar da Asker); diğer karakter modelleri gerektiğinde indirilir
  const factory = new CharacterFactory(loader, { soldier: gltf });
  await factory.ensure(appearanceKey(progress)).catch(() => {
    progress.character = 'soldier'; // model inemezse Asker'e dön
  });
  factory.prewarm(appearanceKey(progress), 40);
  // bölümün düşman türü (Kızıl Asker, Yavru Yeti, Taşçık, Şeytancık, Yavru Ejder)
  await factory.ensure(LEVEL.minion.id);
  factory.prewarm(LEVEL.minion.id, 30);
  const squad = new Squad(scene, factory, fx, lasers);
  squad.setSkin(appearanceKey(progress));
  // bölümdeki özel düşmanlar (robot, uzaylılar)
  const specialKinds = [...new Set(LEVEL.events.flatMap((e) => (e.extras ?? []).map((x) => x.kind)))];
  for (const k of specialKinds) {
    await factory.ensure(k);
    factory.prewarm(k, 8);
  }
  const enemies = new EnemyManager(track, factory, fx, coins, LEVEL.events.filter((e) => e.type === 'enemies'));
  const gates = new GateManager(track, LEVEL.events.filter((e) => e.type === 'gate'));
  const boss = new Boss(track, fx, coins, LEVEL.bossZ, bossGltf, {
    def: LEVEL.boss,
    hp: LEVEL.bossHp,
    scale: LEVEL.bossScale,
    color: MAP.boss.color,
    crack: MAP.boss.crack,
    speed: LEVEL.bossSpeed,
  });
  const bossStopZ = LEVEL.bossZ + LEVEL.bossStopOffset;

  // ---------- Yükseltmeler (market) ----------
  let stats = upgradeStats(progress.upgrades, currentPerk(progress));
  function applyStats() {
    stats = upgradeStats(progress.upgrades, currentPerk(progress));
    squad.fireInterval = stats.fireInterval;
    squad.armor = stats.armor;
    enemies.damage = stats.damage;
    boss.damage = stats.damage;
    squad.setCount(stats.startCount);
  }
  applyStats();

  // ---------- Post-processing ----------
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.4, 0.95);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let rect = app.getBoundingClientRect();
  function resize() {
    rect = app.getBoundingClientRect();
    const w = Math.max(1, rect.width), h = Math.max(1, rect.height);
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const pointScale = (h * renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    fx.setPointScale(pointScale);
    world.setPointScale(pointScale);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- Ayarlar ----------
  const settings = loadSettings();
  sfx.setSfx(settings.sfx);
  sfx.setMusic(settings.music);
  function applyQuality(hq) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, hq ? 2 : 1));
    bloom.enabled = hq;
    squad.setVisibleMul(hq ? 1 : 0.55); // düşük grafikte ekranda daha az asker
    sun.shadow.mapSize.set(hq ? 2048 : 1024, hq ? 2048 : 1024);
    if (sun.shadow.map) {
      sun.shadow.map.dispose();
      sun.shadow.map = null;
    }
    resize();
  }
  applyQuality(settings.hq);

  // ---------- Durum ----------
  // menu → run → intro (boss sinematiği) → boss → win | lose
  let state = 'menu';
  let paused = false;
  const menu = new Menu(onAction);
  hud.setLevel(LEVEL.index, LEVEL.bossName, MAP.name);
  const shopUI = new ShopUI();
  shopUI.setTab('upgrades');
  // ---------- Günlük ödül ve görevler ----------
  const daily = loadDaily();
  const ach = loadAchievements();
  const saveMeta = () => {
    saveDaily(daily);
    saveAchievements(ach);
  };
  saveMeta(); // yeni günün görevleri oluştuysa kaydet
  const dailyUI = new DailyUI();
  const board = new LocalLeaderboard();
  const boardUI = new LeaderboardUI(board);
  let runKills = 0;
  let pickedMap = 0; // bölüm seçiminde görüntülenen harita
  let pickedPage = 0; // görüntülenen 10'luk bölüm sayfası
  const renderLevelPage = () => menu.renderLevels(progress, pickedMap, mapIdx, LEVEL.index, pickedPage);
  function turnLevelPage(dir) {
    const next = Math.max(0, Math.min(LEVEL_COUNT / 10 - 1, pickedPage + dir));
    if (next === pickedPage) return;
    pickedPage = next;
    menu.slide(dir, renderLevelPage);
  }
  menu.onSwipe((dir) => {
    sfx.click();
    turnLevelPage(dir);
  });
  boardUI.mapId = MAP.id;
  const achUI = new AchievementsUI();

  // Oyun olayları hem günlük görevleri hem ömür boyu başarımları ilerletir
  function trackQuest(type, amount = 1) {
    for (const m of trackMission(daily, type, amount)) {
      hud.toast(`✅ Görev tamamlandı: ${missionText(m)}`);
      sfx.purchase();
    }
    for (const a of record(ach, type, amount)) {
      hud.toast(`🏆 Başarım açıldı: ${a.name}`);
      sfx.win();
    }
    if (state === 'menu') refreshMenu();
  }

  const refreshMenu = () => {
    menu.setMain(LEVEL.index, `${MAP.icon} ${MAP.name} · ${LEVEL.name}`, progress.coins, hasAffordable(progress));
    menu.setCharBadge(hasAffordableChar(progress));
    menu.setBadges(canClaimDaily(daily), hasClaimableMission(daily), hasClaimableAchievement(ach));
  };
  refreshMenu();
  // mevcut ilerlemeyle eşitle (eski kayıtlar için)
  record(ach, 'skins', progress.skins.length);
  record(ach, 'chars', progress.characters.length);
  record(ach, 'vehicles', progress.vehicles.length);
  record(ach, 'maps', unlockedMapCount(progress));
  record(ach, 'streak', daily.streak ?? 0);
  refreshMenu();
  menu.bindSettings(settings, (key, on) => {
    settings[key] = on;
    saveSettings(settings);
    if (key === 'sfx') sfx.setSfx(on);
    if (key === 'music') sfx.setMusic(on);
    if (key === 'hq') applyQuality(on);
    if (key === 'unlockAll') testMode.unlockAll = on;
  });
  squad.setRunning(false);

  // Bölümler sayfa yeniden yüklenerek kurulur; ?play doğrudan oyuna girer
  function go(level, play, screen, map) {
    const url = new URL(location.pathname, location.origin);
    if (map) url.searchParams.set('map', map);
    if (level) url.searchParams.set('level', level);
    if (play) url.searchParams.set('play', '');
    if (screen) url.searchParams.set(screen, '');
    if (params.has('ts')) url.searchParams.set('ts', params.get('ts'));
    saveMeta();
    location.href = url.toString();
  }

  function onAction(action, btn) {
    sfx.unlock();
    if (!action.startsWith('buy') && action !== 'skin') sfx.click();
    switch (action) {
      case 'shop':
        shopUI.render(progress);
        menu.open('shop');
        break;
      case 'go-shop':
        go(null, false, 'shop');
        break;
      case 'tab':
        shopUI.setTab(btn.dataset.tab);
        break;
      case 'daily':
        dailyUI.renderDaily(daily);
        menu.open('daily');
        break;
      case 'leaderboard':
        boardUI.setTab('all');
        menu.open('leaderboard');
        break;
      case 'lb-tab':
        boardUI.setTab(btn.dataset.tab);
        break;
      case 'achievements':
        achUI.render(ach);
        menu.open('achievements');
        break;
      case 'claim-ach':
        if (claimAchievement(ach, progress, btn.dataset.id)) {
          sfx.purchase();
          saveMeta();
          saveProgress(progress);
        }
        achUI.render(ach);
        refreshMenu();
        break;
      case 'claim-daily':
        if (claimDaily(daily, progress)) {
          sfx.win();
          trackQuest('streak', daily.streak);
          saveMeta();
          saveProgress(progress);
        }
        dailyUI.renderDaily(daily);
        refreshMenu();
        break;
      case 'missions':
        dailyUI.renderMissions(daily);
        menu.open('missions');
        break;
      case 'claim-mission':
        if (claimMission(daily, progress, Number(btn.dataset.index))) {
          sfx.purchase();
          trackQuest('missions');
          saveMeta();
          saveProgress(progress);
        }
        dailyUI.renderMissions(daily);
        refreshMenu();
        break;
      case 'buy-up':
        if (buyUpgrade(progress, btn.dataset.id)) {
          sfx.purchase();
          saveProgress(progress);
          applyStats();
          trackQuest('upgrade');
          saveMeta();
        } else sfx.deny();
        shopUI.render(progress);
        refreshMenu();
        break;
      case 'skin': {
        const res = buyOrEquipSkin(progress, btn.dataset.id);
        if (res === 'poor') {
          sfx.deny();
          btn.classList.add('shake');
          setTimeout(() => btn.classList.remove('shake'), 300);
          break;
        }
        if (res === 'bought') {
          sfx.purchase();
          trackQuest('skins', progress.skins.length);
          saveMeta();
        }
        else sfx.click();
        saveProgress(progress);
        squad.setSkin(appearanceKey(progress));
        applyStats(); // kostüm Asker'e geçirir → karakter yeteneği değişebilir
        shopUI.render(progress);
        refreshMenu();
        break;
      }
      case 'chars':
        csIndex = Math.max(0, CHARACTERS.findIndex((c) => c.id === progress.character));
        menu.open('chars');
        showCharacter();
        break;
      case 'char-prev':
      case 'char-next':
        csIndex = (csIndex + (action === 'char-next' ? 1 : -1) + CHARACTERS.length) % CHARACTERS.length;
        showCharacter();
        break;
      case 'char-buy':
        buyCharacter();
        break;
      case 'veh':
        toggleVehicle(btn.dataset.id, btn);
        break;
      case 'play':
        if (state === 'menu') start();
        break;
      case 'levels':
        pickedMap = mapIdx;
        pickedPage = Math.floor((LEVEL.index - 1) / 10);
        renderLevelPage();
        menu.open('levels');
        break;
      case 'map-pick':
        pickedMap = Number(btn.dataset.map);
        pickedPage = Math.floor((mapState(progress, MAPS[pickedMap].id).level - 1) / 10);
        renderLevelPage();
        break;
      case 'lv-prev':
      case 'lv-next':
        turnLevelPage(action === 'lv-next' ? 1 : -1);
        break;
      case 'settings':
        menu.open('settings');
        break;
      case 'select': {
        const n = Number(btn.dataset.level);
        const m = Number(btn.dataset.map);
        if (n === LEVEL.index && m === mapIdx && state === 'menu') start();
        else go(n, true, null, MAPS[m].id);
        break;
      }
      case 'pause':
        pause();
        break;
      case 'resume':
        resume();
        break;
      case 'restart':
      case 'retry':
        go(LEVEL.index, true);
        break;
      case 'next':
        go(null, true); // kayıtlı ilerleme bir sonraki bölümü gösterir
        break;
      case 'home':
        go(null, false);
        break;
      case 'reset':
        if (menu.confirmReset()) {
          resetProgress();
          go(null, false);
        }
        break;
    }
  }

  function pause() {
    if (paused || !['run', 'intro', 'boss'].includes(state)) return;
    paused = true;
    dragging = false;
    sfx.stopMusic();
    menu.open('pause');
    saveMeta();
  }

  function resume() {
    if (!paused) return;
    menu.closeAll();
    paused = false;
    clock.getDelta(); // duraklama süresini atla
    if (state !== 'intro') sfx.startMusic(state === 'boss');
  }
  document.addEventListener('visibilitychange', () => document.hidden && pause());

  // ---------- Girdi: sürükle ----------
  let dragging = false;
  let lastX = 0;
  app.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, .screen, label')) return;
    if (state === 'intro') {
      boss.skipIntro();
      return;
    }
    dragging = true;
    lastX = e.clientX;
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging || paused) return;
    squad.targetX += ((e.clientX - lastX) / rect.width) * GAME.pathHalf * 2.6;
    lastX = e.clientX;
  });
  window.addEventListener('pointerup', () => (dragging = false));
  const keys = {};
  window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (e.key === 'Escape') paused ? resume() : pause();
    if ((e.key === ' ' || e.key === 'Enter') && state === 'menu' && menu.top === 'menu') start();
  });
  window.addEventListener('keyup', (e) => (keys[e.key] = false));

  function start() {
    state = 'run';
    menu.closeAll();
    hud.setMode('play');
    squad.setRunning(true);
    squad.firing = true;
    sfx.unlock();
    sfx.startMusic();
  }

  // ---------- Boss giriş sinematiği ----------
  function startIntro() {
    state = 'intro';
    squad.setRunning(false);
    squad.firing = false;
    hud.setMode('cinematic');
    hud.showCinematic(true);
    sfx.stopMusic();
    sfx.rumble(2.4);
    boss.startIntro();
  }
  boss.onIntroEvent = (ev) => {
    if (ev === 'roar') hud.showBossCard();
    if (ev === 'done') {
      bossStartCount = squad.count; // "Kusursuz" başarımı için
      state = 'boss';
      squad.firing = true;
      hud.showCinematic(false);
      hud.setMode('play');
      hud.showBoss(true);
      sfx.startMusic(true);
      sfx.setIntense(true);
    }
  };

  // Bölüm sonu: harita ilerlemesini ve toplam parayı kaydet
  function finish(win) {
    const final = win && LEVEL.index >= LEVEL_COUNT;
    const nextMap = MAPS[mapIdx + 1];
    const nextWasOpen = nextMap && isMapEarned(progress, mapIdx + 1);
    const ms = mapState(progress, MAP.id);
    ms.unlocked = Math.max(ms.unlocked, win ? Math.min(LEVEL_COUNT, LEVEL.index + 1) : LEVEL.index);
    // harita bittiyse sıradaki haritaya geç; son harita bittiyse baştan
    ms.level = win ? (final ? (nextMap ? LEVEL_COUNT : 1) : LEVEL.index + 1) : LEVEL.index;
    progress.map = final && nextMap ? nextMap.id : MAP.id;
    saveProgress({ ...progress, coins: progress.coins + coinCount });
    if (nextMap && !nextWasOpen && isMapEarned(progress, mapIdx + 1)) {
      hud.toast(`🔓 Yeni harita açıldı: ${nextMap.icon} ${nextMap.name}`);
      trackQuest('maps', unlockedMapCount(progress));
    }
    sfx.stopMusic();
    if (win) {
      trackQuest('levels');
      trackQuest('highestLevel', LEVEL.index);
      if (squad.count <= 3) trackQuest('closeCall', 1);
    }
    saveMeta();
    if (win) sfx.win();
    else sfx.lose();
    hud.setMode('menu');
    const score = runScore({ kills: runKills, coins: coinCount, win, survivors: squad.count, level: LEVEL.index });
    const result = board.submit(score, LEVEL.index, MAP.id);
    hud.showEnd(win, coinCount, {
      level: LEVEL.index, final, score, isRecord: result.isRecord && score > 0, rank: result.rank,
      mapName: MAP.name, nextMapName: final && nextMap ? `${nextMap.icon} ${nextMap.name}` : null,
    });
  }

  // ---------- Karakter mağazası: 3D önizleme ----------
  const csUI = new CharStoreUI();
  let csIndex = 0;
  let preview = null;
  let previewToken = 0;
  const showcase = new THREE.Group();
  showcase.position.set(0, 0, 4.5);
  showcase.visible = false;
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 1.25, 0.3, 48),
    new THREE.MeshStandardMaterial({ color: 0x3a2c22, metalness: 0.6, roughness: 0.35 }),
  );
  pedestal.position.y = 0.15;
  pedestal.receiveShadow = true;
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.045, 8, 72), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.31;
  const glowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(1.5, 48),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  glowDisc.rotation.x = -Math.PI / 2;
  glowDisc.position.y = 0.02;
  showcase.add(pedestal, ring, glowDisc);
  scene.add(showcase);

  // Mağazada seçili karakteri göster (model gerekirse indirilir)
  async function showCharacter() {
    const c = CHARACTERS[csIndex];
    csUI.render(progress, csIndex);
    const col = RARITY_COLORS[c.rarity];
    ringMat.color.setRGB(...col);
    glowDisc.material.color.setRGB(col[0] * 0.4, col[1] * 0.4, col[2] * 0.4);
    const mech = vehiclesOf(c.id).find((v) => v.type === 'mech' && progress.vehiclesOn.includes(v.id));
    const key = c.id === 'soldier' ? progress.skin : mech?.id ?? c.id;
    const token = ++previewToken;
    showPreviewVehicle(vehiclesOf(c.id).find((v) => v.type === 'support' && progress.vehiclesOn.includes(v.id)), token);
    if (!factory.isLoaded(key)) {
      csUI.setLoading(true);
      try {
        await factory.ensure(key);
      } catch {
        csUI.setLoading(false);
        return;
      }
      csUI.setLoading(false); // daha yeni bir seçim yapıldıysa o kendi yüklemesini gösterir
      if (token !== previewToken) return;
    }
    if (preview) factory.release(preview);
    preview = factory.acquire(key);
    preview.setClip('idle');
    preview.setShadow(true);
    preview.obj.position.set(0, 0.3, 0);
    preview.obj.rotation.set(0, Math.PI + 0.5, 0);
    showcase.add(preview.obj);
    sfx.click();
  }

  // ---------- Karaktere özel araçlar ----------
  const vehicleGltfs = {};
  const loadVehicle = (v) => (vehicleGltfs[v.id] ??= loader.loadAsync(v.url));
  let support = null;
  let previewVehicle = null;

  // timin destek aracını (rover/gemi) güncel karaktere göre kur
  async function refreshSupport() {
    const v = activeSupport(progress);
    if (support?.def.id === v?.id) return;
    support?.dispose();
    support = null;
    if (!v) return;
    const gltf = await loadVehicle(v);
    if (activeSupport(progress)?.id !== v.id) return;
    support = new SupportVehicle(scene, gltf, v, squad.muzzleColor.clone());
    scene.add(support.obj);
  }

  // mağaza kaidesinde karakterin arkasında aracı
  async function showPreviewVehicle(v, token) {
    previewVehicle?.dispose();
    previewVehicle = null;
    if (!v) return;
    const gltf = await loadVehicle(v);
    if (token !== previewToken) return;
    previewVehicle = new SupportVehicle(showcase, gltf, v, new THREE.Color(1, 1, 1));
    previewVehicle.obj.scale.setScalar(0.5);
    // gemi karakterin arkasında havada, rover yanında
    previewVehicle.obj.position.set(v.kind === 'ship' ? 1.3 : 1.7, v.kind === 'ship' ? 2.3 : 0.3, -1.6);
    showcase.add(previewVehicle.obj);
  }

  async function toggleVehicle(id, btn) {
    const res = buyOrToggleVehicle(progress, id);
    if (res === 'locked') {
      sfx.deny();
      hud.toast('Önce karakteri açmalısın');
      return;
    }
    if (res === 'poor') {
      sfx.deny();
      btn.classList.add('shake');
      setTimeout(() => btn.classList.remove('shake'), 300);
      return;
    }
    if (res === 'bought') {
      sfx.win();
      trackQuest('vehicles', progress.vehicles.length);
      saveMeta();
    } else sfx.purchase();
    saveProgress(progress);
    refreshMenu();
    await factory.ensure(appearanceKey(progress));
    squad.setSkin(appearanceKey(progress));
    applyStats();
    refreshSupport();
    showCharacter();
  }

  async function buyCharacter() {
    const c = CHARACTERS[csIndex];
    const res = buyOrEquipCharacter(progress, c.id);
    if (res === 'poor') {
      sfx.deny();
      csUI.shake();
      return;
    }
    if (res === 'bought') {
      sfx.win();
      trackQuest('chars', progress.characters.length);
      saveMeta();
    } else sfx.purchase();
    saveProgress(progress);
    csUI.render(progress, csIndex);
    refreshMenu();
    await factory.ensure(appearanceKey(progress));
    squad.setSkin(appearanceKey(progress));
    applyStats();
    refreshSupport();
  }
  refreshSupport();

  // ---------- Oyun döngüsü ----------
  let coinCount = 0;
  let coinAcc = 0;
  hud.setCoins(progress.coins);
  let endTimer = 0;
  let cineW = 0;
  const camPos = new THREE.Vector3(0, 12, 14);
  const lookAt = new THREE.Vector3();
  const focus = new THREE.Vector3();
  const countAnchor = new THREE.Vector3();
  const bossPos = new THREE.Vector3();
  const cineCam = new THREE.Vector3();
  const cineLook = new THREE.Vector3();
  enemies.onKill = () => {
    runKills++;
    trackQuest('kill');
  };
  squad.onBlock = () => trackQuest('blocks');
  let bossStartCount = 0;
  boss.onDead = () => {
    if (squad.count >= bossStartCount) trackQuest('flawless', 1);
    trackQuest('boss');
    enemies.shatterAll();
    hud.showBoss(false);
    squad.firing = false;
    state = 'win';
    endTimer = 4.2;
  };

  // Shader derlemesini önden yap (ilk karede takılma olmasın)
  camera.position.set(0, 12, 14);
  camera.lookAt(0, 0, -10);
  renderer.compile(scene, camera);
  hud.setLoading(1);
  hud.loaded();

  if (import.meta.env.DEV) window.__game = { THREE, scene, track, camera, renderer, composer, bloom, squad, boss, world, menu, enemies, daily, ach, board };

  const timeScale = Number(params.get('ts')) || 1;
  if (params.has('play') || params.has('auto')) start();
  else {
    menu.open('menu');
    if (params.has('shop')) onAction('shop');
    else if (canClaimDaily(daily)) setTimeout(() => menu.top === 'menu' && onAction('daily'), 700);
  }

  const clock = new THREE.Clock();
  let t = 0;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 1 / 30) * timeScale;
    if (paused) {
      composer.render();
      return;
    }
    t += dt;

    if (keys.ArrowLeft || keys.a) squad.targetX -= dt * 14;
    if (keys.ArrowRight || keys.d) squad.targetX += dt * 14;

    if (state === 'run') {
      squad.center.z -= GAME.speed * dt;
      if (squad.center.z <= bossStopZ) {
        squad.center.z = bossStopZ;
        startIntro();
      }
      gates.check(squad, (gate, n) => {
        sfx.gate(n >= squad.count);
        if (n > squad.count) trackQuest('gates');
        squad.setCount(n);
        trackQuest('squad', squad.count);
        fx.shake += 0.15;
      });
    }

    squad.update(dt);
    gates.update(dt);
    enemies.update(dt, squad);
    lasers.update(dt, (x, y, z, dmg) => enemies.hit(x, y, z, dmg) || boss.hit(x, y, z, dmg));
    factory.update(dt); // ortak iskeletler: kare başına bir kez
    support?.update(dt, squad, lasers, enemies, fx, squad.firing);
    boss.update(dt, squad);
    coins.update(dt, squad.center, () => {
      coinAcc += stats.coinMul; // Para Bonusu yükseltmesi
      coinCount = Math.floor(coinAcc);
      trackQuest('coins');
      hud.setCoins(progress.coins + coinCount);
      sfx.coin();
    });
    fx.update(dt);
    track.position.z = -squad.center.z; // harita oyuncuya doğru akar

    if ((state === 'run' || state === 'boss') && squad.count === 0) {
      state = 'lose';
      squad.firing = false;
      endTimer = 1.6;
    }
    if (endTimer > 0) {
      endTimer -= dt;
      if (endTimer <= 0) finish(state === 'win');
    }

    // ---------- Kamera: stabilize üçüncü şahıs takip ----------
    const bossCam = state === 'boss' || state === 'win' ? 1 : 0;
    focus.set(squad.center.x * 0.55, 0, 0);
    const zoom = Math.max(0, squad.radius() - 3) * 0.9; // tim büyüdükçe kamera geri çekilir
    const desired = new THREE.Vector3(focus.x, 12.5 + bossCam * 3.5 + zoom, focus.z + 13 + bossCam * 4 + zoom * 0.8);
    lookAt.set(focus.x, 0, focus.z - 10 - bossCam * 4);
    const storeOpen = state === 'menu' && menu.top === 'chars';
    if (storeOpen !== showcase.visible) {
      showcase.visible = storeOpen;
      squad.setVisible(!storeOpen);
      if (support) support.obj.visible = !storeOpen;
    }
    if (storeOpen && preview) {
      preview.obj.rotation.y += dt * 0.5;
      ring.rotation.z += dt * 0.8;
    }

    if (storeOpen) {
      // karakter mağazası: kamera kaideye yaklaşır
      desired.set(0, 2.3, 10.8);
      lookAt.set(0, -0.1, 4.5);
    } else if (state === 'menu' && menu.top === 'shop') {
      // markette kamera timin önüne iner: kostüm önizlemesi
      desired.set(squad.center.x + Math.sin(t * 0.4) * 1.5, 3.6, 9);
      lookAt.set(squad.center.x, 3.6, -4);
    } else if (state === 'menu') {
      // menüde kamera yavaşça süzülür
      desired.x += Math.sin(t * 0.25) * 3;
      desired.y -= 2;
      lookAt.y += 2;
    }

    // Sinematik: kamera boss'un önüne kayar ve yükselişini izler
    cineW += ((state === 'intro' ? 1 : 0) - cineW) * (1 - Math.exp(-dt * 2.5));
    if (cineW > 0.001) {
      boss.root.getWorldPosition(bossPos);
      const it = boss.introT ?? 0;
      cineCam.set(bossPos.x + 9 - it * 3, 5 + it * 0.8, bossPos.z + 26 - it * 1.5);
      cineLook.set(bossPos.x, 3.5 + Math.max(0, boss.root.position.y) + Math.min(it, 2.4), bossPos.z);
      desired.lerp(cineCam, cineW);
      lookAt.lerp(cineLook, cineW);
    }

    camPos.lerp(desired, 1 - Math.exp(-dt * 5));
    camera.position.copy(camPos);
    if (fx.shake > 0) {
      const s = fx.shake * 0.25;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
    }
    camera.lookAt(lookAt);

    // Güneş gölge kamerası squad'ı takip eder
    sun.target.position.set(focus.x, 0, focus.z - 10);
    sun.position.copy(sun.target.position).addScaledVector(SUN_DIR, 70);
    fill.target.position.copy(sun.target.position);
    fill.position.set(focus.x + 6, 14, focus.z + 30);

    world.update(dt, t, camera, focus);

    hud.setProgress((squad.center.z - 0) / (bossStopZ - 0));
    if (state === 'boss') hud.setBossHp(boss.hp / boss.maxHp);
    countAnchor.set(squad.center.x, 2.4 + Math.min(1.5, squad.radius() * 0.15), -squad.radius() * 0.3);
    hud.setCount(squad.count, countAnchor, camera, rect);

    composer.render();
  });
}

main().catch((err) => {
  console.error(err);
  document.querySelector('.load-text').textContent = 'HATA: ' + err.message;
});
