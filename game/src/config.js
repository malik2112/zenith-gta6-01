// ZENITH — config.js
// One job: every tunable number, colour and story string in one place so the
// rest of the game reads like a design document, not a pile of magic numbers.
// All names, places and people here are original fiction.
export const GAME_TITLE = 'ZENITH';
export const GAME_SUBTITLE = 'An open-world crime story in the mountain town of Zenith';
export const SAVE_KEY = 'zenith-save-v1';

// City layout: a 6 x 6 grid of blocks. Streets run on the grid lines.
export const CITY = {
  blocks: 6,          // blocks per side
  block: 70,          // block pitch (metres)
  streetWidth: 16,    // road width
  half: 210,          // city spans -half .. +half on both axes
  beachX: 226,        // edge feature starts here (east edge)
  waterX: 262,        // far edge feature starts here
  boundX: 288,        // hard world bound east (in the edge feature)
  boundZ: 228,
  fogNear: 120,
  fogFar: 380,
  sunIntensity: 1.9,
};

// Mission hub: the fixer's base. Missions start here, the story ends here.
export const HUB = { x: -186, z: -168 };
export const HUB_NAME = "Ridge Lodge";
export const PD_NAME = "Ridge PD";
export const RADIO_NAME = "SUMMIT FM 94.7";
export const COMPLETE_TITLE = "QUEEN OF THE RIDGE";
export const BUSTED_TEXT = "The Ridge PD caught you. They took $100 for the trouble and dropped you at the lodge.";
export const WASTED_TEXT = "Ridge Clinic patched you up. The bill was $100 \u2014 and the heat is off, for now.";
export const CLOCK_START = 1145; // in-game clock start, minutes

// The one mechanic that makes this city drive differently from any other:
// RIDGE ICE: the east ridge road (past the observatory) is slick — steering bites late, slides last longer.
export const MECHANIC = { type: "ice", blurb: "RIDGE ICE: the east ridge road (past the observatory) is slick \u2014 steering bites late, slides last longer." };

// Player / on-foot tuning
export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 11,
  radius: 0.6,
  height: 1.8,
  eyeHeight: 1.62,
  maxHp: 100,
  jumpSpeed: 0,
};

// Car tuning (arcade, not a sim: fun first)
export const CAR = {
  accel: 22,
  brake: 34,
  reverseMax: 12,
  maxSpeed: 36,
  turnRate: 2.0,
  grip: 6.5,
  handbrakeTurn: 3.1,
  radius: 1.5,
};

// Traffic + pedestrians
export const TRAFFIC = {
  carCount: 10,
  carSpeed: 9,
  pedCount: 16,
  pedSpeed: 1.6,
};

// Wanted system
export const WANTED = {
  max: 5,
  decaySeconds: 26,       // quiet seconds before one star drops
  bustDistance: 3.2,      // cop must be this close, on foot, to bust
  bustSeconds: 1.6,       // seconds of contact before the bust lands
  heatStealCar: 1,
  heatHitPed: 1,
  heatShoot: 1,
  heatKillCop: 2,
  heatRamCop: 1,
};

// Combat
export const COMBAT = {
  magSize: 12,
  reloadSeconds: 1.4,
  range: 90,
  damage: 34,
  fireInterval: 0.22,
  pedHp: 50,
  copHp: 80,
  rivalHp: 100,
};

// Palette
export const PALETTE = {
  sky: 0x8a7fc0,
  fog: 0x7a6fa8,
  sun: 0xffd9a0,
  asphalt: 0x2c2c34,
  sidewalk: 0x8a8a96,
  sand: 0x6a6a72,
  sea: 0x8a7fb8,
  building: [0x8a86a8, 0x6a7a9a, 0xb8a88a, 0x9a8ab8, 0xd8d8e0, 0x7a6a8a, 0xc8b8a8, 0x5a5a6a],
  glass: 0x4a5a7a,
  palmTrunk: 0x5a4632,
  palmLeaf: 0x2a6a3a,
  carPaint: [0x8a7fc0, 0x2e6fc2, 0xe8c23a, 0x3aa88a, 0xc23b2e, 0xe8e8e8, 0x222831, 0xd97a2b],
  ground: 0x5a5e52,
  hemiSky: 0x9a8ac8,
  hemiGround: 0x4a4448,
  minimapSea: "#8a7fb8",
  minimapSand: "#6a6a72",
};

// Story: Nadia Kaur, a driver new to town, owes fixer Professor Alden Vark.
export const STORY = {
  hero: "Nadia Kaur",
  fixer: "Professor Alden Vark",
  intro: "You are Nadia Kaur, a getaway driver who just rolled into Zenith with a busted rover and a debt to Professor Alden Vark, who runs the observatory lodge on Ridge Road. Pay him back job by job \u2014 drive, steal, run \u2014 and earn your place as the best driver on the mountain. Watch the stars: the Ridge PD does not forgive.",
  outro: "The ridge road fades behind you, $1,500 richer and finally square with Vark. Zenith is yours now, Nadia \u2014 every street, every car, every getaway. QUEEN OF THE RIDGE.",
};

// Controls shown on the start screen and pause menu
export const CONTROLS = [
  ['W A S D', 'Move / drive'],
  ['Mouse', 'Look around (click to lock)'],
  ['Shift', 'Sprint / NITRO boost (in car)'],
  ['E', 'Enter / exit / steal a car'],
  ['Space', 'Handbrake (in car)'],
  ['Click', 'Fire pistol'],
  ['R', 'Reload'],
  ['M', 'Toggle mission details'],
  ['P / Esc', 'Pause'],
  ['H', 'Toggle radio'],
];
