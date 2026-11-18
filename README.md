# ZENITH — an open-world crime game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/malik2112/zenith-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/malik2112/zenith-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game for [make.fun's **gta6-01** bounty](https://make.fun/bounty/gta6-01), built as
plain static files that play offline in a desktop browser. No network, no
build step: open `game/index.html` (or `node serve.ts` and visit
http://localhost:8080).

## The game

You are **Nadia Kaur**, a driver new to **ZENITH** — no part of any commercial game is used: the city,
people, cars, story and music are all original.

- **Open city**: a 6×6-block grid with its own edge district, a landmark tower and Professor Alden Vark's Ridge Lodge — explore on foot or by car.
- **Drive & steal**: traffic cruises the roads; walk up to any car and press
  **E** to take it. Arcade handling, handbrake slides, crash damage.
- **Signature mechanic**: RIDGE ICE: the east ridge road (past the observatory) is slick — steering bites late, slides last longer.
- **Wanted system**: steal, hit pedestrians or shoot and the stars rise;
  Ridge PD cruisers chase, ram and try to bust you. Lay low and the
  heat cools off.
- **Story**: five jobs for fixer Professor Alden Vark — an errand, a stolen car, a
  hot pursuit, a timed collection run, and the big final job.
- **Combat**: pistol with tracers, reloads and rival crew that shoots back.
- **HUD**: cash, health, wanted stars, live minimap, mission objective,
  speed, ammo, in-game clock, and a synth radio (WebAudio, generated live).
- **Save**: progress saves to localStorage; Continue resumes at the hub.

## Controls

WASD move / drive · mouse look (click to lock) · Shift sprint / NITRO (in car) · E enter/exit
car · Space handbrake · click fire · R reload · M mission details · H radio ·
P / Esc pause.

## Files

- `game/index.html` — the page, HUD and menus
- `game/src/main.js` — boot, game loop, input, car enter/exit, flows
- `game/src/config.js` — tuning, palette, story text
- `game/src/city.js` — procedural city, collisions, road graph
- `game/src/vehicles.js` — car meshes, driving physics, traffic + police AI
- `game/src/pedestrians.js` — walkers, fleeing, fallen
- `game/src/player.js` — on-foot movement + third-person camera
- `game/src/combat.js` — pistol, tracers, rivals
- `game/src/wanted.js` — wanted level, police dispatch, busted
- `game/src/missions.js` — the five-job story
- `game/src/hud.js` — HUD + live minimap
- `game/src/save.js` — localStorage save/load
- `game/src/audio.js` — synthesised sound + radio (WebAudio, no files)
- `game/src/shots.js` — staged scenes for the screenshots (`?shot=`)
- `game/src/selftest.js` — headless play-through checks (`?selftest=1`)
- `game/vendor/three/three.module.min.js` — three.js (MIT), vendored

## License

MIT — see LICENSE.
