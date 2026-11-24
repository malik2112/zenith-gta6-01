// ZENITH — HUD. All DOM overlay: money, health, wanted stars, objective,
// distance, 2D minimap, crosshair, banner, toasts, and the menu / pause /
// busted screens. The minimap draws the road grid, buildings, cars, peds,
// police and the mission marker every frame.
import { CONFIG } from './config.js';

function el(tag, id, cls, parent) {
  const e = document.createElement(tag);
  if (id) e.id = id;
  if (cls) e.className = cls;
  if (parent) parent.appendChild(e);
  return e;
}

export class Hud {
  constructor(world) {
    this.world = world;
    this.root = el('div', 'hud', '', document.body);

    const topLeft = el('div', '', 'hud-topleft', this.root);
    this.moneyEl = el('div', 'hud-money', '', topLeft);
    this.moneyEl.textContent = '$250';
    const healthWrap = el('div', '', 'hud-healthwrap', topLeft);
    this.healthEl = el('div', 'hud-health', '', healthWrap);
    this.ammoEl = el('div', 'hud-ammo', '', topLeft);
    this.ammoEl.textContent = 'AMMO 12/12';

    const topRight = el('div', '', 'hud-topright', this.root);
    this.starsEl = el('div', 'hud-stars', '', topRight);
    this.radioEl = el('div', 'hud-radio', '', topRight);

    this.banner = el('div', 'hud-banner', 'hidden', this.root);
    this.bannerTitle = el('div', '', 'hud-banner-title', this.banner);
    this.bannerSub = el('div', '', 'hud-banner-sub', this.banner);

    this.objectiveEl = el('div', 'hud-objective', '', this.root);
    this.distanceEl = el('div', 'hud-distance', '', this.root);

    this.toastEl = el('div', 'hud-toast', 'hidden', this.root);
    this.toastTimer = 0;

    this.crosshair = el('div', 'hud-crosshair', '', this.root);
    this.crosshair.textContent = '+';

    this.vignette = el('div', 'hud-vignette', 'hidden', this.root);

    // Minimap: bottom-left, 2D canvas.
    this.mapCanvas = el('canvas', 'hud-minimap', '', this.root);
    this.mapCanvas.width = 180;
    this.mapCanvas.height = 180;
    this.mapCtx = this.mapCanvas.getContext('2d');

    // Menu overlay (start screen).
    this.menu = el('div', 'menu', '', document.body);
    const menuInner = el('div', '', 'menu-inner', this.menu);
    const title = el('div', '', 'menu-title', menuInner);
    title.textContent = 'ZENITH';
    const tag = el('div', '', 'menu-tag', menuInner);
    tag.textContent = 'An open-world crime story at sunset — steal cars, outrun the law, take the city.';
    const controls = el('div', '', 'menu-controls', menuInner);
    controls.innerHTML =
      'WASD move &nbsp;·&nbsp; SHIFT run &nbsp;·&nbsp; E steal / exit car &nbsp;·&nbsp; CLICK shoot<br>' +
      'R reload &nbsp;·&nbsp; N radio &nbsp;·&nbsp; M mute &nbsp;·&nbsp; ESC pause';
    const missions = el('div', '', 'menu-missions', menuInner);
    missions.innerHTML =
      '<b>5 JOBS:</b> 1 First Wheels · 2 Sunset Courier · 3 Street Heat · 4 Rooftop Standoff · 5 Zenith Heist';
    this.startBtn = el('button', 'menu-start', '', menuInner);
    this.startBtn.textContent = 'START ENGINE';
    this.menuNote = el('div', '', 'menu-note', menuInner);
    this.menuNote.textContent = 'Progress saves in this browser.';

    // Pause overlay.
    this.pause = el('div', 'pause', 'hidden', document.body);
    const pauseInner = el('div', '', 'menu-inner', this.pause);
    el('div', '', 'menu-title', pauseInner).textContent = 'PAUSED';
    const resume = el('button', 'pause-resume', '', pauseInner);
    resume.textContent = 'RESUME';
    resume.addEventListener('click', () => world.resume());
    const quit = el('button', 'pause-quit', '', pauseInner);
    quit.textContent = 'BACK TO MENU';
    quit.addEventListener('click', () => world.toMenu());

    // Busted overlay.
    this.busted = el('div', 'busted', 'hidden', document.body);
    const bustedInner = el('div', '', 'menu-inner', this.busted);
    el('div', '', 'menu-title', bustedInner).textContent = 'BUSTED';
    this.bustedText = el('div', '', 'menu-tag', bustedInner);
    const bustedBtn = el('button', 'busted-ok', '', bustedInner);
    bustedBtn.textContent = 'WALK IT OFF';
    bustedBtn.addEventListener('click', () => world.resumeFromBusted());

    // Self-test output (only filled when ?selftest=1).
    this.selftestEl = el('div', 'selftest', 'hidden', document.body);

    this.setStars(0);
    this.setMoney(world.money);
    this.setHealth(world.player.health);
    this.setRadio(world.audio.stationName());
    this.bannerTimer = 0;
  }

  setMoney(n) {
    this.moneyEl.textContent = `$${n.toLocaleString('en-US')}`;
  }

  setHealth(n) {
    this.healthEl.style.width = `${Math.max(0, Math.min(100, n))}%`;
    this.healthEl.style.background = n > 50 ? '#3aa655' : n > 25 ? '#d8b13a' : '#c23b2e';
  }

  setAmmo(ammo, mag, reloading) {
    this.ammoEl.textContent = reloading ? 'RELOADING…' : `AMMO ${ammo}/${mag}`;
  }

  setStars(n) {
    let s = '';
    for (let i = 0; i < 5; i++) s += i < n ? '★' : '☆';
    this.starsEl.textContent = s;
    this.starsEl.style.color = n >= 3 ? '#ff5544' : '#ffd24a';
  }

  setRadio(name) {
    this.radioEl.textContent = `♪ ${name}`;
  }

  setObjective(text) {
    this.objectiveEl.textContent = text;
  }

  setDistance(d, label) {
    this.distanceEl.textContent = d === null || d === undefined ? '' : `${label} — ${Math.round(d)}m`;
  }

  showBanner(title, sub) {
    this.bannerTitle.textContent = title;
    this.bannerSub.textContent = sub || '';
    this.banner.classList.remove('hidden');
    this.bannerTimer = 3.2;
  }

  toast(msg) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.remove('hidden');
    this.toastTimer = 3;
  }

  showMenu() {
    this.menu.classList.remove('hidden');
    this.root.classList.add('hidden');
  }

  hideMenu() {
    this.menu.classList.add('hidden');
    this.root.classList.remove('hidden');
  }

  showPause() {
    this.pause.classList.remove('hidden');
  }

  hidePause() {
    this.pause.classList.add('hidden');
  }

  showBusted(fine) {
    this.bustedText.textContent = `The cops caught you. Fine: $${fine}. Your car is gone.`;
    this.busted.classList.remove('hidden');
  }

  hideBusted() {
    this.busted.classList.add('hidden');
  }

  showSelftest(text) {
    this.selftestEl.classList.remove('hidden');
    this.selftestEl.textContent = text;
  }

  update(dt) {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.banner.classList.add('hidden');
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.classList.add('hidden');
    }
    const world = this.world;
    const hp = world.player.health;
    this.vignette.classList.toggle('hidden', hp > 30);
    this.crosshair.style.opacity = world.state === 'playing' && world.player.onFoot ? '1' : '0';
    this.drawMinimap();
  }

  drawMinimap() {
    const ctx = this.mapCtx;
    const S = 180;
    const half = CONFIG.worldSize / 2;
    const toMap = (x, z) => [((x + half) / CONFIG.worldSize) * S, ((z + half) / CONFIG.worldSize) * S];
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(16,12,28,0.82)';
    ctx.fillRect(0, 0, S, S);
    // Roads.
    ctx.strokeStyle = '#5a5470';
    ctx.lineWidth = 3;
    for (let k = -3; k <= 3; k++) {
      const c = k * CONFIG.roadSpacing;
      const [x0] = toMap(c, 0);
      const [, y0] = toMap(0, c);
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      ctx.lineTo(x0, S);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, y0);
      ctx.lineTo(S, y0);
      ctx.stroke();
    }
    // Buildings.
    ctx.fillStyle = '#3a3450';
    for (const b of this.world.city.buildings) {
      const [x, y] = toMap(b.position.x, b.position.z);
      ctx.fillRect(x - 3, y - 3, 6, 6);
    }
    // Mission marker.
    const target = this.world.missions.currentTarget();
    if (target) {
      const [x, y] = toMap(target.x, target.z);
      const pulse = 5 + Math.sin(performance.now() / 200) * 2;
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath();
      ctx.arc(x, y, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7a5c00';
      ctx.stroke();
    }
    // Pedestrians.
    ctx.fillStyle = '#9a94b0';
    for (const ped of this.world.peds.list) {
      if (ped.state === 'down') continue;
      const [x, y] = toMap(ped.pos.x, ped.pos.z);
      ctx.fillRect(x - 1, y - 1, 2, 2);
    }
    // Cars.
    for (const car of this.world.vehicles.cars) {
      const [x, y] = toMap(car.pos.x, car.pos.z);
      ctx.fillStyle = car.isPolice ? '#ff5544' : '#ffd24a';
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
    // Player arrow.
    const [px, py] = toMap(this.world.player.pos.x, this.world.player.pos.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-this.world.player.heading + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Border.
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, S - 1, S - 1);
  }
}
