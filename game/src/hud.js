// ZENITH — hud.js (round 3 redo)
// Everything the player reads: cash, health, stars, ammo, speed, the
// mission line, the message feed, and the live minimap — plus the zone
// label, which now follows the player around the town instead of sitting
// still. All DOM access lives here; the game loop calls refreshHud once
// a frame and this module touches the DOM only where a value actually
// changed (the minimap canvas is the one thing repainted every frame).
import { TOWN, GUN, COLORS, CLOCK_START, MECHANIC, ZONES } from './config.js';
import { objectiveLine } from './missions.js';

export function newHud() {
  const byId = (id) => document.getElementById(id);
  return {
    el: {
      cash: byId('cash'),
      hpFill: byId('hpfill'),
      hpNum: byId('hpnum'),
      stars: byId('stars'),
      ammo: byId('ammo'),
      speed: byId('speed'),
      speedLabel: byId('speedlabel'),
      boostfill: byId('boostfill'),
      boostwrap: byId('boostwrap'),
      objective: byId('objtext'),
      objectiveBox: byId('objective'),
      feed: byId('feed'),
      hint: byId('hint'),
      bust: byId('bustbar'),
      clock: byId('clock'),
      radio: byId('radio'),
      minimap: byId('minimap'),
      loc: byId('loc'),
    },
    minimapCtx: null,
    shown: { stars: -1, cash: -1, hp: -1, ammo: '', speed: -1, objective: '', clock: '', zone: '' },
    clockMin: CLOCK_START,
  };
}

export function postFeed(hud, text, kind = 'info') {
  if (!hud.el.feed) return;
  const div = document.createElement('div');
  div.className = kind;
  div.textContent = text;
  hud.el.feed.prepend(div);
  while (hud.el.feed.children.length > 4) hud.el.feed.removeChild(hud.el.feed.lastChild);
  setTimeout(() => {
    if (div.parentNode) div.parentNode.removeChild(div);
  }, 9000);
}

export function flashHint(hud, text) {
  if (!hud.el.hint) return;
  hud.el.hint.textContent = text;
  hud.el.hint.style.opacity = '1';
  clearTimeout(hud.el.hint._t);
  hud.el.hint._t = setTimeout(() => {
    hud.el.hint.style.opacity = '0';
  }, 2600);
}

export function flashScreen(hud, kind) {
  const el = document.getElementById('flash');
  if (!el) return;
  el.className = 'on ' + kind;
  setTimeout(() => {
    el.className = '';
  }, kind === 'damage' ? 220 : 120);
  if (kind === 'bust' && hud.el.bust) {
    hud.el.bust.style.opacity = '1';
    setTimeout(() => {
      hud.el.bust.style.opacity = '0';
    }, 300);
  }
}

// Which named district the player is standing in right now.
export function zoneNameFor(pos) {
  for (const z of ZONES) {
    if (pos.x >= z.x0 && pos.x <= z.x1 && pos.z >= z.z0 && pos.z <= z.z1) return z.name;
  }
  return 'ZENITH';
}

// The minimap: valley haze and ridge shelf to the east, blocks and roads,
// then the moving parts — traffic, cruisers (flashing), the mission
// beacon, and Nadia's arrow, rotated to her heading.
export function paintMinimap(G) {
  const hud = G.hud;
  const cv = hud.el.minimap;
  if (!cv) return;
  if (!hud.minimapCtx) hud.minimapCtx = cv.getContext('2d');
  const g = hud.minimapCtx;
  const S = cv.width;
  const world = TOWN.half * 2 + 90;
  const mx = (x) => ((x + TOWN.half) / world) * S;
  const mz = (z) => ((z + TOWN.half) / world) * S;

  g.fillStyle = '#20262c';
  g.fillRect(0, 0, S, S);
  // East edge: rock shelf, then the violet valley.
  g.fillStyle = COLORS.minimapSand;
  g.fillRect(mx(TOWN.beachX), 0, mx(TOWN.waterX) - mx(TOWN.beachX), S);
  g.fillStyle = COLORS.minimapSea;
  g.fillRect(mx(TOWN.waterX), 0, S - mx(TOWN.waterX), S);
  // City blocks (the plaza block reads as open stone).
  g.fillStyle = '#3a4148';
  const blockPx = ((TOWN.block - 16) / world) * S;
  for (let bx = 0; bx < TOWN.blocks; bx++) {
    for (let bz = 0; bz < TOWN.blocks; bz++) {
      if ((bx === 2 || bx === 3) && (bz === 2 || bz === 3)) {
        g.fillStyle = '#6a6258';
        g.fillRect(
          mx(-TOWN.half + bx * TOWN.block + 10),
          mz(-TOWN.half + bz * TOWN.block + 10),
          blockPx,
          blockPx,
        );
        g.fillStyle = '#3a4148';
        continue;
      }
      g.fillRect(
        mx(-TOWN.half + bx * TOWN.block + 10),
        mz(-TOWN.half + bz * TOWN.block + 10),
        blockPx,
        blockPx,
      );
    }
  }
  // Roads as filled strips.
  g.fillStyle = '#565e66';
  const roadPx = Math.max(2, (TOWN.streetWidth / world) * S);
  for (const c of G.city.centers) {
    g.fillRect(mx(c) - roadPx / 2, 0, roadPx, S);
    g.fillRect(0, mz(c) - roadPx / 2, S, roadPx);
  }
  // Traffic.
  g.fillStyle = '#c8ccd0';
  for (const car of G.cars) {
    if (car.kind !== 'traffic') continue;
    g.fillRect(mx(car.pos.x) - 1.5, mz(car.pos.z) - 1.5, 3, 3);
  }
  // Cruisers, alternating red/blue.
  g.fillStyle = Math.sin(G.time * 8) > 0 ? '#ff4444' : '#4488ff';
  for (const cop of G.wanted.police) {
    g.beginPath();
    g.arc(mx(cop.pos.x), mz(cop.pos.z), 3.5, 0, Math.PI * 2);
    g.fill();
  }
  // Mission beacon, pulsing.
  const m = G.missions;
  if (m.beaconPos) {
    const pulse = 5 + Math.sin(G.time * 5) * 2;
    g.fillStyle = '#ffd23a';
    g.beginPath();
    g.arc(mx(m.beaconPos.x), mz(m.beaconPos.z), pulse, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#20262c';
    g.beginPath();
    g.arc(mx(m.beaconPos.x), mz(m.beaconPos.z), 2.5, 0, Math.PI * 2);
    g.fill();
  }
  // Player arrow. World forward is (sin yaw, cos yaw) in (x, z); the
  // canvas angle for that vector is atan2(dz, dx).
  g.save();
  g.translate(mx(G.player.pos.x), mz(G.player.pos.z));
  g.rotate(Math.atan2(Math.cos(G.player.yaw), Math.sin(G.player.yaw)));
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(7, 0);
  g.lineTo(-5, -4.5);
  g.lineTo(-5, 4.5);
  g.closePath();
  g.fill();
  g.strokeStyle = '#111';
  g.lineWidth = 1;
  g.stroke();
  g.restore();
  g.fillStyle = '#e8e8e8';
  g.font = 'bold 10px sans-serif';
  g.fillText('N', 6, 12);
}

function setText(el, cache, key, value) {
  if (!el || cache[key] === value) return;
  cache[key] = value;
  el.textContent = value;
}

export function refreshHud(G, dt) {
  const hud = G.hud;
  const p = G.player;
  const shown = hud.shown;

  // The town clock runs one game-minute per real second.
  hud.clockMin = (hud.clockMin + dt) % (24 * 60);
  const hh = String(Math.floor(hud.clockMin / 60)).padStart(2, '0');
  const mm = String(Math.floor(hud.clockMin % 60)).padStart(2, '0');
  setText(hud.el.clock, shown, 'clock', `${hh}:${mm}`);

  setText(hud.el.cash, shown, 'cash', '$' + p.cash.toLocaleString('en-US'));

  const hp = Math.ceil(Math.max(0, p.hp));
  if (shown.hp !== hp) {
    shown.hp = hp;
    if (hud.el.hpFill) {
      hud.el.hpFill.style.width = Math.max(0, p.hp) + '%';
      hud.el.hpFill.style.background = p.hp > 50 ? '#69e08a' : p.hp > 25 ? '#e8c23a' : '#ff5346';
    }
    if (hud.el.hpNum) hud.el.hpNum.textContent = hp;
  }

  if (hud.el.stars && shown.stars !== G.wanted.level) {
    shown.stars = G.wanted.level;
    hud.el.stars.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const s = document.createElement('span');
      s.className = 'star' + (i < G.wanted.level ? ' on' : '');
      s.textContent = '★';
      hud.el.stars.appendChild(s);
    }
  }

  setText(
    hud.el.ammo,
    shown,
    'ammo',
    G.combat.reloading ? 'RELOADING…' : `AMMO ${G.combat.ammo} / ${GUN.magSize}`,
  );

  const kmh = p.onFoot ? p.speedKmh : Math.round(Math.abs(p.car ? p.car.speed * 3.6 : 0));
  if (shown.speed !== kmh) {
    shown.speed = kmh;
    if (hud.el.speed) hud.el.speed.textContent = kmh;
    if (hud.el.speedLabel) hud.el.speedLabel.textContent = p.onFoot ? 'KM/H ON FOOT' : 'KM/H';
  }

  if (hud.el.boostfill && hud.el.boostwrap) {
    const showBoost = MECHANIC.type === 'nitro' && !p.onFoot && p.car;
    hud.el.boostwrap.style.opacity = showBoost ? '1' : '0';
    hud.el.boostfill.style.width = showBoost ? Math.max(0, p.car.boost || 0) + '%' : '0%';
  }

  setText(hud.el.objective, shown, 'objective', objectiveLine(G));
  // Timed jobs going short turn the objective box red.
  const lowTime =
    G.missions.state === 'active' && MISSIONS_LOW(G);
  if (hud.el.objectiveBox) hud.el.objectiveBox.classList.toggle('urgent', lowTime);

  setText(hud.el.loc, shown, 'zone', `ZENITH · ${zoneNameFor(p.pos)}`);

  paintMinimap(G);
}

function MISSIONS_LOW(G) {
  return G.missions.timer > 0 && G.missions.timer < 30;
}
