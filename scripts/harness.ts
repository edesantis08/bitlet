import { rngFromString } from "../src/engine/rng";
import { generateLayouts } from "../src/game/levelGen";
import type { Settings } from "../src/game/types";

const seed = "demo-standard";
const settings: Settings = {
  mode: "turn",
  difficulty: "standard",
  colorMode: "default",
  audio: false,
  screenShake: 0,
  customSeed: undefined,
};

const rngA = rngFromString(seed);
const rngB = rngFromString(seed);
const layoutsA = generateLayouts(rngA, settings);
const layoutsB = generateLayouts(rngB, settings);

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Harness failed: ${message}`);
  }
}

assert(layoutsA.length === 5, "Five depths generated");
assert(layoutsB.length === 5, "Second pass depths generated");

for (let d = 0; d < layoutsA.length; d += 1) {
  const layoutA = layoutsA[d];
  const layoutB = layoutsB[d];
  assert(layoutA.rooms.length === 4, `Depth ${d + 1} has four rooms`);
  assert(layoutB.rooms.length === 4, `Depth ${d + 1} repeat has four rooms`);
  const spawnA = layoutA.rooms[0].spawn;
  const spawnB = layoutB.rooms[0].spawn;
  assert(spawnA.x === spawnB.x && spawnA.y === spawnB.y, `Spawn matches for depth ${d + 1}`);
  const locked = layoutA.lockedDoorRoomIndex;
  const keyRoom = layoutA.keyRoomIndex;
  assert(locked > keyRoom, `Key precedes lock at depth ${d + 1}`);
}

console.warn("[HARNESS] deterministic generation OK for seed", seed);
