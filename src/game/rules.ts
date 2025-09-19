import { AUDIO_TONES } from "../engine/assets";
import type { InputAction } from "../engine/input";
import { inBounds } from "../engine/grid";
import { advanceProjectiles, drawEntities, drawRoom, isPassable, updateHazards, updateVisibility } from "./entities";
import {
  MAX_PLAYER_HP,
  MAX_PROJECTILES,
  type GameWorld,
  type Item,
  type Projectile,
  type RoomState,
  type Tile,
} from "./types";

export interface ActionOutcome {
  tookTurn: boolean;
  enteredPortal: boolean;
  died: boolean;
}

const DIR_MAP: Record<InputAction, { x: number; y: number } | null> = {
  move_up: { x: 0, y: -1 },
  move_down: { x: 0, y: 1 },
  move_left: { x: -1, y: 0 },
  move_right: { x: 1, y: 0 },
  interact: null,
  wait: { x: 0, y: 0 },
  pause: null,
  restart: null,
};

export function processPlayerAction(world: GameWorld, action: InputAction): ActionOutcome {
  const outcome: ActionOutcome = { tookTurn: false, enteredPortal: false, died: false };
  const dir = DIR_MAP[action];
  if (dir) {
    const moveResult = attemptMove(world, dir);
    outcome.tookTurn = moveResult.success;
    outcome.died = moveResult.died;
    outcome.enteredPortal = moveResult.enteredPortal;
  } else if (action === "interact") {
    outcome.tookTurn = handleInteract(world, outcome);
  } else if (action === "wait") {
    outcome.tookTurn = true;
  }
  if (outcome.tookTurn) {
    world.run.stats.turnsTaken += 1;
  }
  return outcome;
}

interface MoveResult {
  success: boolean;
  died: boolean;
  enteredPortal: boolean;
}

interface ResolveResult {
  died: boolean;
  enteredPortal: boolean;
}

function attemptMove(world: GameWorld, delta: { x: number; y: number }): MoveResult {
  const player = world.run.player;
  if (delta.x === 0 && delta.y === 0) {
    return { success: true, died: false, enteredPortal: false };
  }
  const map = world.currentRoom.tileMap;
  const next = { x: player.pos.x + delta.x, y: player.pos.y + delta.y };
  if (!inBounds(next, map.size)) {
    return { success: false, died: false, enteredPortal: false };
  }
  const tile = tileAt(map, next);
  if (tile.type === "wall") {
    return { success: false, died: false, enteredPortal: false };
  }
  if (tile.type === "locked-door") {
    if (player.keys > 0) {
      tile.type = "door";
      tile.locked = false;
      player.keys -= 1;
      world.message = "Door unlocked";
      playTone(world, AUDIO_TONES.portal);
    } else {
      world.message = "Door is locked";
      return { success: false, died: false, enteredPortal: false };
    }
  }
  if (!isPassable(tile)) {
    return { success: false, died: false, enteredPortal: false };
  }
  player.pos = next;
  player.facing = delta;
  const result = resolveTile(world, next);
  return { success: true, died: result.died, enteredPortal: result.enteredPortal };
}

function resolveTile(world: GameWorld, position: { x: number; y: number }): ResolveResult {
  const room = world.currentRoom;
  let enteredPortal = false;
  for (const shard of room.shards) {
    if (shard.alive && shard.pos.x === position.x && shard.pos.y === position.y) {
      shard.alive = false;
      room.collected += 1;
      world.run.player.shards += 1;
      world.run.stats.shardsCollected += 1;
      world.run.player.score += 10;
      playTone(world, AUDIO_TONES.shard);
      break;
    }
  }
  for (const item of room.items) {
    if (item.alive && item.pos.x === position.x && item.pos.y === position.y) {
      collectItem(world, item);
    }
  }
  for (const hazard of room.hazards) {
    if (hazard.alive && hazard.pos.x === position.x && hazard.pos.y === position.y) {
      const died = applyDamage(world, 1);
      return { died, enteredPortal: false };
    }
  }
  if (room.portal && room.portal.active && room.portal.pos.x === position.x && room.portal.pos.y === position.y) {
    enteredPortal = true;
  }
  checkPortal(world);
  return { died: false, enteredPortal };
}

function collectItem(world: GameWorld, item: Item): void {
  item.alive = false;
  const player = world.run.player;
  if (item.kind === "key") {
    player.keys += 1;
    world.message = "Picked up a key";
  } else if (item.kind === "patch") {
    if (player.maxHp < MAX_PLAYER_HP) {
      player.maxHp += 1;
    }
    player.hp = Math.min(player.maxHp, player.hp + 1);
    world.message = "Patched up";
  } else {
    player.blinkCharges += 1;
    world.message = "Blink ready";
  }
  playTone(world, AUDIO_TONES.start);
}

function checkPortal(world: GameWorld): void {
  const room = world.currentRoom;
  if (!room.portal) {
    return;
  }
  if (!room.portal.active && room.collected >= room.shardTarget) {
    room.portal.active = true;
    world.message = "Portal opened";
    playTone(world, AUDIO_TONES.portal);
  }
}

function handleInteract(world: GameWorld, outcome: ActionOutcome): boolean {
  const player = world.run.player;
  const room = world.currentRoom;
  if (room.portal && room.portal.active && room.portal.pos.x === player.pos.x && room.portal.pos.y === player.pos.y) {
    outcome.enteredPortal = true;
    return true;
  }
  if (player.blinkCharges > 0) {
    const target = {
      x: player.pos.x + player.facing.x * 2,
      y: player.pos.y + player.facing.y * 2,
    };
    if (inBounds(target, room.tileMap.size)) {
      const tile = tileAt(room.tileMap, target);
      if (tile.type !== "wall" && tile.type !== "locked-door") {
        player.pos = target;
        player.blinkCharges -= 1;
        world.message = "Blink";
        playTone(world, AUDIO_TONES.portal);
        const result = resolveTile(world, target);
        outcome.died ||= result.died;
        outcome.enteredPortal ||= result.enteredPortal;
        return true;
      }
    }
  }
  return false;
}

function tileAt(map: RoomState["tileMap"], pos: { x: number; y: number }): Tile {
  return map.tiles[pos.y * map.size.width + pos.x];
}

export function hazardsTakeTurn(world: GameWorld): ActionOutcome {
  const outcome: ActionOutcome = { tookTurn: false, enteredPortal: false, died: false };
  const damagePlayer = () => {
    outcome.died ||= applyDamage(world, 1);
  };
  const spawnProjectile = (projectile: Projectile) => {
    if (world.run.projectiles.length >= MAX_PROJECTILES) {
      return;
    }
    world.run.projectiles.push(projectile);
  };
  updateHazards(world, damagePlayer, spawnProjectile);
  advanceProjectiles(world, damagePlayer);
  outcome.tookTurn = true;
  return outcome;
}

export function applyDamage(world: GameWorld, amount: number): boolean {
  const player = world.run.player;
  player.hp -= amount;
  playTone(world, AUDIO_TONES.damage);
  if (world.settings.screenShake > 0) {
    const duration = Math.ceil(8 * world.settings.screenShake);
    world.shakeTimer = Math.max(world.shakeTimer, duration);
  }
  if (player.hp <= 0) {
    player.hp = 0;
    return true;
  }
  world.message = "Ouch";
  return false;
}

export function refreshVision(world: GameWorld): void {
  updateVisibility(world);
}

export function drawPlayfield(ctx: CanvasRenderingContext2D, world: GameWorld): void {
  drawRoom(ctx, world);
  drawEntities(ctx, world);
}

function playTone(world: GameWorld, frequency: number): void {
  if (!world.settings.audio) {
    return;
  }
  if (!world.audio.context) {
    try {
      world.audio.context = new AudioContext();
    } catch (error) {
      console.warn("Audio init failed", error);
      world.settings.audio = false;
      return;
    }
  }
  const ctx = world.audio.context;
  if (!ctx) {
    return;
  }
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = frequency;
  osc.type = "sine";
  gain.gain.value = 0.1;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.1);
}
