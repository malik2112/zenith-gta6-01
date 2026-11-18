// ZENITH — vehicles.js
// One job: cars. Building car meshes, arcade driving physics for the player's
// car, the traffic AI that cruises the road graph, and the police AI that
// chases the player. No real physics engine — simple, fun, predictable.
import * as THREE from 'three';
import { CAR, PALETTE, CITY, MECHANIC } from './config.js';
import { collideCircle } from './city.js';

let carId = 0;

export function makeCarMesh(color, isPolice = false) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a2027 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fc4e0 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.62, 4.4), paint);
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.55, 2.2), glass);
  cabin.position.set(0, 1.1, -0.2);
  g.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 2.3), paint);
  roof.position.set(0, 1.4, -0.2);
  g.add(roof);
  // headlights + taillights
  const hl = new THREE.MeshBasicMaterial({ color: 0xfff6c8 });
  const tl = new THREE.MeshBasicMaterial({ color: 0xff2a22 });
  for (const sx of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), hl);
    h.position.set(sx, 0.6, 2.21);
    g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), tl);
    t.position.set(sx, 0.6, -2.21);
    g.add(t);
  }
  // wheels
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14181c });
  const wheels = [];
  for (const [wx, wz] of [[-1.0, 1.45], [1.0, 1.45], [-1.0, -1.45], [1.0, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w);
    wheels.push(w);
  }
  let lightBar = null;
  if (isPolice) {
    const bar = new THREE.Group();
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    r.position.x = -0.4;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4),
      new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    b.position.x = 0.4;
    bar.add(r); bar.add(b);
    bar.position.set(0, 1.55, -0.2);
    g.add(bar);
    lightBar = { red: r, blue: b };
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return { group: g, wheels, lightBar };
}

export function spawnCar(scene, x, z, yaw, color, kind = 'traffic') {
  const isPolice = kind === 'police';
  const { group, wheels, lightBar } = makeCarMesh(color, isPolice);
  group.position.set(x, 0, z);
  group.rotation.y = yaw;
  scene.add(group);
  const car = {
    id: ++carId,
    kind,
    mesh: group,
    wheels,
    lightBar,
    pos: new THREE.Vector3(x, 0, z),
    yaw,
    speed: 0,
    boost: 100,
    boosting: false,
    steer: 0,
    target: null,      // traffic: next intersection {x,z}
    waitTimer: 0,
    stuckTimer: 0,
    lastPos: new THREE.Vector3(x, 0, z),
    alive: true,
    flashT: Math.random() * 10,
  };
  return car;
}

function randomNode(nodes, rng) {
  return nodes[Math.floor(rng() * nodes.length)];
}

function pickNextTarget(car, nodes, rng) {
  // Stay on the road graph: the next node must share the car's current
  // street (same x for a north-south road, same z for east-west). A car
  // only ever turns at an intersection, never cuts across a block.
  const onX = nodes.filter((n) => Math.abs(n.x - car.pos.x) < 6 && Math.abs(n.z - car.pos.z) > 1);
  const onZ = nodes.filter((n) => Math.abs(n.z - car.pos.z) < 6 && Math.abs(n.x - car.pos.x) > 1);
  const pool = onX.length || onZ.length ? [...onX, ...onZ] : nodes;
  car.target = pool[Math.floor(rng() * pool.length)];
}

// Traffic car: drive toward its target intersection, turn at nodes.
export function updateTrafficCar(car, nodes, rng, dt, allCars, colliders) {
  if (!car.target) pickNextTarget(car, nodes, rng);
  const t = car.target;
  const dx = t.x - car.pos.x;
  const dz = t.z - car.pos.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 3) { pickNextTarget(car, nodes, rng); return; }
  const wantYaw = Math.atan2(dx, dz);
  let dy = wantYaw - car.yaw;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  car.yaw += Math.max(-1.6 * dt, Math.min(1.6 * dt, dy));
  // slow down for a car ahead
  let slow = false;
  for (const o of allCars) {
    if (o === car || !o.alive) continue;
    const ox = o.pos.x - car.pos.x, oz = o.pos.z - car.pos.z;
    const d = Math.hypot(ox, oz);
    if (d < 9) {
      const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
      if (ox * fx + oz * fz > 0) { slow = true; break; }
    }
  }
  const targetSpeed = slow ? 0 : 10;
  car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 2);
  car.pos.x += Math.sin(car.yaw) * car.speed * dt;
  car.pos.z += Math.cos(car.yaw) * car.speed * dt;
  collideCircle(car.pos, CAR.radius, colliders);
  car.mesh.position.copy(car.pos);
  car.mesh.rotation.y = car.yaw;
  spinWheels(car, dt);
}

export function spinWheels(car, dt) {
  const spin = (car.speed * dt) / 0.36;
  for (const w of car.wheels) w.rotation.x += spin;
}

// Arcade player-car physics: throttle, brake/reverse, steering that bites
// with speed, handbrake slides, building push-out, soft car-vs-car bumps.
export function updatePlayerCar(car, input, dt, colliders, allCars, onCrash) {
  const fwd = (input.up ? 1 : 0) - (input.down ? 1 : 0);
  const steerIn = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const hand = !!input.handbrake;
  // per-game driving feel: nitro boost, solar boost in the edge field,
  // slick ice on the ridge road — all from MECHANIC in config.js.
  let maxSpeed = CAR.maxSpeed, accel = CAR.accel, turnRate = CAR.turnRate, steerResponse = 8;
  const inZone = car.pos.x > CITY.beachX;
  car.boosting = false;
  if (MECHANIC.type === 'nitro' && input.run && car.boost > 0) {
    maxSpeed *= 1.35; accel *= 1.5;
    car.boost = Math.max(0, car.boost - dt * 30);
    car.boosting = true;
  } else if (car.boost !== undefined) {
    car.boost = Math.min(100, car.boost + dt * 8);
  }
  if (MECHANIC.type === 'solar' && inZone) maxSpeed *= 1.3;
  if (MECHANIC.type === 'ice' && inZone) { turnRate *= 1.35; steerResponse = 4; }
  const speed01 = Math.min(1, Math.abs(car.speed) / maxSpeed);
  const steerTarget = steerIn * turnRate * (hand ? CAR.handbrakeTurn / turnRate : 1)
    * (0.35 + 0.65 * speed01) * (car.speed < -0.5 ? -1 : 1);
  car.steer += (steerTarget - car.steer) * Math.min(1, dt * steerResponse);
  car.yaw += car.steer * dt * Math.min(1, Math.abs(car.speed) / 6 + 0.15);
  if (fwd > 0) car.speed += accel * dt * (1 - speed01 * 0.75);
  else if (fwd < 0) {
    if (car.speed > 0.5) car.speed -= CAR.brake * dt;
    else car.speed -= accel * 0.6 * dt;
  } else {
    car.speed -= car.speed * Math.min(1, dt * (hand ? 2.2 : 0.7));
  }
  if (car.speed > maxSpeed) car.speed = maxSpeed;
  if (car.speed < -CAR.reverseMax) car.speed = -CAR.reverseMax;
  if (Math.abs(car.speed) < 0.05 && fwd === 0) car.speed = 0;
  const nx = car.pos.x + Math.sin(car.yaw) * car.speed * dt;
  const nz = car.pos.z + Math.cos(car.yaw) * car.speed * dt;
  const before = car.pos.clone();
  car.pos.x = nx; car.pos.z = nz;
  const hitWall = collideCircle(car.pos, CAR.radius, colliders);
  if (hitWall) {
    const lost = car.speed;
    car.speed *= 0.35;
    if (Math.abs(lost) > 14 && onCrash) onCrash(Math.abs(lost));
  }
  // soft bumps with other cars
  for (const o of allCars) {
    if (o === car || !o.alive) continue;
    const dx = car.pos.x - o.pos.x, dz = car.pos.z - o.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 3.4 && d > 0.001) {
      const push = (3.4 - d) / 2;
      car.pos.x += (dx / d) * push;
      car.pos.z += (dz / d) * push;
      o.pos.x -= (dx / d) * push;
      o.pos.z -= (dz / d) * push;
      if (o.kind === 'traffic') o.speed *= 0.6;
      if (Math.abs(car.speed) > 10 && onCrash) onCrash(Math.abs(car.speed) * 0.5);
      car.speed *= 0.92;
    }
  }
  // world bounds
  car.pos.x = Math.max(-CITY.boundZ, Math.min(CITY.boundX, car.pos.x));
  car.pos.z = Math.max(-CITY.boundZ, Math.min(CITY.boundZ, car.pos.z));
  car.mesh.position.copy(car.pos);
  car.mesh.rotation.y = car.yaw;
  spinWheels(car, dt);
}

// Police car: chase the player's position, cut corners, ram.
export function updatePoliceCar(car, playerPos, dt, colliders, allCars, onRam) {
  const dx = playerPos.x - car.pos.x;
  const dz = playerPos.z - car.pos.z;
  const dist = Math.hypot(dx, dz);
  const wantYaw = Math.atan2(dx, dz);
  let dy = wantYaw - car.yaw;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  car.yaw += Math.max(-2.4 * dt, Math.min(2.4 * dt, dy));
  const targetSpeed = dist > 4 ? Math.min(34, 16 + dist * 0.35) : 6;
  car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.6);
  car.pos.x += Math.sin(car.yaw) * car.speed * dt;
  car.pos.z += Math.cos(car.yaw) * car.speed * dt;
  collideCircle(car.pos, CAR.radius, colliders);
  if (dist < 3.6 && onRam) onRam(car);
  car.mesh.position.copy(car.pos);
  car.mesh.rotation.y = car.yaw;
  spinWheels(car, dt);
  // flashing light bar
  car.flashT += dt * 6;
  if (car.lightBar) {
    const on = Math.sin(car.flashT) > 0;
    car.lightBar.red.material.color.setHex(on ? 0xff2222 : 0x551111);
    car.lightBar.blue.material.color.setHex(on ? 0x111155 : 0x2244ff);
  }
}

export function randomCarColor(rng) {
  return PALETTE.carPaint[Math.floor(rng() * PALETTE.carPaint.length)];
}
