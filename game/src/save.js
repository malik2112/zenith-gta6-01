// ZENITH — save.js (round 3 redo)
// Progress lives in localStorage: cash, story position, and the stats
// the end screen brags about. One key, one JSON blob, versioned so a
// future format can migrate instead of breaking old saves. Format v3
// adds the total play time in seconds.
import { SAVE_KEY, HUB } from './config.js';

const SAVE_VERSION = 3;

// Snapshot the parts of the game state worth remembering.
function packSave(G) {
  return {
    version: SAVE_VERSION,
    cash: G.player.cash,
    missionIndex: G.missions.index,
    missionsDone: G.stats.missionsDone,
    carsStolen: G.stats.carsStolen,
    shotsFired: G.stats.shotsFired,
    nearMisses: G.stats.nearMisses || 0,
    playSeconds: Math.floor(G.time),
    savedAt: new Date().toISOString(),
  };
}

export function storeSave(G) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(packSave(G)));
    return true;
  } catch (e) {
    return false;
  }
}

export function fetchSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== SAVE_VERSION) return null;
    return data;
  } catch (e) {
    return null;
  }
}

// Put a loaded save back into the world: money and stats restored, the
// story resumes at the next unfinished job, Nadia back at the lodge.
export function restoreSave(G, data) {
  if (!data) return false;
  G.player.cash = data.cash ?? 50;
  G.stats.missionsDone = data.missionsDone ?? 0;
  G.stats.carsStolen = data.carsStolen ?? 0;
  G.stats.shotsFired = data.shotsFired ?? 0;
  G.stats.nearMisses = data.nearMisses ?? 0;
  G.missions.index = Math.min(data.missionIndex ?? 0, 4);
  G.missions.state = 'waiting-hub';
  G.player.pos.set(HUB.x + 6, 0, HUB.z - 18);
  G.player.mesh.position.copy(G.player.pos);
  return true;
}

export function saveExists() {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch (e) {
    return false;
  }
}
