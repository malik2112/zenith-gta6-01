// ZENITH — selftest.js (fresh rewrite, round 3)
// Proof without a human: ?selftest=1 drives the real game through its
// real functions — start, steal a car, drive it, raise the wanted
// level, finish a mission, save and reload, fire the pistol, paint the
// minimap — and writes PASS/FAIL lines into #selftest and the document
// title for headless checks.
import { addHeat } from './wanted.js';
import { startMission, MISSIONS } from './missions.js';
import { fireWeapon } from './combat.js';
import { saveGame, loadSave } from './save.js';
import { spawnPed } from './pedestrians.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function nearestTrafficCar(G) {
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

export async function runSelfTest(G) {
  const results = [];
  const el = document.getElementById('selftest');
  const record = (name, ok, detail = '') => {
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
  const steps = [
    ['boot', async () => {
      record('boot', !!G.renderer && G.scene.children.length > 60, `${G.scene.children.length} scene objects`);
    }],
    ['start', async () => {
      G.startGame(true);
      await sleep(300);
      record('start', G.mode === 'playing', 'mode=' + G.mode);
    }],
    ['steal-car', async () => {
      const car = nearestTrafficCar(G);
      if (car) {
        G.player.pos.set(car.pos.x + 2, 0, car.pos.z);
        G.tryEnterCar();
      }
      record('steal-car', !G.player.onFoot && G.player.car === car, car ? `entered car #${car.id}` : 'no car found');
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
      record('drive', moved > 5, `moved ${moved.toFixed(1)}m`);
    }],
    ['wanted', async () => {
      addHeat(G, 2, 'selftest');
      await sleep(600);
      record('wanted', G.wanted.level >= 2, `level=${G.wanted.level}`);
      record('police-respond', G.wanted.police.length >= 1, `${G.wanted.police.length} cruisers`);
    }],
    ['mission', async () => {
      G.exitCar();
      if (G.missions.state !== 'active') startMission(G, 0);
      const cashBefore = G.player.cash;
      const missionBefore = G.missions.index;
      // Mission 1 completes with the player IN a car at the target.
      const car = nearestTrafficCar(G);
      if (car) {
        G.player.pos.set(car.pos.x + 2, 0, car.pos.z);
        G.tryEnterCar();
        car.pos.set(MISSIONS[0].target.x, 0, MISSIONS[0].target.z);
        car.mesh.position.copy(car.pos);
        G.player.pos.copy(car.pos);
      }
      await sleep(400);
      record('mission-complete', G.missions.index === missionBefore + 1, `mission ${missionBefore + 1} -> ${G.missions.index + 1}`);
      record('mission-reward', G.player.cash >= cashBefore + MISSIONS[0].reward, `$${cashBefore} -> $${G.player.cash}`);
    }],
    ['save-load', async () => {
      saveGame(G);
      const loaded = loadSave();
      record('save-load', !!loaded && loaded.cash === G.player.cash, loaded ? `cash $${loaded.cash}` : 'no save found');
    }],
    ['shoot', async () => {
      G.exitCar();
      const ped = spawnPed(G.scene, G.player.pos.x + 6, G.player.pos.z, Math.random);
      ped.hp = 50;
      G.peds.push(ped);
      G.camera.position.set(G.player.pos.x, 1.7, G.player.pos.z);
      G.camera.lookAt(ped.pos.x, 1.2, ped.pos.z);
      const ammoBefore = G.combat.ammo;
      const hpBefore = ped.hp;
      fireWeapon(G, [ped]);
      await sleep(120);
      record('shoot', G.combat.ammo === ammoBefore - 1 && ped.hp < hpBefore, `ammo ${ammoBefore}->${G.combat.ammo}, ped hp ${hpBefore}->${ped.hp}`);
    }],
    ['minimap', async () => {
      const cv = G.hud.el.minimap;
      const ctx = cv.getContext('2d');
      const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
      let nonBg = 0;
      for (let i = 0; i < data.length; i += 400) {
        if (data[i] !== 32 || data[i + 1] !== 38 || data[i + 2] !== 44) nonBg++;
      }
      record('minimap', nonBg > 5, `${nonBg} non-background samples`);
    }],
    ['exit-car', async () => {
      record('exit-car', G.player.onFoot === true, 'onFoot=' + G.player.onFoot);
    }],
  ];

  try {
    for (const [, run] of steps) await run();
  } catch (e) {
    record('exception', false, String((e && e.message) || e));
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
