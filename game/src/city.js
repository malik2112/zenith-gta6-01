// ZENITH — city.js (fresh rewrite, round 3)
// Builds the whole town out of primitives: the road grid, pavement strips,
// pastel towers with lit windows, the observatory lodge, the dome on the
// ridge, pines, cable-car pylons and streetlights. Everything procedural —
// the only "asset" is a canvas texture painted at boot. Alongside the
// meshes it returns the collision boxes and the intersection graph that
// traffic and pedestrians navigate by.
import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';

// Xorshift32: tiny deterministic stream so the town is identical every boot
// (and identical in the screenshots to what the player gets).
function xorshift32(seed) {
  let s = (seed >>> 0) || 0x9e3779b9;
  return function next() {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

// Paint one facade: base colour, a grid of windows, some of them lit warm
// or cool. Each tower gets its own seed so no two facades repeat exactly.
function facadeTexture(baseHex, seed) {
  const rand = xorshift32(seed * 2654435761);
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const cols = 4;
  const rows = 10;
  const cellW = canvas.width / cols;
  const cellH = canvas.height / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const roll = rand();
      ctx.fillStyle = roll < 0.3 ? '#ffd98a' : roll < 0.42 ? '#9ad4ff' : '#2c3a4a';
      ctx.fillRect(c * cellW + 4, r * cellH + 4, cellW - 8, cellH - 8);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// The x (and z) coordinate of every road centre line, west to east.
export function streetCenters() {
  const lines = [];
  for (let i = 0; i <= CITY.blocks; i++) lines.push(-CITY.half + i * CITY.block);
  return lines;
}

const hexCss = (n) => `#${n.toString(16).padStart(6, '0')}`;

// A flat plane lying on the ground, centred at (x, z), lifted `y` metres.
function groundPlane(scene, w, d, color, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  scene.add(mesh);
  return mesh;
}

// One box, added to the scene, optionally registered as a collider.
function addBox(scene, colliders, w, h, d, material, x, y, z, solid = false) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  scene.add(mesh);
  if (solid) {
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  }
  return mesh;
}

export function buildCity(scene, seed = 20261118) {
  const rand = xorshift32(seed);
  const colliders = [];
  const buildings = [];
  const centers = streetCenters();
  const road = CITY.streetWidth;
  const half = CITY.half;
  const span = half * 2 + road;

  // Far ground and the town slab it sits on.
  groundPlane(scene, 900, 700, PALETTE.ground, 40, -0.05, 0);
  groundPlane(scene, span, span, 0x7d838a, 0, 0, 0);

  // Roads on every grid line, with dashed centre markings.
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8d8c8 });
  for (const c of centers) {
    groundPlane(scene, road, span, PALETTE.asphalt, c, 0.01, 0);
    groundPlane(scene, span, road, PALETTE.asphalt, 0, 0.01, c);
    for (let d = -half + 7; d < half; d += 14) {
      const dashV = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 5), dashMat);
      dashV.rotation.x = -Math.PI / 2;
      dashV.position.set(c, 0.02, d);
      scene.add(dashV);
      const dashH = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.5), dashMat);
      dashH.rotation.x = -Math.PI / 2;
      dashH.position.set(d, 0.02, c);
      scene.add(dashH);
    }
  }

  // Pavement strips flanking every road.
  for (const c of centers) {
    const off = road / 2 + 2;
    groundPlane(scene, 4, span, PALETTE.sidewalk, c - off, 0.015, 0);
    groundPlane(scene, 4, span, PALETTE.sidewalk, c + off, 0.015, 0);
    groundPlane(scene, span, 4, PALETTE.sidewalk, 0, 0.015, c - off);
    groundPlane(scene, span, 4, PALETTE.sidewalk, 0, 0.015, c + off);
  }

  // Towers: each block is quartered into lots; most lots get a tower set
  // back from the pavement, heights skewed low with the odd tall one.
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x5a5f66 });
  let facadeSeed = 11;
  for (let bx = 0; bx < CITY.blocks; bx++) {
    for (let bz = 0; bz < CITY.blocks; bz++) {
      const blockX = -half + bx * CITY.block;
      const blockZ = -half + bz * CITY.block;
      for (let lx = 0; lx < 2; lx++) {
        for (let lz = 0; lz < 2; lz++) {
          if (rand() < 0.22) continue; // empty lot: a car park, a gap
          const lotX = blockX + road / 2 + lx * ((CITY.block - road) / 2);
          const lotZ = blockZ + road / 2 + lz * ((CITY.block - road) / 2);
          const lotSize = (CITY.block - road) / 2;
          const w = 12 + rand() * (lotSize - 16);
          const d = 12 + rand() * (lotSize - 16);
          const h = 11 + rand() * rand() * 52;
          const cx = lotX + lotSize / 2 + (rand() - 0.5) * 3;
          const cz = lotZ + lotSize / 2 + (rand() - 0.5) * 3;
          const paint = PALETTE.building[Math.floor(rand() * PALETTE.building.length)];
          const wall = new THREE.MeshLambertMaterial({ map: facadeTexture(hexCss(paint), facadeSeed++) });
          const tower = addBox(scene, colliders, w, h, d, wall, cx, h / 2, cz, true);
          addBox(scene, colliders, w + 1, 0.8, d + 1, roofMat, cx, h + 0.4, cz);
          buildings.push(tower);
        }
      }
    }
  }

  // Ridge Lodge — the mission hub. Low stone lodge, pitched roof, lit sign.
  const lodgeMat = new THREE.MeshLambertMaterial({ color: 0x7a7568 });
  addBox(scene, colliders, 26, 9, 18, lodgeMat, -186, 4.5, -168, true);
  const roofL = new THREE.Mesh(new THREE.BoxGeometry(27, 0.5, 10), roofMat);
  roofL.position.set(-186, 10.2, -172.4);
  roofL.rotation.x = 0.42;
  scene.add(roofL);
  const roofR = roofL.clone();
  roofR.position.z = -163.6;
  roofR.rotation.x = -0.42;
  scene.add(roofR);
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(24, 2.4, 0.6),
    new THREE.MeshBasicMaterial({ color: 0xffe08a }),
  );
  sign.position.set(-186, 8.2, -158.6);
  scene.add(sign);

  // The observatory: drum, dome with a slit, and the radio dish nearby.
  const drum = new THREE.Mesh(
    new THREE.CylinderGeometry(14, 15, 10, 16),
    new THREE.MeshLambertMaterial({ color: 0xd8d8e0 }),
  );
  drum.position.set(150, 5, -150);
  scene.add(drum);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(14, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }),
  );
  dome.position.set(150, 10, -150);
  scene.add(dome);
  const slit = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 9, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x2c3440 }),
  );
  slit.position.set(150, 15.5, -136.4);
  slit.rotation.x = -0.35;
  scene.add(slit);
  const scope = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.1, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0x8a8a96 }),
  );
  scope.position.set(150, 17, -141);
  scope.rotation.x = 0.8;
  scene.add(scope);
  colliders.push({ minX: 136, maxX: 164, minZ: -164, maxZ: -136 });

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.6, 12, 8),
    new THREE.MeshLambertMaterial({ color: 0x5a5a6a }),
  );
  mast.position.set(118, 6, -118);
  scene.add(mast);
  const dish = new THREE.Mesh(
    new THREE.CircleGeometry(9, 20),
    new THREE.MeshLambertMaterial({ color: 0xc8c8d8, side: THREE.DoubleSide }),
  );
  dish.position.set(118, 13, -118);
  dish.rotation.x = -Math.PI / 4;
  scene.add(dish);

  // Pines along the ridge shelf, two staggered rows.
  const palms = [];
  const trunkMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmTrunk });
  const crownMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmLeaf });
  for (let z = -200; z <= 200; z += 20) {
    for (const px of [214, 222]) {
      const tx = px + rand() * 2;
      const tz = z + rand() * 4;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 4, 6), trunkMat);
      trunk.position.set(tx, 2, tz);
      scene.add(trunk);
      const crown = new THREE.Mesh(new THREE.ConeGeometry(2.6, 8, 7), crownMat);
      crown.position.set(tx, 8, tz);
      scene.add(crown);
      palms.push(trunk);
    }
  }

  // Cable-car pylons marching down the central avenue, cable strung between.
  const pylonMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  for (const pz of [-150, -50, 50, 150]) {
    const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 22, 6), pylonMat);
    pylon.position.set(8, 11, pz);
    scene.add(pylon);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(5, 0.5, 0.5), pylonMat);
    arm.position.set(8, 21.5, pz);
    scene.add(arm);
  }
  const cable = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.3, 340),
    new THREE.MeshLambertMaterial({ color: 0x222831 }),
  );
  cable.position.set(8, 21.5, 0);
  scene.add(cable);

  // Streetlights at every second crossing.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let i = 0; i < centers.length; i += 2) {
    for (let j = 0; j < centers.length; j += 2) {
      const lx = centers[i] + road / 2 + 1.5;
      const lz = centers[j] + road / 2 + 1.5;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6, 6), poleMat);
      pole.position.set(lx, 3, lz);
      scene.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampMat);
      lamp.position.set(lx, 6.2, lz);
      scene.add(lamp);
    }
  }

  // The ridge shelf, the violet valley beyond it, and two overlook decks.
  groundPlane(scene, 60, half * 2 + 60, PALETTE.sand, CITY.beachX + 16, 0.02, 0);
  groundPlane(scene, 220, 700, PALETTE.sea, CITY.waterX + 110, 0.0, 0);
  const deckMat = new THREE.MeshLambertMaterial({ color: 0x5a5a6a });
  for (const pz of [-70, 60]) {
    addBox(scene, colliders, 46, 1, 8, deckMat, CITY.beachX + 30, 0.6, pz);
    addBox(scene, colliders, 46, 0.3, 0.4, deckMat, CITY.beachX + 30, 1.6, pz - 3.8);
    addBox(scene, colliders, 46, 0.3, 0.4, deckMat, CITY.beachX + 30, 1.6, pz + 3.8);
  }

  // The road graph: every intersection, for traffic to cruise between.
  const nodes = [];
  for (const x of centers) for (const z of centers) nodes.push({ x, z });

  return { colliders, buildings, nodes, centers, palms };
}

// Push a circle (player, car, ped) out of every building box it overlaps.
// Resolves the deepest overlap first, then re-checks, so a circle wedged
// in a corner between two towers still ends up outside both. Returns true
// when anything was pushed (callers use that to detect a wall hit).
export function collideCircle(pos, radius, colliders) {
  let pushed = false;
  for (let pass = 0; pass < 3; pass++) {
    let deepest = null;
    let deepestDepth = 0;
    for (const b of colliders) {
      const nearX = Math.max(b.minX, Math.min(pos.x, b.maxX));
      const nearZ = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
      const dx = pos.x - nearX;
      const dz = pos.z - nearZ;
      const distSq = dx * dx + dz * dz;
      if (distSq >= radius * radius) continue;
      const depth = radius - Math.sqrt(distSq || 0);
      if (depth > deepestDepth) {
        deepestDepth = depth;
        deepest = { b, nearX, nearZ, dx, dz, distSq };
      }
    }
    if (!deepest) break;
    pushed = true;
    const { b, nearX, nearZ, dx, dz, distSq } = deepest;
    if (distSq > 1e-6) {
      const dist = Math.sqrt(distSq);
      pos.x = nearX + (dx / dist) * radius;
      pos.z = nearZ + (dz / dist) * radius;
    } else {
      // Centre inside the box: leave by whichever wall is nearest.
      const exits = [
        { d: pos.x - b.minX, x: b.minX - radius, z: pos.z },
        { d: b.maxX - pos.x, x: b.maxX + radius, z: pos.z },
        { d: pos.z - b.minZ, x: pos.x, z: b.minZ - radius },
        { d: b.maxZ - pos.z, x: pos.x, z: b.maxZ + radius },
      ];
      exits.sort((a, c) => a.d - c.d);
      pos.x = exits[0].x;
      pos.z = exits[0].z;
    }
  }
  return pushed;
}
