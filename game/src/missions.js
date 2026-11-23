// ZENITH — missions.js (fresh rewrite, round 3)
// The story: five jobs for Professor Alden Vark, each a small state
// machine with a glowing beacon, a minimap blip, and a cash reward.
// Finish all five and the debt is settled. Every job starts at Ridge
// Lodge; the next one waits there when the last is done.
import * as THREE from 'three';
import { spawnPed } from './pedestrians.js';
import { HUB } from './config.js';
import { syncPolice } from './wanted.js';

export const MISSIONS = [
  {
    id: 1,
    title: 'First Ascent',
    reward: 200,
    brief:
      'Vark: "My rover sits by the lodge, Nadia. Take it up to the cable-car terminus on the east ridge. Bring it back without a scratch — I cannot lend what I no longer have."',
    objective: "Drive Vark's rover to the cable-car terminus",
    type: 'reach',
    radius: 9,
    target: { x: 236, z: 60 },
    needCar: true,
  },
  {
    id: 2,
    title: 'Borrowed Rover',
    reward: 350,
    brief:
      'Vark: "A client of mine collects violet coupes and pays cash, no paperwork. Find one on the street, borrow it permanently, and park it at my lodge."',
    objective: 'Steal a car and bring it to the Ridge Lodge',
    type: 'steal-deliver',
    radius: 10,
    target: { x: -186, z: -168 },
  },
  {
    id: 3,
    title: 'Heat on the Ridge',
    reward: 500,
    brief:
      'Vark: "You clipped a cruiser and now every badge in Zenith knows your name. Shake the tail first — then the safehouse on Summit Road. Arrive clean or do not arrive."',
    objective: 'Lose the wanted level, then reach the safehouse',
    type: 'lose-heat',
    radius: 10,
    target: { x: 100, z: 100 },
    startHeat: 2,
  },
  {
    id: 4,
    title: 'Lens Run',
    reward: 700,
    brief:
      'Vark: "Three crates of telescope glass, three corners of the ridge, one hundred and fifty seconds. The buyers leave at sundown whether the glass is there or not."',
    objective: 'Collect 3 lens crates before the timer runs out',
    type: 'collect',
    count: 3,
    timeLimit: 150,
    packages: [
      { x: -170, z: 170 },
      { x: 170, z: 170 },
      { x: 170, z: -170 },
    ],
  },
  {
    id: 5,
    title: 'The Dome Job',
    reward: 1500,
    brief:
      'Vark: "Last one, Nadia. The dome crew changes shift at dawn and leaves a gap. Take the lens prototype, mind the guards, and bring it down the ridge road. Then we are square."',
    objective: 'Grab the lens prototype at the observatory dome, then escape down the ridge road',
    type: 'grab-escape',
    radius: 10,
    target: { x: 150, z: -138 },
    startHeat: 3,
    escape: { x: 236, z: -70 },
  },
];

export function createMissions() {
  return {
    index: 0,
    state: 'idle', // idle | waiting-hub | active | done
    timer: 0,
    collected: 0,
    packageIndex: 0,
    phase: 0,
    beacon: null,
    beaconPos: null,
    pkgMeshes: [],
  };
}

export function currentMission(m) {
  return m.index < MISSIONS.length ? MISSIONS[m.index] : null;
}

// The objective beacon: a translucent pillar of light, three stacked
// rings, and a spinning diamond so it reads from across the map.
function buildBeacon(scene) {
  const group = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.2, 40, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xffd23a,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  pillar.position.y = 20;
  group.add(pillar);
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.2 - i * 0.5, 0.22, 8, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd23a }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.4 + i * 1.1;
    group.add(ring);
  }
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color: 0xffd23a }),
  );
  diamond.position.y = 8;
  group.add(diamond);
  group.userData.diamond = diamond;
  scene.add(group);
  return group;
}

function removeBeacons(G) {
  const m = G.missions;
  if (m.beacon) {
    G.scene.remove(m.beacon);
    m.beacon = null;
  }
  m.beaconPos = null;
  for (const p of m.pkgMeshes) G.scene.remove(p);
  m.pkgMeshes = [];
}

function showBeaconAt(G, pos) {
  removeBeacons(G);
  const beacon = buildBeacon(G.scene);
  beacon.position.set(pos.x, 0, pos.z);
  G.missions.beacon = beacon;
  G.missions.beaconPos = { x: pos.x, z: pos.z };
}

// The lodge beacon: drive here to pick up the next job.
export function placeHubBeacon(G) {
  if (!G.missions.beacon) showBeaconAt(G, { x: HUB.x, z: HUB.z });
}

export function startMission(G, index) {
  const m = G.missions;
  const def = MISSIONS[index];
  m.index = index;
  m.collected = 0;
  m.packageIndex = 0;
  m.phase = 0;
  if (!def) {
    m.state = 'done';
    return;
  }
  m.state = 'active';
  m.timer = def.timeLimit || 0;
  if (def.type === 'collect') {
    removeBeacons(G);
    for (const p of def.packages) {
      const beacon = buildBeacon(G.scene);
      beacon.position.set(p.x, 0, p.z);
      beacon.scale.setScalar(0.6);
      m.pkgMeshes.push(beacon);
    }
    m.beaconPos = { ...def.packages[0] };
  } else if (def.target) {
    showBeaconAt(G, def.target);
  }
  if (def.startHeat) {
    G.wanted.level = Math.max(G.wanted.level, def.startHeat);
    G.wanted.quietTimer = 0;
    G.sound.sirenStart();
    G.wanted.sirenOn = true;
    syncPolice(G);
  }
  G.hudMessage(`MISSION ${def.id}: ${def.title} — $${def.reward}`, 'mission');
  G.sound.missionStart();
  G.showBriefing(def);
}

// Called whenever Nadia gets into a car; mission 2 cares.
export function onPlayerEnterCar(G) {
  const m = G.missions;
  if (m.state === 'active' && MISSIONS[m.index] && MISSIONS[m.index].type === 'steal-deliver') {
    m.phase = 1;
  }
}

function spawnGuards(G, at) {
  for (let i = 0; i < 2; i++) {
    const guard = spawnPed(G.scene, at.x + (i ? 6 : -6), at.z + 8, Math.random, 'rival');
    guard.hp = 100;
    guard.shootTimer = 1;
    G.rivals.push(guard);
    G.peds.push(guard);
  }
}

// One handler per mission type; each returns true when the job is done.
const HANDLERS = {
  reach(G, def, near) {
    if (!near(def.target, def.radius)) return false;
    if (G.player.onFoot) {
      G.hudHint('You need to be in a car for this drop-off.');
      return false;
    }
    return true;
  },
  'steal-deliver'(G, def, near) {
    return G.missions.phase === 1 && !G.player.onFoot && near(def.target, def.radius);
  },
  'lose-heat'(G, def, near) {
    const m = G.missions;
    if (m.phase === 0 && G.wanted.level === 0) {
      m.phase = 1;
      G.hudMessage('Heat is off — get to the safehouse!', 'good');
      showBeaconAt(G, def.target);
    }
    return m.phase === 1 && near(def.target, def.radius);
  },
  collect(G, def, near) {
    const m = G.missions;
    const pkg = def.packages[m.packageIndex];
    if (!pkg || !near(pkg, 4)) return false;
    m.collected++;
    G.sound.cash();
    G.player.cash += 50;
    G.hudMessage(`Package ${m.collected}/${def.count} collected (+$50)`, 'good');
    const mesh = m.pkgMeshes[m.packageIndex];
    if (mesh) G.scene.remove(mesh);
    m.packageIndex++;
    if (m.packageIndex < def.packages.length) {
      m.beaconPos = { ...def.packages[m.packageIndex] };
      return false;
    }
    return true;
  },
  'grab-escape'(G, def, near) {
    const m = G.missions;
    if (m.phase === 0 && near(def.target, def.radius)) {
      m.phase = 1;
      G.player.cash += 1500;
      G.hudMessage('Cash grabbed! Get to the docks — the PD is coming!', 'bad');
      G.sound.cash();
      showBeaconAt(G, def.escape);
      spawnGuards(G, def.target);
      return false;
    }
    return m.phase === 1 && near(def.escape, def.radius);
  },
};

export function updateMissions(G, dt) {
  const m = G.missions;
  if (m.state !== 'active') return;
  const def = MISSIONS[m.index];
  if (!def) return;
  if (def.timeLimit) {
    m.timer -= dt;
    if (m.timer <= 0) {
      failMission(G, 'Out of time.');
      return;
    }
  }
  if (m.beacon && m.beacon.userData.diamond) {
    m.beacon.userData.diamond.rotation.y += dt * 2;
    m.beacon.userData.diamond.position.y = 8 + Math.sin(G.time * 2.5) * 0.8;
  }
  const px = G.player.pos.x;
  const pz = G.player.pos.z;
  const near = (t, r) => Math.hypot(px - t.x, pz - t.z) < r;
  const handler = HANDLERS[def.type];
  if (handler && handler(G, def, near)) completeMission(G);
}

function completeMission(G) {
  const m = G.missions;
  const def = MISSIONS[m.index];
  G.player.cash += def.reward;
  G.sound.cash();
  G.hudMessage(`MISSION COMPLETE: ${def.title} — +$${def.reward}`, 'good');
  G.stats.missionsDone++;
  removeBeacons(G);
  m.index++;
  if (m.index >= MISSIONS.length) {
    m.state = 'done';
    G.storyComplete();
    return;
  }
  G.saveGame();
  G.hudMessage("New job at Ridge Lodge — head back to Professor Alden Vark's base.", 'mission');
  showBeaconAt(G, { x: HUB.x, z: HUB.z });
  m.state = 'waiting-hub';
}

export function failMission(G, reason) {
  const m = G.missions;
  G.hudMessage(`MISSION FAILED: ${reason} Talk to Professor Alden Vark to retry.`, 'bad');
  G.sound.busted();
  removeBeacons(G);
  showBeaconAt(G, { x: HUB.x, z: HUB.z });
  m.state = 'waiting-hub';
}

// Standing in the lodge beacon starts the next job.
export function updateHub(G) {
  const m = G.missions;
  if (m.state !== 'waiting-hub') return;
  if (Math.hypot(G.player.pos.x - HUB.x, G.player.pos.z - HUB.z) < 9) {
    startMission(G, m.index);
  }
}

export function missionObjectiveText(G) {
  const m = G.missions;
  if (m.state === 'waiting-hub') {
    const next = MISSIONS[m.index];
    return next ? `Go to Ridge Lodge to start: ${next.title}` : 'Story complete!';
  }
  if (m.state !== 'active') return 'No active mission';
  const def = MISSIONS[m.index];
  let text = def.objective;
  if (def.type === 'collect') text += ` — ${m.collected}/${def.count}`;
  if (def.timeLimit) text += ` — ${Math.max(0, Math.ceil(m.timer))}s left`;
  if (def.type === 'grab-escape' && m.phase === 1) text = 'Escape to the docks!';
  if (def.type === 'lose-heat' && m.phase === 0) text = 'Lose the wanted level!';
  return text;
}
