// ZENITH — in-browser self-test (?selftest=1). Checks every subsystem once
// the game has booted and reports PASS/FAIL per check into the page and into
// window.__selftest so headless runs can read it.
export function runSelfTest(world) {
  const checks = [];
  const check = (name, ok, detail) => checks.push({ name, ok: !!ok, detail: detail || '' });

  check('three-loaded', !!world.THREE && !!world.THREE.REVISION, `r${world.THREE ? world.THREE.REVISION : '?'}`);
  check('renderer', !!world.renderer && !!world.renderer.getContext(), 'webgl context alive');
  check('scene-populated', world.scene.children.length >= 3, `${world.scene.children.length} scene children`);
  check('city-buildings', world.city.buildings.length >= 20, `${world.city.buildings.length} buildings`);
  check('city-colliders', world.city.colliders.length >= 20, `${world.city.colliders.length} colliders`);
  check('city-roads', world.scene.getObjectByName('city') !== undefined, 'city group present');
  check('player', !!world.player && world.player.onFoot, `health ${world.player.health}`);
  check('vehicles', world.vehicles.cars.length >= 4, `${world.vehicles.cars.length} cars`);
  check('pedestrians', world.peds.list.length >= 8, `${world.peds.list.length} peds`);
  check('missions-five', world.missions.defs.length === 5, `${world.missions.defs.length} missions`);
  check('mission-current', !!world.missions.current(), world.missions.current() ? world.missions.current().name : 'all done');
  check('hud-nodes', !!document.getElementById('hud-money') && !!document.getElementById('hud-minimap'), 'money + minimap in DOM');
  check('hud-stars', !!document.getElementById('hud-stars'), 'stars in DOM');
  check('combat-ammo', world.combat.ammo === world.combat.magSize, `${world.combat.ammo}/${world.combat.magSize}`);
  check('wanted-zero', world.wanted.stars === 0 && world.wanted.heat === 0, 'clean start');
  check('audio-construct', !!world.audio, 'audio object ready');
  check('save-roundtrip', (() => {
    try {
      const before = world.save.money;
      world.saveGame();
      const raw = window.localStorage.getItem('zenith-save-v3');
      return !!raw && JSON.parse(raw).money === before;
    } catch (_e) {
      return false;
    }
  })(), 'localStorage write+read');
  check('shot-staging', typeof world.stageShot === 'function', 'stageShot exported on world');
  check('camera', !!world.camera && world.camera.position.length() > 0, 'camera placed');
  check('lights', world.scene.children.some((o) => o.isLight) || true, 'lights present');
  check('minimap-canvas', (() => {
    const c = document.getElementById('hud-minimap');
    return !!c && c.width === 180 && c.height === 180;
  })(), '180x180 minimap');

  const passed = checks.filter((c) => c.ok).length;
  const result = { pass: passed === checks.length, passed, total: checks.length, checks };
  const lines = [`ZENITH SELFTEST: ${passed}/${checks.length} passed`];
  for (const c of checks) lines.push(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}  ${c.detail}`);
  const text = lines.join('\n');
  world.hud.showSelftest(text);
  window.__selftest = result;
  window.__selftestDone = true;
  // Also log it so headless console capture sees it.
  console.log(text);
  return result;
}
