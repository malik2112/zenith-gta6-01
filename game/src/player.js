// ZENITH — player.js (fresh rewrite, round 3)
// Nadia Kaur on foot, and the camera that watches her. Movement is
// acceleration-based: input asks for a velocity, the body eases toward
// it, so starting and stopping have weight instead of snapping. The
// camera rides behind her on foot (mouse orbits it) and trails the car
// when she drives; on the menu it drifts over the town on its own.
import * as THREE from 'three';
import { PLAYER, CITY } from './config.js';
import { collideCircle } from './city.js';
import { makePersonMesh } from './pedestrians.js';

export function createPlayer(scene) {
  const parts = makePersonMesh(0x8a7fc0); // the violet jacket everyone knows
  parts.group.position.set(-180, 0, 180);
  scene.add(parts.group);
  return {
    mesh: parts.group,
    legL: parts.legL,
    legR: parts.legR,
    armL: parts.armL,
    armR: parts.armR,
    pos: new THREE.Vector3(-180, 0, 180),
    vel: new THREE.Vector3(),
    yaw: Math.PI * 0.75,
    pitch: -0.12,
    hp: PLAYER.maxHp,
    cash: 50,
    speed: 0,
    walkPhase: 0,
    onFoot: true,
    car: null,
    speedKmh: 0,
    bustMeter: 0,
  };
}

// WASD asks for a direction relative to where the camera faces; Shift
// raises the requested speed from a walk to a run. The body turns toward
// the direction of travel and the legs swing with the actual speed.
export function updatePlayerOnFoot(player, input, dt, colliders) {
  const want = new THREE.Vector3();
  if (input.up) want.z += 1;
  if (input.down) want.z -= 1;
  if (input.left) want.x -= 1;
  if (input.right) want.x += 1;

  const topSpeed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  if (want.lengthSq() > 0) {
    want.normalize();
    const sin = Math.sin(player.yaw);
    const cos = Math.cos(player.yaw);
    const worldX = want.z * sin + want.x * cos;
    const worldZ = want.z * cos - want.x * sin;
    want.set(worldX, 0, worldZ).multiplyScalar(topSpeed);
    // Face where we are going, but not instantly.
    const faceYaw = Math.atan2(worldX, worldZ);
    let d = faceYaw - player.yaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    player.yaw += d * Math.min(1, dt * 10);
  }
  // Ease the velocity toward the request: snappy, not teleporty.
  const blend = Math.min(1, dt * 9);
  player.vel.x += (want.x - player.vel.x) * blend;
  player.vel.z += (want.z - player.vel.z) * blend;
  player.pos.x += player.vel.x * dt;
  player.pos.z += player.vel.z * dt;
  player.speed = Math.hypot(player.vel.x, player.vel.z);

  collideCircle(player.pos, PLAYER.radius, colliders);
  player.pos.x = Math.max(-CITY.boundZ, Math.min(CITY.boundX, player.pos.x));
  player.pos.z = Math.max(-CITY.boundZ, Math.min(CITY.boundZ, player.pos.z));

  player.walkPhase += dt * (2 + player.speed * 1.6);
  const swing = Math.sin(player.walkPhase) * 0.5 * Math.min(1, player.speed / 5);
  player.legL.rotation.x = swing;
  player.legR.rotation.x = -swing;
  player.armL.rotation.x = -swing * 0.8;
  player.armR.rotation.x = swing * 0.8;
  player.mesh.position.copy(player.pos);
  player.mesh.rotation.y = player.yaw;
  player.speedKmh = Math.round(player.speed * 3.6);
}

// Exponential approach helper: move `current` toward `goal` with a
// frame-rate independent rate, so the camera feels the same at 30 or 144 Hz.
function approach(current, goal, rate, dt) {
  return current + (goal - current) * (1 - Math.exp(-rate * dt));
}

// Third-person camera. On foot the mouse orbits yaw/pitch around Nadia;
// in a car the camera chases a point behind the car, higher and further
// back the faster she goes, always looking up the road.
export function updateCamera(camera, player, dt, mouseDX, mouseDY) {
  if (player.onFoot) {
    player.yaw -= mouseDX * 0.0028;
    player.pitch = Math.max(-0.6, Math.min(0.45, player.pitch - mouseDY * 0.0028));
    const dist = 6.5;
    const ring = Math.cos(player.pitch) * dist;
    const goal = new THREE.Vector3(
      player.pos.x - Math.sin(player.yaw) * ring,
      PLAYER.eyeHeight + Math.sin(player.pitch) * dist + 1.2,
      player.pos.z - Math.cos(player.yaw) * ring,
    );
    camera.position.x = approach(camera.position.x, goal.x, 10, dt);
    camera.position.y = approach(camera.position.y, goal.y, 10, dt);
    camera.position.z = approach(camera.position.z, goal.z, 10, dt);
    camera.lookAt(player.pos.x, player.pos.y + 1.6, player.pos.z);
  } else if (player.car) {
    const car = player.car;
    const back = 10 + Math.abs(car.speed) * 0.12;
    const goal = new THREE.Vector3(
      car.pos.x - Math.sin(car.yaw) * back,
      4 + Math.abs(car.speed) * 0.03,
      car.pos.z - Math.cos(car.yaw) * back,
    );
    camera.position.x = approach(camera.position.x, goal.x, 4.5, dt);
    camera.position.y = approach(camera.position.y, goal.y, 4.5, dt);
    camera.position.z = approach(camera.position.z, goal.z, 4.5, dt);
    camera.lookAt(car.pos.x + Math.sin(car.yaw) * 6, 1.4, car.pos.z + Math.cos(car.yaw) * 6);
    player.yaw = car.yaw;
    player.pos.copy(car.pos);
  }
}

// Menu backdrop: a slow lissajous drift over the rooftops, never quite
// repeating, always looking at the town centre.
export function menuCamera(camera, t) {
  camera.position.set(
    Math.sin(t * 0.045) * 160,
    52 + Math.sin(t * 0.03) * 14,
    Math.sin(t * 0.03 + 1.3) * 160,
  );
  camera.lookAt(0, 8, 0);
}
