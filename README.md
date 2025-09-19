# ShardCrawler

ShardCrawler is a zero-backend HTML5 canvas roguelite built with Vite and TypeScript. Runs are deterministic from a seed and last roughly five to ten minutes as you weave through five depths of shard-harvesting caverns.

## Getting started

```bash
npm install
npm run dev
```

The dev server runs on Vite with hot module replacement. To build and preview production output:

```bash
npm run build
npm run preview
```

Static analysis and the deterministic generation harness are available via:

```bash
npm run lint
npm run typecheck
npm run harness
```

## Controls

* **Movement:** Arrow keys or WASD
* **Interact / Blink:** Space
* **Wait:** Q
* **Pause:** P
* **Restart with new seed:** R

Bindings can be remapped in the settings screen and persist in `localStorage`.

## Game loop

1. Explore each room, scooping up memory shards while avoiding sentinels, turrets and spike traps.
2. When you hit the shard quota a shimmering portal awakens.
3. Step through to advance deeper; four rooms compose each depth, and five depths complete a run.
4. Collect keys to bypass the single locked door per depth. Patches boost max HP (cap 3) and heal, blink cores grant a two-tile teleport.
5. Runs end on victory at depth five or death; a summary panel shows your seed, depth, shards, turns and time. Your best run is cached locally.

## Procedural generation

* **Seeded RNG:** `rngFromString(seedString)` hashes strings into a 32-bit seed and powers all generation. The active seed can be set via the settings panel or the `?seed=` query parameter.
* **Room builder:** Each room random-walks a cavern between 14×10 and 24×16 tiles, then scatters shards, hazards and loot while keeping the spawn and portal connected.
* **Layout planner:** Five depths × four rooms per depth. Exactly one locked door per depth is guaranteed to appear after a key-bearing room so progression never soft-locks.
* **Difficulty scaling:** Relaxed trims shard quotas and slows sentinels; Hard boosts hazard density, spike cadence and shard targets.

## Accessibility and options

* Palette toggle between default and colorblind-friendly contrast.
* Turn-based or 10 Hz real-time ticking.
* Screen-shake slider (defaults to off) and audio blip toggle (WebAudio generated, no assets).
* Custom seed entry, binding remap, and settings persistence across sessions.

## Determinism checklist

* All randomness funnels through the shared `rng.ts` module.
* Runs launched with the same seed replay identically, verified by `npm run harness`.
* The HUD displays both the human-readable and numeric seed for shareability.

## Reference seeds

| Seed string     | Notes                               |
| --------------- | ----------------------------------- |
| `demo-standard` | Baseline progression-friendly depth |
| `relaxed-easy`  | Wide caverns, gentle hazard mix     |
| `hard-forge`    | Tight corridors with extra turrets  |

## Design highlights

* **Fog of war** keeps unexplored tiles subdued while hazards remain active off-screen.
* **Turn order** in turn mode: player action → hazard AI → projectile travel → collision resolution.
* **Real-time mode** buffers player input while hazards tick at 10 updates per second, matching turn resolution rules.
* **Screen shake** and concise HUD messaging keep feedback immediate without clutter.

## Project structure

```
src/
  engine/        // deterministic RNG, grid helpers, scheduler, input, palettes
  game/          // generation, entities, rules, save/load, run controller
  ui/            // HUD drawing and overlay screens
  main.ts        // bootstrap + canvas binding
```

Enjoy crawling the shards!
