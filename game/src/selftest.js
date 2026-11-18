// ZENITH — selftest.js
// One job: prove the game works without a human. ?selftest=1 drives the real
// game through its real functions — start, steal a car, drive, wanted level,
// police, mission completion, save/load, shooting, minimap — and writes
// PASS/FAIL lines into #selftest and the document title for headless checks.
import { addHeat } from './wanted.js';
import { startMission } from './missions.js';
import { fireWeapon } from './combat.js';
import { saveGame, loadSave } from './save.js';
import { MISSIONS } from './missions.js';
import { spawnPed } from './pedestrians.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function runSelfTest(G) {
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
    // eslint-disable-next-line no-console
    console.log('[selftest] ' + line);
  };

  try {
    // 1. boot: renderer + a real city in the scene
    log('boot', !!G.renderer && G.scene.children.length > 60, `${G.scene.children.length} scene objects`);
    // 2. start the game
    G.startGame(true);
    await sleep(300);
    log('start', G.mode === 'playing', 'mode=' + G.mode);
    // 3. steal a car: walk to the nearest car and press E (the real function)
    let car = null;
    let best = 1e9;
    for (const c of G.cars) {
      if (c.kind !== 'traffic') continue;
      const d = Math.hypot(c.pos.x - G.player.pos.x, c.pos.z - G.player.pos.z);
      if (d < best) { best = d; car = c; }
    }
    if (car) {
      G.player.pos.set(car.pos.x + 2, 0, car.pos.z);
      G.tryEnterCar();
    }
    log('steal-car', !G.player.onFoot && G.player.car === car, car ? `entered car #${car.id}` : 'no car found');
    // 4. drive: hold W until the car has really moved (up to 6 s).
    // A fixed 2 s fails on a cold headless renderer: the first frames
    // compile shaders, so 2 wall-clock seconds are ~0.5 game-seconds.
    const x0 = G.player.pos.x, z0 = G.player.pos.z;
    G.input.up = true;
    let moved = 0;
    for (let i = 0; i < 24; i++) {
      await sleep(250);
      moved = Math.hypot(G.player.pos.x - x0, G.player.pos.z - z0);
      if (moved > 5) break;
    }
    G.input.up = false;
    log('drive', moved > 5, `moved ${moved.toFixed(1)}m`);
    // 5. wanted: a crime raises stars and the PD answers
    addHeat(G, 2, 'selftest');
    await sleep(600);
    log('wanted', G.wanted.level >= 2, `level=${G.wanted.level}`);
    log('police-respond', G.wanted.police.length >= 1, `${G.wanted.police.length} cruisers`);
    // 6. mission: teleport the car onto mission 1's target and let it complete
    G.exitCar();
    if (G.missions.state !== 'active') startMission(G, 0);
    G.player.pos.set(MISSIONS[0].target.x, 0, MISSIONS[0].target.z);
    const cashBefore = G.player.cash;
    const missionBefore = G.missions.index;
    // mission 1 needs the player IN a car at the target: re-enter the nearest car
    let car2 = null; let b2 = 1e9;
    for (const c of G.cars) {
      if (c.kind !== 'traffic') continue;
      const d = Math.hypot(c.pos.x - G.player.pos.x, c.pos.z - G.player.pos.z);
      if (d < b2) { b2 = d; car2 = c; }
    }
    if (car2) {
      G.player.pos.set(car2.pos.x + 2, 0, car2.pos.z);
      G.tryEnterCar();
      // carry the car to the pier
      car2.pos.set(MISSIONS[0].target.x, 0, MISSIONS[0].target.z);
      car2.mesh.position.copy(car2.pos);
      G.player.pos.copy(car2.pos);
    }
    await sleep(400);
    log('mission-complete', G.missions.index === missionBefore + 1, `mission ${missionBefore + 1} -> ${G.missions.index + 1}`);
    log('mission-reward', G.player.cash >= cashBefore + MISSIONS[0].reward, `$${cashBefore} -> $${G.player.cash}`);
    // 7. save/load round-trip through localStorage
    saveGame(G);
    const loaded = loadSave();
    log('save-load', !!loaded && loaded.cash === G.player.cash, loaded ? `cash $${loaded.cash}` : 'no save found');
    // 8. shooting: a ped in front of the camera takes damage, ammo drops
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
    log('shoot', G.combat.ammo === ammoBefore - 1 && ped.hp < hpBefore, `ammo ${ammoBefore}->${G.combat.ammo}, ped hp ${hpBefore}->${ped.hp}`);
    // 9. minimap: the canvas actually draws (not a blank rect)
    const cv = G.hud.el.minimap;
    const ctx = cv.getContext('2d');
    const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
    let nonBg = 0;
    for (let i = 0; i < data.length; i += 400) {
      if (data[i] !== 32 || data[i + 1] !== 38 || data[i + 2] !== 44) nonBg++;
    }
    log('minimap', nonBg > 5, `${nonBg} non-background samples`);
    // 10. exit car works on foot again
    log('exit-car', G.player.onFoot === true, 'onFoot=' + G.player.onFoot);
  } catch (e) {
    log('exception', false, String(e && e.message || e));
  }
  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  document.title = `SELFTEST: ${passed}/${total} ${passed === total ? 'PASS' : 'FAIL'}`;
  window.__selftestDone = true;
  window.__selftestResults = results;
  if (el) {
    const sum = document.createElement('div');
    sum.textContent = `SELFTEST: ${passed}/${total} ${passed === total ? 'PASS' : 'FAIL'}`;
    sum.style.fontWeight = 'bold';
    el.appendChild(sum);
  }
}
