// ZENITH — shots.js (fresh rewrite, round 3)
// Screenshot staging: ?shot=<name> puts the real game into a real,
// playable state — menu, busy street, police chase, mid-mission — and
// lets it run. Nothing is fake scenery; the same traffic, police and
// HUD the player gets are simply arranged for the camera.
import { spawnCar, randomCarColor } from './vehicles.js';
import { spawnPed } from './pedestrians.js';
import { startMission, MISSIONS } from './missions.js';
import { addHeat } from './wanted.js';
import { GAME_TITLE } from './config.js';

// A small linear congruential generator: staging must be identical on
// every run so the screenshots are reproducible.
function lcg(seed) {
  let s = seed >>> 0;
  return function next() {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function removeWhere(G, list, predicate) {
  for (const item of [...list]) {
    if (!predicate(item)) continue;
    item.alive = false;
    G.scene.remove(item.mesh);
    list.splice(list.indexOf(item), 1);
  }
}

function clearAmbient(G) {
  removeWhere(G, G.cars, (car) => car.kind === 'traffic');
  removeWhere(G, G.peds, (ped) => ped.kind === 'walker');
}

function clearCruisers(G) {
  removeWhere(G, G.cars, (car) => car.kind === 'police');
  G.wanted.police.length = 0;
}

// Fill an avenue with cruising cars in both lanes and walkers on the
// pavements, centred on (x, z) running along z.
function populateAvenue(G, rng, x, z, carCount) {
  for (let i = 0; i < carCount; i++) {
    const lane = (rng() < 0.5 ? -1 : 1) * 4;
    const along = (rng() - 0.5) * 160;
    const heading = rng() < 0.5 ? 0 : Math.PI;
    const car = spawnCar(G.scene, x + lane, z + along, heading, randomCarColor(rng), 'traffic');
    car.target = { x: x + lane, z: z + along + (heading === 0 ? 200 : -200) };
    G.cars.push(car);
  }
  for (let i = 0; i < 8; i++) {
    const ped = spawnPed(G.scene, x + (rng() - 0.5) * 30, z + (rng() - 0.5) * 60, rng);
    G.peds.push(ped);
  }
}

function stageStart(G) {
  G.mode = 'menu';
}

function stageStreet(G, rng) {
  // On foot at a busy downtown crossing, mission 1 live, beacon ahead.
  G.player.pos.set(-6, 0, -40);
  G.player.yaw = 0;
  G.player.mesh.position.copy(G.player.pos);
  populateAvenue(G, rng, 0, 0, 7);
  // Keep staged traffic out of the camera, which sits behind the player.
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
}

function stageDrive(G) {
  // Mid-chase: Nadia in a yellow coupe at speed, three stars, two
  // cruisers holding formation beside her so the pursuit is in frame
  // whatever the frame rate (the chase AI runs them in real play).
  const car = spawnCar(G.scene, 0, -60, 0, 0xe8c23a, 'traffic');
  car.parked = false;
  G.cars.push(car);
  G.enterCar(car, true);
  car.speed = 24;
  G.shotInput = { up: true };
  G.missions.index = 2;
  startMission(G, 2);
  clearCruisers(G);
  G.wanted.level = 3;
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
}

function stageMission(G, rng) {
  // The lens run in progress: one crate collected, the next beacon
  // ahead, one star up and a cruiser nearby.
  const pkg = MISSIONS[3].packages[1];
  G.player.pos.set(pkg.x - 20, 0, pkg.z - 20);
  G.player.yaw = Math.PI * 0.25;
  G.player.mesh.position.copy(G.player.pos);
  populateAvenue(G, rng, pkg.x - 30, pkg.z - 30, 4);
  G.missions.index = 3;
  startMission(G, 3);
  G.missions.collected = 1;
  G.missions.packageIndex = 1;
  G.missions.beaconPos = { x: pkg.x, z: pkg.z };
  const firstPkg = G.missions.pkgMeshes[0];
  if (firstPkg) G.scene.remove(firstPkg);
  addHeat(G, 1, 'Speeding past a cruiser');
  const cop = spawnCar(G.scene, pkg.x - 40, pkg.z - 50, Math.PI * 0.5, 0x14181c, 'police');
  G.cars.push(cop);
  G.wanted.police.push(cop);
  G.player.cash = 820;
}

const STAGERS = {
  start: stageStart,
  street: stageStreet,
  drive: stageDrive,
  mission: stageMission,
};

export function applyShot(G, name) {
  const rng = lcg(1337);
  G.shotMode = true;
  document.title = `${GAME_TITLE} — shot: ${name}`;
  clearAmbient(G);
  document.getElementById('hud').style.display = name === 'start' ? 'none' : 'block';
  if (name === 'start') {
    stageStart(G);
    return;
  }
  G.startGame(false);
  G.hud.el.hint.style.opacity = '0';
  const stage = STAGERS[name];
  if (stage) stage(G, rng);
}

export const SHOT_NAMES = ['start', 'street', 'drive', 'mission'];
