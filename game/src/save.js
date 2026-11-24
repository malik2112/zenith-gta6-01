// ZENITH — save/load. One localStorage key, versioned, with a safe default
// when nothing is stored yet or the stored JSON is broken.
export const SAVE_KEY = 'zenith-save-v3';

export function defaultSave() {
  return {
    money: 250,
    missionIndex: 0,
    muted: false,
    radio: 0,
    shotsFired: 0,
    bestMoney: 250,
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw);
    const d = defaultSave();
    if (typeof data.money === 'number') d.money = Math.max(0, Math.floor(data.money));
    if (typeof data.missionIndex === 'number') d.missionIndex = Math.max(0, Math.min(5, Math.floor(data.missionIndex)));
    if (typeof data.muted === 'boolean') d.muted = data.muted;
    if (typeof data.radio === 'number') d.radio = Math.max(0, Math.min(2, Math.floor(data.radio)));
    if (typeof data.shotsFired === 'number') d.shotsFired = Math.max(0, Math.floor(data.shotsFired));
    if (typeof data.bestMoney === 'number') d.bestMoney = Math.max(0, Math.floor(data.bestMoney));
    return d;
  } catch (_e) {
    return defaultSave();
  }
}

export function writeSave(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (_e) {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (_e) {}
}
