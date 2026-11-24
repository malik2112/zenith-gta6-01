[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/malik2112/zenith-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/malik2112/zenith-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# ZENITH — Open-World Crime

A sunset open-world crime game built for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). You are a nobody with a pistol and a dream in Zenith, a mountain town that never quite cools down after sunset. Steal cars, outrun the law, and run five story jobs to own the city.

## Play

Serve the game locally (no build step, no install) and open it in a desktop browser:

```sh
node serve.ts 8080
# open http://127.0.0.1:8080/game/index.html
```

Or open `game/index.html` directly from any static file server. Three.js is vendored under `game/vendor/three/` — the game loads fully offline.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| Shift | Run |
| E | Steal a car / exit a car |
| Click | Shoot (on foot) |
| R | Reload |
| N | Next radio station |
| M | Mute |
| Esc | Pause |

## Features

- **A living city**: a road grid with sidewalks and streetlights, ~50 buildings with lit windows, a plaza, scrub trees, and a ring of snowy mountains around a gradient sunset sky.
- **Drivable cars**: six parked cars to steal, arcade handling with speed-sensitive steering, headlights, damage smoke, and police interceptors with flashing light bars.
- **Pedestrians**: walkers who stroll the sidewalks, flee from gunfire, and fall when shot.
- **Wanted system**: 0–5 stars driven by a heat meter. Crimes add heat, quiet time cools it. At 1+ stars police cars chase you; get caught on foot and you are busted, fined, and dumped back on the street.
- **Five story missions**: First Wheels (steal a car), Sunset Courier (two checkpoints), Street Heat (reach 2 stars, then lose them), Rooftop Standoff (drop 5 targets), Zenith Heist (vault, then the docks). Each pays out; progress saves in the browser.
- **HUD + minimap**: money, health, ammo, wanted stars, objective tracker, distance readout, and a live 2D minimap with the player arrow, cars, pedestrians, police, and the mission beacon.
- **Procedural audio**: synthesized engine hum, gunshots, sirens, and three radio stations — no audio files.
- **Save/load**: money, mission progress, mute, and radio station persist in `localStorage`.
- **Self-test**: open `game/index.html?selftest=1` for an in-browser checklist of every subsystem.

## Screenshots

Staged in-session with a headless browser (`?shot=drive|street|mission|start`):

- `screenshots/1-drive.jpg` — driving the Sunset Courier job
- `screenshots/2-street.jpg` — on foot at the central intersection
- `screenshots/3-mission.jpg` — Street Heat at 2 stars with a unit closing in
- `screenshots/4-start.jpg` — the title menu over the city at dusk

## Layout

```
game/
  index.html        page + import map + HUD styles
  src/
    config.js       tunables, mission defs, radio stations, spawns
    city.js         sunset town: roads, buildings, mountains, colliders
    player.js       on-foot movement, enter/exit car
    vehicles.js     car factory, arcade driving, police chase
    pedestrians.js  walkers, flee AI, fall/respawn
    combat.js       pistol, raycast hits, tracer, muzzle flash
    wanted.js       heat, stars, police spawn, busted
    missions.js     five-job state machine + beacon marker
    hud.js          DOM HUD, minimap, menu / pause / busted screens
    audio.js        WebAudio synth: engine, shots, siren, radio
    save.js         localStorage save/load
    selftest.js     ?selftest=1 checklist
    shots.js        ?shot= staging for screenshots
    main.js         boot, input, camera, game loop
  vendor/three/     vendored Three.js (r187)
vendor/makefun-game.ts   dossier builder (kit starter, untouched)
main.ts             builds dossier.json (makefun/dossier/v1)
serve.ts            static file server for local play
```

## Dossier

```sh
MAKEFUN_OUTPUT_DIR=/tmp/zenith-out node main.ts
# writes /tmp/zenith-out/dossier.json
```

## License

MIT — see `LICENSE`. Three.js is MIT-licensed by the Three.js Authors.
