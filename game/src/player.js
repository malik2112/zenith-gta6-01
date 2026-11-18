// SOLMAR BAY — player.js
// One job: Nadia Kaur on foot and the third-person camera — walking,
// running, mouse-look, and the camera that follows him or his car.
// Car driving lives in vehicles.js; this file only moves the person.
import * as THREE from 'three';
import { PLAYER, CITY } from './config.js';
import { collideCircle } from './city.js';
import { makePersonMesh } from './pedestrians.js';

export function createPlayer(scene) {
  const { group, legL, legR, armL, armR } = makePersonMesh(0x8a7fc0);
  // Nadia Kaur: signature jacket, dark jeans, easy to spot in a crowd.
  group.position.set(-180, 0, 180);
  scene.add(group);
  return {
    mesh: group, legL, legR, armL, armR,
    pos: new THREE.Vector3(-180, 0, 180),
    yaw: Math.PI * 0.75,
    pitch: -0.12,
    hp: PLAYER.maxHp,
    cash: 50,
    speed: 0,
    walkPhase: 0,
    onFoot: true,
    car: null,        // the car object Nadia Kaur is driving, or null
    speedKmh: 0,
    bustMeter: 0,
  };
}

// On-foot movement: WASD relative to the camera yaw, Shift to sprint.
export function updatePlayerOnFoot(player, input, dt, colliders) {
  const run = !!input.run;
  const maxSpeed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
  let mx = 0, mz = 0;
  if (input.up) mz += 1;
  if (input.down) mz -= 1;
  if (input.left) mx -= 1;
  if (input.right) mx += 1;
  const moving = mx !== 0 || mz !== 0;
  let targetSpeed = 0;
  if (moving) {
    const len = Math.hypot(mx, mz);
    mx /= len; mz /= len;
    // camera-relative: forward is where the camera looks
    const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
    const wx = mz * sin + mx * cos;
    const wz = mz * cos - mx * sin;
    // face the direction of travel
    const wantYaw = Math.atan2(wx, wz);
    let dy = wantYaw - player.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    player.yaw += dy * Math.min(1, dt * 10);
    targetSpeed = maxSpeed;
    player.pos.x += wx * maxSpeed * dt;
    player.pos.z += wz * maxSpeed * dt;
  }
  player.speed += (targetSpeed - player.speed) * Math.min(1, dt * 10);
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

// Third-person camera: behind the player on foot, behind the car when driving.
// Mouse-look orbits on foot; in a car the camera trails the car's heading with
// a little mouse offset. Returns nothing; moves the camera in place.
export function updateCamera(camera, player, dt, mouseDX, mouseDY) {
  if (player.onFoot) {
    player.yaw -= mouseDX * 0.0028;
    player.pitch = Math.max(-0.6, Math.min(0.45, player.pitch - mouseDY * 0.0028));
    const dist = 6.5;
    const cx = player.pos.x - Math.sin(player.yaw) * Math.cos(player.pitch) * dist;
    const cz = player.pos.z - Math.cos(player.yaw) * Math.cos(player.pitch) * dist;
    const cy = PLAYER.eyeHeight + Math.sin(player.pitch) * dist + 1.2;
    camera.position.x += (cx - camera.position.x) * Math.min(1, dt * 12);
    camera.position.y += (cy - camera.position.y) * Math.min(1, dt * 12);
    camera.position.z += (cz - camera.position.z) * Math.min(1, dt * 12);
    camera.lookAt(player.pos.x, player.pos.y + 1.6, player.pos.z);
  } else if (player.car) {
    const car = player.car;
    // camera trails the car; mouse nudges the view sideways a touch
    const back = 10 + Math.abs(car.speed) * 0.12;
    const up = 4 + Math.abs(car.speed) * 0.03;
    const cx = car.pos.x - Math.sin(car.yaw) * back;
    const cz = car.pos.z - Math.cos(car.yaw) * back;
    camera.position.x += (cx - camera.position.x) * Math.min(1, dt * 5);
    camera.position.y += (up - camera.position.y) * Math.min(1, dt * 5);
    camera.position.z += (cz - camera.position.z) * Math.min(1, dt * 5);
    camera.lookAt(car.pos.x + Math.sin(car.yaw) * 6, 1.4, car.pos.z + Math.cos(car.yaw) * 6);
    player.yaw = car.yaw;
    player.pos.copy(car.pos);
  }
}

// Slow cinematic orbit for the start menu backdrop.
export function menuCamera(camera, t) {
  const r = 150;
  camera.position.set(Math.cos(t * 0.05) * r, 55 + Math.sin(t * 0.03) * 12, Math.sin(t * 0.05) * r);
  camera.lookAt(0, 8, 0);
}
