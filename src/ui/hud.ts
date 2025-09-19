import { FONT_FAMILY, HEART_COLOR, HUD_TEXT_COLOR } from "../engine/assets";
import type { GameWorld } from "../game/types";

export function drawHud(ctx: CanvasRenderingContext2D, world: GameWorld): void {
  ctx.save();
  ctx.fillStyle = HUD_TEXT_COLOR;
  ctx.font = `16px ${FONT_FAMILY}`;
  ctx.textBaseline = "top";
  const depthLine = `Depth ${world.run.depth + 1}/5`; // max depth fixed
  const roomLine = `Room ${world.run.roomIndex + 1}/4`;
  const shardLine = `Shards ${world.currentRoom.collected}/${world.currentRoom.shardTarget}`;
  ctx.fillText(depthLine, 16, 12);
  ctx.fillText(roomLine, 16, 32);
  ctx.fillText(shardLine, 16, 52);

  const hpX = 16;
  let hpY = 80;
  for (let i = 0; i < world.run.player.maxHp; i += 1) {
    ctx.strokeStyle = HEART_COLOR;
    ctx.lineWidth = 2;
    ctx.strokeRect(hpX + i * 20, hpY, 16, 16);
    if (i < world.run.player.hp) {
      ctx.fillStyle = HEART_COLOR;
      ctx.fillRect(hpX + i * 20 + 2, hpY + 2, 12, 12);
    }
  }

  const seedText = `Seed ${world.run.rngSeedString} (${world.run.rngNumericSeed})`;
  ctx.fillStyle = HUD_TEXT_COLOR;
  ctx.fillText(seedText, 16, hpY + 28);

  const modeText = world.run.mode === "turn" ? "Turn" : "Real-Time";
  ctx.fillText(`Mode ${modeText}`, 16, hpY + 48);

  if (world.message) {
    ctx.fillStyle = HUD_TEXT_COLOR;
    ctx.fillText(world.message, 16, hpY + 68);
  }

  ctx.restore();
}
