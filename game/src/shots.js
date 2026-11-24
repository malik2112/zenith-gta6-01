// ZENITH — shots.js (round 3 redo)
// Screenshot staging: ?shot=<name> puts the real game into a real,
// playable state — menu, busy street, police chase, mid-mission — and
// lets it run. Nothing is fake scenery; the same traffic, police and
// HUD the player gets are simply arranged for the camera.
import { summonCar, pickPaint } from './vehicles.js';
import { summonWalker } from './pedestrians.js';
import { beginJob, MISSIONS } from './missions.js';
import { raiseHeat } from './wanted.js';
import { GAME_TITLE } from './config.js';

// A small mulberry32 generator: staging must be identical on every run
// so the screenshots are reproducible.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dropWhere(G, list, predicate) {
  for (const item of [...list]) {
    if (!predicate(item)) continue;
    item.alive = false;
    G.scene.remove(item.mesh);
    list.splice(list.indexOf(item), 1);
  }
}

function sweepAmbient(G) {
  dropWhere(G, G.cars, (car) => car.kind === 'traffic');
  dropWhere(G, G.peds, (ped) => ped.kind === 'walker');
}

function sweepCruisers(G) {
  dropWhere(G, G.cars, (car) => car.kind === 'police');
  G.wanted.police.length = 0;
}

// Fill an avenue with cruising cars in both lanes and walkers on the
// pavements, centred on (x, z) running along z.
function fillAvenue(G, rng, x, z, carCount) {
  for (let i = 0; i < carCount; i++) {
    const lane = (rng() < 0.5 ? -1 : 1) * 4;
    const along = (rng() - 0.5) * 160;
    const heading = rng() < 0.5 ? 0 : Math.PI;
    const car = summonCar(G.scene, x + lane, z + along, heading, pickPaint(rng), 'traffic');
    car.target = { x: x + lane, z: z + along + (heading === 0 ? 200 : -200) };
    G.cars.push(car);
  }
  for (let i = 0; i < 9; i++) {
    const ped = summonWalker(G.scene, x + (rng() - 0.5) * 30, z + (rng() - 0.5) * 60, rng);
    G.peds.push(ped);
  }
}

function stageStart(G) {
  G.mode = 'menu';
}

function stageStreet(G, rng) {
  // On foot on the avenue itself, facing the oncoming lane: traffic and
  // walkers fill the frame ahead, mission 1 live, beacon on the ridge.
  G.player.pos.set(4, 0, 30);
  G.player.yaw = Math.PI;
  G.player.mesh.position.copy(G.player.pos);
  fillAvenue(G, rng, 0, -10, 8);
  // Keep staged traffic out of the camera, which sits behind the player.
  for (const car of G.cars) {
    if (car.kind !== 'traffic') continue;
    if (Math.hypot(car.pos.x - G.player.pos.x, car.pos.z - G.player.pos.z) < 8) {
      car.pos.z -= 24;
      car.mesh.position.copy(car.pos);
      if (car.target) car.target.z -= 24;
    }
  }
  beginJob(G, 0);
  G.player.cash = 75;
}

function stageDrive(G) {
  // Mid-chase: Nadia in a blue coupe at speed, three stars, two
  // cruisers holding formation beside her so the pursuit is in frame
  // whatever the frame rate (the chase AI runs them in real play).
  const car = summonCar(G.scene, 0, -40, 0, 0x2e6fc2, 'traffic');
  car.parked = false;
  car.owned = true; // staged getaway car: no theft-heat line in the feed
  G.cars.push(car);
  G.climbIn(car, true);
  car.speed = 26;
  G.shotInput = { up: true };
  G.missions.index = 2;
  beginJob(G, 2);
  sweepCruisers(G);
  G.wanted.level = 3;
  G.wanted.quietTimer = 0;
  G.sound.sirenStart();
  G.wanted.sirenOn = true;
  for (const [dx, dz] of [[-5.5, 3], [5.5, 8]]) {
    const cop = summonCar(G.scene, dx, -40 + dz, 0, 0x14181c, 'police');
    cop.shotFollow = { dx, dz };
    G.cars.push(cop);
    G.wanted.police.push(cop);
  }
  G.player.cash = 1400;
}

function stageMission(G, rng) {
  // The lens run in progress: one crate collected, the next beacon
  // ahead, one star up and a cruiser nearby.
  const pkg = MISSIONS[3].packages[1];
  G.player.pos.set(pkg.x - 24, 0, pkg.z - 16);
  G.player.yaw = Math.PI * 0.3;
  G.player.mesh.position.copy(G.player.pos);
  fillAvenue(G, rng, pkg.x - 30, pkg.z - 30, 5);
  G.missions.index = 3;
  beginJob(G, 3);
  G.missions.collected = 1;
  G.missions.packageIndex = 1;
  G.missions.beaconPos = { x: pkg.x, z: pkg.z };
  const firstPkg = G.missions.pkgMeshes[0];
  if (firstPkg) G.scene.remove(firstPkg);
  raiseHeat(G, 1, 'Speeding past a cruiser');
  const cop = summonCar(G.scene, pkg.x - 44, pkg.z - 46, Math.PI * 0.5, 0x14181c, 'police');
  G.cars.push(cop);
  G.wanted.police.push(cop);
  G.player.cash = 940;
}

const STAGE_BOOK = {
  start: stageStart,
  street: stageStreet,
  drive: stageDrive,
  mission: stageMission,
};

export function stageShot(G, name) {
  const rng = mulberry32(4242);
  G.shotMode = true;
  document.title = `${GAME_TITLE} — shot: ${name}`;
  sweepAmbient(G);
  document.getElementById('hud').style.display = name === 'start' ? 'none' : 'block';
  if (name === 'start') {
    stageStart(G);
    return;
  }
  G.beginGame(false);
  G.hud.el.hint.style.opacity = '0';
  const stage = STAGE_BOOK[name];
  if (stage) stage(G, rng);
}

export const SHOT_NAMES = ['start', 'street', 'drive', 'mission'];
