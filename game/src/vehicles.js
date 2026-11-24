// ZENITH — vehicles. Box-built low-poly cars with arcade driving: accel,
// brake/reverse, speed-sensitive steering, building collision, headlights.
// One of them can be stolen (E) and driven; police cars chase the player.
import { CONFIG } from './config.js';
import { resolveCircleCollision } from './city.js';

function buildCarMesh(THREE, color, isPolice) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x11131a, roughness: 0.25, metalness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.1, metalness: 0.8 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), paint);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), glass);
  cabin.position.set(0, 1.1, -0.25);
  cabin.castShadow = true;
  g.add(cabin);

  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.22, 0.3), dark);
  bumperF.position.set(0, 0.32, 2.25);
  g.add(bumperF);
  const bumperR = bumperF.clone();
  bumperR.position.z = -2.25;
  g.add(bumperR);

  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.9 });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.36, z);
    g.add(w);
    wheels.push(w);
  }

  // Headlights (emissive) + taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0 });
  for (const x of [-0.65, 0.65]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), headMat);
    h.position.set(x, 0.62, 2.22);
    g.add(h);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  for (const x of [-0.65, 0.65]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), tailMat);
    t.position.set(x, 0.62, -2.22);
    g.add(t);
  }

  let lightBar = null;
  if (isPolice) {
    // Black-and-white livery: white doors band + light bar.
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(2.02, 0.3, 1.6),
      new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 })
    );
    band.position.set(0, 0.62, 0.2);
    g.add(band);
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.x = -0.3;
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.4), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    blue.position.x = 0.3;
    lightBar.add(red);
    lightBar.add(blue);
    lightBar.position.set(0, 1.48, -0.25);
    lightBar.userData = { red, blue };
    g.add(lightBar);
  }

  // One real spotlight for the headlights, reused by the driven car only.
  const spot = new THREE.SpotLight(0xffe9b0, 0, 60, 0.5, 0.5, 1.2);
  spot.position.set(0, 0.7, 2.2);
  const spotTarget = new THREE.Object3D();
  spotTarget.position.set(0, 0, 14);
  g.add(spotTarget);
  spot.target = spotTarget;
  g.add(spot);

  return { group: g, wheels, spot, lightBar };
}

export class Vehicles {
  constructor(THREE, scene, city) {
    this.THREE = THREE;
    this.scene = scene;
    this.city = city;
    this.cars = [];
    this.flashPhase = 0;
    for (const s of city.spawn.cars) this.addCar(s.x, s.z, s.heading, s.color, false);
  }

  addCar(x, z, heading, color, isPolice) {
    const built = buildCarMesh(this.THREE, color, isPolice);
    built.group.position.set(x, 0, z);
    built.group.rotation.y = heading;
    this.scene.add(built.group);
    const car = {
      group: built.group,
      wheels: built.wheels,
      spot: built.spot,
      lightBar: built.lightBar,
      pos: built.group.position,
      heading,
      speed: 0,
      color,
      isPolice,
      driver: 'parked', // parked | player | police | none
      health: 100,
      smoke: null,
      stuck: 0,
    };
    this.cars.push(car);
    return car;
  }

  spawnPolice(x, z) {
    const car = this.addCar(x, z, 0, 0x14161c, true);
    car.driver = 'police';
    return car;
  }

  nearestCar(pos, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of this.cars) {
      if (car.driver === 'player') continue;
      const d = Math.hypot(car.pos.x - pos.x, car.pos.z - pos.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  playerCar() {
    return this.cars.find((c) => c.driver === 'player') || null;
  }

  removeCar(car) {
    this.scene.remove(car.group);
    this.cars = this.cars.filter((c) => c !== car);
  }

  update(dt, input, player, policeTarget) {
    this.flashPhase += dt * 6;
    for (const car of this.cars) {
      if (car.lightBar) {
        const on = Math.sin(this.flashPhase) > 0;
        car.lightBar.userData.red.material.color.setHex(on ? 0xff2222 : 0x551111);
        car.lightBar.userData.blue.material.color.setHex(on ? 0x2244ff : 0x111155);
      }
      if (car.driver === 'player') this.drivePlayer(car, dt, input, player);
      else if (car.driver === 'police' && policeTarget) this.drivePolice(car, dt, policeTarget);
      else if (car.speed !== 0) {
        // Parked cars never move; a coasting car slows down.
        car.speed *= Math.max(0, 1 - dt * 2);
        if (Math.abs(car.speed) < 0.05) car.speed = 0;
      }
      if (car.speed !== 0) {
        const fx = Math.sin(car.heading);
        const fz = Math.cos(car.heading);
        car.pos.x += fx * car.speed * dt;
        car.pos.z += fz * car.speed * dt;
        resolveCircleCollision(car.pos, 1.9, this.city.colliders, this.city.bounds);
      }
      car.group.rotation.y = car.heading;
      for (const w of car.wheels) w.rotation.x += car.speed * dt * 2.2;
      // Headlight only on the driven car (one real light in the scene).
      car.spot.intensity = car.driver === 'player' ? 60 : 0;
      // Smoke when badly damaged.
      if (car.health < 40 && !car.smoke) {
        const smoke = new this.THREE.Mesh(
          new this.THREE.SphereGeometry(0.8, 8, 6),
          new this.THREE.MeshBasicMaterial({ color: 0x777777, transparent: true, opacity: 0.45 })
        );
        smoke.position.set(0, 1.6, 1.4);
        car.group.add(smoke);
        car.smoke = smoke;
      }
      if (car.smoke) {
        car.smoke.scale.setScalar(1 + Math.sin(this.flashPhase * 0.7 + car.pos.x) * 0.15);
      }
    }
  }

  drivePlayer(car, dt, input, player) {
    const maxF = CONFIG.carMaxSpeed;
    const maxR = CONFIG.carMaxReverse;
    if (input.f) car.speed += CONFIG.carAccel * dt;
    else if (input.b) car.speed -= (car.speed > 0.5 ? CONFIG.carBrake : CONFIG.carAccel * 0.6) * dt;
    else car.speed *= Math.max(0, 1 - dt * 1.4);
    car.speed = Math.max(-maxR, Math.min(maxF, car.speed));
    const steer = (input.l ? 1 : 0) - (input.r ? 1 : 0);
    if (steer !== 0 && Math.abs(car.speed) > 0.5) {
      const dir = car.speed >= 0 ? 1 : -1;
      car.heading += steer * CONFIG.carTurn * dt * Math.min(1, Math.abs(car.speed) / 12) * dir;
    }
    player.pos.copy(car.pos);
    player.heading = car.heading;
  }

  drivePolice(car, dt, target) {
    const dx = target.x - car.pos.x;
    const dz = target.z - car.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 3) {
      car.speed *= Math.max(0, 1 - dt * 3);
      return;
    }
    const want = Math.atan2(dx, dz);
    let diff = want - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
    const maxSpeed = Math.min(CONFIG.policeMaxSpeed, 18 + dist * 0.6);
    car.speed += (maxSpeed - car.speed) * Math.min(1, dt * 1.2);
  }

  damage(car, n) {
    car.health = Math.max(0, car.health - n);
    return car.health;
  }
}
