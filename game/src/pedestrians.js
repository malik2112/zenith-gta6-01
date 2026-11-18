// SOLMAR BAY — pedestrians.js
// One job: the people of ZENITH. Walkers amble the sidewalks between
// random corners, pause, turn, and flee when a gun goes off or a car
// screams past. One shared mesh builder, one update loop.
import * as THREE from 'three';
import { TRAFFIC } from './config.js';

const SHIRTS = [0xd95f4b, 0x4b8ad9, 0x53b06a, 0xd9b84b, 0x9a5fd0, 0xe8e8e8, 0x3a3f45, 0xe08aa8];

export function makePersonMesh(shirtColor, skinColor = 0xc98e6a) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const skin = new THREE.MeshLambertMaterial({ color: skinColor });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2c3440 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.85, 8), shirt);
  body.position.y = 1.05;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.72;
  g.add(head);
  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.62, 6), pants);
  legL.position.set(-0.14, 0.31, 0);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.14;
  g.add(legR);
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.6, 6), shirt);
  armL.position.set(-0.44, 1.1, 0);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.44;
  g.add(armR);
  return { group: g, legL, legR, armL, armR };
}

export function spawnPed(scene, x, z, rng, kind = 'walker') {
  const shirt = SHIRTS[Math.floor(rng() * SHIRTS.length)];
  const { group, legL, legR, armL, armR } = makePersonMesh(shirt);
  group.position.set(x, 0, z);
  scene.add(group);
  return {
    kind,
    mesh: group, legL, legR, armL, armR,
    pos: new THREE.Vector3(x, 0, z),
    yaw: rng() * Math.PI * 2,
    speed: 0,
    target: null,
    waitTimer: rng() * 3,
    walkPhase: rng() * 10,
    hp: 50,
    alive: true,
    fleeing: false,
    fleeTimer: 0,
  };
}

// Pick a sidewalk corner: an intersection offset by ~11m onto the pavement.
export function randomSidewalkPoint(centers, rng) {
  const cx = centers[Math.floor(rng() * centers.length)];
  const cz = centers[Math.floor(rng() * centers.length)];
  const off = 11 + rng() * 2;
  const sx = (rng() < 0.5 ? -1 : 1) * off;
  const sz = (rng() < 0.5 ? -1 : 1) * off;
  return { x: cx + sx, z: cz + sz };
}

export function updatePed(ped, centers, rng, dt, dangerPos, colliders) {
  if (!ped.alive) return;
  // flee from recent danger (gunfire / speeding car)
  if (dangerPos) {
    const d = Math.hypot(ped.pos.x - dangerPos.x, ped.pos.z - dangerPos.z);
    if (d < 18) { ped.fleeing = true; ped.fleeTimer = 3; }
  }
  if (ped.fleeTimer > 0) {
    ped.fleeTimer -= dt;
    if (ped.fleeTimer <= 0) ped.fleeing = false;
  }
  if (ped.waitTimer > 0) {
    ped.waitTimer -= dt;
    ped.speed = 0;
  } else {
    if (!ped.target) ped.target = randomSidewalkPoint(centers, rng);
    const dx = ped.target.x - ped.pos.x;
    const dz = ped.target.z - ped.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1.5) {
      ped.target = null;
      ped.waitTimer = 1 + rng() * 4;
      ped.speed = 0;
    } else {
      const wantYaw = Math.atan2(dx, dz);
      let dy = wantYaw - ped.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      ped.yaw += Math.max(-3 * dt, Math.min(3 * dt, dy));
      const targetSpeed = ped.fleeing ? 4.6 : TRAFFIC.pedSpeed;
      ped.speed += (targetSpeed - ped.speed) * Math.min(1, dt * 3);
      ped.pos.x += Math.sin(ped.yaw) * ped.speed * dt;
      ped.pos.z += Math.cos(ped.yaw) * ped.speed * dt;
    }
  }
  ped.walkPhase += dt * (2 + ped.speed * 2.4);
  const swing = Math.sin(ped.walkPhase) * 0.45 * Math.min(1, ped.speed / 2);
  ped.legL.rotation.x = swing;
  ped.legR.rotation.x = -swing;
  ped.armL.rotation.x = -swing * 0.8;
  ped.armR.rotation.x = swing * 0.8;
  ped.mesh.position.copy(ped.pos);
  ped.mesh.rotation.y = ped.yaw;
}

// A ped that was shot falls over and fades; returns true while animating.
export function updateFallenPed(ped, dt) {
  if (ped.alive) return false;
  ped.mesh.rotation.x += (Math.PI / 2 - ped.mesh.rotation.x) * Math.min(1, dt * 6);
  return true;
}
