"use strict";

// Exploration: spike obstacle - same solid-rect collision as the plain
// wall obstacle, but rendered as a row of sharp triangles instead of a
// flat rectangle. Procedural (Path2D), no imported sprite - same approach
// as horn-item-2d.js / monster-2d.js. Kept in its own file per the
// exploration-phase rule and the CLAUDE.md obstacle perimeter (new
// obstacle rendering goes in obstacle-<nom>.js, not game.js).

// Draws a row of upward-pointing spikes filling rect (x, y, w, h) in
// screen space (x already camera-adjusted by the caller).
function drawSpikeObstacle(ctx, x, y, w, h) {
  var spikeCount = Math.max(1, Math.round(w / (h * 0.7)));
  var spikeW = w / spikeCount;

  ctx.fillStyle = "#8b2f2f";
  ctx.strokeStyle = "#5a1c1c";
  ctx.lineWidth = Math.max(1, h * 0.04);
  ctx.lineJoin = "round";

  for (var i = 0; i < spikeCount; i++) {
    var baseX = x + i * spikeW;
    ctx.beginPath();
    ctx.moveTo(baseX, y + h);
    ctx.lineTo(baseX + spikeW / 2, y);
    ctx.lineTo(baseX + spikeW, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}
