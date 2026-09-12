"use strict";

// Exploration: procedural magic horn collectible, drawn as a spiral-ridged
// cone (Path2D, no imported sprite - same "everything procedural" approach
// as horse-2d-outline.js). 7 color variants (ROYGBIV), same shape, color is
// the only difference between them. Kept in its own file per the
// exploration-phase rule in CLAUDE.md.

var HORN_COLORS = [
  "#e0463f", // rouge
  "#f0913a", // orange
  "#f2d43d", // jaune
  "#4fb35a", // vert
  "#3f7fd6", // bleu
  "#4b3fa8", // indigo
  "#9b4fc9", // violet
];

// Draws one horn centered at (x, y), pointing up, `size` tall.
// colorIndex selects which of the 7 HORN_COLORS variants to use.
function drawHornItem(ctx, x, y, size, colorIndex, rotation) {
  var color = HORN_COLORS[colorIndex % HORN_COLORS.length];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation || 0);

  var halfW = size * 0.16;
  var tipY = -size * 0.5;
  var baseY = size * 0.5;

  // Main cone body, slightly curved (bends toward +x near the tip, like a
  // unicorn horn) instead of a straight triangle.
  ctx.beginPath();
  ctx.moveTo(0, tipY);
  ctx.quadraticCurveTo(halfW * 1.4, tipY + size * 0.4, halfW, baseY);
  ctx.lineTo(-halfW, baseY);
  ctx.quadraticCurveTo(-halfW * 1.4, tipY + size * 0.4, 0, tipY);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  // Spiral ridges: a handful of curved bands wrapping down the cone,
  // darker than the base color, evenly spaced from tip to base.
  ctx.strokeStyle = shadeColor(color, -0.3);
  ctx.lineWidth = Math.max(1, size * 0.03);
  var ridgeCount = 5;
  for (var i = 1; i <= ridgeCount; i++) {
    var t = i / (ridgeCount + 1);
    var ry = tipY + (baseY - tipY) * t;
    var rw = halfW * (0.15 + t * 0.9);
    var curveX = halfW * 1.4 * Math.sin(t * Math.PI * 0.5);
    ctx.beginPath();
    ctx.moveTo(-rw + curveX * t, ry - rw * 0.5);
    ctx.quadraticCurveTo(curveX * t, ry + rw * 0.3, rw + curveX * t, ry - rw * 0.5);
    ctx.stroke();
  }

  // Small highlight along the front edge for a glossy/magic look.
  ctx.beginPath();
  ctx.moveTo(-halfW * 0.3, tipY + size * 0.1);
  ctx.quadraticCurveTo(-halfW * 0.5, baseY - size * 0.15, -halfW * 0.6, baseY - size * 0.02);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = Math.max(1, size * 0.05);
  ctx.lineCap = "round";
  ctx.stroke();

  ctx.restore();
}

// Darkens (negative amount) or lightens (positive) a hex color by a
// fraction (-1..1), for the ridge shading above.
function shadeColor(hex, amount) {
  var num = parseInt(hex.slice(1), 16);
  var r = (num >> 16) & 0xff, g = (num >> 8) & 0xff, b = num & 0xff;
  function adjust(c) {
    var v = amount < 0 ? c * (1 + amount) : c + (255 - c) * amount;
    return Math.max(0, Math.min(255, Math.round(v)));
  }
  r = adjust(r); g = adjust(g); b = adjust(b);
  return "rgb(" + r + "," + g + "," + b + ")";
}
