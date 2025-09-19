import { TILE_SIZE, getPalette } from "../engine/assets";
import { computeFieldOfView, findPathBfs, inBounds } from "../engine/grid";
import type {
  GameWorld,
  PlayerState,
  Projectile,
  SentinelState,
  SpikeState,
  Tile,
  TileMap,
  TurretState,
} from "./types";
import { VISION_RADIUS } from "./types";

export function isPassable(tile: Tile): boolean {
  return tile.type === "floor" || tile.type === "door";
}

export function isTransparent(tile: Tile): boolean {
  return tile.type !== "wall";
}

export function updateVisibility(world: GameWorld): void {
  const room = world.currentRoom;
  const { tileMap } = room;
  const visible = computeFieldOfView(
    world.run.player.pos,
    VISION_RADIUS,
    tileMap.size,
    (p) => isTransparent(tileAt(tileMap, p)),
  );
  world.run.fog = visible;
  for (let i = 0; i < visible.length; i += 1) {
    if (visible[i]) {
      room.seen[i] = true;
    }
  }
}

export function drawRoom(ctx: CanvasRenderingContext2D, world: GameWorld): void {
  const palette = getPalette(world.settings.colorMode);
  const { tileMap } = world.currentRoom;
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, tileMap.size.width * TILE_SIZE, tileMap.size.height * TILE_SIZE);
  for (let y = 0; y < tileMap.size.height; y += 1) {
    for (let x = 0; x < tileMap.size.width; x += 1) {
      const idx = y * tileMap.size.width + x;
      const tile = tileMap.tiles[idx];
      const visible = world.run.fog[idx];
      const seen = world.currentRoom.seen[idx];
      if (!seen && !visible) {
        ctx.fillStyle = palette.fog;
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        continue;
      }
      let color = palette.floor;
      if (tile.type === "wall") {
        color = palette.wall;
      } else if (tile.type === "door") {
        color = palette.accent;
      } else if (tile.type === "locked-door") {
        color = palette.hazard;
      }
      ctx.fillStyle = color;
      ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      if (!visible) {
        ctx.fillStyle = "rgba(3,7,11,0.7)";
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }
}

export function drawEntities(ctx: CanvasRenderingContext2D, world: GameWorld): void {
  const palette = getPalette(world.settings.colorMode);
  const fog = world.run.fog;
  const width = world.currentRoom.tileMap.size.width;
  const drawCircle = (pos: { x: number; y: number }, color: string, radius = TILE_SIZE / 2 - 2) => {
    const centerX = pos.x * TILE_SIZE + TILE_SIZE / 2;
    const centerY = pos.y * TILE_SIZE + TILE_SIZE / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
  };
  for (const shard of world.currentRoom.shards) {
    if (!shard.alive) {
      continue;
    }
    const idx = shard.pos.y * width + shard.pos.x;
    if (!fog[idx] && !world.currentRoom.seen[idx]) {
      continue;
    }
    drawCircle(shard.pos, palette.shard, TILE_SIZE / 3);
  }
  for (const item of world.currentRoom.items) {
    if (!item.alive) {
      continue;
    }
    const idx = item.pos.y * width + item.pos.x;
    if (!fog[idx] && !world.currentRoom.seen[idx]) {
      continue;
    }
    const color = item.kind === "key" ? palette.accent : item.kind === "patch" ? palette.shard : palette.portal;
    drawCircle(item.pos, color, TILE_SIZE / 3);
  }
  for (const hazard of world.currentRoom.hazards) {
    if (!hazard.alive) {
      continue;
    }
    const idx = hazard.pos.y * width + hazard.pos.x;
    if (!fog[idx] && !world.currentRoom.seen[idx]) {
      continue;
    }
    if (hazard.kind === "sentinel") {
      drawCircle(hazard.pos, palette.hazard, TILE_SIZE / 2.4);
    } else if (hazard.kind === "turret") {
      ctx.fillStyle = palette.hazard;
      ctx.fillRect(hazard.pos.x * TILE_SIZE + 4, hazard.pos.y * TILE_SIZE + 4, TILE_SIZE - 8, TILE_SIZE - 8);
    } else {
      ctx.fillStyle = (hazard as SpikeState).active ? palette.hazard : palette.floor;
      ctx.fillRect(hazard.pos.x * TILE_SIZE + 6, hazard.pos.y * TILE_SIZE + 6, TILE_SIZE - 12, TILE_SIZE - 12);
    }
  }
  for (const projectile of world.run.projectiles) {
    if (!projectile.alive) {
      continue;
    }
    const idx = projectile.pos.y * width + projectile.pos.x;
    if (!fog[idx] && !world.currentRoom.seen[idx]) {
      continue;
    }
    ctx.fillStyle = palette.hazard;
    ctx.fillRect(
      projectile.pos.x * TILE_SIZE + TILE_SIZE / 2 - 2,
      projectile.pos.y * TILE_SIZE + TILE_SIZE / 2 - 2,
      4,
      4,
    );
  }
  if (world.currentRoom.portal && world.currentRoom.portal.alive) {
    const portal = world.currentRoom.portal;
    const idx = portal.pos.y * width + portal.pos.x;
    if (fog[idx] || world.currentRoom.seen[idx]) {
      ctx.strokeStyle = palette.portal;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
        portal.pos.x * TILE_SIZE + TILE_SIZE / 2,
        portal.pos.y * TILE_SIZE + TILE_SIZE / 2,
        TILE_SIZE / 2.5,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      if (portal.active) {
        ctx.fillStyle = `${palette.portal}55`;
        ctx.fill();
      }
    }
  }
  drawCircle(world.run.player.pos, palette.accent, TILE_SIZE / 2.5);
}

function tileAt(map: TileMap, point: { x: number; y: number }): Tile {
  return map.tiles[point.y * map.size.width + point.x];
}

function moveHazardTowards(
  hazard: SentinelState,
  target: PlayerState,
  map: TileMap,
): void {
  if (hazard.cooldown > 0) {
    hazard.cooldown -= 1;
    return;
  }
  const path = findPathBfs(hazard.pos, target.pos, map.size, (p) => {
    const tile = tileAt(map, p);
    return tile.type !== "wall" && tile.type !== "locked-door";
  });
  if (path.length > 1) {
    hazard.pos = { ...path[1] };
  }
  hazard.cooldown = hazard.delay;
}

function tickSpike(spike: SpikeState): void {
  spike.timer = (spike.timer + 1) % spike.cycleLength;
  spike.active = spike.timer >= Math.floor(spike.cycleLength / 2);
}

export function updateHazards(
  world: GameWorld,
  damagePlayer: () => void,
  spawnProjectile: (projectile: Projectile) => void,
): void {
  const map = world.currentRoom.tileMap;
  const player = world.run.player;
  for (const hazard of world.currentRoom.hazards) {
    if (!hazard.alive) {
      continue;
    }
    if (hazard.kind === "sentinel") {
      moveHazardTowards(hazard as SentinelState, player, map);
      if (hazard.pos.x === player.pos.x && hazard.pos.y === player.pos.y) {
        damagePlayer();
      }
    } else if (hazard.kind === "turret") {
      const turret = hazard as TurretState;
      turret.counter += 1;
      if (turret.counter >= turret.fireRate) {
        turret.counter = 0;
        spawnProjectile({
          id: world.run.projectileCounter++,
          pos: { ...turret.pos },
          alive: true,
          dir: { ...turret.facing },
        });
      }
    } else if (hazard.kind === "spike") {
      const spike = hazard as SpikeState;
      tickSpike(spike);
      if (spike.active && spike.pos.x === player.pos.x && spike.pos.y === player.pos.y) {
        damagePlayer();
      }
    }
  }
}

export function advanceProjectiles(
  world: GameWorld,
  damagePlayer: () => void,
): void {
  const map = world.currentRoom.tileMap;
  for (const projectile of world.run.projectiles) {
    if (!projectile.alive) {
      continue;
    }
    projectile.pos = {
      x: projectile.pos.x + projectile.dir.x,
      y: projectile.pos.y + projectile.dir.y,
    };
    if (!inBounds(projectile.pos, map.size)) {
      projectile.alive = false;
      continue;
    }
    const tile = tileAt(map, projectile.pos);
    if (tile.type === "wall" || tile.type === "locked-door") {
      projectile.alive = false;
      continue;
    }
    if (projectile.pos.x === world.run.player.pos.x && projectile.pos.y === world.run.player.pos.y) {
      projectile.alive = false;
      damagePlayer();
    }
  }
  world.run.projectiles = world.run.projectiles.filter((p) => p.alive);
}
