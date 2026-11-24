// ZENITH — main.js (round 3 redo)
// The conductor: owns the renderer, the game state, the input, and the
// frame loop, and calls each system in the right order. The systems
// themselves (city, cars, people, gun, law, story, HUD, sound) live in
// their own modules; this file only wires them together and runs the
// busted / wasted / story-complete flows.
import * as THREE from 'three';
import {
  TOWN, GAME_TITLE, GAME_SUBTITLE, STORY, CONTROLS, HEAT, DRIVE, HUB,
  MECHANIC, COMPLETE_TITLE, BUSTED_TEXT, WASTED_TEXT, RADIO_NAME, COLORS,
  CROWD,
} from './config.js';
import { growTown, avenueLines, pushOutOfWalls } from './city.js';
import { SoundEngine } from './audio.js';
import { makeHero, walkHero, trackCamera, orbitMenuCam } from './player.js';
import { summonCar, cruiseTraffic, drivePlayerCar, pickPaint } from './vehicles.js';
import { summonWalker, walkPerson, topplePed, sidewalkSpot } from './pedestrians.js';
import { newArsenal, shoot, beginReload, tickArsenal, tickRivals, hurtPlayer } from './combat.js';
import { newHeat, raiseHeat, tickHeat, tickCruisers, coolOff } from './wanted.js';
import { newStory, tickStory, checkLodge, noteCarTaken, markLodge } from './missions.js';
import { newHud, postFeed, flashHint, flashScreen, refreshHud } from './hud.js';
import { storeSave, fetchSave, restoreSave, saveExists } from './save.js';
import { stageShot } from './shots.js';
import { runChecks } from './selftest.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SELFTEST = params.get('selftest') === '1';

// ------------------------------------------------------------ game state
function newLedger() {
  return { missionsDone: 0, carsStolen: 0, shotsFired: 0, nearMisses: 0 };
}

const G = {
  scene: null,
  camera: null,
  renderer: null,
  mode: 'menu', // menu | playing | paused | busted | wasted | complete
  time: 0,
  player: null,
  cars: [],
  peds: [],
  rivals: [],
  city: null,
  wanted: null,
  combat: null,
  missions: null,
  hud: null,
  sound: new SoundEngine(),
  input: { up: false, down: false, left: false, right: false, run: false, handbrake: false },
  shotInput: null,
  shotMode: false,
  mouseDX: 0,
  mouseDY: 0,
  dangerPos: null,
  dangerTimer: 0,
  recoil: 0,
  stats: newLedger(),
  rngSeed: 20261124,
};
window.__game = G;

// ------------------------------------------------- helpers systems call
G.hudMessage = (text, kind) => postFeed(G.hud, text, kind);
G.hudHint = (text) => flashHint(G.hud, text);
G.hudFlash = (kind) => flashScreen(G.hud, kind);
G.showBriefing = (def) => {
  const panel = document.getElementById('briefing');
  document.getElementById('brief-title').textContent =
    `MISSION ${def.id}: ${def.title} — $${def.reward}`;
  document.getElementById('brief-text').textContent = def.brief;
  panel.classList.add('show');
  clearTimeout(panel._t);
  panel._t = setTimeout(() => panel.classList.remove('show'), 14000);
};
G.saveGame = () => {
  if (storeSave(G)) G.hudMessage('Progress saved.', 'good');
};

// ------------------------------------------------------------ end flows
function presentEnding(title, text, buttonText) {
  const overlay = document.getElementById('endscreen');
  document.getElementById('end-title').textContent = title;
  document.getElementById('end-text').textContent = text;
  const button = document.getElementById('end-button');
  button.textContent = buttonText;
  overlay.style.display = 'flex';
  button.onclick = () => {
    overlay.style.display = 'none';
    wakeUp();
  };
}

function wakeUp() {
  const p = G.player;
  p.hp = 100;
  p.bustMeter = 0;
  if (p.car) G.climbOut(true);
  p.pos.set(HUB.x + 6, 0, HUB.z - 18);
  p.yaw = Math.PI * 0.75;
  p.mesh.position.copy(p.pos);
  p.mesh.visible = true;
  G.mode = 'playing';
  G.missions.state = G.missions.index >= 5 ? 'done' : 'waiting-hub';
  G.saveGame();
}

function finishRun(mode, sound, title, text, button) {
  if (G.mode !== 'playing') return;
  G.mode = mode;
  sound();
  G.player.cash = Math.max(0, G.player.cash - 100);
  coolOff(G);
  document.exitPointerLock?.();
  presentEnding(title, text, button);
}

G.busted = () =>
  finishRun('busted', () => {
    G.sound.busted();
    G.sound.sirenStop();
  }, 'BUSTED', BUSTED_TEXT, 'Walk free');

G.wasted = () =>
  finishRun('wasted', () => G.sound.busted(), 'WASTED', WASTED_TEXT, 'Leave the hospital');

G.storyComplete = () => {
  G.mode = 'complete';
  G.sound.chime();
  document.exitPointerLock?.();
  presentEnding(
    COMPLETE_TITLE,
    `${STORY.outro} — Missions done: ${G.stats.missionsDone}, cars stolen: ${G.stats.carsStolen}, near misses: ${G.stats.nearMisses}.`,
    'Keep playing (free roam)',
  );
};

// ------------------------------------------------------- cars: in & out
G.climbIn = (car, silent = false) => {
  const p = G.player;
  if (car.kind === 'police') {
    G.hudHint('Too hot — leave the cruiser alone.');
    return false;
  }
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
    raiseHeat(G, HEAT.heatStealCar, 'Grand theft auto');
    noteCarTaken(G);
  }
  if (MECHANIC.type === 'nitro') G.hudHint('Hold SHIFT for NITRO boost.');
  return true;
};

G.tryClimbIn = () => {
  const p = G.player;
  if (!p.onFoot) {
    G.climbOut();
    return;
  }
  let nearest = null;
  let nearestDist = 4.5;
  for (const car of G.cars) {
    if (!car.alive || car.kind === 'police' || car.kind === 'player') continue;
    const d = Math.hypot(car.pos.x - p.pos.x, car.pos.z - p.pos.z);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = car;
    }
  }
  if (nearest) G.climbIn(nearest);
  else G.hudHint('No car close enough — walk up to one and press E.');
};

G.climbOut = (silent = false) => {
  const p = G.player;
  if (!p.car) return;
  const car = p.car;
  p.car = null;
  p.onFoot = true;
  p.pos.set(car.pos.x - Math.sin(car.yaw) * 2.5, 0, car.pos.z - Math.cos(car.yaw) * 2.5);
  pushOutOfWalls(p.pos, 0.6, G.city.colliders);
  p.mesh.visible = true;
  p.mesh.position.copy(p.pos);
  p.yaw = car.yaw;
  car.kind = 'traffic';
  car.target = null;
  car.speed = 0;
  if (!silent) G.sound.door();
  G.sound.engineStop();
};

// --------------------------------------------------------- start / pause
G.beginGame = (fresh) => {
  document.getElementById('menu').style.display = 'none';
  document.getElementById('hud').style.display = 'block';
  document.getElementById('endscreen').style.display = 'none';
  if (fresh) {
    G.player.cash = 50;
    G.player.hp = 100;
    G.stats = newLedger();
    G.missions.index = 0;
    G.missions.state = 'waiting-hub';
    G.player.pos.set(HUB.x + 6, 0, HUB.z - 6);
    G.player.mesh.position.copy(G.player.pos);
  }
  G.mode = 'playing';
  if (G.missions.state === 'waiting-hub') markLodge(G);
  G.hudMessage(`${GAME_TITLE} — ${STORY.fixer} is waiting at the lodge.`, 'mission');
  if (G.sound.init()) {
    G.sound.musicStart();
    G.sound.engineStop();
  }
};

function setPaused(on) {
  if (on && G.mode === 'playing') {
    G.mode = 'paused';
    document.getElementById('pausemenu').style.display = 'flex';
    document.exitPointerLock?.();
  } else if (!on && G.mode === 'paused') {
    G.mode = 'playing';
    document.getElementById('pausemenu').style.display = 'none';
  }
}

// -------------------------------------------------------------- shooting
function shootables() {
  return G.peds.filter((p) => p.alive);
}

function priceShot(target) {
  if (target.kind === 'walker') {
    raiseHeat(
      G,
      target.alive ? HEAT.heatShoot : HEAT.heatHitPed,
      target.alive ? 'Shots fired' : 'Pedestrian down',
    );
    if (!target.alive) G.hudMessage('A pedestrian is down. The PD will remember that.', 'bad');
  } else if (target.kind === 'rival' && !target.alive) {
    G.player.cash += 75;
    G.hudMessage('Rival down (+$75).', 'good');
  }
}

// A fast car meeting a pedestrian, whoever is driving.
function checkRunOvers() {
  for (const car of G.cars) {
    if (!car.alive || (car.kind !== 'player' && car.kind !== 'police')) continue;
    if (Math.abs(car.speed) <= 3) continue;
    for (const ped of G.peds) {
      if (!ped.alive || ped.kind !== 'walker') continue;
      if (Math.hypot(ped.pos.x - car.pos.x, ped.pos.z - car.pos.z) >= 1.8) continue;
      ped.alive = false;
      ped.hp = 0;
      G.sound.thud();
      G.dangerPos = ped.pos.clone();
      G.dangerTimer = 2;
      if (car.kind === 'player') raiseHeat(G, HEAT.heatHitPed, 'Hit and run');
    }
  }
}

// Threading traffic at speed without touching it pays danger money.
function payNearMiss() {
  G.stats.nearMisses++;
  G.player.cash += HEAT.nearMissBonus;
  G.hudMessage(`Near miss! +$${HEAT.nearMissBonus}`, 'good');
  G.sound.cash();
}

// ------------------------------------------------------------------ boot
function makeRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  document.getElementById('game').appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.sky);
  scene.fog = new THREE.Fog(COLORS.fog, TOWN.fogNear, TOWN.fogFar);
  const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(-160, 40, 220);
  const sun = new THREE.DirectionalLight(COLORS.sun, TOWN.sunIntensity);
  sun.position.set(120, 180, 60);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(COLORS.hemiSky, COLORS.hemiGround, 1.1));
  G.scene = scene;
  G.camera = camera;
  G.renderer = renderer;
  return renderer;
}

function fillTown() {
  const scene = G.scene;
  G.city = growTown(scene);
  G.player = makeHero(scene);
  G.wanted = newHeat();
  G.combat = newArsenal();
  G.missions = newStory();
  G.hud = newHud();

  const pickNode = () => G.city.nodes[Math.floor(Math.random() * G.city.nodes.length)];
  for (let i = 0; i < CROWD.carCount; i++) {
    const node = pickNode();
    const car = summonCar(scene, node.x, node.z, Math.random() * Math.PI * 2, pickPaint(Math.random), 'traffic');
    car.target = pickNode();
    G.cars.push(car);
  }
  // Vark's own rover by the lodge: taking it is not a crime.
  const hubCar = summonCar(scene, -168, -160, Math.PI * 0.5, 0x8a7fc0, 'traffic');
  hubCar.owned = true;
  hubCar.parked = true;
  G.cars.push(hubCar);
  for (const [x, z, yaw] of [[40, -76, 0], [-100, 64, Math.PI], [140, -16, Math.PI / 2], [-30, -150, 0]]) {
    const parked = summonCar(scene, x, z, yaw, pickPaint(Math.random), 'traffic');
    parked.parked = true;
    G.cars.push(parked);
  }
  const centers = avenueLines();
  for (let i = 0; i < CROWD.pedCount; i++) {
    const pt = sidewalkSpot(centers, Math.random);
    G.peds.push(summonWalker(scene, pt.x, pt.z, Math.random));
  }
}

function bindMenus() {
  document.getElementById('btn-start').onclick = () => G.beginGame(true);
  const continueBtn = document.getElementById('btn-continue');
  if (saveExists()) {
    continueBtn.style.display = 'inline-block';
    continueBtn.onclick = () => {
      restoreSave(G, fetchSave());
      G.beginGame(false);
      G.hudMessage('Welcome back, Nadia Kaur. Professor Alden Vark is still waiting at the lodge.', 'mission');
    };
  }
  document.getElementById('btn-save').onclick = () => {
    G.saveGame();
    setPaused(false);
  };
  document.getElementById('btn-resume').onclick = () => setPaused(false);
  document.getElementById('btn-restart').onclick = () => {
    document.getElementById('pausemenu').style.display = 'none';
    G.beginGame(true);
  };
  document.getElementById('btn-quit').onclick = () => {
    setPaused(false);
    G.mode = 'menu';
    document.getElementById('menu').style.display = 'flex';
    document.getElementById('hud').style.display = 'none';
  };
  document.getElementById('menu-title').textContent = GAME_TITLE;
  document.getElementById('menu-sub').textContent = GAME_SUBTITLE;
  document.getElementById('menu-story').textContent = STORY.intro;
  const ctl = document.getElementById('controls');
  for (const [key, desc] of CONTROLS) {
    const row = document.createElement('div');
    row.innerHTML = `<b>${key}</b><span>${desc}</span>`;
    ctl.appendChild(row);
  }
}

function bindKeys(canvas) {
  const keyMap = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'run', ShiftRight: 'run', Space: 'handbrake',
  };
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') e.preventDefault();
    const mapped = keyMap[e.code];
    if (mapped) G.input[mapped] = true;
    if (e.repeat) return;
    if (e.code === 'KeyE' && G.mode === 'playing') G.tryClimbIn();
    if (e.code === 'KeyF' && G.mode === 'playing' && !G.player.onFoot && G.player.car) {
      // Horn: a blast that sends nearby pedestrians scattering.
      G.sound.horn();
      G.dangerPos = G.player.car.pos.clone();
      G.dangerTimer = 1.2;
    }
    if (e.code === 'KeyR' && G.mode === 'playing') beginReload(G);
    if (e.code === 'KeyM') document.getElementById('briefing').classList.toggle('show');
    if (e.code === 'KeyH' && G.sound.init()) {
      const on = G.sound.toggleMusic();
      G.hudMessage(on ? `Radio on — ${RADIO_NAME}.` : 'Radio off.', 'info');
    }
    if (e.code === 'KeyP' && (G.mode === 'playing' || G.mode === 'paused')) {
      setPaused(G.mode === 'playing');
    }
    if (e.code === 'Escape' && G.mode === 'playing') setPaused(true);
  });
  window.addEventListener('keyup', (e) => {
    const mapped = keyMap[e.code];
    if (mapped) G.input[mapped] = false;
  });
  canvas.addEventListener('click', () => {
    if (G.mode !== 'playing' || G.shotMode || SELFTEST) return;
    if (document.pointerLockElement !== canvas) {
      canvas.requestPointerLock();
    } else if (G.player.onFoot) {
      const result = shoot(G, shootables());
      if (result) {
        G.stats.shotsFired++;
        G.dangerPos = result.end.clone();
        G.dangerTimer = 2;
        if (result.hit) priceShot(result.hit);
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
    G.camera.aspect = window.innerWidth / window.innerHeight;
    G.camera.updateProjectionMatrix();
    G.renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function launch() {
  const renderer = makeRenderer();
  fillTown();
  bindMenus();
  bindKeys(renderer.domElement);
  if (SHOT) stageShot(G, SHOT);
  if (SELFTEST) {
    // Let the first frames compile shaders before the timed checks run.
    setTimeout(() => runChecks(G), 1500);
  }
  renderer.setAnimationLoop(tick);
}

// ------------------------------------------------------------- the frame
function tickAmbient(dt) {
  for (const car of G.cars) {
    if (car.kind === 'traffic' && !car.parked && car.alive) {
      cruiseTraffic(car, G.city.nodes, Math.random, dt, G.cars, G.city.colliders);
    }
  }
  for (const ped of G.peds) {
    if (!ped.alive) {
      topplePed(ped, dt);
    } else if (ped.kind !== 'rival') {
      walkPerson(ped, G.city.centers, Math.random, dt, G._danger || null, G.city.colliders, G.peds);
    }
  }
}

let lastT = 0;
function tick(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
  lastT = t;
  G.time += dt;
  const mouseDX = G.mouseDX;
  const mouseDY = G.mouseDY;
  G.mouseDX = 0;
  G.mouseDY = 0;
  // Recoil kick decays fast; the camera reads it each frame.
  G.recoil *= Math.exp(-6 * dt);

  if (G.mode === 'menu') {
    orbitMenuCam(G.camera, G.time);
    tickAmbient(dt);
    G.renderer.render(G.scene, G.camera);
    return;
  }
  if (G.mode !== 'playing') {
    G.renderer.render(G.scene, G.camera);
    return;
  }

  const input = G.shotInput || G.input;
  if (G.player.onFoot) {
    walkHero(G.player, input, dt, G.city.colliders);
  } else if (G.player.car) {
    drivePlayerCar(G.player.car, input, dt, G.city.colliders, G.cars, (force) => {
      G.sound.crash();
      if (force > 20) hurtPlayer(G, Math.floor(force / 8));
    }, () => payNearMiss());
    G.sound.engineSet(Math.abs(G.player.car.speed) / DRIVE.maxSpeed, true);
    // Ridge-ice warning, once per entry into the slick zone.
    const inZone = G.player.pos.x > TOWN.beachX;
    if (inZone && !G._inZone) {
      if (MECHANIC.type === 'solar') G.hudHint('SOLAR BOOST — the mirror field is feeding the motor.');
      if (MECHANIC.type === 'ice') G.hudHint('ICE — the ridge road is slick. Easy does it.');
    }
    G._inZone = inZone;
  }

  tickAmbient(dt);
  tickCruisers(G, dt);
  tickHeat(G, dt);
  tickStory(G, dt);
  checkLodge(G);
  tickArsenal(G, dt);
  tickRivals(G, dt);
  checkRunOvers();

  if (G.dangerTimer > 0) G.dangerTimer -= dt;
  G._danger = G.dangerTimer > 0 ? G.dangerPos : null;

  // Slow recovery, but only while nobody is hunting you.
  if (G.wanted.level === 0 && G.player.hp > 0 && G.player.hp < 100) {
    G.player.hp = Math.min(100, G.player.hp + dt * 2);
  }

  trackCamera(G.camera, G.player, dt, mouseDX, mouseDY, G.recoil);
  refreshHud(G, dt);
  G.renderer.render(G.scene, G.camera);
}

launch();
