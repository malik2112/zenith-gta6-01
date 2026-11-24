// ZENITH — configuration. Every tunable number of the game lives here so
// the other modules stay small and consistent. Written from scratch.
export const CONFIG = {
  worldSize: 640, // playable square, metres, centred on (0, 0)
  roadSpacing: 80, // distance between parallel roads
  roadWidth: 12,
  playerWalk: 9,
  playerRun: 14,
  carAccel: 26,
  carBrake: 40,
  carMaxSpeed: 42,
  carMaxReverse: 12,
  carTurn: 1.9,
  policeMaxSpeed: 46,
  pedSpeed: 1.6,
  pedFleeSpeed: 4.4,
  gravity: 30,
  startMoney: 250,
  startHealth: 100,
  bustedFine: 200,
  // Wanted heat: 0..100. Stars are derived from heat bands.
  heatPerStar: 20,
  heatDecayPerSec: 2.2,
  heatStealCar: 15,
  heatShootPed: 25,
  heatShootCar: 10,
  heatShootPolice: 40,
  heatKillCop: 50,
  // Sunset palette.
  skyTop: 0x2b1a4e,
  skyHorizon: 0xff7e3d,
  fogColor: 0x3a2350,
  fogDensity: 0.0016,
  sunColor: 0xffb36b,
  sunIntensity: 2.4,
  hemiSky: 0x8a6bbf,
  hemiGround: 0x2a1a2e,
  hemiIntensity: 0.9,
  keys: {
    forward: 'KeyW',
    back: 'KeyS',
    left: 'KeyA',
    right: 'KeyD',
    run: 'ShiftLeft',
    enterCar: 'KeyE',
    reload: 'KeyR',
    mute: 'KeyM',
    pause: 'Escape',
    radioNext: 'KeyN',
  },
};

// The five story missions, in order. `type` drives the completion check in
// missions.js; `waypoints` are tried in order for multi-stop missions.
export const MISSIONS = [
  {
    id: 'first-wheels',
    name: 'First Wheels',
    brief: 'You need wheels. Find a parked car, press E to take it, and drive.',
    type: 'steal',
    reward: 150,
  },
  {
    id: 'sunset-courier',
    name: 'Sunset Courier',
    brief: 'Drive the package through both checkpoints before the sun is gone.',
    type: 'drive-to',
    waypoints: [
      { x: -160, z: -160, label: 'Checkpoint A' },
      { x: 160, z: 160, label: 'Checkpoint B' },
    ],
    reward: 300,
  },
  {
    id: 'street-heat',
    name: 'Street Heat',
    brief: 'Get the cops to 2 stars, then shake them and go quiet.',
    type: 'escape',
    needStars: 2,
    reward: 400,
  },
  {
    id: 'rooftop-standoff',
    name: 'Rooftop Standoff',
    brief: 'Rivals own this block. Drop 5 targets. Watch your wanted level.',
    type: 'shoot',
    needHits: 5,
    reward: 500,
  },
  {
    id: 'zenith-heist',
    name: 'Zenith Heist',
    brief: 'Hit the vault on the north strip, then run for the docks.',
    type: 'heist',
    waypoints: [
      { x: 0, z: -240, label: 'Zenith Vault' },
      { x: -240, z: 240, label: 'Docks Escape' },
    ],
    reward: 1000,
  },
];

// Three procedural radio stations. Each is a scale of semitone offsets from
// a root note plus a tempo; audio.js turns them into a loop.
export const RADIO = [
  { name: 'ZENITH FM — synthwave', root: 57, bpm: 96, scale: [0, 3, 5, 7, 10, 12, 15] },
  { name: 'VICE 88 — night drive', root: 52, bpm: 78, scale: [0, 2, 4, 7, 9, 12] },
  { name: 'MOUNTAIN — dusty roads', root: 45, bpm: 112, scale: [0, 3, 5, 8, 10, 12] },
];

// Fixed spawn anchors the city hands out, so staging and missions agree.
// Cars sit at the curb of a road (road centre +/- 7), peds on sidewalks
// (road centre +/- 8.5), so nothing ever spawns inside a building.
export const SPAWNS = {
  player: { x: 8.5, z: 40, heading: Math.PI },
  cars: [
    { x: 24, z: 7, heading: Math.PI / 2, color: 0xc23b2e },
    { x: -24, z: -7, heading: -Math.PI / 2, color: 0x2e6fc2 },
    { x: 104, z: 87, heading: Math.PI / 2, color: 0xd8b13a },
    { x: -104, z: -87, heading: -Math.PI / 2, color: 0x3aa655 },
    { x: 7, z: 184, heading: 0, color: 0x8a3ac2 },
    { x: -7, z: -184, heading: Math.PI, color: 0xcccccc },
  ],
  peds: [
    { x: 8, z: 88 }, { x: -8, z: 168 }, { x: 88, z: -8 }, { x: -88, z: 48 },
    { x: 168, z: 88 }, { x: -168, z: -88 }, { x: 48, z: -8 }, { x: -88, z: 208 },
    { x: 88, z: 208 }, { x: -88, z: -208 }, { x: 168, z: -48 }, { x: -208, z: 168 },
    { x: 56, z: 168 }, { x: -56, z: -168 },
  ],
};
