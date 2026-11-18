// ZENITH — hud.js
// One job: everything the player reads — cash, health, wanted stars, ammo,
// speed, mission objective, message feed, and the live minimap canvas.
// All DOM reads/writes live here; the game loop only calls updateHud().
import { CITY, COMBAT, PALETTE, CLOCK_START, MECHANIC } from './config.js';
import { missionObjectiveText } from './missions.js';

export function createHud() {
  return {
    el: {
      cash: document.getElementById('cash'),
      hpFill: document.getElementById('hpfill'),
      hpNum: document.getElementById('hpnum'),
      stars: document.getElementById('stars'),
      ammo: document.getElementById('ammo'),
      speed: document.getElementById('speed'),
      speedLabel: document.getElementById('speedlabel'),
      boostfill: document.getElementById('boostfill'),
      boostwrap: document.getElementById('boostwrap'),
      objective: document.getElementById('objtext'),
      feed: document.getElementById('feed'),
      hint: document.getElementById('hint'),
      bust: document.getElementById('bustbar'),
      clock: document.getElementById('clock'),
      radio: document.getElementById('radio'),
      minimap: document.getElementById('minimap'),
    },
    minimapCtx: null,
    lastStars: -1,
    lastCash: -1,
    clockMin: CLOCK_START,
  };
}

export function addFeedMessage(hud, text, kind = 'info') {
  if (!hud.el.feed) return;
  const div = document.createElement('div');
  div.className = kind;
  div.textContent = text;
  hud.el.feed.prepend(div);
  while (hud.el.feed.children.length > 4) hud.el.feed.removeChild(hud.el.feed.lastChild);
  setTimeout(() => { if (div.parentNode) div.parentNode.removeChild(div); }, 9000);
}

export function showHint(hud, text) {
  if (!hud.el.hint) return;
  hud.el.hint.textContent = text;
  hud.el.hint.style.opacity = '1';
  clearTimeout(hud.el.hint._t);
  hud.el.hint._t = setTimeout(() => { hud.el.hint.style.opacity = '0'; }, 2600);
}

export function flashScreen(hud, kind) {
  const el = document.getElementById('flash');
  if (!el) return;
  el.className = 'on ' + kind;
  setTimeout(() => { el.className = ''; }, kind === 'damage' ? 220 : 120);
  if (kind === 'bust' && hud.el.bust) {
    hud.el.bust.style.opacity = '1';
    setTimeout(() => { hud.el.bust.style.opacity = '0'; }, 300);
  }
}

// The minimap: roads, blocks, sea, player arrow, cars, police, mission blip.
export function drawMinimap(G) {
  const hud = G.hud;
  const cv = hud.el.minimap;
  if (!cv) return;
  if (!hud.minimapCtx) hud.minimapCtx = cv.getContext('2d');
  const g = hud.minimapCtx;
  const S = cv.width; // 190
  const world = CITY.half * 2 + 90; // -210..+300ish
  const toMap = (x, z) => [
    ((x + CITY.half) / world) * S,
    ((z + CITY.half) / world) * S,
  ];
  g.clearRect(0, 0, S, S);
  g.fillStyle = '#20262c';
  g.fillRect(0, 0, S, S);
  // sea (east)
  const [seaX] = toMap(CITY.waterX, 0);
  g.fillStyle = PALETTE.minimapSea;
  g.fillRect(seaX, 0, S - seaX, S);
  // sand
  const [sandX] = toMap(CITY.beachX, 0);
  g.fillStyle = PALETTE.minimapSand;
  g.fillRect(sandX, 0, seaX - sandX, S);
  // blocks
  g.fillStyle = '#3a4148';
  const step = CITY.block;
  for (let bx = 0; bx < CITY.blocks; bx++) {
    for (let bz = 0; bz < CITY.blocks; bz++) {
      const [x, z] = toMap(-CITY.half + bx * step + 10, -CITY.half + bz * step + 10);
      const w = ((step - 16) / world) * S;
      g.fillRect(x, z, w, w);
    }
  }
  // roads
  g.strokeStyle = '#565e66';
  g.lineWidth = 3;
  for (const c of G.city.centers) {
    const [x] = toMap(c, 0);
    const [, z] = toMap(0, c);
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, S); g.stroke();
    g.beginPath(); g.moveTo(0, z); g.lineTo(S, z); g.stroke();
  }
  // mission beacon
  const m = G.missions;
  if (m.beaconPos) {
    const [bx, bz] = toMap(m.beaconPos.x, m.beaconPos.z);
    const pulse = 5 + Math.sin(G.time * 5) * 2;
    g.fillStyle = '#ffd23a';
    g.beginPath(); g.arc(bx, bz, pulse, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#20262c';
    g.beginPath(); g.arc(bx, bz, 2.5, 0, Math.PI * 2); g.fill();
  }
  // traffic cars
  g.fillStyle = '#c8ccd0';
  for (const car of G.cars) {
    if (car.kind !== 'traffic') continue;
    const [x, z] = toMap(car.pos.x, car.pos.z);
    g.fillRect(x - 1.5, z - 1.5, 3, 3);
  }
  // police (flashing)
  const flash = Math.sin(G.time * 8) > 0;
  g.fillStyle = flash ? '#ff4444' : '#4488ff';
  for (const cop of G.wanted.police) {
    const [x, z] = toMap(cop.pos.x, cop.pos.z);
    g.beginPath(); g.arc(x, z, 3.5, 0, Math.PI * 2); g.fill();
  }
  // player arrow (rotates with heading)
  const [px, pz] = toMap(G.player.pos.x, G.player.pos.z);
  g.save();
  g.translate(px, pz);
  // world yaw: forward = (sin yaw, cos yaw) in (x, z); canvas angle = atan2(dz, dx)
  g.rotate(Math.atan2(Math.cos(G.player.yaw), Math.sin(G.player.yaw)));
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(7, 0); g.lineTo(-5, -4.5); g.lineTo(-5, 4.5); g.closePath();
  g.fill();
  g.strokeStyle = '#111';
  g.lineWidth = 1;
  g.stroke();
  g.restore();
  // north tick
  g.fillStyle = '#e8e8e8';
  g.font = 'bold 10px sans-serif';
  g.fillText('N', 6, 12);
}

export function updateHud(G, dt) {
  const hud = G.hud;
  const p = G.player;
  // in-game clock: 1 real second = 1 game minute
  hud.clockMin = (hud.clockMin + dt) % (24 * 60);
  const hh = Math.floor(hud.clockMin / 60);
  const mm = Math.floor(hud.clockMin % 60);
  if (hud.el.clock) hud.el.clock.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  if (hud.el.cash && p.cash !== hud.lastCash) {
    hud.el.cash.textContent = '$' + p.cash.toLocaleString('en-US');
    hud.lastCash = p.cash;
  }
  if (hud.el.hpFill) {
    hud.el.hpFill.style.width = Math.max(0, p.hp) + '%';
    hud.el.hpFill.style.background = p.hp > 50 ? '#69e08a' : p.hp > 25 ? '#e8c23a' : '#ff5346';
  }
  if (hud.el.hpNum) hud.el.hpNum.textContent = Math.ceil(Math.max(0, p.hp));
  if (hud.el.stars && G.wanted.level !== hud.lastStars) {
    hud.lastStars = G.wanted.level;
    hud.el.stars.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const s = document.createElement('span');
      s.className = 'star' + (i < G.wanted.level ? ' on' : '');
      s.textContent = '★';
      hud.el.stars.appendChild(s);
    }
  }
  if (hud.el.ammo) {
    hud.el.ammo.textContent = G.combat.reloading
      ? 'RELOADING…'
      : `AMMO ${G.combat.ammo} / ${COMBAT.magSize}`;
  }
  if (hud.el.speed) {
    hud.el.speed.textContent = p.onFoot ? p.speedKmh : Math.round(Math.abs(p.car ? p.car.speed * 3.6 : 0));
    hud.el.speedLabel.textContent = p.onFoot ? 'KM/H ON FOOT' : 'KM/H';
  }
  if (hud.el.boostfill && hud.el.boostwrap) {
    const showBoost = MECHANIC.type === 'nitro' && !p.onFoot && p.car;
    hud.el.boostwrap.style.opacity = showBoost ? '1' : '0';
    hud.el.boostfill.style.width = showBoost ? Math.max(0, p.car.boost || 0) + '%' : '0%';
  }
  if (hud.el.objective) {
    hud.el.objective.textContent = missionObjectiveText(G);
  }
  drawMinimap(G);
}
