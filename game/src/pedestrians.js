// ZENITH — pedestrians. Low-poly walkers who stroll the sidewalks, flee from
// gunfire, and fall when shot. A small pool respawns at the map edge.
import { CONFIG } from './config.js';
import { resolveCircleCollision } from './city.js';

const SHIRTS = [0xd8b13a, 0x3aa655, 0xc23b2e, 0x8a3ac2, 0xe8e0d0, 0x2e6fc2, 0xff7e3d];
const SKIN = [0xd9a066, 0xb97a4e, 0x8a5a34, 0xe8c39a];

export class Pedestrians {
  constructor(THREE, scene, city, count) {
    this.THREE = THREE;
    this.scene = scene;
    this.city = city;
    this.list = [];
    this.wantCount = count || 14;
    const spots = city.spawn.peds;
    for (let i = 0; i < this.wantCount; i++) {
      const s = spots[i % spots.length];
      this.spawn(s.x + (i % 3) * 4 - 4, s.z + ((i * 7) % 5) * 3 - 6);
    }
  }

  spawn(x, z) {
    const THREE = this.THREE;
    const g = new THREE.Group();
    const shirt = SHIRTS[(Math.random() * SHIRTS.length) | 0];
    const skin = SKIN[(Math.random() * SKIN.length) | 0];
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.36, 0.9, 8),
      new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.9 })
    );
    body.position.y = 1.0;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 10, 8),
      new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 })
    );
    head.position.y = 1.72;
    g.add(head);
    const legL = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.13, 0.6, 6),
      new THREE.MeshStandardMaterial({ color: 0x232838, roughness: 0.9 })
    );
    legL.position.set(-0.15, 0.3, 0);
    g.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.15;
    g.add(legR);
    g.position.set(x, 0, z);
    this.scene.add(g);
    const ped = {
      group: g,
      legL,
      legR,
      pos: g.position,
      heading: Math.random() * Math.PI * 2,
      speed: CONFIG.pedSpeed * (0.8 + Math.random() * 0.5),
      state: 'walk', // walk | flee | down
      target: this.pickWaypoint(x, z),
      fleeFrom: null,
      downTimer: 0,
      phase: Math.random() * 6,
    };
    this.list.push(ped);
    return ped;
  }

  pickWaypoint(x, z) {
    // Waypoints sit on sidewalks: snap one axis to a road offset.
    const roads = [];
    for (let k = -3; k <= 3; k++) roads.push(k * CONFIG.roadSpacing);
    const near = roads[(Math.random() * roads.length) | 0];
    if (Math.random() < 0.5) return { x: (Math.random() - 0.5) * CONFIG.worldSize * 0.8, z: near + 8.5 };
    return { x: near + 8.5, z: (Math.random() - 0.5) * CONFIG.worldSize * 0.8 };
  }

  fleeFrom(pos) {
    for (const ped of this.list) {
      if (ped.state !== 'walk') continue;
      const d = Math.hypot(ped.pos.x - pos.x, ped.pos.z - pos.z);
      if (d < 26) {
        ped.state = 'flee';
        ped.fleeFrom = { x: pos.x, z: pos.z };
      }
    }
  }

  nearestPed(pos, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const ped of this.list) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(ped.pos.x - pos.x, ped.pos.z - pos.z);
      if (d < bestD) {
        bestD = d;
        best = ped;
      }
    }
    return best;
  }

  shootDown(ped) {
    ped.state = 'down';
    ped.downTimer = 12;
    ped.group.rotation.x = -Math.PI / 2;
    ped.group.position.y = 0.3;
  }

  update(dt) {
    for (const ped of this.list) {
      if (ped.state === 'down') {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          // Get back up and walk off, or respawn at the edge.
          this.scene.remove(ped.group);
          this.list = this.list.filter((p) => p !== ped);
          const edge = (Math.random() - 0.5) * CONFIG.worldSize * 0.8;
          this.spawn(edge, (Math.random() < 0.5 ? -1 : 1) * (CONFIG.worldSize / 2 - 30));
        }
        continue;
      }
      let tx;
      let tz;
      let speed = ped.speed;
      if (ped.state === 'flee' && ped.fleeFrom) {
        const dx = ped.pos.x - ped.fleeFrom.x;
        const dz = ped.pos.z - ped.fleeFrom.z;
        const d = Math.hypot(dx, dz) || 1;
        tx = ped.pos.x + (dx / d) * 30;
        tz = ped.pos.z + (dz / d) * 30;
        speed = CONFIG.pedFleeSpeed;
        if (d > 45) {
          ped.state = 'walk';
          ped.target = this.pickWaypoint(ped.pos.x, ped.pos.z);
        }
      } else {
        tx = ped.target.x;
        tz = ped.target.z;
        const d = Math.hypot(tx - ped.pos.x, tz - ped.pos.z);
        if (d < 2) ped.target = this.pickWaypoint(ped.pos.x, ped.pos.z);
      }
      const dx = tx - ped.pos.x;
      const dz = tz - ped.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01) {
        const want = Math.atan2(dx, dz);
        let diff = want - ped.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        ped.heading += Math.max(-3 * dt, Math.min(3 * dt, diff));
        ped.pos.x += Math.sin(ped.heading) * speed * dt;
        ped.pos.z += Math.cos(ped.heading) * speed * dt;
        ped.phase += dt * speed * 2.4;
      }
      resolveCircleCollision(ped.pos, 0.5, this.city.colliders, this.city.bounds);
      ped.group.rotation.y = ped.heading;
      const swing = Math.sin(ped.phase) * 0.5;
      ped.legL.rotation.x = swing;
      ped.legR.rotation.x = -swing;
    }
    // Keep the street populated.
    while (this.list.length < this.wantCount) {
      const edge = (Math.random() - 0.5) * CONFIG.worldSize * 0.8;
      this.spawn(edge, (Math.random() < 0.5 ? -1 : 1) * (CONFIG.worldSize / 2 - 30));
    }
  }
}
