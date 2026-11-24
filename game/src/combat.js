// ZENITH — combat.js (round 3 redo)
// The pistol and the people who shoot back. Hitscan from the camera with
// a whisker of spread; every shot leaves a short-lived tracer (a thin
// glowing rod stretched between muzzle and impact), a muzzle flash, and
// a small kick to the camera. Rivals fire in bursts and get less
// accurate the further away they are.
import * as THREE from 'three';
import { GUN } from './config.js';

export function newArsenal() {
  return {
    ammo: GUN.magSize,
    reserve: 999,
    reloading: false,
    reloadTimer: 0,
    fireTimer: 0,
    tracers: [], // {mesh, life, maxLife}
  };
}

// Stretch a unit cylinder between two points and fade it out over `life`.
function drawTracer(G, from, to, color, life) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  if (len < 0.01) return;
  const geo = new THREE.CylinderGeometry(0.03, 0.03, len, 5, 1, true);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
  const rod = new THREE.Mesh(geo, mat);
  rod.position.copy(from).addScaledVector(dir, 0.5);
  rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  G.scene.add(rod);
  G.combat.tracers.push({ mesh: rod, life, maxLife: life });
}

// Fire one shot from the camera centre. `targets` are the shootables:
// anything with {pos, hp, alive, kind, mesh}. Returns {hit, end} so the
// game loop can price the crime, or null when the gun cannot fire.
export function shoot(G, targets) {
  const c = G.combat;
  if (c.reloading || c.fireTimer > 0) return null;
  if (c.ammo <= 0) {
    G.sound.dryClick();
    return null;
  }
  c.fireTimer = GUN.fireInterval;
  c.ammo -= 1;
  G.sound.shot();
  G.recoil = 0.035;

  const origin = G.camera.position.clone();
  const dir = new THREE.Vector3();
  G.camera.getWorldDirection(dir);
  dir.x += (Math.random() - 0.5) * 0.012;
  dir.y += (Math.random() - 0.5) * 0.012;
  dir.normalize();
  const ray = new THREE.Raycaster(origin, dir, 0.1, GUN.range);

  // Refresh world matrices first: a target spawned this frame must be hit
  // where it stands, not where its unrendered identity matrix puts it.
  const meshes = [];
  const owner = new Map();
  for (const t of targets) {
    if (!t.alive || !t.mesh) continue;
    t.mesh.updateMatrixWorld(true);
    t.mesh.traverse((o) => {
      if (o.isMesh) {
        meshes.push(o);
        owner.set(o, t);
      }
    });
  }
  const hits = ray.intersectObjects(meshes, false);
  let end = origin.clone().addScaledVector(dir, GUN.range);
  let hit = null;
  if (hits.length) {
    end = hits[0].point.clone();
    hit = owner.get(hits[0].object) || null;
    if (hit) {
      hit.hp -= GUN.damage;
      if (hit.hp <= 0) {
        hit.alive = false;
        if (hit.mesh) hit.mesh.visible = false;
      }
    }
  }
  drawTracer(G, origin, end, 0xffd76a, 0.09);
  const flash = new THREE.PointLight(0xffc860, 12, 9, 1.5);
  flash.position.copy(origin).addScaledVector(dir, 0.8);
  G.scene.add(flash);
  setTimeout(() => G.scene.remove(flash), 60);
  return { hit, end };
}

export function beginReload(G) {
  const c = G.combat;
  if (c.reloading || c.ammo === GUN.magSize) return;
  c.reloading = true;
  c.reloadTimer = GUN.reloadSeconds;
  G.sound.reload();
}

export function tickArsenal(G, dt) {
  const c = G.combat;
  if (c.fireTimer > 0) c.fireTimer -= dt;
  if (c.reloading) {
    c.reloadTimer -= dt;
    if (c.reloadTimer <= 0) {
      c.reloading = false;
      c.ammo = GUN.magSize;
    }
  }
  for (let i = c.tracers.length - 1; i >= 0; i--) {
    const t = c.tracers[i];
    t.life -= dt;
    t.mesh.material.opacity = Math.max(0, t.life / t.maxLife) * 0.85;
    if (t.life <= 0) {
      G.scene.remove(t.mesh);
      t.mesh.geometry.dispose();
      t.mesh.material.dispose();
      c.tracers.splice(i, 1);
    }
  }
}

// All player damage funnels through here so the flash and the wasted
// flow can never be forgotten by a caller.
export function hurtPlayer(G, amount) {
  if (G.mode !== 'playing' || G.player.hp <= 0) return;
  G.player.hp = Math.max(0, G.player.hp - amount);
  G.hudFlash('damage');
  if (G.player.hp <= 0) G.wasted();
}

// Rival crew: they hold their ground, face you, and fire three-round
// bursts with a breath between them. Accuracy falls off with distance.
export function tickRivals(G, dt) {
  for (const r of G.rivals) {
    if (!r.alive) continue;
    const dist = Math.hypot(r.pos.x - G.player.pos.x, r.pos.z - G.player.pos.z);
    if (dist >= 55 || G.mode !== 'playing') continue;
    r.mesh.rotation.y = Math.atan2(G.player.pos.x - r.pos.x, G.player.pos.z - r.pos.z);
    if (r.burstLeft === undefined) {
      r.burstLeft = 0;
      r.shootTimer = 0.6 + Math.random() * 0.6;
    }
    r.shootTimer -= dt;
    if (r.shootTimer > 0) continue;
    if (r.burstLeft <= 0) r.burstLeft = 3;
    r.burstLeft--;
    r.shootTimer = r.burstLeft > 0 ? 0.16 : 1.1 + Math.random() * 0.8;

    const hitChance = Math.max(0.15, 0.6 - dist * 0.008);
    if (Math.random() < hitChance) {
      hurtPlayer(G, 9 + Math.floor(Math.random() * 7));
      G.sound.thud();
    } else {
      G.sound.shot();
    }
    drawTracer(
      G,
      new THREE.Vector3(r.pos.x, 1.4, r.pos.z),
      new THREE.Vector3(G.player.pos.x, 1.2, G.player.pos.z),
      0xff6a5a,
      0.08,
    );
  }
}
