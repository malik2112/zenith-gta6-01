// ZENITH — vehicles.js (round 3 redo)
// Everything with wheels: how a car looks, how the player's car drives
// (throttle, brakes, steering, handbrake, and the ridge-ice drift), how
// traffic cruises the intersection graph in its lane, and how a cruiser
// cuts the corner to intercept you. Arcade, not simulation — but the
// drift model is real: the car has a facing and a direction of travel,
// and grip is what pulls the second back in line with the first.
// New here: brake lights that flare when you brake, and a near-miss
// bonus for threading traffic at speed.
import * as THREE from 'three';
import { DRIVE, COLORS, TOWN, MECHANIC, HEAT } from './config.js';
import { pushOutOfWalls } from './city.js';

let nextCarId = 0;

// ------------------------------------------------------------------ meshes
export function buildCarBody(color, isPolice = false) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const trim = new THREE.MeshLambertMaterial({ color: 0x1a2027 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fc4e0 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 4.4), paint);
  body.position.y = 0.55;
  group.add(body);
  // Bumpers front and rear, slightly wider than the body.
  for (const bz of [2.28, -2.28]) {
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.34, 0.24), trim);
    bumper.position.set(0, 0.42, bz);
    group.add(bumper);
  }
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.55, 2.2), glass);
  cabin.position.set(0, 1.1, -0.2);
  group.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 2.3), paint);
  roof.position.set(0, 1.4, -0.2);
  group.add(roof);
  // A hood scoop so the player's car reads at a glance in traffic.
  const scoop = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 1.1), trim);
  scoop.position.set(0, 0.92, 1.1);
  group.add(scoop);
  // Mirrors on stalks.
  for (const sx of [-1.08, 1.08]) {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.22), trim);
    mirror.position.set(sx, 1.05, 0.75);
    group.add(mirror);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0x881111 });
  const tails = [];
  for (const sx of [-0.7, 0.7]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), headMat);
    head.position.set(sx, 0.6, 2.21);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), tailMat);
    tail.position.set(sx, 0.6, -2.21);
    group.add(tail);
    tails.push(tail);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14181c });
  const hubMat = new THREE.MeshLambertMaterial({ color: 0x9aa2ac });
  const wheels = [];
  for (const [wx, wz] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const wheel = new THREE.Group();
    const tyre = new THREE.Mesh(wheelGeo, wheelMat);
    tyre.rotation.z = Math.PI / 2;
    wheel.add(tyre);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.32, 8), hubMat);
    hub.rotation.z = Math.PI / 2;
    wheel.add(hub);
    wheel.position.set(wx, 0.36, wz);
    group.add(wheel);
    wheels.push(wheel);
  }
  let lightBar = null;
  if (isPolice) {
    const bar = new THREE.Group();
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }),
    );
    red.position.x = -0.4;
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.4),
      new THREE.MeshBasicMaterial({ color: 0x2244ff }),
    );
    blue.position.x = 0.4;
    bar.add(red, blue);
    bar.position.set(0, 1.55, -0.2);
    group.add(bar);
    lightBar = { red, blue };
  }
  return { group, wheels, lightBar, tails };
}

export function summonCar(scene, x, z, yaw, color, kind = 'traffic') {
  const { group, wheels, lightBar, tails } = buildCarBody(color, kind === 'police');
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  scene.add(group);
  return {
    id: ++nextCarId,
    kind,
    mesh: group,
    wheels,
    lightBar,
    tails,
    pos: new THREE.Vector3(x, 0, z),
    yaw,
    velAngle: yaw, // direction of travel; lags yaw while drifting
    speed: 0,
    boost: 100,
    boosting: false,
    steer: 0,
    target: null,
    waitTimer: 0,
    stuckTimer: 0,
    lastPos: new THREE.Vector3(x, 0, z),
    alive: true,
    flashT: Math.random() * 10,
    nmSeen: {}, // near-miss cooldowns, keyed by other car id
  };
}

export function spinWheels(car, dt) {
  const turn = (car.speed * dt) / 0.36;
  for (const wheel of car.wheels) wheel.rotation.x += turn;
}

function syncMesh(car) {
  car.mesh.position.copy(car.pos);
  car.mesh.rotation.y = car.yaw;
}

// Shortest signed turn from angle `from` to angle `to`, in (-PI, PI].
function angleDelta(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Brake lights flare while the brakes are on, dim otherwise.
export function setBrakeLights(car, braking) {
  if (!car.tails) return;
  const hex = braking ? 0xff2a22 : 0x881111;
  for (const tail of car.tails) tail.material.color.setHex(hex);
}

// ----------------------------------------------------------------- traffic
// Traffic keeps to the right-hand lane: the waypoint is the intersection
// centre shifted sideways, perpendicular to the direction of travel.
function laneWaypoint(car, node) {
  const dx = node.x - car.pos.x;
  const dz = node.z - car.pos.z;
  const len = Math.hypot(dx, dz) || 1;
  const lane = 3.6;
  return { x: node.x + (dz / len) * lane, z: node.z - (dx / len) * lane };
}

function pickNextNode(car, nodes, rng) {
  // Stay on the road graph: next node shares the current street.
  const alongX = nodes.filter((n) => Math.abs(n.x - car.pos.x) < 6 && Math.abs(n.z - car.pos.z) > 1);
  const alongZ = nodes.filter((n) => Math.abs(n.z - car.pos.z) < 6 && Math.abs(n.x - car.pos.x) > 1);
  const pool = alongX.length || alongZ.length ? [...alongX, ...alongZ] : nodes;
  car.target = laneWaypoint(car, pool[Math.floor(rng() * pool.length)]);
}

export function cruiseTraffic(car, nodes, rng, dt, allCars, colliders) {
  if (!car.target) pickNextNode(car, nodes, rng);
  const t = car.target;
  const dist = Math.hypot(t.x - car.pos.x, t.z - car.pos.z);
  if (dist < 3.5) {
    pickNextNode(car, nodes, rng);
    return;
  }
  const wantYaw = Math.atan2(t.x - car.pos.x, t.z - car.pos.z);
  car.yaw += Math.max(-1.6 * dt, Math.min(1.6 * dt, angleDelta(car.yaw, wantYaw)));
  // Brake for anything slow or stopped in the lane ahead.
  let blocked = false;
  const fx = Math.sin(car.yaw);
  const fz = Math.cos(car.yaw);
  for (const other of allCars) {
    if (other === car || !other.alive) continue;
    const ox = other.pos.x - car.pos.x;
    const oz = other.pos.z - car.pos.z;
    if (Math.hypot(ox, oz) < 9 && ox * fx + oz * fz > 0) {
      blocked = true;
      break;
    }
  }
  const cruise = blocked ? 0 : 10;
  car.speed += (cruise - car.speed) * Math.min(1, dt * 2);
  car.velAngle = car.yaw;
  car.pos.x += fx * car.speed * dt;
  car.pos.z += fz * car.speed * dt;
  pushOutOfWalls(car.pos, DRIVE.radius, colliders);
  setBrakeLights(car, blocked && car.speed > 1);
  syncMesh(car);
  spinWheels(car, dt);
}

// ------------------------------------------------------------- player car
// Longitudinal: throttle eases off near the top speed, S brakes then
// reverses, coasting bleeds speed. Lateral: the steering turns the nose;
// the travel direction follows at a rate set by grip — generous on dry
// asphalt, lazy on the ridge ice, laziest with the handbrake held.
export function drivePlayerCar(car, input, dt, colliders, allCars, onCrash, onNearMiss) {
  const throttle = (input.up ? 1 : 0) - (input.down ? 1 : 0);
  const steerIn = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const hand = !!input.handbrake;
  const onIce = MECHANIC.type === 'ice' && car.pos.x > TOWN.beachX;

  let topSpeed = DRIVE.maxSpeed;
  let accel = DRIVE.accel;
  car.boosting = false;
  if (MECHANIC.type === 'nitro' && input.run && car.boost > 0) {
    topSpeed *= 1.35;
    accel *= 1.5;
    car.boost = Math.max(0, car.boost - dt * 30);
    car.boosting = true;
  } else if (car.boost !== undefined) {
    car.boost = Math.min(100, car.boost + dt * 8);
  }
  if (MECHANIC.type === 'solar' && car.pos.x > TOWN.beachX) topSpeed *= 1.3;

  // Steering: more lock at speed, flipped in reverse, sharper on the brake.
  const speedFrac = Math.min(1, Math.abs(car.speed) / topSpeed);
  const lock = (hand ? DRIVE.handbrakeTurn : DRIVE.turnRate) * (0.35 + 0.65 * speedFrac);
  const steerGoal = steerIn * lock * (car.speed < -0.5 ? -1 : 1);
  const steerRate = onIce ? 4 : 8;
  car.steer += (steerGoal - car.steer) * Math.min(1, dt * steerRate);
  car.yaw += car.steer * dt * Math.min(1, Math.abs(car.speed) / 6 + 0.15);

  // Travel direction chases the nose; grip is the chase rate.
  let gripRate = DRIVE.grip;
  if (onIce) gripRate *= 0.45;
  if (hand) gripRate *= 0.4;
  car.velAngle += angleDelta(car.velAngle, car.yaw) * Math.min(1, dt * gripRate);

  // Longitudinal forces.
  const braking = throttle < 0 && car.speed > 0.5;
  if (throttle > 0) {
    car.speed += accel * dt * (1 - speedFrac * 0.75);
  } else if (throttle < 0) {
    car.speed -= (car.speed > 0.5 ? DRIVE.brake : accel * 0.6) * dt;
  } else {
    car.speed -= car.speed * Math.min(1, dt * (hand ? 2.2 : 0.7));
  }
  car.speed = Math.max(-DRIVE.reverseMax, Math.min(topSpeed, car.speed));
  if (Math.abs(car.speed) < 0.05 && throttle === 0) car.speed = 0;
  setBrakeLights(car, braking || hand);

  car.pos.x += Math.sin(car.velAngle) * car.speed * dt;
  car.pos.z += Math.cos(car.velAngle) * car.speed * dt;

  // Walls: scrub most of the speed, report hard hits as crashes.
  if (pushOutOfWalls(car.pos, DRIVE.radius, colliders)) {
    const impact = Math.abs(car.speed);
    car.speed *= 0.35;
    car.velAngle = car.yaw;
    if (impact > 14 && onCrash) onCrash(impact);
  }
  // Other cars: soft two-body shove, traffic loses more speed than you do.
  // A fast, close pass that is NOT a touch is a near miss — danger money.
  const now = Date.now() / 1000;
  for (const other of allCars) {
    if (other === car || !other.alive) continue;
    const dx = car.pos.x - other.pos.x;
    const dz = car.pos.z - other.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 3.4 && d > 0.001) {
      const push = (3.4 - d) / 2;
      car.pos.x += (dx / d) * push;
      car.pos.z += (dz / d) * push;
      other.pos.x -= (dx / d) * push;
      other.pos.z -= (dz / d) * push;
      if (other.kind === 'traffic') other.speed *= 0.6;
      if (Math.abs(car.speed) > 10 && onCrash) onCrash(Math.abs(car.speed) * 0.5);
      car.speed *= 0.92;
    } else if (
      onNearMiss && other.kind === 'traffic' && Math.abs(car.speed) > HEAT.nearMissMinSpeed &&
      d < 3.4 + HEAT.nearMissGap && d >= 3.4 &&
      (car.nmSeen[other.id] || 0) + HEAT.nearMissCooldown < now
    ) {
      car.nmSeen[other.id] = now;
      onNearMiss(other);
    }
  }
  car.pos.x = Math.max(-TOWN.boundZ, Math.min(TOWN.boundX, car.pos.x));
  car.pos.z = Math.max(-TOWN.boundZ, Math.min(TOWN.boundZ, car.pos.z));
  syncMesh(car);
  spinWheels(car, dt);
}

// ------------------------------------------------------------------ police
// A cruiser does not aim at where you are; it aims at where you will be,
// leading the target by the time it needs to get there.
export function chasePolice(car, playerPos, dt, colliders, allCars, onRam) {
  // Estimate the player's velocity from successive sightings.
  if (!car._seenPos) car._seenPos = playerPos.clone();
  const pvx = dt > 0 ? (playerPos.x - car._seenPos.x) / dt : 0;
  const pvz = dt > 0 ? (playerPos.z - car._seenPos.z) / dt : 0;
  car._seenPos.copy(playerPos);

  const distNow = Math.hypot(playerPos.x - car.pos.x, playerPos.z - car.pos.z);
  const lead = Math.min(1.2, distNow / 30);
  const aimX = playerPos.x + pvx * lead;
  const aimZ = playerPos.z + pvz * lead;
  const wantYaw = Math.atan2(aimX - car.pos.x, aimZ - car.pos.z);
  car.yaw += Math.max(-2.4 * dt, Math.min(2.4 * dt, angleDelta(car.yaw, wantYaw)));

  const chaseSpeed = distNow > 4 ? Math.min(34, 16 + distNow * 0.35) : 6;
  car.speed += (chaseSpeed - car.speed) * Math.min(1, dt * 1.6);
  car.velAngle = car.yaw;
  car.pos.x += Math.sin(car.yaw) * car.speed * dt;
  car.pos.z += Math.cos(car.yaw) * car.speed * dt;
  pushOutOfWalls(car.pos, DRIVE.radius, colliders);
  if (distNow < 3.6 && onRam) onRam(car);
  syncMesh(car);
  spinWheels(car, dt);

  car.flashT += dt * 6;
  if (car.lightBar) {
    const phase = Math.sin(car.flashT) > 0;
    car.lightBar.red.material.color.setHex(phase ? 0xff2222 : 0x551111);
    car.lightBar.blue.material.color.setHex(phase ? 0x111155 : 0x2244ff);
  }
}

export function pickPaint(rng) {
  return COLORS.carPaint[Math.floor(rng() * COLORS.carPaint.length)];
}
