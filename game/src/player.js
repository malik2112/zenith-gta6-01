// ZENITH — the player on foot. A low-poly walker with a jacket, jeans and a
// cap; WASD moves relative to the camera yaw, Shift runs, E enters a car.
import { CONFIG } from './config.js';
import { resolveCircleCollision } from './city.js';

const JACKET = 0x2e6f8e;
const SKIN = 0xd9a066;

export class Player {
  constructor(THREE, scene, spawn) {
    this.THREE = THREE;
    this.pos = new THREE.Vector3(spawn.x, 0, spawn.z);
    this.heading = spawn.heading;
    this.speed = 0;
    this.health = CONFIG.startHealth;
    this.onFoot = true;
    this.currentCar = null;
    this.walkPhase = 0;

    const g = new THREE.Group();
    g.name = 'player';

    const jacket = new THREE.MeshStandardMaterial({ color: JACKET, roughness: 0.85 });
    const jeans = new THREE.MeshStandardMaterial({ color: 0x2a3242, roughness: 0.9 });
    const skin = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.8 });

    this.torso = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.95, 10), jacket);
    this.torso.position.y = 1.05;
    this.torso.castShadow = true;
    g.add(this.torso);

    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
    this.head.position.y = 1.82;
    this.head.castShadow = true;
    g.add(this.head);

    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.1, 12),
      new THREE.MeshStandardMaterial({ color: 0xc23b2e, roughness: 0.8 })
    );
    cap.position.y = 2.02;
    g.add(cap);

    this.legL = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.62, 8), jeans);
    this.legL.position.set(-0.18, 0.31, 0);
    g.add(this.legL);
    this.legR = this.legL.clone();
    this.legR.position.x = 0.18;
    g.add(this.legR);

    this.armL = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.6, 8), jacket);
    this.armL.position.set(-0.46, 1.15, 0);
    g.add(this.armL);
    this.armR = this.armL.clone();
    this.armR.position.x = 0.46;
    g.add(this.armR);

    // A visible pistol in the right hand when armed.
    this.gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.12, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.5, metalness: 0.7 })
    );
    this.gun.position.set(0.46, 0.82, 0.18);
    g.add(this.gun);

    this.group = g;
    this.group.position.copy(this.pos);
    scene.add(g);
  }

  get forward() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  // input: {f,b,l,r,run} in camera space; camYaw is the camera heading.
  update(dt, input, camYaw, colliders, bounds) {
    if (!this.onFoot) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    let mx = 0;
    let mz = 0;
    if (input.f) mz += 1;
    if (input.b) mz -= 1;
    if (input.l) mx -= 1;
    if (input.r) mx += 1;
    const len = Math.hypot(mx, mz);
    const target = input.run ? CONFIG.playerRun : CONFIG.playerWalk;
    if (len > 0) {
      mx /= len;
      mz /= len;
      // Rotate the camera-space stick into world space.
      const sin = Math.sin(camYaw);
      const cos = Math.cos(camYaw);
      const wx = mx * cos - mz * sin;
      const wz = mx * sin + mz * cos;
      this.heading = Math.atan2(wx, wz);
      this.speed += (target - this.speed) * Math.min(1, dt * 10);
      this.pos.x += wx * this.speed * dt;
      this.pos.z += wz * this.speed * dt;
      this.walkPhase += dt * this.speed * 1.6;
    } else {
      this.speed += (0 - this.speed) * Math.min(1, dt * 8);
    }
    resolveCircleCollision(this.pos, 0.55, colliders, bounds);
    this.group.position.set(this.pos.x, 0, this.pos.z);
    this.group.rotation.y = this.heading;
    // Walk swing.
    const swing = Math.sin(this.walkPhase) * Math.min(0.55, this.speed / CONFIG.playerRun);
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.8;
    this.armR.rotation.x = swing * 0.8;
  }

  enterCar(car) {
    this.onFoot = false;
    this.currentCar = car;
    this.group.visible = false;
  }

  exitCar() {
    if (!this.currentCar) return null;
    const car = this.currentCar;
    this.currentCar = null;
    this.onFoot = true;
    // Step out to the driver's side.
    const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
    this.pos.set(car.pos.x + side.x * 2.2, 0, car.pos.z + side.z * 2.2);
    this.heading = car.heading;
    this.group.position.copy(this.pos);
    this.group.visible = true;
    return car;
  }

  teleport(x, z, heading) {
    this.pos.set(x, 0, z);
    if (heading !== undefined) this.heading = heading;
    this.group.position.copy(this.pos);
  }

  damage(n) {
    this.health = Math.max(0, this.health - n);
    return this.health;
  }

  heal(n) {
    this.health = Math.min(CONFIG.startHealth, this.health + n);
  }
}
