"use strict";

// Exploration: breakable crate obstacle - solid like a platform (the
// player can stand on top), but breaks and disappears when landed on
// from above; hit from the side it damages the player like a plain wall
// obstacle. The break/side-hit decision itself lives in game.js
// (checkObstacleHit needs the player's fall state to tell top from side),
// this file only owns the crate's own look. See CLAUDE.md obstacle
// perimeter table.

// Draws a wooden crate filling rect (x, y, w, h) in screen space (x
// already camera-adjusted by the caller).
function drawCrateObstacle(ctx, x, y, w, h) {
  ctx.fillStyle = "#a9752f";
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = "#6b491d";
  ctx.lineWidth = Math.max(1, w * 0.06);
  ctx.strokeRect(x + ctx.lineWidth / 2, y + ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);

  // X-shaped cross bracing, like classic crate art.
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y + h);
  ctx.moveTo(x + w, y);
  ctx.lineTo(x, y + h);
  ctx.stroke();
}
