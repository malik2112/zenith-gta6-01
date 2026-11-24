// ZENITH — the city. Builds the whole sunset mountain town from primitives:
// ground, road grid, buildings with lit windows, streetlights, and a ring of
// mountains. Also owns collision boxes and spawn anchors.
import { CONFIG, SPAWNS } from './config.js';

function makeWindowTexture(THREE) {
  // One shared canvas texture: a dark facade with random lit windows.
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#1c1a2e';
  g.fillRect(0, 0, 128, 256);
  const lit = ['#ffd27a', '#9fd8ff', '#ff9d5c', '#fff2c0'];
  for (let y = 12; y < 244; y += 22) {
    for (let x = 10; x < 118; x += 18) {
      if (Math.random() < 0.42) {
        g.fillStyle = lit[(Math.random() * lit.length) | 0];
        g.globalAlpha = 0.55 + Math.random() * 0.45;
        g.fillRect(x, y, 10, 12);
      }
    }
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(THREE, scene) {
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);
  const colliders = [];
  const half = CONFIG.worldSize / 2;

  scene.background = new THREE.Color(CONFIG.skyHorizon);
  scene.fog = new THREE.FogExp2(CONFIG.fogColor, CONFIG.fogDensity);

  // Ground: dark scrubland with a subtle checker of two tones.
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x2e2a33, roughness: 1 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.worldSize + 160, CONFIG.worldSize + 160), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Distant gradient sky dome (inside-out sphere, vertex colours).
  const skyGeo = new THREE.SphereGeometry(900, 24, 12);
  const top = new THREE.Color(CONFIG.skyTop);
  const horizon = new THREE.Color(CONFIG.skyHorizon);
  const pos = skyGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, Math.min(1, (pos.getY(i) / 900 + 0.12) / 0.7));
    const col = horizon.clone().lerp(top, t);
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const sky = new THREE.Mesh(
    skyGeo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })
  );
  group.add(sky);

  // Sun disc low on the western horizon.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(46, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false })
  );
  sun.position.set(-760, 120, -220);
  sun.lookAt(0, 60, 0);
  group.add(sun);

  // Mountain ring: cones of dusk purple around the playable square.
  const mountainMat = new THREE.MeshStandardMaterial({ color: 0x4a3560, roughness: 1, flatShading: true });
  const mountainMat2 = new THREE.MeshStandardMaterial({ color: 0x5d4368, roughness: 1, flatShading: true });
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + 0.11;
    const r = half + 90 + ((i * 37) % 70);
    const h = 130 + ((i * 53) % 140);
    const m = new THREE.Mesh(
      new THREE.ConeGeometry(90 + ((i * 29) % 60), h, 5),
      i % 2 === 0 ? mountainMat : mountainMat2
    );
    m.position.set(Math.cos(a) * r, h / 2 - 6, Math.sin(a) * r);
    m.rotation.y = a;
    group.add(m);
    // Snow cap: small pale cone on the tallest peaks.
    if (h > 220) {
      const cap = new THREE.Mesh(
        new THREE.ConeGeometry(26, 34, 5),
        new THREE.MeshStandardMaterial({ color: 0xe8dfe8, roughness: 0.9, flatShading: true })
      );
      cap.position.set(m.position.x, h - 20, m.position.z);
      cap.rotation.y = a;
      group.add(cap);
    }
  }

  // Roads: grid of dark strips with dashed centre lines.
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x17161c, roughness: 0.95 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8b13a });
  const roadLines = [];
  for (let k = -3; k <= 3; k++) {
    const c = k * CONFIG.roadSpacing;
    roadLines.push(c);
    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.worldSize, CONFIG.roadWidth), roadMat);
      road.rotation.x = -Math.PI / 2;
      if (horizontal) road.position.set(0, 0.02, c);
      else {
        road.rotation.z = Math.PI / 2;
        road.position.set(c, 0.02, 0);
      }
      road.receiveShadow = true;
      group.add(road);
      // Dashes along the centre line.
      for (let d = -half + 10; d < half - 10; d += 16) {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(6, 0.06, 0.5), dashMat);
        if (horizontal) dash.position.set(d, 0.05, c);
        else dash.position.set(c, 0.05, d);
        group.add(dash);
      }
    }
  }

  // Sidewalks: pale strips flanking every road.
  const walkMat = new THREE.MeshStandardMaterial({ color: 0x3d3a44, roughness: 1 });
  for (const c of roadLines) {
    for (const off of [-8.5, 8.5]) {
      for (const horizontal of [true, false]) {
        const walk = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.worldSize, 3), walkMat);
        walk.rotation.x = -Math.PI / 2;
        if (horizontal) walk.position.set(0, 0.03, c + off);
        else {
          walk.rotation.z = Math.PI / 2;
          walk.position.set(c + off, 0.03, 0);
        }
        group.add(walk);
      }
    }
  }

  // Buildings: boxes on the blocks between roads, window texture on all sides.
  const winTex = makeWindowTexture(THREE);
  const facadeMat = new THREE.MeshStandardMaterial({ map: winTex, roughness: 0.85, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 0.55 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x241f2e, roughness: 1 });
  const buildings = [];
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let gx = -3; gx <= 2; gx++) {
    for (let gz = -3; gz <= 2; gz++) {
      const bx = gx * CONFIG.roadSpacing + CONFIG.roadSpacing / 2;
      const bz = gz * CONFIG.roadSpacing + CONFIG.roadSpacing / 2;
      if (Math.abs(bx) < 30 && Math.abs(bz) < 30) continue; // keep the central plaza open
      const w = 18 + rand() * 22;
      const d = 18 + rand() * 22;
      const h = 9 + rand() * 34;
      const mats = [facadeMat, facadeMat, roofMat, roofMat, facadeMat, facadeMat];
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
      b.position.set(bx, h / 2, bz);
      b.castShadow = true;
      b.receiveShadow = true;
      group.add(b);
      buildings.push(b);
      colliders.push({ minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - d / 2, maxZ: bz + d / 2 });
      // Rooftop beacon on the tallest towers.
      if (h > 34) {
        const beacon = new THREE.Mesh(
          new THREE.SphereGeometry(0.7, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xff4444 })
        );
        beacon.position.set(bx, h + 1.2, bz);
        group.add(beacon);
      }
    }
  }

  // Streetlights at every other intersection: pole + warm glowing head.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.7, metalness: 0.6 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe1a0 });
  const lampHeads = [];
  for (let gx = -3; gx <= 3; gx += 2) {
    for (let gz = -3; gz <= 3; gz += 2) {
      const x = gx * CONFIG.roadSpacing + 8;
      const z = gz * CONFIG.roadSpacing + 8;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), poleMat);
      pole.position.set(x, 3, z);
      group.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), lampMat);
      head.position.set(x, 6.1, z);
      group.add(head);
      lampHeads.push(head);
    }
  }

  // Central plaza: fountain ring + the "ZENITH" sign block.
  const plaza = new THREE.Mesh(
    new THREE.CylinderGeometry(14, 16, 1.2, 24),
    new THREE.MeshStandardMaterial({ color: 0x4a4456, roughness: 0.9 })
  );
  plaza.position.set(0, 0.6, 0);
  group.add(plaza);
  colliders.push({ minX: -14, maxX: 14, minZ: -14, maxZ: 14 });

  // A few scrub trees (cone + trunk) scattered on blocks.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f5d3a, roughness: 1, flatShading: true });
  for (let i = 0; i < 26; i++) {
    const x = ((i * 97) % CONFIG.worldSize) - half;
    const z = ((i * 61) % CONFIG.worldSize) - half;
    if (Math.abs(x % CONFIG.roadSpacing) < 14 || Math.abs(z % CONFIG.roadSpacing) < 14) continue;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 2.4, 6), trunkMat);
    trunk.position.set(x, 1.2, z);
    group.add(trunk);
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(2.2, 5, 7), leafMat);
    leaves.position.set(x, 4.6, z);
    group.add(leaves);
  }

  return {
    group,
    colliders,
    buildings,
    lampHeads,
    bounds: half,
    spawn: {
      player: { ...SPAWNS.player },
      cars: SPAWNS.cars.map((c) => ({ ...c })),
      peds: SPAWNS.peds.map((p) => ({ ...p })),
    },
  };
}

// Circle-vs-AABB push-out used by the player, peds and cars.
export function resolveCircleCollision(pos, radius, colliders, bounds) {
  const half = bounds - 2;
  pos.x = Math.max(-half, Math.min(half, pos.x));
  pos.z = Math.max(-half, Math.min(half, pos.z));
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 < 1e-6) {
        pos.x = c.maxX + radius;
      } else {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      }
    }
  }
  return pos;
}
