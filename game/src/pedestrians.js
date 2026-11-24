// ZENITH — pedestrians.js (round 3 redo)
// The people of Zenith: one low-poly figure builder shared by the hero,
// the walkers and the rival crew, plus the walker brain — a small state
// machine (pause, stroll, chat, flee) that keeps them on the pavements
// and sends them running when shots ring out or a car comes too close.
import * as THREE from 'three';
import { CROWD } from './config.js';

const SHIRT_COLORS = [0xd95f4b, 0x4b8ad9, 0x53b06a, 0xd9b84b, 0x9a5fd0, 0xe8e8e8, 0x3a3f45, 0xe08aa8];
const SKIN_TONES = [0xc98e6a, 0xa9744f, 0xe3b48f, 0x8a5a3c];

// A person from boxes: torso, head, two legs, two arms. Limbs pivot at the
// shoulder/hip so the walk cycle is just a sine on rotation.x.
export function buildFigure(shirtColor, skinColor = 0xc98e6a) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const skin = new THREE.MeshLambertMaterial({ color: skinColor });
  const trousers = new THREE.MeshLambertMaterial({ color: 0x2c3440 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.78, 0.3), shirt);
  torso.position.y = 1.08;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.38, 0.34), skin);
  head.position.y = 1.68;
  group.add(head);
  // A flat cap on some heads, a hair slab on the rest.
  if (Math.random() < 0.5) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.38), trousers);
    cap.position.y = 1.9;
    group.add(cap);
  } else {
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.36), new THREE.MeshLambertMaterial({ color: 0x2a2018 }));
    hair.position.y = 1.86;
    group.add(hair);
  }

  function limb(w, h, mat, x, y) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat);
    seg.position.y = -h / 2;
    pivot.add(seg);
    group.add(pivot);
    return pivot;
  }
  const legL = limb(0.16, 0.68, trousers, -0.15, 0.7);
  const legR = limb(0.16, 0.68, trousers, 0.15, 0.7);
  const armL = limb(0.12, 0.58, shirt, -0.36, 1.4);
  const armR = limb(0.12, 0.58, shirt, 0.36, 1.4);
  return { group, legL, legR, armL, armR };
}

export function summonWalker(scene, x, z, rng, kind = 'walker') {
  const shirt = SHIRT_COLORS[Math.floor(rng() * SHIRT_COLORS.length)];
  const skin = SKIN_TONES[Math.floor(rng() * SKIN_TONES.length)];
  const parts = buildFigure(shirt, skin);
  parts.group.position.set(x, 0, z);
  scene.add(parts.group);
  return {
    kind,
    mesh: parts.group,
    legL: parts.legL,
    legR: parts.legR,
    armL: parts.armL,
    armR: parts.armR,
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
    state: 'pause', // pause | stroll | chat | flee
  };
}

// A point on the pavement near a random corner: intersection plus an
// offset that lands on the sidewalk strip, never in the road.
export function sidewalkSpot(centers, rng) {
  const cx = centers[Math.floor(rng() * centers.length)];
  const cz = centers[Math.floor(rng() * centers.length)];
  const off = 11 + rng() * 2;
  return {
    x: cx + (rng() < 0.5 ? -off : off),
    z: cz + (rng() < 0.5 ? -off : off),
  };
}

function turnToward(ped, wantYaw, maxTurn, dt) {
  let d = wantYaw - ped.yaw;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  ped.yaw += Math.max(-maxTurn * dt, Math.min(maxTurn * dt, d));
}

function animateWalk(ped, dt) {
  ped.walkPhase += dt * (2 + ped.speed * 2.4);
  const swing = Math.sin(ped.walkPhase) * 0.45 * Math.min(1, ped.speed / 2);
  ped.legL.rotation.x = swing;
  ped.legR.rotation.x = -swing;
  ped.armL.rotation.x = -swing * 0.8;
  ped.armR.rotation.x = swing * 0.8;
  ped.mesh.position.copy(ped.pos);
  ped.mesh.rotation.y = ped.yaw;
}

// Walker brain. Danger (a shot's end point, a body, a fast car) flips the
// state to flee for a few seconds; fleeing means sprinting away from the
// danger point, not toward a target. Otherwise: pause, sometimes chat
// with the nearest walker, pick a corner, stroll to it, repeat.
export function walkPerson(ped, centers, rng, dt, dangerPos, colliders, allPeds) {
  if (!ped.alive) return;

  if (dangerPos) {
    const d = Math.hypot(ped.pos.x - dangerPos.x, ped.pos.z - dangerPos.z);
    if (d < 18) {
      ped.state = 'flee';
      ped.fleeTimer = 3;
      ped.fleeFrom = { x: dangerPos.x, z: dangerPos.z };
    }
  }
  ped.fleeing = ped.state === 'flee';

  if (ped.state === 'flee') {
    ped.fleeTimer -= dt;
    const away = Math.atan2(ped.pos.x - ped.fleeFrom.x, ped.pos.z - ped.fleeFrom.z);
    turnToward(ped, away, 4, dt);
    ped.speed += (4.6 - ped.speed) * Math.min(1, dt * 3);
    ped.pos.x += Math.sin(ped.yaw) * ped.speed * dt;
    ped.pos.z += Math.cos(ped.yaw) * ped.speed * dt;
    if (ped.fleeTimer <= 0) {
      ped.state = 'pause';
      ped.waitTimer = 0.5 + rng() * 1.5;
      ped.target = null;
    }
  } else if (ped.state === 'pause') {
    ped.speed = 0;
    ped.waitTimer -= dt;
    if (ped.waitTimer <= 0) {
      // One in three pauses turns into a chat: face the nearest walker
      // and stand still together for a while.
      const near = allPeds
        ? allPeds.find((o) => o !== ped && o.alive && Math.hypot(o.pos.x - ped.pos.x, o.pos.z - ped.pos.z) < 6)
        : null;
      if (near && rng() < 0.35) {
        ped.state = 'chat';
        ped.waitTimer = 3 + rng() * 4;
        ped.chatWith = near;
      } else {
        ped.target = sidewalkSpot(centers, rng);
        ped.state = 'stroll';
      }
    }
  } else if (ped.state === 'chat') {
    ped.speed = 0;
    ped.waitTimer -= dt;
    if (ped.chatWith && ped.chatWith.alive) {
      turnToward(ped, Math.atan2(ped.chatWith.pos.x - ped.pos.x, ped.chatWith.pos.z - ped.pos.z), 3, dt);
    }
    if (ped.waitTimer <= 0) {
      ped.state = 'pause';
      ped.waitTimer = 0.5 + rng() * 1.5;
      ped.chatWith = null;
    }
  } else {
    // stroll
    if (!ped.target) ped.target = sidewalkSpot(centers, rng);
    const dx = ped.target.x - ped.pos.x;
    const dz = ped.target.z - ped.pos.z;
    if (Math.hypot(dx, dz) < 1.5) {
      ped.target = null;
      ped.state = 'pause';
      ped.waitTimer = 1 + rng() * 4;
      ped.speed = 0;
    } else {
      turnToward(ped, Math.atan2(dx, dz), 3, dt);
      ped.speed += (CROWD.pedSpeed - ped.speed) * Math.min(1, dt * 3);
      ped.pos.x += Math.sin(ped.yaw) * ped.speed * dt;
      ped.pos.z += Math.cos(ped.yaw) * ped.speed * dt;
    }
  }
  animateWalk(ped, dt);
}

// A fallen ped tips over and stays down. Returns true while animating.
export function topplePed(ped, dt) {
  if (ped.alive) return false;
  ped.mesh.rotation.x += (Math.PI / 2 - ped.mesh.rotation.x) * Math.min(1, dt * 6);
  return true;
}
