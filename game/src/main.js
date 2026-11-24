// ZENITH — boot and main loop. Wires every module into one `world` object,
// runs the frame loop, follows the player with a third-person camera, and
// exposes the ready flags headless runs wait for.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { buildCity } from './city.js';
import { Player } from './player.js';
import { Vehicles } from './vehicles.js';
import { Pedestrians } from './pedestrians.js';
import { Combat } from './combat.js';
import { Wanted } from './wanted.js';
import { Missions } from './missions.js';
import { Hud } from './hud.js';
import { GameAudio } from './audio.js';
import { loadSave, writeSave } from './save.js';
import { runSelfTest } from './selftest.js';
import { stageShot, shotFromUrl, selftestFromUrl } from './shots.js';

const params = new URLSearchParams(window.location.search);
const SHOT = shotFromUrl();
const SELFTEST = selftestFromUrl();

function boot() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 30, 90);

  // Sunset lighting: low warm sun + purple sky fill.
  const sun = new THREE.DirectionalLight(CONFIG.sunColor, CONFIG.sunIntensity);
  sun.position.set(-180, 90, -120);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 700;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(CONFIG.hemiSky, CONFIG.hemiGround, CONFIG.hemiIntensity));

  const world = {
    THREE,
    renderer,
    scene,
    camera,
    state: 'menu', // menu | playing | paused | busted
    money: 250,
    time: 0,
    camYaw: Math.PI,
    camPitch: 0.32,
    shotName: SHOT,
    shotFrames: 0,
    save: loadSave(),
    keys: {},
  };
  world.money = world.save.money;

  world.city = buildCity(THREE, scene);
  world.player = new Player(THREE, scene, world.city.spawn.player);
  world.player.health = CONFIG.startHealth;
  world.vehicles = new Vehicles(THREE, scene, world.city);
  world.peds = new Pedestrians(THREE, scene, world.city, 14);
  world.combat = new Combat(THREE, scene, camera);
  world.audio = new GameAudio();
  world.audio.station = world.save.radio || 0;
  world.audio.setMuted(!!world.save.muted);
  world.hud = new Hud(world);
  world.wanted = new Wanted(world);
  world.missions = new Missions(THREE, scene, world);

  world.stageShot = (name) => stageShot(name, world);
  world.saveGame = () => {
    world.save.money = world.money;
    world.save.missionIndex = world.missions.index;
    world.save.muted = world.audio.muted;
    world.save.radio = world.audio.station;
    world.save.shotsFired = world.combat.shotsFired;
    world.save.bestMoney = Math.max(world.save.bestMoney || 0, world.money);
    writeSave(world.save);
  };
  world.resume = () => {
    if (world.state === 'paused') {
      world.state = 'playing';
      world.hud.hidePause();
    }
  };
  world.resumeFromBusted = () => {
    world.hud.hideBusted();
    world.state = 'playing';
    world.hud.showBanner('BACK ON THE STREET', 'Lay low. The heat is off — for now.');
  };
  world.toMenu = () => {
    world.state = 'menu';
    world.hud.hidePause();
    world.hud.showMenu();
  };
  world.startGame = () => {
    world.audio.ensure();
    world.audio.blip(660);
    world.state = 'playing';
    world.hud.hideMenu();
    if (world.missions.current()) {
      world.hud.setObjective(world.missions.current().brief);
    }
  };

  // ---- input ----
  window.addEventListener('keydown', (e) => {
    if (e.code === CONFIG.keys.pause && world.state === 'playing') {
      world.state = 'paused';
      world.hud.showPause();
      return;
    }
    if (e.code === CONFIG.keys.pause && world.state === 'paused') {
      world.resume();
      return;
    }
    world.keys[e.code] = true;
    if (e.code === CONFIG.keys.reload) world.combat.startReload();
    if (e.code === CONFIG.keys.mute) {
      world.audio.ensure();
      world.audio.setMuted(!world.audio.muted);
      world.hud.toast(world.audio.muted ? 'Sound muted' : 'Sound on');
      world.saveGame();
    }
    if (e.code === CONFIG.keys.radioNext) {
      world.audio.ensure();
      world.hud.setRadio(world.audio.nextStation());
      world.hud.toast(`Radio: ${world.audio.stationName()}`);
    }
    if (e.code === CONFIG.keys.enterCar && world.state === 'playing') {
      if (world.player.onFoot) {
        const car = world.vehicles.nearestCar(world.player.pos, 3.4);
        if (car) {
          car.driver = 'player';
          world.player.enterCar(car);
          world.audio.blip(440);
          if (car.driver === 'player' && world.missions.current()?.type === 'steal') {
            world.wanted.addHeat(CONFIG.heatStealCar);
          }
          world.hud.toast('Car taken. Drive!');
        }
      } else {
        const car = world.player.exitCar();
        if (car) car.driver = 'parked';
        world.audio.blip(330);
      }
    }
  });
  window.addEventListener('keyup', (e) => {
    world.keys[e.code] = false;
  });
  window.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (world.state === 'menu') return; // the START button handles menu clicks
    if (world.state !== 'playing') return;
    if (!world.player.onFoot) return;
    world.audio.ensure();
    const hit = world.combat.shoot(world);
    if (hit) {
      if (hit.kind === 'empty') world.hud.toast('Click — empty! Press R to reload.');
      else world.audio.gunshot();
      if (hit.kind === 'ped' || hit.kind === 'police') {
        world.hud.toast(hit.kind === 'ped' ? 'Target down.' : 'You shot a cop car!');
      }
    }
  });
  world.hud.startBtn.addEventListener('click', () => world.startGame());
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ---- staging / self-test ----
  if (SHOT) {
    stageShot(SHOT, world);
  }
  if (SELFTEST) {
    // Let one frame render first so the checks see a live scene.
    setTimeout(() => runSelfTest(world), 600);
  }

  const clock = new THREE.Clock();
  let frames = 0;
  let saveTimer = 0;
  window.__zenithReady = false;
  window.__shotReady = false;

  function readInput() {
    const k = world.keys;
    const input = {
      f: !!k[CONFIG.keys.forward],
      b: !!k[CONFIG.keys.back],
      l: !!k[CONFIG.keys.left],
      r: !!k[CONFIG.keys.right],
      run: !!k[CONFIG.keys.run],
    };
    // Staged drive shot: hold the accelerator so the car is still moving
    // (and the engine note is up) when the screenshot is taken.
    if (world.shotName === 'drive') input.f = true;
    return input;
  }

  function updateCamera(dt) {
    const target = world.player.onFoot
      ? world.player.pos
      : world.vehicles.playerCar()
        ? world.vehicles.playerCar().pos
        : world.player.pos;
    if (world.state === 'menu') {
      // Slow orbit over the plaza for the title screen.
      const a = world.time * 0.05;
      camera.position.set(Math.cos(a) * 120, 46, Math.sin(a) * 120);
      camera.lookAt(0, 8, 0);
      return;
    }
    if (!world.shotName) {
      // Follow the player's heading, smoothed.
      let diff = world.player.heading - world.camYaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      world.camYaw += diff * Math.min(1, dt * 4);
    }
    const fx = Math.sin(world.camYaw);
    const fz = Math.cos(world.camYaw);
    const dist = world.player.onFoot ? 9 : 13;
    const height = world.player.onFoot ? 4.2 : 5.4;
    camera.position.set(
      target.x - fx * dist,
      height,
      target.z - fz * dist
    );
    camera.lookAt(target.x + fx * 6, 1.8, target.z + fz * 6);
  }

  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, clock.getDelta());
    world.time += dt;
    frames += 1;
    const input = readInput();

    if (world.state === 'playing') {
      world.player.update(dt, input, world.camYaw, world.city.colliders, world.city.bounds);
      world.vehicles.update(dt, input, world.player, world.player.pos);
      world.peds.update(dt);
      world.combat.update(dt);
      world.wanted.update(dt);
      world.missions.update(dt, world.time);
      const car = world.vehicles.playerCar();
      world.audio.engine(car ? Math.abs(car.speed) / CONFIG.carMaxSpeed : 0);
      world.audio.update(dt, !!car);
      saveTimer += dt;
      if (saveTimer > 30) {
        saveTimer = 0;
        world.saveGame();
      }
    } else if (world.state === 'menu') {
      world.peds.update(dt);
      world.vehicles.update(dt, { f: false, b: false, l: false, r: false }, world.player, null);
    } else {
      // paused / busted: freeze the world, keep rendering.
      world.combat.update(dt);
    }

    world.hud.setHealth(world.player.health);
    world.hud.setAmmo(world.combat.ammo, world.combat.magSize, world.combat.reloading);
    world.hud.update(dt);
    updateCamera(dt);
    renderer.render(scene, camera);

    if (frames === 3) {
      window.__zenithReady = true;
      document.title = 'ZENITH — Open-World Crime';
    }
    if (world.shotName && !window.__shotReady) {
      world.shotFrames += 1;
      if (world.shotFrames >= 45) window.__shotReady = true;
    }
  }
  loop();
  return world;
}

window.__zenithWorld = boot();
