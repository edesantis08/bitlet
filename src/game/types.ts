import type { Point, Size } from "../engine/grid";
import type { RNG } from "../engine/rng";

export const MAX_DEPTH = 5;
export const ROOMS_PER_DEPTH = 4;
export const MAX_PLAYER_HP = 3;
export const BASE_SHARD_TARGET = 3;
export const SHARD_INCREMENT_PER_ROOM = 2;
export const BASE_ROOM_SIZE: Size = { width: 24, height: 16 };
export const MIN_ROOM_SIZE: Size = { width: 14, height: 10 };
export const VISION_RADIUS = 7;
export const MAX_PROJECTILES = 32;

export type DifficultyLevel = "relaxed" | "standard" | "hard";
export type ColorMode = "default" | "colorblind";

export interface Settings {
  mode: "turn" | "real";
  difficulty: DifficultyLevel;
  colorMode: ColorMode;
  audio: boolean;
  screenShake: number;
  customSeed?: string;
}

export interface DifficultyTuning {
  shardDelta: number;
  sentinelDelay: number;
  spikeCycle: number;
  extraTurretChance: number;
  patchChance: number;
}

export const DIFFICULTY_TUNING: Record<DifficultyLevel, DifficultyTuning> = {
  relaxed: {
    shardDelta: -2,
    sentinelDelay: 1,
    spikeCycle: 6,
    extraTurretChance: 0,
    patchChance: 0.45,
  },
  standard: {
    shardDelta: 0,
    sentinelDelay: 0,
    spikeCycle: 5,
    extraTurretChance: 0.15,
    patchChance: 0.25,
  },
  hard: {
    shardDelta: 2,
    sentinelDelay: 0,
    spikeCycle: 3,
    extraTurretChance: 0.35,
    patchChance: 0.1,
  },
};

export type TileType = "wall" | "floor" | "door" | "locked-door" | "void";

export interface Tile {
  type: TileType;
  doorTarget?: number;
  locked?: boolean;
}

export interface TileMap {
  tiles: Tile[];
  size: Size;
}

export interface EntityBase {
  id: number;
  pos: Point;
  alive: boolean;
}

export interface PlayerState extends EntityBase {
  hp: number;
  maxHp: number;
  shards: number;
  keys: number;
  blinkCharges: number;
  score: number;
  facing: Point;
}

export type Shard = EntityBase;

export type ItemType = "key" | "patch" | "blink";

export interface Item extends EntityBase {
  kind: ItemType;
}

export type HazardType = "sentinel" | "turret" | "spike";

export interface Hazard extends EntityBase {
  kind: HazardType;
}

export interface SentinelState extends Hazard {
  cooldown: number;
  delay: number;
}

export interface TurretState extends Hazard {
  facing: Point;
  fireRate: number;
  counter: number;
}

export interface SpikeState extends Hazard {
  cycleLength: number;
  timer: number;
  active: boolean;
}

export type HazardState = SentinelState | TurretState | SpikeState;

export interface Projectile extends EntityBase {
  dir: Point;
}

export interface Portal extends EntityBase {
  active: boolean;
}

export interface RoomState {
  tileMap: TileMap;
  spawn: Point;
  shards: Shard[];
  hazards: HazardState[];
  items: Item[];
  portal: Portal | null;
  shardTarget: number;
  doorTargets: Record<string, number>;
  seen: boolean[];
  collected: number;
}

export interface DepthLayout {
  rooms: RoomState[];
  lockedDoorRoomIndex: number;
  keyRoomIndex: number;
}

export interface RunStats {
  seedString: string;
  numericSeed: number;
  depthReached: number;
  shardsCollected: number;
  turnsTaken: number;
  timeMs: number;
  victory: boolean;
}

export interface RunState {
  depth: number;
  roomIndex: number;
  layouts: DepthLayout[];
  player: PlayerState;
  mode: "turn" | "real";
  rngSeedString: string;
  rngNumericSeed: number;
  stats: RunStats;
  projectiles: Projectile[];
  fog: boolean[];
  projectileCounter: number;
  rng: RNG;
}

export interface GameWorld {
  currentRoom: RoomState;
  run: RunState;
  settings: Settings;
  difficulty: DifficultyTuning;
  paused: boolean;
  screen: ScreenType;
  elapsedMs: number;
  message?: string;
  audio: AudioState;
  shakeTimer: number;
}

export type ScreenType = "title" | "settings" | "howto" | "run" | "pause" | "summary";

export interface AudioState {
  context: AudioContext | null;
  enabled: boolean;
}

export const STORAGE_KEYS = {
  bestRun: "shardcrawler.best-run",
  settings: "shardcrawler.settings",
};
