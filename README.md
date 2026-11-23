# ZENITH — an open-world crime game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/malik2112/zenith-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/malik2112/zenith-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game written for [make.fun's **gta6-01** bounty](https://make.fun/bounty/gta6-01).
It is plain static files — no build step, no network, no assets to download.
Open `game/index.html` in a desktop browser, or run `node serve.ts` and
visit http://localhost:8080.

## The pitch

You are **Nadia Kaur**, a getaway driver who rolled into the mountain town
of **Zenith** owing money to **Professor Alden Vark**, the fixer who runs
the observatory lodge on Ridge Road. Five jobs settle the debt: an errand
up the ridge, a car to "borrow", a hot pursuit to shake, a timed crate
run, and one last job at the dome. Everything — city, people, cars,
story, music — is original fiction; no part of any commercial game is used.

## What's in the game

- **A whole town, procedurally built**: a 6×6-block grid of pastel towers
  with lit windows, an observatory dome and radio dish, cable-car pylons,
  pine rows along the ridge shelf, and the violet valley beyond.
- **Drive anything**: traffic cruises the road graph in its lane; walk up
  to any car and press **E** to take it. Arcade handling with a real
  drift model — the car has a facing and a direction of travel, and grip
  pulls one back in line with the other.
- **Signature mechanic — RIDGE ICE**: the east ridge road past the
  observatory is polished rock and morning ice. Steering bites late and
  every slide lasts longer. Easy does it.
- **Wanted system**: steal, run someone down, or open fire and the stars
  climb. Ridge PD cruisers dispatch from real roads, lead their target
  to intercept you, ram, and bust you on foot. Lay low and the heat cools.
- **Combat**: a 12-round pistol with tracers, muzzle flash and reloads;
  rival crew who fire in bursts and shoot back.
- **People**: walkers stroll the pavements, pause at corners, and sprint
  away from gunfire or a car coming too fast.
- **HUD**: cash, health, wanted stars, a live minimap with traffic and
  cruiser blips, mission objective, speed, ammo, an in-game clock, and a
  synth radio (SUMMIT FM 94.7) generated live with WebAudio.
- **Save**: progress persists in localStorage; Continue resumes at the lodge.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move / drive |
| Mouse | Look around (click to lock) |
| Shift | Sprint |
| E | Enter / exit / steal a car |
| Space | Handbrake (in car) |
| Click | Fire pistol |
| R | Reload |
| M | Toggle mission details |
| H | Toggle radio |
| P / Esc | Pause |

## How it's built

- `game/index.html` — the page, HUD and menus
- `game/src/main.js` — boot, the frame loop, input, car enter/exit, end flows
- `game/src/config.js` — every tuning number, the palette, the story text
- `game/src/city.js` — the procedural town, collisions, the road graph
- `game/src/vehicles.js` — car meshes, the drift driving model, traffic and police AI
- `game/src/pedestrians.js` — the figure builder and the walker state machine
- `game/src/player.js` — on-foot movement and the third-person camera
- `game/src/combat.js` — the pistol, tracers, rival bursts
- `game/src/wanted.js` — heat, stars, cruiser dispatch, the bust
- `game/src/missions.js` — the five-job story and its beacons
- `game/src/hud.js` — HUD readouts and the live minimap
- `game/src/save.js` — localStorage save/load
- `game/src/audio.js` — all sound synthesised with WebAudio, no audio files
- `game/src/shots.js` — staged scenes for the screenshots (`?shot=start|street|drive|mission`)
- `game/src/selftest.js` — a headless play-through check (`?selftest=1`)
- `game/vendor/three/three.module.min.js` — three.js (MIT), vendored
- `main.ts` — the make.fun entrypoint: copies `game/` and `screenshots/` out and writes the dossier
- `serve.ts` — a tiny static server for local play

## License

MIT — see LICENSE.
