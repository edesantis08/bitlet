import { floodFill, findPathBfs, inBounds, pointKey } from "../engine/grid";
import type { RNG } from "../engine/rng";
import {
  BASE_ROOM_SIZE,
  MIN_ROOM_SIZE,
  BASE_SHARD_TARGET,
  DIFFICULTY_TUNING,
  MAX_DEPTH,
  ROOMS_PER_DEPTH,
  SHARD_INCREMENT_PER_ROOM,
  type DifficultyLevel,
  type DifficultyTuning,
  type DepthLayout,
  type Item,
  type PlayerState,
  type Portal,
  type RoomState,
  type Settings,
  type Shard,
  type SpikeState,
  type Tile,
  type TileMap,
  type TurretState,
  type SentinelState,
  type HazardState,
} from "./types";
import { manhattan } from "../engine/grid";

interface GenerationContext {
  rng: RNG;
  difficulty: DifficultyTuning;
  depth: number;
}

const DIRECTIONS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

function createTileMap(rng: RNG): TileMap {
  const width = Math.max(MIN_ROOM_SIZE.width, Math.floor(BASE_ROOM_SIZE.width - rng.nextInt(6)));
  const height = Math.max(MIN_ROOM_SIZE.height, Math.floor(BASE_ROOM_SIZE.height - rng.nextInt(6)));
  const tiles: Tile[] = new Array(width * height).fill(null).map(() => ({ type: "wall" }));
  const map: TileMap = { tiles, size: { width, height } };
  const start = { x: Math.floor(width / 2), y: Math.floor(height / 2) };
  let walker = { ...start };
  const totalSteps = width * height * 4;
  for (let step = 0; step < totalSteps; step += 1) {
    carve(map, walker, rng);
    const dir = DIRECTIONS[rng.nextInt(DIRECTIONS.length)];
    const next = { x: walker.x + dir.x, y: walker.y + dir.y };
    if (inBounds(next, map.size)) {
      walker = next;
    }
  }
  ensureConnectivity(map, start);
  return map;
}

function carve(map: TileMap, point: { x: number; y: number }, rng: RNG): void {
  const index = point.y * map.size.width + point.x;
  map.tiles[index] = { type: "floor" };
  for (const dir of DIRECTIONS) {
    const nx = point.x + dir.x;
    const ny = point.y + dir.y;
    if (!inBounds({ x: nx, y: ny }, map.size)) {
      continue;
    }
    const idx = ny * map.size.width + nx;
    if (map.tiles[idx].type === "wall" && rng.next() < 0.05) {
      map.tiles[idx] = { type: "floor" };
    }
  }
}

function ensureConnectivity(map: TileMap, start: { x: number; y: number }): void {
  const reachable = floodFill(start, map.size, (p) => tileAt(map, p).type !== "wall");
  for (let y = 0; y < map.size.height; y += 1) {
    for (let x = 0; x < map.size.width; x += 1) {
      const key = pointKey({ x, y });
      if (!reachable.has(key)) {
        const idx = y * map.size.width + x;
        map.tiles[idx] = { type: "wall" };
      }
    }
  }
}

function tileAt(map: TileMap, point: { x: number; y: number }): Tile {
  return map.tiles[point.y * map.size.width + point.x];
}

function randomFloorPositions(map: TileMap): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let y = 0; y < map.size.height; y += 1) {
    for (let x = 0; x < map.size.width; x += 1) {
      const tile = tileAt(map, { x, y });
      if (tile.type === "floor") {
        points.push({ x, y });
      }
    }
  }
  return points;
}

function pickFarthest(
  start: { x: number; y: number },
  candidates: { x: number; y: number }[],
): { x: number; y: number } {
  let best = candidates[0] ?? start;
  let bestDist = -1;
  for (const candidate of candidates) {
    const dist = manhattan(start, candidate);
    if (dist > bestDist) {
      bestDist = dist;
      best = candidate;
    }
  }
  return best;
}

function shardTargetFor(depth: number, roomIndex: number, difficulty: DifficultyTuning): number {
  return BASE_SHARD_TARGET + depth * SHARD_INCREMENT_PER_ROOM + roomIndex * SHARD_INCREMENT_PER_ROOM + difficulty.shardDelta;
}

let entityId = 0;
function nextId(): number {
  entityId += 1;
  return entityId;
}

function createShard(position: { x: number; y: number }): Shard {
  return { id: nextId(), pos: position, alive: true };
}

function createPortal(position: { x: number; y: number }): Portal {
  return { id: nextId(), pos: position, alive: true, active: false };
}

function createKey(position: { x: number; y: number }): Item {
  return { id: nextId(), pos: position, alive: true, kind: "key" };
}

function createPatch(position: { x: number; y: number }): Item {
  return { id: nextId(), pos: position, alive: true, kind: "patch" };
}

function createBlink(position: { x: number; y: number }): Item {
  return { id: nextId(), pos: position, alive: true, kind: "blink" };
}

function createSentinel(position: { x: number; y: number }, difficulty: DifficultyTuning): SentinelState {
  return {
    id: nextId(),
    pos: position,
    alive: true,
    kind: "sentinel",
    cooldown: 0,
    delay: difficulty.sentinelDelay,
  };
}

function randomFacing(rng: RNG): { x: number; y: number } {
  return DIRECTIONS[rng.nextInt(DIRECTIONS.length)];
}

function createTurret(position: { x: number; y: number }, rng: RNG, depth: number): TurretState {
  return {
    id: nextId(),
    pos: position,
    alive: true,
    kind: "turret",
    facing: randomFacing(rng),
    fireRate: Math.max(3, 6 - depth),
    counter: 0,
  };
}

function createSpike(position: { x: number; y: number }, difficulty: DifficultyTuning): SpikeState {
  return {
    id: nextId(),
    pos: position,
    alive: true,
    kind: "spike",
    cycleLength: difficulty.spikeCycle,
    timer: 0,
    active: false,
  };
}

function placeHazards(
  ctx: GenerationContext,
  map: TileMap,
  spawn: { x: number; y: number },
  shardTarget: number,
): HazardState[] {
  const hazards: HazardState[] = [];
  const floors = randomFloorPositions(map);
  ctx.rng.shuffleInPlace(floors);
  const hazardBudget = Math.min(6, 2 + ctx.depth + Math.floor(shardTarget / 3));
  for (const point of floors) {
    if (manhattan(point, spawn) < 4) {
      continue;
    }
    if (hazards.length >= hazardBudget) {
      break;
    }
    const roll = ctx.rng.next();
    if (roll < 0.4) {
      hazards.push(createSentinel(point, ctx.difficulty));
    } else if (roll < 0.7 + ctx.difficulty.extraTurretChance) {
      hazards.push(createTurret(point, ctx.rng, ctx.depth));
    } else {
      hazards.push(createSpike(point, ctx.difficulty));
    }
  }
  return hazards;
}

function placeItems(
  ctx: GenerationContext,
  map: TileMap,
  spawn: { x: number; y: number },
  keyRequired: boolean,
): Item[] {
  const items: Item[] = [];
  const floors = randomFloorPositions(map).filter((p) => manhattan(p, spawn) > 2);
  ctx.rng.shuffleInPlace(floors);
  if (keyRequired && floors.length > 0) {
    items.push(createKey(floors.shift()!));
  }
  if (floors.length > 0 && ctx.rng.next() < ctx.difficulty.patchChance) {
    items.push(createPatch(floors.shift()!));
  }
  if (floors.length > 0 && ctx.rng.next() < 0.2) {
    items.push(createBlink(floors.shift()!));
  }
  return items;
}

function buildRoom(
  ctx: GenerationContext,
  roomIndex: number,
  lockedDoor: boolean,
  placeKey: boolean,
): RoomState {
  const tileMap = createTileMap(ctx.rng);
  const spawnCandidates = randomFloorPositions(tileMap);
  const spawn = spawnCandidates[ctx.rng.nextInt(Math.max(spawnCandidates.length, 1))] ?? {
    x: Math.floor(tileMap.size.width / 2),
    y: Math.floor(tileMap.size.height / 2),
  };
  const target = pickFarthest(spawn, spawnCandidates);
  const path = findPathBfs(spawn, target, tileMap.size, (p) => tileAt(tileMap, p).type !== "wall");
  const shardTarget = Math.max(1, shardTargetFor(ctx.depth, roomIndex, ctx.difficulty));
  const shardPositions = randomFloorPositions(tileMap)
    .filter((p) => manhattan(p, spawn) > 1)
    .slice(0, shardTarget + 2);
  const shards = shardPositions.map((pos) => createShard(pos));
  const portal: Portal | null = createPortal(target);
  const doorTargets: Record<string, number> = {};
  if (lockedDoor && path.length > 3) {
    const doorIndex = Math.floor(path.length / 2);
    const doorPos = path[doorIndex];
    const tileIdx = doorPos.y * tileMap.size.width + doorPos.x;
    tileMap.tiles[tileIdx] = { type: "locked-door", locked: true };
    doorTargets[pointKey(doorPos)] = 1;
  }
  const hazards = placeHazards(ctx, tileMap, spawn, shardTarget);
  const items = placeItems(ctx, tileMap, spawn, placeKey);
  const seen = new Array(tileMap.size.width * tileMap.size.height).fill(false);
  return {
    tileMap,
    spawn,
    shards,
    hazards,
    items,
    portal,
    shardTarget,
    doorTargets,
    seen,
    collected: 0,
  };
}

export function buildDepthLayout(
  rng: RNG,
  depth: number,
  difficultyLevel: DifficultyLevel,
): DepthLayout {
  const difficulty = DIFFICULTY_TUNING[difficultyLevel];
  const ctx: GenerationContext = { rng, difficulty, depth };
  const rooms: RoomState[] = [];
  const lockedDoorRoomIndex = rng.nextInt(ROOMS_PER_DEPTH - 1) + 1; // avoid first room
  const keyRoomIndex = rng.nextInt(lockedDoorRoomIndex);
  for (let i = 0; i < ROOMS_PER_DEPTH; i += 1) {
    const locked = i === lockedDoorRoomIndex;
    const placeKey = i === keyRoomIndex;
    rooms.push(buildRoom(ctx, i, locked, placeKey));
  }
  return { rooms, lockedDoorRoomIndex, keyRoomIndex };
}

export function generateLayouts(
  rng: RNG,
  settings: Settings,
): DepthLayout[] {
  const layouts: DepthLayout[] = [];
  for (let depth = 0; depth < MAX_DEPTH; depth += 1) {
    layouts.push(buildDepthLayout(rng, depth, settings.difficulty));
  }
  return layouts;
}

export function createInitialPlayer(spawn: { x: number; y: number }): PlayerState {
  return {
    id: nextId(),
    pos: { ...spawn },
    alive: true,
    hp: 1,
    maxHp: 1,
    shards: 0,
    keys: 0,
    blinkCharges: 0,
    score: 0,
    facing: { x: 0, y: 1 },
  };
}
