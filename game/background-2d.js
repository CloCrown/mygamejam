"use strict";

// Exploration: procedural parallax background (sky gradient + far
// mountains + near hills), drawn from simple sine-based silhouettes
// instead of an imported image - keeps this at near-zero build size,
// consistent with the project's "everything procedural" approach (see
// horse-2d-outline.js). Kept in its own file per the exploration-phase
// rule in CLAUDE.md.

function drawBackground(ctx, width, height, camX, groundY) {
  var sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#8fd0f5");
  sky.addColorStop(1, "#d7f0fb");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  drawParallaxLayer(ctx, width, height, groundY, camX * 0.15, 140, 260, "#a9c9d8", 0);
  drawParallaxLayer(ctx, width, height, groundY, camX * 0.35, 90, 160, "#8fb79f", 400);
  drawParallaxLayer(ctx, width, height, groundY, camX * 0.6, 40, 70, "#6fae7c", 900);
}

// Draws a repeating rounded-hill silhouette using a sine wave, offset by
// parallaxX (a fraction of real camera scroll) so it scrolls slower than
// the foreground - the standard "layers scroll at different speeds" trick.
function drawParallaxLayer(ctx, width, height, groundY, parallaxX, amplitude, wavelength, color, phaseSeed) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  var step = 20;
  for (var sx = 0; sx <= width; sx += step) {
    var worldX = sx + parallaxX;
    var y = groundY - amplitude - Math.sin((worldX + phaseSeed) / wavelength) * amplitude * 0.4
      - Math.sin((worldX + phaseSeed) * 0.6 / wavelength) * amplitude * 0.2;
    ctx.lineTo(sx, y);
  }
  ctx.lineTo(width, groundY);
  ctx.closePath();
  ctx.fill();
}
