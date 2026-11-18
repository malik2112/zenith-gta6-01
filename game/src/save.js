// SOLMAR BAY — save.js
// One job: persist Nadia Kaur's progress in localStorage — cash, story progress,
// stats — and load it back. The game never needs a server to remember.
import { SAVE_KEY, HUB } from './config.js';

export function saveGame(G) {
  try {
    const data = {
      version: 1,
      cash: G.player.cash,
      missionIndex: G.missions.index,
      missionsDone: G.stats.missionsDone,
      carsStolen: G.stats.carsStolen,
      shotsFired: G.stats.shotsFired,
      playSeconds: Math.floor(G.time),
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function applySave(G, data) {
  if (!data) return false;
  G.player.cash = data.cash ?? 50;
  G.stats.missionsDone = data.missionsDone ?? 0;
  G.stats.carsStolen = data.carsStolen ?? 0;
  G.stats.shotsFired = data.shotsFired ?? 0;
  // resume at the next uncompleted mission, back at Ridge Lodge
  G.missions.index = Math.min(data.missionIndex ?? 0, 4);
  G.missions.state = 'waiting-hub';
  G.player.pos.set(HUB.x + 6, 0, HUB.z - 18);
  G.player.mesh.position.copy(G.player.pos);
  return true;
}

export function hasSave() {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch (e) {
    return false;
  }
}
