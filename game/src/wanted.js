// SOLMAR BAY — wanted.js
// One job: the wanted system. Crimes add heat, stars rise, the ZENITH
// PD dispatches cruisers that chase and ram, and a long quiet stretch (or a
// clean getaway) cools the heat back down. Busted on foot, wrecked in a car.
import { WANTED } from './config.js';
import { spawnCar, updatePoliceCar, spinWheels } from './vehicles.js';

export function createWanted() {
  return {
    level: 0,
    quietTimer: 0,     // seconds since the last crime
    bustTimer: 0,      // contact time with a cop while on foot
    police: [],        // police car objects
    sirenOn: false,
  };
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

// How many cruisers the current level wants on the street.
function desiredCruisers(level) {
  return level <= 0 ? 0 : Math.min(1 + level, 4);
}

export function syncPolice(G) {
  const w = G.wanted;
  const want = desiredCruisers(w.level);
  // spawn missing cruisers at a road edge away from the player
  while (w.police.length < want) {
    const p = G.player.pos;
    const ang = Math.random() * Math.PI * 2;
    const dist = 70 + Math.random() * 40;
    const x = Math.max(-200, Math.min(200, p.x + Math.cos(ang) * dist));
    const z = Math.max(-200, Math.min(200, p.z + Math.sin(ang) * dist));
    const car = spawnCar(G.scene, x, z, Math.random() * Math.PI * 2, 0x14181c, 'police');
    // police livery: white doors on a black body
    car.mesh.children[0].material = car.mesh.children[0].material.clone();
    w.police.push(car);
    G.cars.push(car);
  }
  // retire extras when the heat drops
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

export function updateWanted(G, dt) {
  const w = G.wanted;
  if (w.level === 0) return;
  w.quietTimer += dt;
  // cool down: quiet + no cruiser close = one star drops
  let nearest = 1e9;
  for (const c of w.police) {
    const d = Math.hypot(c.pos.x - G.player.pos.x, c.pos.z - G.player.pos.z);
    if (d < nearest) nearest = d;
  }
  if (w.quietTimer > WANTED.decaySeconds && nearest > 55) {
    w.level -= 1;
    w.quietTimer = 0;
    G.hudMessage(w.level > 0 ? `Heat cooling… wanted level ${w.level}` : 'You lost them. Heat is off.', 'good');
    syncPolice(G);
  }
  // busted: on foot, a cruiser parked on top of you
  if (G.player.onFoot) {
    let touching = false;
    for (const c of w.police) {
      const d = Math.hypot(c.pos.x - G.player.pos.x, c.pos.z - G.player.pos.z);
      if (d < WANTED.bustDistance && Math.abs(c.speed) < 4) touching = true;
    }
    if (touching) {
      w.bustTimer += dt;
      G.hudFlash('bust');
      if (w.bustTimer >= WANTED.bustSeconds) {
        w.bustTimer = 0;
        G.busted();
      }
    } else {
      w.bustTimer = Math.max(0, w.bustTimer - dt * 2);
    }
  } else {
    w.bustTimer = 0;
  }
}

export function updatePolice(G, dt) {
  for (const car of G.wanted.police) {
    if (!car.alive) continue;
    // Screenshot staging: a cruiser with shotFollow holds formation beside
    // the player (real mesh, real flashing lights) instead of chasing.
    if (G.shotMode && car.shotFollow) {
      const p = G.player.car || G.player;
      const yaw = p.yaw;
      const { dx, dz } = car.shotFollow;
      const sin = Math.sin(yaw), cos = Math.cos(yaw);
      car.pos.x = p.pos.x + cos * dx + sin * dz;
      car.pos.z = p.pos.z - sin * dx + cos * dz;
      car.yaw = yaw;
      car.speed = p.speed || 0;
      car.mesh.position.copy(car.pos);
      car.mesh.rotation.y = car.yaw;
      spinWheels(car, dt);
      car.flashT += dt * 6;
      if (car.lightBar) {
        const on = Math.sin(car.flashT) > 0;
        car.lightBar.red.material.color.setHex(on ? 0xff2222 : 0x551111);
        car.lightBar.blue.material.color.setHex(on ? 0x111155 : 0x2244ff);
      }
      continue;
    }
    updatePoliceCar(car, G.player.pos, dt, G.city.colliders, G.cars, (cop) => {
      // ramming the player
      if (G.player.onFoot) {
        const d = Math.hypot(cop.pos.x - G.player.pos.x, cop.pos.z - G.player.pos.z);
        if (d < 2.6) {
          damagePlayerShove(G, cop);
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

function damagePlayerShove(G, cop) {
  // a cruiser nudging Nadia Kaur on foot: shove + a little damage, no instant bust
  const dx = G.player.pos.x - cop.pos.x;
  const dz = G.player.pos.z - cop.pos.z;
  const d = Math.hypot(dx, dz) || 1;
  G.player.pos.x += (dx / d) * 1.2;
  G.player.pos.z += (dz / d) * 1.2;
  G.player.hp = Math.max(0, G.player.hp - 4);
  G.sound.thud();
  if (G.player.hp <= 0) G.wasted();
}

export function clearWanted(G) {
  const w = G.wanted;
  w.level = 0;
  w.quietTimer = 0;
  w.bustTimer = 0;
  syncPolice(G);
}
