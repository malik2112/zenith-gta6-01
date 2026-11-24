// ZENITH — screenshot staging (?shot=<name>). Each shot puts the game into a
// fixed, good-looking state and the main loop sets window.__shotReady once
// the scene has settled for a few frames.
export const SHOT_NAMES = ['drive', 'street', 'mission', 'start'];

export function stageShot(name, world) {
  const THREE = world.THREE;
  const hideMenu = () => {
    world.state = 'playing';
    world.hud.hideMenu();
    world.hud.hidePause();
    world.hud.hideBusted();
  };
  if (name === 'drive') {
    hideMenu();
    // Stage mission 2 directly so taking the car does not complete mission 1
    // mid-shot (money stays at the $250 start and the banner is mission 2).
    world.missions.start(1);
    // Put the player in the red car on the main east road (z = 0), mid-drive.
    // Camera sits behind the car, so camYaw equals the car's heading.
    const car = world.vehicles.cars[0];
    car.driver = 'player';
    car.speed = 26;
    car.heading = Math.PI / 2;
    car.pos.set(60, 0, 0);
    world.player.enterCar(car);
    world.player.pos.copy(car.pos);
    world.player.heading = car.heading;
    world.hud.showBanner('MISSION 2: SUNSET COURIER', 'Drive the package through both checkpoints.');
    world.hud.setObjective('Drive the package through both checkpoints.');
    world.camYaw = car.heading;
    world.shotFrames = 0;
  } else if (name === 'street') {
    hideMenu();
    // On foot at the central intersection, peds crossing, cars parked nearby.
    world.player.teleport(8, 72, Math.PI * 0.75);
    world.player.onFoot = true;
    world.player.group.visible = true;
    const near = world.peds.nearestPed(world.player.pos, 60);
    if (near) {
      near.pos.set(4, 0, 84);
      near.target = { x: 30, z: 88 };
    }
    world.hud.showBanner('ZENITH', 'An open-world crime story at sunset.');
    world.hud.setObjective('Steal a car — press E near a parked car.');
    world.camYaw = world.player.heading;
    world.shotFrames = 0;
  } else if (name === 'mission') {
    hideMenu();
    // Mission 3 active with 2 stars: a police car closing in, beacon lit.
    world.missions.start(2);
    world.wanted.addHeat(45);
    world.player.teleport(-8, -120, 0.2);
    world.player.onFoot = true;
    world.player.group.visible = true;
    const cop = world.vehicles.spawnPolice(30, -95);
    cop.heading = Math.atan2(world.player.pos.x - cop.pos.x, world.player.pos.z - cop.pos.z);
    world.wanted.police.push(cop);
    world.hud.setStars(2);
    world.camYaw = world.player.heading;
    world.shotFrames = 0;
  } else if (name === 'start') {
    // Title menu over the city at dusk; camera orbits slowly (menu state).
    world.state = 'menu';
    world.hud.showMenu();
    world.shotFrames = 0;
  } else {
    return false;
  }
  world.shotName = name;
  window.__zenithShot = name;
  return true;
}

export function shotFromUrl() {
  try {
    const q = new URLSearchParams(window.location.search);
    const s = q.get('shot');
    return SHOT_NAMES.includes(s) ? s : null;
  } catch (_e) {
    return null;
  }
}

export function selftestFromUrl() {
  try {
    return new URLSearchParams(window.location.search).get('selftest') === '1';
  } catch (_e) {
    return false;
  }
}
