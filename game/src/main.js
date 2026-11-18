// ZENITH — main.js
// One job: wire everything together. Boot the renderer, own the game loop,
// read keyboard + mouse, enter and exit cars, and run the busted / wasted /
// story-complete flows. The systems live in their own files; this file only
// calls them in the right order.
import * as THREE from 'three';
import { CITY, GAME_TITLE, GAME_SUBTITLE, STORY, CONTROLS, WANTED, CAR, HUB, MECHANIC, COMPLETE_TITLE, BUSTED_TEXT, WASTED_TEXT, RADIO_NAME, PALETTE } from './config.js';
import { buildCity, streetCenters, collideCircle } from './city.js';
import { SoundEngine } from './audio.js';
import { createPlayer, updatePlayerOnFoot, updateCamera, menuCamera } from './player.js';
import { spawnCar, updateTrafficCar, updatePlayerCar, randomCarColor } from './vehicles.js';
import { spawnPed, updatePed, updateFallenPed, randomSidewalkPoint } from './pedestrians.js';
import { createCombat, fireWeapon, startReload, updateCombat, updateRivals, damagePlayer } from './combat.js';
import { createWanted, addHeat, updateWanted, updatePolice, clearWanted } from './wanted.js';
import { createMissions, updateMissions, updateHub, startMission, onPlayerEnterCar, placeHubBeacon } from './missions.js';
import { createHud, addFeedMessage, showHint, flashScreen, updateHud } from './hud.js';
import { saveGame, loadSave, applySave, hasSave } from './save.js';
import { applyShot } from './shots.js';
import { runSelfTest } from './selftest.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SELFTEST = params.get('selftest') === '1';

const G = {
  scene: null, camera: null, renderer: null,
  mode: 'menu', // menu | playing | paused | busted | wasted | complete
  time: 0,
  player: null, cars: [], peds: [], rivals: [],
  city: null, wanted: null, combat: null, missions: null, hud: null,
  sound: new SoundEngine(),
  input: { up: false, down: false, left: false, right: false, run: false, handbrake: false },
  shotInput: null,
  shotMode: false,
  mouseDX: 0, mouseDY: 0,
  dangerPos: null, dangerTimer: 0,
  stats: { missionsDone: 0, carsStolen: 0, shotsFired: 0 },
  rngSeed: 20261118,
};
window.__game = G;

// ---------- HUD helpers the systems call ----------
G.hudMessage = (text, kind) => addFeedMessage(G.hud, text, kind);
G.hudHint = (text) => showHint(G.hud, text);
G.hudFlash = (kind) => flashScreen(G.hud, kind);
G.showBriefing = (def) => {
  const panel = document.getElementById('briefing');
  document.getElementById('brief-title').textContent = `MISSION ${def.id}: ${def.title} — $${def.reward}`;
  document.getElementById('brief-text').textContent = def.brief;
  panel.classList.add('show');
  clearTimeout(panel._t);
  panel._t = setTimeout(() => panel.classList.remove('show'), 14000);
};
G.saveGame = () => { if (saveGame(G)) G.hudMessage('Progress saved.', 'good'); };

// ---------- flows ----------
G.busted = () => {
  if (G.mode !== 'playing') return;
  G.mode = 'busted';
  G.sound.busted();
  G.sound.sirenStop();
  G.player.cash = Math.max(0, G.player.cash - 100);
  clearWanted(G);
  document.exitPointerLock?.();
  showEndScreen('BUSTED', BUSTED_TEXT, 'Walk free');
};
G.wasted = () => {
  if (G.mode !== 'playing') return;
  G.mode = 'wasted';
  G.sound.busted();
  G.player.cash = Math.max(0, G.player.cash - 100);
  clearWanted(G);
  document.exitPointerLock?.();
  showEndScreen('WASTED', WASTED_TEXT, 'Leave the hospital');
};
G.storyComplete = () => {
  G.mode = 'complete';
  G.sound.chime();
  document.exitPointerLock?.();
  showEndScreen(COMPLETE_TITLE, STORY.outro + ` — Missions done: ${G.stats.missionsDone}, cars stolen: ${G.stats.carsStolen}.`, 'Keep playing (free roam)');
};

function showEndScreen(title, text, buttonText) {
  const ov = document.getElementById('endscreen');
  document.getElementById('end-title').textContent = title;
  document.getElementById('end-text').textContent = text;
  const btn = document.getElementById('end-button');
  btn.textContent = buttonText;
  ov.style.display = 'flex';
  btn.onclick = () => {
    ov.style.display = 'none';
    respawn();
  };
}

function respawn() {
  const p = G.player;
  p.hp = 100;
  p.bustMeter = 0;
  if (p.car) { G.exitCar(true); }
  p.pos.set(HUB.x + 6, 0, HUB.z - 18);
  p.yaw = Math.PI * 0.75;
  p.mesh.position.copy(p.pos);
  p.mesh.visible = true;
  G.mode = 'playing';
  G.missions.state = G.missions.index >= 5 ? 'done' : 'waiting-hub';
  G.saveGame();
}

// ---------- cars: enter / exit / steal ----------
G.enterCar = (car, silent = false) => {
  const p = G.player;
  if (car.kind === 'police') { G.hudHint('Too hot — leave the cruiser alone.'); return false; }
  const wasOwned = !!car.owned;
  p.car = car;
  p.onFoot = false;
  p.mesh.visible = false;
  car.kind = 'player';
  car.parked = false;
  if (!silent) {
    G.sound.door();
    G.sound.engineStart();
  }
  if (!wasOwned) {
    G.stats.carsStolen++;
    addHeat(G, WANTED.heatStealCar, 'Grand theft auto');
    onPlayerEnterCar(G);
  }
  if (MECHANIC.type === 'nitro') G.hudHint('Hold SHIFT for NITRO boost.');
  return true;
};

G.tryEnterCar = () => {
  const p = G.player;
  if (!p.onFoot) { G.exitCar(); return; }
  let best = null, bestD = 4.5;
  for (const car of G.cars) {
    if (!car.alive || car.kind === 'police' || car.kind === 'player') continue;
    const d = Math.hypot(car.pos.x - p.pos.x, car.pos.z - p.pos.z);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (best) G.enterCar(best);
  else G.hudHint('No car close enough — walk up to one and press E.');
};

G.exitCar = (silent = false) => {
  const p = G.player;
  if (!p.car) return;
  const car = p.car;
  p.car = null;
  p.onFoot = true;
  p.pos.set(car.pos.x - Math.sin(car.yaw) * 2.5, 0, car.pos.z - Math.cos(car.yaw) * 2.5);
  collideCircle(p.pos, 0.6, G.city.colliders);
  p.mesh.visible = true;
  p.mesh.position.copy(p.pos);
  p.yaw = car.yaw;
  car.kind = 'traffic';
  car.target = null;
  car.speed = 0;
  if (!silent) G.sound.door();
  G.sound.engineStop();
};

// ---------- start / continue ----------
G.startGame = (fresh) => {
  const menu = document.getElementById('menu');
  menu.style.display = 'none';
  document.getElementById('hud').style.display = 'block';
  document.getElementById('endscreen').style.display = 'none';
  if (fresh) {
    G.player.cash = 50;
    G.player.hp = 100;
    G.stats = { missionsDone: 0, carsStolen: 0, shotsFired: 0 };
    G.missions.index = 0;
    G.missions.state = 'waiting-hub';
    G.player.pos.set(HUB.x + 6, 0, HUB.z - 6);
    G.player.mesh.position.copy(G.player.pos);
  }
  G.mode = 'playing';
  if (G.missions.state === 'waiting-hub') placeHubBeacon(G);
  G.hudMessage(`${GAME_TITLE} — ${STORY.fixer} is waiting at the lodge.`, 'mission');
  if (G.sound.init()) {
    G.sound.musicStart();
    G.sound.engineStop();
  }
};

// ---------- boot ----------
function boot() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  document.getElementById('game').appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, CITY.fogNear, CITY.fogFar);
  const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(-160, 40, 220);
  G.scene = scene; G.camera = camera; G.renderer = renderer;

  // sun + sky light
  const sun = new THREE.DirectionalLight(PALETTE.sun, CITY.sunIntensity);
  sun.position.set(120, 180, 60);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 1.1));

  G.city = buildCity(scene);
  G.player = createPlayer(scene);
  G.wanted = createWanted();
  G.combat = createCombat();
  G.missions = createMissions();
  G.hud = createHud();

  // traffic: cruise the road graph
  const centers = streetCenters();
  for (let i = 0; i < 12; i++) {
    const node = G.city.nodes[Math.floor(Math.random() * G.city.nodes.length)];
    const car = spawnCar(scene, node.x, node.z, Math.random() * Math.PI * 2, randomCarColor(Math.random), 'traffic');
    car.target = G.city.nodes[Math.floor(Math.random() * G.city.nodes.length)];
    G.cars.push(car);
  }
  // Professor Alden Vark's car, parked by Ridge Lodge (no heat to take it)
  const hubCar = spawnCar(scene, -168, -160, Math.PI * 0.5, 0x8a7fc0, 'traffic');
  hubCar.owned = true;
  hubCar.parked = true;
  G.cars.push(hubCar);
  // a few more parked cars around town
  for (const [x, z, yaw] of [[40, -76, 0], [-100, 64, 3.14159], [140, -16, 1.5708], [-30, -150, 0]]) {
    const pc = spawnCar(scene, x, z, yaw, randomCarColor(Math.random), 'traffic');
    pc.parked = true;
    G.cars.push(pc);
  }
  // pedestrians on the sidewalks
  for (let i = 0; i < 16; i++) {
    const pt = randomSidewalkPoint(centers, Math.random);
    const ped = spawnPed(scene, pt.x, pt.z, Math.random);
    G.peds.push(ped);
  }

  // menu buttons
  document.getElementById('btn-start').onclick = () => G.startGame(true);
  const btnContinue = document.getElementById('btn-continue');
  if (hasSave()) {
    btnContinue.style.display = 'inline-block';
    btnContinue.onclick = () => {
      applySave(G, loadSave());
      G.startGame(false);
      G.hudMessage('Welcome back, Nadia Kaur. Professor Alden Vark is still waiting at the lodge.', 'mission');
    };
  }
  document.getElementById('btn-save').onclick = () => { G.saveGame(); togglePause(false); };
  document.getElementById('btn-resume').onclick = () => togglePause(false);
  document.getElementById('btn-restart').onclick = () => {
    document.getElementById('pausemenu').style.display = 'none';
    G.startGame(true);
  };
  document.getElementById('btn-quit').onclick = () => {
    togglePause(false);
    G.mode = 'menu';
    document.getElementById('menu').style.display = 'flex';
    document.getElementById('hud').style.display = 'none';
  };

  // input
  const keyMap = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'run', ShiftRight: 'run', Space: 'handbrake',
  };
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') e.preventDefault();
    const k = keyMap[e.code];
    if (k) G.input[k] = true;
    if (e.repeat) return;
    if (e.code === 'KeyE' && G.mode === 'playing') G.tryEnterCar();
    if (e.code === 'KeyR' && G.mode === 'playing') startReload(G);
    if (e.code === 'KeyM') document.getElementById('briefing').classList.toggle('show');
    if (e.code === 'KeyH') {
      if (G.sound.init()) {
        const on = G.sound.toggleMusic();
        G.hudMessage(on ? 'Radio on — ' + RADIO_NAME + '.' : 'Radio off.', 'info');
      }
    }
    if (e.code === 'KeyP' && (G.mode === 'playing' || G.mode === 'paused')) togglePause(G.mode === 'playing');
    if (e.code === 'Escape' && G.mode === 'playing') togglePause(true);
  });
  window.addEventListener('keyup', (e) => {
    const k = keyMap[e.code];
    if (k) G.input[k] = false;
  });
  const canvas = renderer.domElement;
  canvas.addEventListener('click', () => {
    if (G.mode === 'playing' && !G.shotMode && !SELFTEST) {
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
      else if (G.player.onFoot) {
        const hit = fireWeapon(G, shootTargets());
        if (hit) {
          G.stats.shotsFired++;
          G.dangerPos = hit.end.clone();
          G.dangerTimer = 2;
          if (hit.hit) onShotHit(hit.hit);
        }
      }
    }
  });
  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) {
      G.mouseDX += e.movementX;
      G.mouseDY += e.movementY;
    }
  });
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // menu copy
  document.getElementById('menu-title').textContent = GAME_TITLE;
  document.getElementById('menu-sub').textContent = GAME_SUBTITLE;
  document.getElementById('menu-story').textContent = STORY.intro;
  const ctl = document.getElementById('controls');
  for (const [key, desc] of CONTROLS) {
    const row = document.createElement('div');
    row.innerHTML = `<b>${key}</b><span>${desc}</span>`;
    ctl.appendChild(row);
  }

  if (SHOT) applyShot(G, SHOT);
  if (SELFTEST) {
    // headless verification: run the self-test after the first frames
    // (1.5 s, so the renderer's shader compile is done before the test
    // measures anything timed)
    setTimeout(() => runSelfTest(G), 1500);
  }
  renderer.setAnimationLoop(tick);
}

function shootTargets() {
  // peds + rivals are shootable; police cars are not (yet)
  return [...G.peds.filter((p) => p.alive)];
}

function onShotHit(target) {
  if (target.kind === 'walker') {
    addHeat(G, target.alive ? WANTED.heatShoot : WANTED.heatHitPed, target.alive ? 'Shots fired' : 'Pedestrian down');
    if (!target.alive) G.hudMessage('A pedestrian is down. The PD will remember that.', 'bad');
  } else if (target.kind === 'rival') {
    if (!target.alive) {
      G.player.cash += 75;
      G.hudMessage('Rival down (+$75).', 'good');
    }
  }
}

function togglePause(on) {
  if (on && G.mode === 'playing') {
    G.mode = 'paused';
    document.getElementById('pausemenu').style.display = 'flex';
    document.exitPointerLock?.();
  } else if (!on && G.mode === 'paused') {
    G.mode = 'playing';
    document.getElementById('pausemenu').style.display = 'none';
  }
}

// car-vs-pedestrian: Nadia Kaur's car (or a cruiser) running someone over
function checkCarPedCollisions() {
  const cars = G.cars.filter((c) => c.alive && (c.kind === 'player' || c.kind === 'police') && Math.abs(c.speed) > 3);
  for (const car of cars) {
    for (const ped of G.peds) {
      if (!ped.alive || ped.kind !== 'walker') continue;
      const d = Math.hypot(ped.pos.x - car.pos.x, ped.pos.z - car.pos.z);
      if (d < 1.8) {
        ped.alive = false;
        ped.hp = 0;
        G.sound.thud();
        G.dangerPos = ped.pos.clone();
        G.dangerTimer = 2;
        if (car.kind === 'player') addHeat(G, WANTED.heatHitPed, 'Hit and run');
      }
    }
  }
}

// ---------- the loop ----------
let lastT = 0;
function tick(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
  lastT = t;
  G.time += dt;
  const mouseDX = G.mouseDX, mouseDY = G.mouseDY;
  G.mouseDX = 0; G.mouseDY = 0;

  if (G.mode === 'menu') {
    menuCamera(G.camera, G.time);
    updateAmbient(dt);
    G.renderer.render(G.scene, G.camera);
    return;
  }
  if (G.mode !== 'playing') {
    G.renderer.render(G.scene, G.camera);
    return;
  }

  // input: shot mode drives the car itself
  const input = G.shotInput || G.input;

  if (G.player.onFoot) {
    updatePlayerOnFoot(G.player, input, dt, G.city.colliders);
  } else if (G.player.car) {
    updatePlayerCar(G.player.car, input, dt, G.city.colliders, G.cars, (force) => {
      G.sound.crash();
      if (force > 20) damagePlayer(G, Math.floor(force / 8));
    });
    G.sound.engineSet(Math.abs(G.player.car.speed) / CAR.maxSpeed, true);
  }

  // per-game driving zone: solar boost / ridge ice (hint on entry)
  if (!G.player.onFoot && G.player.car) {
    const inZone = G.player.pos.x > CITY.beachX;
    if (inZone && !G._inZone) {
      if (MECHANIC.type === 'solar') G.hudHint('SOLAR BOOST — the mirror field is feeding the motor.');
      if (MECHANIC.type === 'ice') G.hudHint('ICE — the ridge road is slick. Easy does it.');
    }
    G._inZone = inZone;
  }
  updateAmbient(dt);
  updatePolice(G, dt);
  updateWanted(G, dt);
  updateMissions(G, dt);
  updateHub(G);
  updateCombat(G, dt);
  updateRivals(G, dt);
  checkCarPedCollisions();

  if (G.dangerTimer > 0) G.dangerTimer -= dt;
  const danger = G.dangerTimer > 0 ? G.dangerPos : null;
  G._danger = danger;

  // health regen, slow, only when the heat is off
  if (G.wanted.level === 0 && G.player.hp > 0 && G.player.hp < 100) {
    G.player.hp = Math.min(100, G.player.hp + dt * 2);
  }

  updateCamera(G.camera, G.player, dt, mouseDX, mouseDY);
  updateHud(G, dt);
  G.renderer.render(G.scene, G.camera);
}

function updateAmbient(dt) {
  for (const car of G.cars) {
    if (car.kind === 'traffic' && !car.parked && car.alive) {
      updateTrafficCar(car, G.city.nodes, Math.random, dt, G.cars, G.city.colliders);
    }
  }
  // walkers amble even on the menu backdrop; rivals hold their ground
  for (const ped of G.peds) {
    if (ped.alive) {
      if (ped.kind !== 'rival') updatePed(ped, G.city.centers, Math.random, dt, G._danger || null, G.city.colliders);
    } else updateFallenPed(ped, dt);
  }
}

boot();
