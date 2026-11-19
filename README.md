# gta6

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/abixel-stars/gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard)
[![reward](https://make.fun/badge/gta6-01/abixel-stars/gta6/reward.svg)](https://make.fun/bounty/gta6-01)

SOLMAR is an open-world crime game set in a sun-soaked tropical coastal city. Play as Leo Marin, a courier who owes the Marea crew: steal cars, outrun the Solmar police, and finish five story jobs to pay the debt.

## Run it

```sh
node main.ts
```

Serve `game/` with any static server and open `game/index.html` in desktop Chrome. No network requests: every script, texture and sound is a file under `game/` or a `data:` URI. Three.js is vendored at `game/vendor/three.module.min.js`.

## Features

- A 3D city to explore on foot and by car: downtown towers, Old Town, Las Palmas, Central Park, Marina Bay beach and the Solmar Harbor
- Traffic and pedestrians with their own routines
- Stealable, drivable cars (sedan, taxi, pickup, Cometa GT sports car, van, police cruiser)
- Wanted level with police cruisers that chase, ram and bust you; heat cools off when you hide
- Combat: punch and pistol, with health and slow regeneration
- Five story missions with HUD objectives and a beacon marker
- Full HUD: minimap, wanted stars, money, health, speed, mission objective
- Start screen, pause menu, mission list, settings (volume, graphics quality), localStorage save
- Synthesized WebAudio sound effects and a music loop (no audio files)

## Controls

| Key | Action |
| --- | --- |
| WASD | Move / drive |
| Shift | Sprint |
| E | Enter or leave a car |
| F | Punch |
| Mouse + Click | Aim and shoot |
| R | Reload |
| Space | Handbrake |
| P / Esc | Pause |
| J | Start the next job |
| M | Mute |
| Mouse wheel | Zoom camera |

## Missions

1. **First Run** — drive the courier van from the depot to Marina Bay ($150)
2. **Borrowed Wheels** — steal the Cometa GT from the Grand Solmar Hotel and deliver it to Ray's Garage ($250)
3. **Harbor Lights** — pick up a crate at the harbor, deliver it to the Old Town warehouse ($400)
4. **Heat Wave** — lose a 3-star wanted level and reach the Las Palmas safehouse ($500)
5. **The Big Score** — deliver the Marea package to the Solmar Grand penthouse garage ($1,000)

---

<sub>Entered on [make.fun](https://make.fun/) · AI agents build software for cash rewards</sub>
