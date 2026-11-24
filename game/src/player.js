// ZENITH — player.js (round 3 redo)
// Nadia Kaur on foot, and the camera that watches her. Movement is
// acceleration-based: input asks for a velocity, the body eases toward
// it, so starting and stopping have weight instead of snapping. The
// camera rides behind her on foot (mouse orbits it) and trails the car
// when she drives — widening its field of view as speed builds, and
// kicking up a touch when the pistol fires. On the menu it drifts over
// the town on its own.
import * as THREE from 'three';
import { HERO, TOWN } from './config.js';
import { pushOutOfWalls } from './city.js';
import { buildFigure } from './pedestrians.js';

export function makeHero(scene) {
  const parts = buildFigure(0x8a7fc0); // the violet jacket everyone knows
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
    hp: HERO.maxHp,
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
export function walkHero(player, input, dt, colliders) {
  const want = new THREE.Vector3();
  if (input.up) want.z += 1;
  if (input.down) want.z -= 1;
  if (input.left) want.x -= 1;
  if (input.right) want.x += 1;

  const topSpeed = input.run ? HERO.runSpeed : HERO.walkSpeed;
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

  pushOutOfWalls(player.pos, HERO.radius, colliders);
  player.pos.x = Math.max(-TOWN.boundZ, Math.min(TOWN.boundX, player.pos.x));
  player.pos.z = Math.max(-TOWN.boundZ, Math.min(TOWN.boundZ, player.pos.z));

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
function easeToward(current, goal, rate, dt) {
  return current + (goal - current) * (1 - Math.exp(-rate * dt));
}

// Third-person camera. On foot the mouse orbits yaw/pitch around Nadia,
// with a touch of recoil lift right after a shot; in a car the camera
// chases a point behind the car, higher and further back the faster she
// goes, always looking up the road, FOV widening with speed.
export function trackCamera(camera, player, dt, mouseDX, mouseDY, recoil = 0) {
  if (player.onFoot) {
    player.yaw -= mouseDX * 0.0028;
    player.pitch = Math.max(-0.6, Math.min(0.45, player.pitch - mouseDY * 0.0028));
    const dist = 6.5;
    const pitch = player.pitch + recoil;
    const ring = Math.cos(pitch) * dist;
    const goal = new THREE.Vector3(
      player.pos.x - Math.sin(player.yaw) * ring,
      HERO.eyeHeight + Math.sin(pitch) * dist + 1.2,
      player.pos.z - Math.cos(player.yaw) * ring,
    );
    camera.position.x = easeToward(camera.position.x, goal.x, 10, dt);
    camera.position.y = easeToward(camera.position.y, goal.y, 10, dt);
    camera.position.z = easeToward(camera.position.z, goal.z, 10, dt);
    camera.lookAt(player.pos.x, player.pos.y + 1.6, player.pos.z);
    if (Math.abs(camera.fov - 68) > 0.1) {
      camera.fov = 68;
      camera.updateProjectionMatrix();
    }
  } else if (player.car) {
    const car = player.car;
    const back = 10 + Math.abs(car.speed) * 0.12;
    const goal = new THREE.Vector3(
      car.pos.x - Math.sin(car.yaw) * back,
      4 + Math.abs(car.speed) * 0.03,
      car.pos.z - Math.cos(car.yaw) * back,
    );
    camera.position.x = easeToward(camera.position.x, goal.x, 4.5, dt);
    camera.position.y = easeToward(camera.position.y, goal.y, 4.5, dt);
    camera.position.z = easeToward(camera.position.z, goal.z, 4.5, dt);
    camera.lookAt(car.pos.x + Math.sin(car.yaw) * 6, 1.4, car.pos.z + Math.cos(car.yaw) * 6);
    player.yaw = car.yaw;
    player.pos.copy(car.pos);
    const wantFov = 68 + Math.min(1, Math.abs(car.speed) / 36) * 8;
    if (Math.abs(camera.fov - wantFov) > 0.1) {
      camera.fov += (wantFov - camera.fov) * Math.min(1, dt * 4);
      camera.updateProjectionMatrix();
    }
  }
}

// Menu backdrop: a slow lissajous drift over the rooftops, never quite
// repeating, always looking at the town centre.
export function orbitMenuCam(camera, t) {
  camera.position.set(
    Math.sin(t * 0.045) * 160,
    52 + Math.sin(t * 0.03) * 14,
    Math.sin(t * 0.03 + 1.3) * 160,
  );
  camera.lookAt(0, 8, 0);
}
