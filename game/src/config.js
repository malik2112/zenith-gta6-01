// ZENITH — config.js (fresh rewrite, round 3)
// Every number the rest of the game argues about lives here: the shape of
// the town, how a car feels, what a crime costs, what the sky looks like.
// The other modules import these tables and never invent their own tuning,
// so balancing the whole game means editing this one file.

export const GAME_TITLE = 'ZENITH';
export const GAME_SUBTITLE = 'An open-world crime story in the mountain town of Zenith';
export const SAVE_KEY = 'zenith-save-v2';

// ---------------------------------------------------------------- the town
// The street grid: BLOCKS_PER_SIDE squares of BLOCK_PITCH metres, roads on
// the grid lines, buildings inside the squares. The built-up area spans
// -half..+half on both axes; east of it the ridge road climbs past the
// observatory toward the valley haze, which is where the world ends.
const BLOCKS_PER_SIDE = 6;
const BLOCK_PITCH = 70;
const GRID_HALF = (BLOCKS_PER_SIDE * BLOCK_PITCH) / 2; // 210

export const CITY = Object.freeze({
  blocks: BLOCKS_PER_SIDE,
  block: BLOCK_PITCH,
  streetWidth: 16,
  half: GRID_HALF,
  beachX: GRID_HALF + 16,   // ridge rock shelf begins (east edge)
  waterX: GRID_HALF + 52,   // violet valley haze begins
  boundX: GRID_HALF + 78,   // hard eastern bound, out on the shelf
  boundZ: GRID_HALF + 18,   // hard bound on the other three sides
  fogNear: 120,
  fogFar: 380,
  sunIntensity: 1.9,
});

// ---------------------------------------------------------------- the story
// Ridge Lodge is where every job starts and where the story ends.
export const HUB = Object.freeze({ x: -186, z: -168 });
export const HUB_NAME = 'Ridge Lodge';
export const PD_NAME = 'Ridge PD';
export const RADIO_NAME = 'SUMMIT FM 94.7';
export const COMPLETE_TITLE = 'QUEEN OF THE RIDGE';
export const BUSTED_TEXT =
  'The Ridge PD finally boxed you in. A $100 fine, a long walk back, and they dropped you at the lodge.';
export const WASTED_TEXT =
  'Ridge Clinic stitched you back together for $100. The good news: nobody is looking for you anymore.';
export const CLOCK_START = 1145; // minutes after midnight when a fresh game opens

export const STORY = Object.freeze({
  hero: 'Nadia Kaur',
  fixer: 'Professor Alden Vark',
  intro:
    'Nadia Kaur rolled into Zenith with a dying rover and a debt she could not outrun. ' +
    'Professor Alden Vark, who runs the observatory lodge up on Ridge Road, offered her a way out: ' +
    'five jobs, no questions, cash on completion. Drive clean, steal smarter, and stay ahead of the ' +
    'Ridge PD — their stars do not come off easy.',
  outro:
    'The last crate is delivered, the debt is settled, and the ridge road is quiet behind you. ' +
    'Zenith belongs to the driver who never got caught. QUEEN OF THE RIDGE.',
});

// The one road that drives like no other road in town: past the observatory
// the ridge shelf is polished rock and morning ice, so the wheel answers
// late and every slide lasts a breath longer.
export const MECHANIC = Object.freeze({
  type: 'ice',
  blurb:
    'RIDGE ICE: the east ridge road (past the observatory) is slick — steering bites late, slides last longer.',
});

// ---------------------------------------------------------------- the hero
export const PLAYER = Object.freeze({
  walkSpeed: 6,
  runSpeed: 11,
  radius: 0.6,
  height: 1.8,
  eyeHeight: 1.62,
  maxHp: 100,
  jumpSpeed: 0, // Zenith is a driving town; feet stay on the ground
});

// ---------------------------------------------------------------- the cars
// Arcade numbers, tuned for fun over realism: strong brakes, forgiving grip,
// a handbrake that actually rotates the car.
export const CAR = Object.freeze({
  accel: 22,
  brake: 34,
  reverseMax: 12,
  maxSpeed: 36,
  turnRate: 2.0,
  grip: 6.5,
  handbrakeTurn: 3.1,
  radius: 1.5,
});

// Ambient population: how many cars cruise and how many people walk.
export const TRAFFIC = Object.freeze({
  carCount: 10,
  carSpeed: 9,
  pedCount: 16,
  pedSpeed: 1.6,
});

// ---------------------------------------------------------------- the law
// Heat is priced per crime; stars cool down only after a quiet stretch
// with no cruiser close enough to see you.
export const WANTED = Object.freeze({
  max: 5,
  decaySeconds: 26,
  bustDistance: 3.2, // a stopped cruiser this close, while you are on foot…
  bustSeconds: 1.6,  // …for this long, and the cuffs come out
  heatStealCar: 1,
  heatHitPed: 1,
  heatShoot: 1,
  heatKillCop: 2,
  heatRamCop: 1,
});

// ---------------------------------------------------------------- the gun
export const COMBAT = Object.freeze({
  magSize: 12,
  reloadSeconds: 1.4,
  range: 90,
  damage: 34,
  fireInterval: 0.22,
  pedHp: 50,
  copHp: 80,
  rivalHp: 100,
});

// ---------------------------------------------------------------- the look
// Dusk over the ridge: violet sky, warm sun, pastel towers.
export const PALETTE = Object.freeze({
  sky: 0x8a7fc0,
  fog: 0x7a6fa8,
  sun: 0xffd9a0,
  asphalt: 0x2c2c34,
  sidewalk: 0x8a8a96,
  sand: 0x6a6a72,
  sea: 0x8a7fb8,
  building: Object.freeze([
    0x8a86a8, 0x6a7a9a, 0xb8a88a, 0x9a8ab8,
    0xd8d8e0, 0x7a6a8a, 0xc8b8a8, 0x5a5a6a,
  ]),
  glass: 0x4a5a7a,
  palmTrunk: 0x5a4632,
  palmLeaf: 0x2a6a3a,
  carPaint: Object.freeze([
    0x8a7fc0, 0x2e6fc2, 0xe8c23a, 0x3aa88a,
    0xc23b2e, 0xe8e8e8, 0x222831, 0xd97a2b,
  ]),
  ground: 0x5a5e52,
  hemiSky: 0x9a8ac8,
  hemiGround: 0x4a4448,
  minimapSea: '#8a7fb8',
  minimapSand: '#6a6a72',
});

// ---------------------------------------------------------------- the keys
// Shown verbatim on the start screen; keep in step with main.js.
export const CONTROLS = Object.freeze([
  ['W A S D', 'Move / drive'],
  ['Mouse', 'Look around (click to lock)'],
  ['Shift', 'Sprint / NITRO boost (in car)'],
  ['E', 'Enter / exit / steal a car'],
  ['F', 'Horn (in car) — scatters pedestrians'],
  ['Space', 'Handbrake (in car)'],
  ['Click', 'Fire pistol'],
  ['R', 'Reload'],
  ['M', 'Toggle mission details'],
  ['P / Esc', 'Pause'],
  ['H', 'Toggle radio'],
]);
