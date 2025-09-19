import { rngFromString, seedFromQuery } from "../engine/rng";
import type { InputAction } from "../engine/input";
import { InputManager } from "../engine/input";
import { Scheduler } from "../engine/scheduler";
import { generateLayouts, createInitialPlayer } from "./levelGen";
import {
  DIFFICULTY_TUNING,
  MAX_DEPTH,
  ROOMS_PER_DEPTH,
  type DifficultyLevel,
  type GameWorld,
  type RunStats,
  type RunState,
  type Settings,
} from "./types";
import { loadBestRun, loadSettings, saveBestRun, saveSettings } from "./save";
import { drawPlayfield, hazardsTakeTurn, processPlayerAction, refreshVision } from "./rules";
import { drawHud } from "../ui/hud";
import { renderScreen, type ScreenController } from "../ui/screens";
import type { RNG } from "../engine/rng";

const DEFAULT_SETTINGS: Settings = {
  mode: "turn",
  difficulty: "standard",
  colorMode: "default",
  audio: false,
  screenShake: 0,
  customSeed: undefined,
};

function randomSeedString(): string {
  return Math.random().toString(36).slice(2, 10);
}

let world: GameWorld;
let canvasCtx: CanvasRenderingContext2D;
let scheduler: Scheduler;
let input: InputManager;
let bestRun: RunStats | null = null;
let uiRoot: HTMLElement;

function createRunState(rng: RNG, settings: Settings, layouts = generateLayouts(rng, settings)): RunState {
  const firstRoom = layouts[0].rooms[0];
  const player = createInitialPlayer(firstRoom.spawn);
  return {
    depth: 0,
    roomIndex: 0,
    layouts,
    player,
    mode: settings.mode,
    rngSeedString: rng.seedString,
    rngNumericSeed: rng.seed,
    stats: {
      seedString: rng.seedString,
      numericSeed: rng.seed,
      depthReached: 1,
      shardsCollected: 0,
      turnsTaken: 0,
      timeMs: 0,
      victory: false,
    },
    projectiles: [],
    fog: new Array(firstRoom.tileMap.size.width * firstRoom.tileMap.size.height).fill(false),
    projectileCounter: 0,
    rng,
  };
}

function resetWorld(settingsOverride?: Partial<Settings>, seedOverride?: string): void {
  const stored = loadSettings(DEFAULT_SETTINGS);
  const settings: Settings = { ...stored, ...settingsOverride };
  const querySeed = seedFromQuery();
  const seedString = seedOverride ?? settings.customSeed ?? querySeed ?? randomSeedString();
  const rng = rngFromString(seedString);
  const layouts = generateLayouts(rng, settings);
  const run = createRunState(rng, settings, layouts);
  world = {
    currentRoom: layouts[0].rooms[0],
    run,
    settings,
    difficulty: DIFFICULTY_TUNING[settings.difficulty],
    paused: false,
    screen: "title",
    elapsedMs: 0,
    message: undefined,
    audio: { context: null, enabled: settings.audio },
    shakeTimer: 0,
  };
  world.currentRoom.collected = 0;
  world.run.player.pos = { ...world.currentRoom.spawn };
  refreshVision(world);
}

export function initialize(canvas: HTMLCanvasElement, ui: HTMLElement): void {
  uiRoot = ui;
  canvasCtx = canvas.getContext("2d")!;
  resetWorld();
  input = new InputManager();
  scheduler = new Scheduler({
    onTick: () => {
      if (world.screen !== "run" || world.paused) {
        return;
      }
      const result = hazardsTakeTurn(world);
      if (result.died) {
        endRun(false);
      }
      refreshVision(world);
    },
    onFrame: (dt) => {
      if (world.screen === "run" && !world.paused) {
        world.run.stats.timeMs += dt;
      }
      drawScene();
      consumeInput();
      renderScreen(uiRoot, world, controller, input.getBindings(), bestRun);
    },
  });
  scheduler.start();
  scheduler.setMode(world.run.mode);
  bestRun = loadBestRun();
  renderScreen(uiRoot, world, controller, input.getBindings(), bestRun);
}

function drawScene(): void {
  if (!canvasCtx) {
    return;
  }
  canvasCtx.save();
  if (world.shakeTimer > 0 && world.settings.screenShake > 0) {
    const intensity = world.settings.screenShake * 3;
    const offsetX = (Math.random() * 2 - 1) * intensity;
    const offsetY = (Math.random() * 2 - 1) * intensity;
    canvasCtx.translate(offsetX, offsetY);
    world.shakeTimer = Math.max(0, world.shakeTimer - 1);
  }
  drawPlayfield(canvasCtx, world);
  drawHud(canvasCtx, world);
  canvasCtx.restore();
}

function consumeInput(): void {
  const actions = input.drainActions();
  for (const action of actions) {
    if (world.screen === "title") {
      if (action === "interact") {
        controller.startRun();
      }
      continue;
    }
    if (action === "pause") {
      togglePause();
      continue;
    }
    if (action === "restart") {
      controller.restart();
      continue;
    }
    if (world.screen !== "run") {
      continue;
    }
    if (world.paused) {
      continue;
    }
    handlePlayerAction(action);
  }
}

function handlePlayerAction(action: InputAction): void {
  const outcome = processPlayerAction(world, action);
  if (!outcome.tookTurn) {
    return;
  }
  refreshVision(world);
  if (outcome.died) {
    endRun(false);
    return;
  }
  if (outcome.enteredPortal) {
    advanceAfterPortal();
    return;
  }
  if (world.run.mode === "turn") {
    const hazardResult = hazardsTakeTurn(world);
    if (hazardResult.died) {
      endRun(false);
      return;
    }
    refreshVision(world);
  }
}

function advanceAfterPortal(): void {
  const run = world.run;
  run.roomIndex += 1;
  if (run.roomIndex >= ROOMS_PER_DEPTH) {
    run.roomIndex = 0;
    run.depth += 1;
    run.stats.depthReached = Math.max(run.stats.depthReached, run.depth + 1);
    if (run.depth >= MAX_DEPTH) {
      endRun(true);
      return;
    }
  }
  const room = run.layouts[run.depth].rooms[run.roomIndex];
  world.currentRoom = room;
  world.currentRoom.collected = 0;
  run.projectiles = [];
  run.player.pos = { ...room.spawn };
  run.player.facing = { x: 0, y: 1 };
  run.fog = new Array(room.tileMap.size.width * room.tileMap.size.height).fill(false);
  refreshVision(world);
}

function togglePause(): void {
  if (world.screen !== "run") {
    return;
  }
  world.paused = !world.paused;
  world.screen = world.paused ? "pause" : "run";
  renderScreen(uiRoot, world, controller, input.getBindings(), bestRun);
}

function endRun(victory: boolean): void {
  world.run.stats.depthReached = Math.max(world.run.stats.depthReached, world.run.depth + 1);
  world.run.stats.victory = victory;
  world.screen = "summary";
  world.paused = true;
  if (!bestRun || isBetter(world.run.stats, bestRun)) {
    bestRun = { ...world.run.stats };
    saveBestRun(bestRun);
  }
  renderScreen(uiRoot, world, controller, input.getBindings(), bestRun);
}

function isBetter(next: RunStats, current: RunStats): boolean {
  if (next.victory && !current.victory) {
    return true;
  }
  if (next.depthReached > current.depthReached) {
    return true;
  }
  if (next.shardsCollected > current.shardsCollected) {
    return true;
  }
  return false;
}

const controller: ScreenController = {
  startRun: (seed) => {
    resetWorld(undefined, seed);
    world.screen = "run";
    world.paused = false;
    world.message = undefined;
    scheduler.setMode(world.run.mode);
    bestRun = loadBestRun();
    renderScreen(uiRoot, world, controller, input.getBindings(), bestRun);
  },
  showSettings: () => {
    world.screen = "settings";
    renderScreen(uiRoot, world, controller, input.getBindings(), bestRun);
  },
  showHowTo: () => {
    world.screen = "howto";
    renderScreen(uiRoot, world, controller, input.getBindings(), bestRun);
  },
  showTitle: () => {
    world.screen = "title";
    world.paused = false;
    renderScreen(uiRoot, world, controller, input.getBindings(), bestRun);
  },
  resume: () => {
    world.paused = false;
    world.screen = "run";
    renderScreen(uiRoot, world, controller, input.getBindings(), bestRun);
  },
  quitToTitle: () => {
    world.screen = "title";
    world.paused = false;
    renderScreen(uiRoot, world, controller, input.getBindings(), bestRun);
  },
  restart: () => {
    controller.startRun();
  },
  applySettings: (patch) => {
    const updated = { ...world.settings, ...patch };
    saveSettings(updated);
    world.settings = updated;
    world.difficulty = DIFFICULTY_TUNING[updated.difficulty];
    world.audio.enabled = updated.audio;
    if (updated.mode !== world.run.mode) {
      world.run.mode = updated.mode;
      scheduler.setMode(updated.mode);
    }
    renderScreen(uiRoot, world, controller, input.getBindings(), bestRun);
  },
  updateBinding: (action, key) => {
    input.setBinding(action, key);
  },
  resetBindings: () => {
    input.resetBindings();
    renderScreen(uiRoot, world, controller, input.getBindings(), bestRun);
  },
};

export function getWorld(): GameWorld {
  return world;
}

export function startNewRun(seed?: string, settings?: Partial<Settings>): void {
  if (settings) {
    controller.applySettings(settings);
  }
  controller.startRun(seed);
}

export function toggleMode(): void {
  const next = world.settings.mode === "turn" ? "real" : "turn";
  controller.applySettings({ mode: next });
}

export function setDifficulty(level: DifficultyLevel): void {
  controller.applySettings({ difficulty: level });
}

export { saveBestRun, loadBestRun };
