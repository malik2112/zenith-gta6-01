// ZENITH — selftest.js (round 3 redo)
// Proof without a human: ?selftest=1 drives the real game through its
// real functions — start, steal a car, drive it, raise the wanted
// level, finish a mission, save and reload, fire the pistol (checking
// the recoil kick lands), paint the minimap, and confirm the zone label
// follows the player — and writes PASS/FAIL lines into #selftest and
// the document title for headless checks.
import { raiseHeat } from './wanted.js';
import { beginJob, MISSIONS } from './missions.js';
import { shoot } from './combat.js';
import { storeSave, fetchSave } from './save.js';
import { summonWalker } from './pedestrians.js';
import { zoneNameFor } from './hud.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function closestTrafficCar(G) {
  let best = null;
  let bestDist = Infinity;
  for (const car of G.cars) {
    if (car.kind !== 'traffic') continue;
    const d = Math.hypot(car.pos.x - G.player.pos.x, car.pos.z - G.player.pos.z);
    if (d < bestDist) {
      bestDist = d;
      best = car;
    }
  }
  return best;
}

export async function runChecks(G) {
  const results = [];
  const el = document.getElementById('selftest');
  const log = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    const line = `${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`;
    if (el) {
      const div = document.createElement('div');
      div.textContent = line;
      el.appendChild(div);
    }
    console.log('[selftest] ' + line);
  };

  // Each step is [name, async fn]; a step records its own verdicts.
  const checks = [
    ['boot', async () => {
      log('boot', !!G.renderer && G.scene.children.length > 60, `${G.scene.children.length} scene objects`);
    }],
    ['start', async () => {
      G.beginGame(true);
      await sleep(300);
      log('start', G.mode === 'playing', 'mode=' + G.mode);
    }],
    ['steal-car', async () => {
      const car = closestTrafficCar(G);
      if (car) {
        G.player.pos.set(car.pos.x + 2, 0, car.pos.z);
        G.tryClimbIn();
      }
      log('steal-car', !G.player.onFoot && G.player.car === car, car ? `entered car #${car.id}` : 'no car found');
    }],
    ['drive', async () => {
      // Hold W until the car has really moved (up to 6 s). A fixed 2 s
      // fails on a cold headless renderer: the first frames compile
      // shaders, so 2 wall-clock seconds are ~0.5 game-seconds.
      const x0 = G.player.pos.x;
      const z0 = G.player.pos.z;
      G.input.up = true;
      let moved = 0;
      for (let i = 0; i < 24; i++) {
        await sleep(250);
        moved = Math.hypot(G.player.pos.x - x0, G.player.pos.z - z0);
        if (moved > 5) break;
      }
      G.input.up = false;
      log('drive', moved > 5, `moved ${moved.toFixed(1)}m`);
    }],
    ['wanted', async () => {
      raiseHeat(G, 2, 'selftest');
      await sleep(600);
      log('wanted', G.wanted.level >= 2, `level=${G.wanted.level}`);
      log('police-respond', G.wanted.police.length >= 1, `${G.wanted.police.length} cruisers`);
    }],
    ['mission', async () => {
      G.climbOut();
      if (G.missions.state !== 'active') beginJob(G, 0);
      const cashBefore = G.player.cash;
      const missionBefore = G.missions.index;
      // Mission 1 completes with the player IN a car at the target.
      const car = closestTrafficCar(G);
      if (car) {
        G.player.pos.set(car.pos.x + 2, 0, car.pos.z);
        G.tryClimbIn();
        car.pos.set(MISSIONS[0].target.x, 0, MISSIONS[0].target.z);
        car.mesh.position.copy(car.pos);
        G.player.pos.copy(car.pos);
      }
      await sleep(400);
      log('mission-complete', G.missions.index === missionBefore + 1, `mission ${missionBefore + 1} -> ${G.missions.index + 1}`);
      log('mission-reward', G.player.cash >= cashBefore + MISSIONS[0].reward, `$${cashBefore} -> $${G.player.cash}`);
    }],
    ['save-load', async () => {
      storeSave(G);
      const loaded = fetchSave();
      log('save-load', !!loaded && loaded.cash === G.player.cash, loaded ? `cash $${loaded.cash}` : 'no save found');
    }],
    ['shoot', async () => {
      G.climbOut();
      const ped = summonWalker(G.scene, G.player.pos.x + 6, G.player.pos.z, Math.random);
      ped.hp = 50;
      G.peds.push(ped);
      G.camera.position.set(G.player.pos.x, 1.7, G.player.pos.z);
      G.camera.lookAt(ped.pos.x, 1.2, ped.pos.z);
      const ammoBefore = G.combat.ammo;
      const hpBefore = ped.hp;
      shoot(G, [ped]);
      await sleep(120);
      log('shoot', G.combat.ammo === ammoBefore - 1 && ped.hp < hpBefore, `ammo ${ammoBefore}->${G.combat.ammo}, ped hp ${hpBefore}->${ped.hp}`);
      log('recoil', (G.recoil || 0) > 0, `recoil=${(G.recoil || 0).toFixed(3)}`);
    }],
    ['minimap', async () => {
      const cv = G.hud.el.minimap;
      const ctx = cv.getContext('2d');
      const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
      let nonBg = 0;
      for (let i = 0; i < data.length; i += 400) {
        if (data[i] !== 32 || data[i + 1] !== 38 || data[i + 2] !== 44) nonBg++;
      }
      log('minimap', nonBg > 5, `${nonBg} non-background samples`);
    }],
    ['zone-label', async () => {
      const zone = zoneNameFor(G.player.pos);
      const shown = (document.getElementById('loc') || {}).textContent || '';
      log('zone-label', zone.length > 0 && shown.includes(zone), `zone=${zone}, label="${shown}"`);
    }],
    ['exit-car', async () => {
      log('exit-car', G.player.onFoot === true, 'onFoot=' + G.player.onFoot);
    }],
  ];

  try {
    for (const [, run] of checks) await run();
  } catch (e) {
    log('exception', false, String((e && e.message) || e));
  }

  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  const verdict = `SELFTEST: ${passed}/${total} ${passed === total ? 'PASS' : 'FAIL'}`;
  document.title = verdict;
  window.__selftestDone = true;
  window.__selftestResults = results;
  if (el) {
    const sum = document.createElement('div');
    sum.textContent = verdict;
    sum.style.fontWeight = 'bold';
    el.appendChild(sum);
  }
}
