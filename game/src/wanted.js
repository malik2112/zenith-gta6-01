// ZENITH — wanted.js (fresh rewrite, round 3)
// Heat, stars, and the Ridge PD. Crimes price themselves in stars; the
// department answers with as many cruisers as the level warrants,
// spawning them on real roads a sensible distance away. Stars cool one
// at a time after a quiet stretch with nobody close enough to see you.
// On foot, a stopped cruiser parked against you for long enough is a bust.
import { WANTED } from './config.js';
import { spawnCar, updatePoliceCar, spinWheels } from './vehicles.js';

export function createWanted() {
  return {
    level: 0,
    quietTimer: 0,
    bustTimer: 0,
    police: [],
    sirenOn: false,
  };
}

// Cruisers on the street per star: 1 star → 2 cars, capped at 4.
function cruisersForLevel(level) {
  return level <= 0 ? 0 : Math.min(1 + level, 4);
}

// Pick a road node 70–110 m from the player to dispatch a cruiser from,
// so it arrives driving on a street instead of materialising in a wall.
function dispatchPoint(G) {
  const p = G.player.pos;
  const nodes = G.city && G.city.nodes ? G.city.nodes : [];
  let best = null;
  let bestScore = Infinity;
  for (const n of nodes) {
    const d = Math.hypot(n.x - p.x, n.z - p.z);
    const score = Math.abs(d - 90) + Math.random() * 25;
    if (d > 45 && score < bestScore) {
      bestScore = score;
      best = n;
    }
  }
  if (best) return best;
  const ang = Math.random() * Math.PI * 2;
  return {
    x: Math.max(-200, Math.min(200, p.x + Math.cos(ang) * 90)),
    z: Math.max(-200, Math.min(200, p.z + Math.sin(ang) * 90)),
  };
}

export function syncPolice(G) {
  const w = G.wanted;
  const want = cruisersForLevel(w.level);
  while (w.police.length < want) {
    const at = dispatchPoint(G);
    const car = spawnCar(G.scene, at.x, at.z, Math.random() * Math.PI * 2, 0x14181c, 'police');
    w.police.push(car);
    G.cars.push(car);
  }
  while (w.police.length > want) {
    const car = w.police.pop();
    car.alive = false;
    G.scene.remove(car.mesh);
    const i = G.cars.indexOf(car);
    if (i >= 0) G.cars.splice(i, 1);
  }
  if (w.level === 0 && w.sirenOn) {
    G.sound.sirenStop();
    w.sirenOn = false;
  }
}

export function addHeat(G, amount, reason) {
  const w = G.wanted;
  const before = w.level;
  w.level = Math.min(WANTED.max, w.level + amount);
  w.quietTimer = 0;
  if (w.level > before) {
    G.hudMessage(`WANTED LEVEL ${w.level} — ${reason}`, 'bad');
    G.sound.sirenStart();
    w.sirenOn = true;
  }
  syncPolice(G);
}

export function updateWanted(G, dt) {
  const w = G.wanted;
  if (w.level === 0) return;
  w.quietTimer += dt;

  // Cooling: quiet long enough, and the nearest cruiser far enough away.
  let nearest = Infinity;
  for (const c of w.police) {
    nearest = Math.min(nearest, Math.hypot(c.pos.x - G.player.pos.x, c.pos.z - G.player.pos.z));
  }
  if (w.quietTimer > WANTED.decaySeconds && nearest > 55) {
    w.level -= 1;
    w.quietTimer = 0;
    G.hudMessage(
      w.level > 0 ? `Heat cooling… wanted level ${w.level}` : 'You lost them. Heat is off.',
      'good',
    );
    syncPolice(G);
  }

  // Busted: on foot with a slow cruiser right on top of you.
  if (!G.player.onFoot) {
    w.bustTimer = 0;
    return;
  }
  const pinned = w.police.some(
    (c) =>
      Math.hypot(c.pos.x - G.player.pos.x, c.pos.z - G.player.pos.z) < WANTED.bustDistance &&
      Math.abs(c.speed) < 4,
  );
  if (pinned) {
    w.bustTimer += dt;
    G.hudFlash('bust');
    if (w.bustTimer >= WANTED.bustSeconds) {
      w.bustTimer = 0;
      G.busted();
    }
  } else {
    w.bustTimer = Math.max(0, w.bustTimer - dt * 2);
  }
}

// A cruiser shoving Nadia on foot: knock her sideways, small damage.
function shovePlayer(G, cop) {
  const dx = G.player.pos.x - cop.pos.x;
  const dz = G.player.pos.z - cop.pos.z;
  const d = Math.hypot(dx, dz) || 1;
  G.player.pos.x += (dx / d) * 1.2;
  G.player.pos.z += (dz / d) * 1.2;
  G.player.hp = Math.max(0, G.player.hp - 4);
  G.sound.thud();
  if (G.player.hp <= 0) G.wasted();
}

export function updatePolice(G, dt) {
  for (const car of G.wanted.police) {
    if (!car.alive) continue;
    // Screenshot staging: a cruiser flagged shotFollow holds formation
    // beside the player (real mesh, real lights) instead of chasing.
    if (G.shotMode && car.shotFollow) {
      const anchor = G.player.car || G.player;
      const sin = Math.sin(anchor.yaw);
      const cos = Math.cos(anchor.yaw);
      car.pos.x = anchor.pos.x + cos * car.shotFollow.dx + sin * car.shotFollow.dz;
      car.pos.z = anchor.pos.z - sin * car.shotFollow.dx + cos * car.shotFollow.dz;
      car.yaw = anchor.yaw;
      car.speed = anchor.speed || 0;
      car.mesh.position.copy(car.pos);
      car.mesh.rotation.y = car.yaw;
      spinWheels(car, dt);
      car.flashT += dt * 6;
      if (car.lightBar) {
        const phase = Math.sin(car.flashT) > 0;
        car.lightBar.red.material.color.setHex(phase ? 0xff2222 : 0x551111);
        car.lightBar.blue.material.color.setHex(phase ? 0x111155 : 0x2244ff);
      }
      continue;
    }
    updatePoliceCar(car, G.player.pos, dt, G.city.colliders, G.cars, (cop) => {
      if (G.player.onFoot) {
        if (Math.hypot(cop.pos.x - G.player.pos.x, cop.pos.z - G.player.pos.z) < 2.6) {
          shovePlayer(G, cop);
        }
      } else if (G.player.car) {
        G.player.car.speed *= 0.94;
        if (Math.abs(cop.speed) > 12) {
          G.sound.crash();
          G.player.hp = Math.max(0, G.player.hp - 2);
          if (G.player.hp <= 0) G.wasted();
        }
      }
    });
  }
}

export function clearWanted(G) {
  const w = G.wanted;
  w.level = 0;
  w.quietTimer = 0;
  w.bustTimer = 0;
  syncPolice(G);
}
