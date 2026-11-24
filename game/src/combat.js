// ZENITH — combat. A pistol with 12 rounds, raycast hits, a tracer line and
// a muzzle flash. Shooting a pedestrian, a car or a cop all raise heat.
import { CONFIG } from './config.js';

export class Combat {
  constructor(THREE, scene, camera) {
    this.THREE = THREE;
    this.scene = scene;
    this.camera = camera;
    this.ammo = 12;
    this.magSize = 12;
    this.cooldown = 0;
    this.reloadTimer = 0;
    this.shotsFired = 0;
    this.hits = 0;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 120;

    // Tracer: a thin line reused for every shot, faded out over 80ms.
    const tracerGeo = new THREE.BufferGeometry();
    tracerGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.tracer = new THREE.Line(
      tracerGeo,
      new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0 })
    );
    this.tracer.frustumCulled = false;
    scene.add(this.tracer);
    this.tracerLife = 0;

    this.flash = new THREE.PointLight(0xffc36b, 0, 18, 1.5);
    scene.add(this.flash);
    this.flashLife = 0;
  }

  get reloading() {
    return this.reloadTimer > 0;
  }

  startReload() {
    if (this.reloadTimer <= 0 && this.ammo < this.magSize) this.reloadTimer = 1.2;
  }

  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this.ammo = this.magSize;
    }
    if (this.tracerLife > 0) {
      this.tracerLife -= dt;
      this.tracer.material.opacity = Math.max(0, this.tracerLife / 0.08);
    }
    if (this.flashLife > 0) {
      this.flashLife -= dt;
      this.flash.intensity = Math.max(0, this.flashLife / 0.06) * 30;
    }
  }

  // Fires from the camera through the screen centre. `world` gives the
  // pedestrians, vehicles and wanted system for hit resolution.
  // Returns null, or { kind: 'ped'|'car'|'police'|'none', target }.
  shoot(world) {
    if (this.cooldown > 0 || this.reloadTimer > 0) return null;
    if (this.ammo <= 0) {
      this.startReload();
      return { kind: 'empty', target: null };
    }
    this.ammo -= 1;
    this.cooldown = 0.22;
    this.shotsFired += 1;

    const origin = new this.THREE.Vector3();
    this.camera.getWorldPosition(origin);
    const dir = new this.THREE.Vector3();
    this.camera.getWorldDirection(dir);
    // Start the ray a little ahead of the camera so the player mesh is skipped.
    origin.addScaledVector(dir, 1.2);

    // Collect hittable meshes: peds, cars (and their children).
    const targets = [];
    for (const ped of world.peds.list) {
      if (ped.state !== 'down') targets.push({ mesh: ped.group, kind: 'ped', ref: ped });
    }
    for (const car of world.vehicles.cars) {
      targets.push({ mesh: car.group, kind: car.isPolice ? 'police' : 'car', ref: car });
    }
    const meshes = [];
    const owner = new Map();
    for (const t of targets) {
      t.mesh.traverse((m) => {
        if (m.isMesh) {
          meshes.push(m);
          owner.set(m, t);
        }
      });
    }
    this.raycaster.set(origin, dir);
    const hits = this.raycaster.intersectObjects(meshes, false);
    const end = origin.clone().addScaledVector(dir, 90);
    let result = { kind: 'none', target: null };
    if (hits.length > 0) {
      const hit = hits[0];
      end.copy(hit.point);
      const t = owner.get(hit.object);
      if (t) {
        this.hits += 1;
        result = { kind: t.kind, target: t.ref };
        if (t.kind === 'ped') {
          world.peds.shootDown(t.ref);
          world.wanted.addHeat(CONFIG.heatShootPed);
          world.peds.fleeFrom(t.ref.pos);
        } else if (t.kind === 'car') {
          world.vehicles.damage(t.ref, 25);
          world.wanted.addHeat(CONFIG.heatShootCar);
        } else if (t.kind === 'police') {
          world.vehicles.damage(t.ref, 25);
          world.wanted.addHeat(CONFIG.heatShootPolice);
        }
      }
    } else {
      // A miss still scares the street.
      world.peds.fleeFrom(world.player.pos);
    }

    // Tracer + muzzle flash at the gun.
    const p = this.tracer.geometry.attributes.position;
    p.setXYZ(0, origin.x, origin.y, origin.z);
    p.setXYZ(1, end.x, end.y, end.z);
    p.needsUpdate = true;
    this.tracerLife = 0.08;
    this.tracer.material.opacity = 1;
    this.flash.position.copy(origin).addScaledVector(dir, 2);
    this.flashLife = 0.06;
    this.flash.intensity = 30;
    return result;
  }
}
