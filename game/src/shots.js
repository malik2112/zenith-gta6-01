// ZENITH — shots.js
// One job: stage the game for its screenshots. ?shot=<name> drops the real
// game into a real, playable state — a menu, a street, a chase, a mission —
// and lets it run, so every screenshot is a true render of the game's code.
// Nothing here is fake scenery: the same systems, traffic, police and HUD
// the player gets, arranged for the camera.
import { spawnCar, randomCarColor } from './vehicles.js';
import { spawnPed } from './pedestrians.js';
import { startMission } from './missions.js';
import { addHeat } from './wanted.js';
import { MISSIONS } from './missions.js';
import { GAME_TITLE } from './config.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clearTraffic(G) {
  for (const car of [...G.cars]) {
    if (car.kind === 'traffic') {
      car.alive = false;
      G.scene.remove(car.mesh);
      G.cars.splice(G.cars.indexOf(car), 1);
    }
  }
  for (const p of [...G.peds]) {
    if (p.kind === 'walker') {
      p.alive = false;
      G.scene.remove(p.mesh);
      G.peds.splice(G.peds.indexOf(p), 1);
    }
  }
}

function clearPolice(G) {
  for (const cop of [...G.wanted.police]) {
    cop.alive = false;
    G.scene.remove(cop.mesh);
    const i = G.cars.indexOf(cop);
    if (i >= 0) G.cars.splice(i, 1);
  }
  G.wanted.police.length = 0;
}

function stageStreet(G, rng, x, z, count, heading) {
  // a busy avenue: cars on the road, walkers on the pavement
  for (let i = 0; i < count; i++) {
    const lane = (rng() < 0.5 ? -1 : 1) * 4;
    const along = (rng() - 0.5) * 160;
    const car = spawnCar(G.scene, x + lane, z + along, heading + (rng() < 0.5 ? 0 : Math.PI), randomCarColor(rng), 'traffic');
    car.target = { x: x + lane, z: z + along + (heading === 0 ? 200 : -200) };
    G.cars.push(car);
  }
  for (let i = 0; i < 8; i++) {
    const p = spawnPed(G.scene, x + (rng() - 0.5) * 30, z + (rng() - 0.5) * 60, rng);
    G.peds.push(p);
  }
}

export function applyShot(G, name) {
  const rng = mulberry32(1337);
  G.shotMode = true;
  document.title = GAME_TITLE + ' — shot: ' + name;
  clearTraffic(G);
  const showHud = name !== 'start';
  document.getElementById('hud').style.display = showHud ? 'block' : 'none';

  if (name === 'start') {
    G.mode = 'menu';
    return;
  }

  // every other shot: the game is already running
  G.startGame(false);
  G.hud.el.hint.style.opacity = '0';

  if (name === 'street') {
    // on foot at a busy downtown crossing, mission 1 live, beacon ahead
    G.player.pos.set(-6, 0, -40);
    G.player.yaw = 0;
    G.player.mesh.position.copy(G.player.pos);
    stageStreet(G, rng, 0, 0, 7, 0);
    // keep staged traffic out of the camera (it sits ~7m behind the player)
    for (const car of G.cars) {
      if (car.kind !== 'traffic') continue;
      if (Math.hypot(car.pos.x - G.player.pos.x, car.pos.z - G.player.pos.z) < 14) {
        car.pos.z += 30;
        car.mesh.position.copy(car.pos);
        if (car.target) car.target.z += 30;
      }
    }
    startMission(G, 0);
    G.player.cash = 50;
  } else if (name === 'drive') {
    // mid-chase: Nadia Kaur in a yellow coupe at speed, 3 stars, two cruisers on them
    const car = spawnCar(G.scene, 0, -60, 0, 0xe8c23a, 'traffic');
    car.parked = false;
    G.cars.push(car);
    G.enterCar(car, true);
    car.speed = 24;
    G.shotInput = { up: true };
    G.missions.index = 2;
    startMission(G, 2);
    // restage the pursuit: exactly two cruisers flanking the player, 3 stars.
    // They hold formation beside Nadia Kaur (shotFollow) so the chase is in frame
    // at screenshot time whatever the frame rate; the chase AI runs them in
    // real play, this staging only frames the shot.
    clearPolice(G);
    G.wanted.level = 3; // mission 3 starts at 2; the chase shot wants 3 stars
    G.wanted.quietTimer = 0;
    G.sound.sirenStart();
    G.wanted.sirenOn = true;
    for (const [dx, dz] of [[-5, 2], [5, 7]]) {
      const cop = spawnCar(G.scene, dx, -60 + dz, 0, 0x14181c, 'police');
      cop.shotFollow = { dx, dz };
      G.cars.push(cop);
      G.wanted.police.push(cop);
    }
    G.player.cash = 1250;
  } else if (name === 'mission') {
    // package run in progress: one collected, next beacon ahead, a cruiser near
    const pkg = MISSIONS[3].packages[1];
    G.player.pos.set(pkg.x - 20, 0, pkg.z - 20);
    G.player.yaw = Math.PI * 0.25;
    G.player.mesh.position.copy(G.player.pos);
    stageStreet(G, rng, pkg.x - 30, pkg.z - 30, 4, 0);
    G.missions.index = 3;
    startMission(G, 3);
    G.missions.collected = 1;
    G.missions.packageIndex = 1;
    G.missions.beaconPos = { x: pkg.x, z: pkg.z };
    const firstPkg = G.missions.pkgMeshes[0];
    if (firstPkg) G.scene.remove(firstPkg); // already collected: no beacon left
    addHeat(G, 1, 'Speeding past a cruiser');
    const cop = spawnCar(G.scene, pkg.x - 40, pkg.z - 50, Math.PI * 0.5, 0x14181c, 'police');
    G.cars.push(cop);
    G.wanted.police.push(cop);
    G.player.cash = 820;
  }
}

export const SHOT_NAMES = ['start', 'street', 'drive', 'mission'];
