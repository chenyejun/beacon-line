# beacon-line

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/chenyejun/beacon-line/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/chenyejun/beacon-line/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

Beacon Line （灯塔防线） is a top-down wave-defense arcade game in the browser. Night has fallen on a rocky shore, and the old lighthouse is the last light left. Hold the beam: aim with the mouse, fire at the shapes crawling out of the dark, and keep the lighthouse standing through wave after wave. Each wave comes faster and thicker than the last; between waves, catch your breath, count your score, and get ready — the dark always comes back.

## Run it

```sh
node serve.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=kr2w23qf&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>

---

## Play it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network: the game is static files under `game/`, drawn on a plain 2D canvas.

- **Mouse** aim, **click** (hold) to fire, **W A S D** / **arrow keys** to move.
- **Shift** / **Space** dash — a short burst of speed with a brief moment of protection after it. **P** / **Esc** pauses.
- **Waves:** enemies come in waves from the dark. Clear a wave to start the next one — faster, thicker, harder. Clear all 10 waves and the light holds: you win.
- **The lighthouse:** the HUD shows your score, the wave number, your health, and the lighthouse's integrity. Enemies that reach the lighthouse damage it; when its light goes out — or you fall — the game is over.
- **Restart:** press **R** on the game-over screen to light the lamp again and start from wave 1. **Enter** / **Space** confirms on the title and end screens. Your best score is remembered between visits.
