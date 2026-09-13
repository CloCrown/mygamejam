"use strict";

// Exploration: simple patrolling monster - moves back and forth between
// its spawn point and a patrol distance, bouncing at each end. Drawn
// procedurally (Path2D, no imported sprite - same approach as
// horse-2d-outline.js / horn-item-2d.js). Kept separate from obstacles
// (level.obstacles) since it needs per-frame movement update, not just a
// static rect - see CLAUDE.md perimeter table.

var MONSTER_SPEED = 90; // px/s

// tier 2 monsters are a bigger, tougher variant of the same patrol
// behavior (not a new movement pattern, so kept in this file rather than
// a separate monster-<name>-2d.js - see CLAUDE.md perimeter table: a new
// file is for different *behavior*, this is just a size/damage variant).
// tier 1 costs the player a heart on contact (lives-1); tier 2 destroys a
// heart slot outright (maxLives-1) - see game.js's checkObstacleHit.
var MONSTER_TIER_SCALE = { 1: 1, 2: 1.4 };

// def: { x, y, w, h, patrolDistance, tier } - x/y/w/h is the spawn rect
// (w/h scaled by MONSTER_TIER_SCALE[tier]), tier defaults to 1 when
// omitted, the monster patrols within [x - patrolDistance, x + patrolDistance].
function createMonster(def) {
  var tier = def.tier || 1;
  var scale = MONSTER_TIER_SCALE[tier];
  return {
    x: def.x, y: def.y, w: def.w * scale, h: def.h * scale,
    tier: tier,
    minX: def.x - def.patrolDistance,
    maxX: def.x + def.patrolDistance,
    vx: MONSTER_SPEED,
    walkTime: 0,
  };
}

function updateMonster(monster, dt) {
  monster.x += monster.vx * dt;
  if (monster.x < monster.minX) { monster.x = monster.minX; monster.vx = MONSTER_SPEED; }
  else if (monster.x > monster.maxX) { monster.x = monster.maxX; monster.vx = -MONSTER_SPEED; }
  monster.walkTime += dt;
}

// Draws a small round-bodied monster with two horns and an angry eye,
// facing its direction of travel. screenX/screenY is its top-left corner
// (same convention as the AABB rect used for physics/collision).
function drawMonster(ctx, monster, camX) {
  var screenX = monster.x - camX;
  var screenY = monster.y;
  var cx = screenX + monster.w / 2;
  var cy = screenY + monster.h / 2;
  var facingRight = monster.vx >= 0;

  ctx.save();
  ctx.translate(cx, cy);
  if (!facingRight) ctx.scale(-1, 1);

  var bob = Math.sin(monster.walkTime * 8) * monster.h * 0.04;
  ctx.translate(0, bob);

  var rx = monster.w / 2, ry = monster.h / 2;
  // Tier 2 is a deeper red instead of purple - a readable "this one's
  // dangerous" cue distinct from its bigger size (see MONSTER_TIER_SCALE).
  var bodyColor = monster.tier === 2 ? "#7a2a2a" : "#5a2d6e";
  var bellyColor = monster.tier === 2 ? "#b04848" : "#8a4fae";
  var hornColor = monster.tier === 2 ? "#3a1010" : "#3a1a48";

  // Body: squat rounded blob.
  ctx.beginPath();
  ctx.ellipse(0, ry * 0.1, rx, ry * 0.85, 0, 0, Math.PI * 2);
  ctx.fillStyle = bodyColor;
  ctx.fill();

  // Belly patch, lighter.
  ctx.beginPath();
  ctx.ellipse(0, ry * 0.35, rx * 0.55, ry * 0.45, 0, 0, Math.PI * 2);
  ctx.fillStyle = bellyColor;
  ctx.fill();

  // Two small horns on top.
  ctx.fillStyle = hornColor;
  ctx.beginPath();
  ctx.moveTo(-rx * 0.4, -ry * 0.6);
  ctx.lineTo(-rx * 0.55, -ry * 1.1);
  ctx.lineTo(-rx * 0.2, -ry * 0.65);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(rx * 0.4, -ry * 0.6);
  ctx.lineTo(rx * 0.55, -ry * 1.1);
  ctx.lineTo(rx * 0.2, -ry * 0.65);
  ctx.closePath();
  ctx.fill();

  // Angry eye (single, facing-direction side) - a white oval with a
  // slit pupil, plus an eyebrow slash for the "angry" read.
  var eyeX = rx * 0.15;
  ctx.beginPath();
  ctx.ellipse(eyeX, -ry * 0.1, rx * 0.28, ry * 0.22, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(eyeX + rx * 0.06, -ry * 0.1, rx * 0.1, ry * 0.18, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#1a1a1a";
  ctx.fill();
  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = Math.max(1, monster.w * 0.03);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(eyeX - rx * 0.3, -ry * 0.35);
  ctx.lineTo(eyeX + rx * 0.25, -ry * 0.25);
  ctx.stroke();

  // Small fangs along the bottom edge.
  ctx.fillStyle = "#fff";
  var fangY = ry * 0.55;
  ctx.beginPath();
  ctx.moveTo(-rx * 0.15, fangY);
  ctx.lineTo(-rx * 0.05, fangY + ry * 0.22);
  ctx.lineTo(-rx * 0.25, fangY + ry * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(rx * 0.15, fangY);
  ctx.lineTo(rx * 0.05, fangY + ry * 0.22);
  ctx.lineTo(rx * 0.25, fangY + ry * 0.05);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}
