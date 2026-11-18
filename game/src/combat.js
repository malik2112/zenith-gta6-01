// SOLMAR BAY — combat.js
// One job: the pistol. Hitscan shooting from the camera, tracers, muzzle
// flash, reloads, and what happens to the people and cars that get hit.
// Damage and wanted-heat rules live here; the wanted level lives in wanted.js.
import * as THREE from 'three';
import { COMBAT } from './config.js';

export function createCombat() {
  return {
    ammo: COMBAT.magSize,
    reserve: 999,
    reloading: false,
    reloadTimer: 0,
    fireTimer: 0,
    tracers: [],   // {line, life}
  };
}

// Fire one hitscan shot from the camera centre. targets is a list of
// shootable things: {pos, radius, hp, alive, kind, mesh}. Returns a report
// the game loop turns into sound, heat and floating text.
export function fireWeapon(G, targets) {
  const c = G.combat;
  if (c.reloading || c.fireTimer > 0 || c.ammo <= 0) {
    if (c.ammo <= 0) G.sound.dryClick();
    return null;
  }
  c.fireTimer = COMBAT.fireInterval;
  c.ammo -= 1;
  G.sound.shot();
  const origin = G.camera.position.clone();
  const dir = new THREE.Vector3();
  G.camera.getWorldDirection(dir);
  // slight spread
  dir.x += (Math.random() - 0.5) * 0.012;
  dir.y += (Math.random() - 0.5) * 0.012;
  dir.normalize();
  const ray = new THREE.Raycaster(origin, dir, 0.1, COMBAT.range);
  // collect meshes for the raycast; refresh world matrices first, so a
  // target spawned this very frame (a rival, a fresh ped) is hit where it
  // stands, not where its never-rendered identity matrix says it is.
  const meshes = [];
  const byMesh = new Map();
  for (const t of targets) {
    if (!t.alive || !t.mesh) continue;
    t.mesh.updateMatrixWorld(true);
    t.mesh.traverse((o) => { if (o.isMesh) { meshes.push(o); byMesh.set(o, t); } });
  }
  const hits = ray.intersectObjects(meshes, false);
  let end = origin.clone().addScaledVector(dir, COMBAT.range);
  let hit = null;
  if (hits.length) {
    const h = hits[0];
    end = h.point.clone();
    hit = byMesh.get(h.object) || null;
    if (hit) {
      hit.hp -= COMBAT.damage;
      if (hit.hp <= 0) {
        hit.alive = false;
        if (hit.mesh) hit.mesh.visible = false;
      }
    }
  }
  // tracer line, fades out in updateCombat
  const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
    color: 0xffd76a, transparent: true, opacity: 0.9,
  }));
  G.scene.add(line);
  c.tracers.push({ line, life: 0.09 });
  // muzzle flash: brief point light at the camera
  const flash = new THREE.PointLight(0xffc860, 12, 9, 1.5);
  flash.position.copy(origin).addScaledVector(dir, 0.8);
  G.scene.add(flash);
  setTimeout(() => { G.scene.remove(flash); }, 60);
  return { hit, end };
}

export function startReload(G) {
  const c = G.combat;
  if (c.reloading || c.ammo === COMBAT.magSize) return;
  c.reloading = true;
  c.reloadTimer = COMBAT.reloadSeconds;
  G.sound.reload();
}

export function updateCombat(G, dt) {
  const c = G.combat;
  if (c.fireTimer > 0) c.fireTimer -= dt;
  if (c.reloading) {
    c.reloadTimer -= dt;
    if (c.reloadTimer <= 0) {
      c.reloading = false;
      c.ammo = COMBAT.magSize;
    }
  }
  for (let i = c.tracers.length - 1; i >= 0; i--) {
    const t = c.tracers[i];
    t.life -= dt;
    t.line.material.opacity = Math.max(0, t.life / 0.09) * 0.9;
    if (t.life <= 0) {
      G.scene.remove(t.line);
      t.line.geometry.dispose();
      t.line.material.dispose();
      c.tracers.splice(i, 1);
    }
  }
}

// Damage the player (cop bullets, rival bullets, car crashes).
export function damagePlayer(G, amount) {
  if (G.mode !== 'playing' || G.player.hp <= 0) return;
  G.player.hp = Math.max(0, G.player.hp - amount);
  G.hudFlash('damage');
  if (G.player.hp <= 0) G.wasted();
}

// Rival crew: armed NPCs that stand their ground and shoot at the player.
export function updateRivals(G, dt) {
  for (const r of G.rivals) {
    if (!r.alive) continue;
    const d = Math.hypot(r.pos.x - G.player.pos.x, r.pos.z - G.player.pos.z);
    if (d < 55 && G.mode === 'playing') {
      r.shootTimer -= dt;
      // face the player
      r.mesh.rotation.y = Math.atan2(G.player.pos.x - r.pos.x, G.player.pos.z - r.pos.z);
      if (r.shootTimer <= 0) {
        r.shootTimer = 0.9 + Math.random() * 0.7;
        // inaccurate: 55% hit chance, worse at range
        const hitChance = Math.max(0.15, 0.6 - d * 0.008);
        if (Math.random() < hitChance) {
          damagePlayer(G, 9 + Math.floor(Math.random() * 7));
          G.sound.thud();
        } else {
          G.sound.shot();
        }
        // their tracer, from rival to player
        const geo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(r.pos.x, 1.4, r.pos.z),
          new THREE.Vector3(G.player.pos.x, 1.2, G.player.pos.z),
        ]);
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
          color: 0xff6a5a, transparent: true, opacity: 0.8,
        }));
        G.scene.add(line);
        G.combat.tracers.push({ line, life: 0.08 });
      }
    }
  }
}
