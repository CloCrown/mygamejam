"use strict";

// Exploration: minimal AABB platformer physics - gravity + axis-separated
// collision resolution against a list of static solid rects (platforms).
// Kept generic (no player-specific knowledge) so it can be reused for
// enemies/obstacles later. See CLAUDE.md exploration-phase rule.

var GRAVITY = 1800; // px/s^2
var MAX_FALL_SPEED = 1400;

// body: { x, y, w, h, vx, vy }  (x,y = top-left)
// solids: array of { x, y, w, h }
// Resolves X then Y separately (standard AABB platformer sweep), setting
// body.onGround = true when a downward collision stops the fall.
function stepBody(body, solids, dt) {
  body.vy = Math.min(body.vy + GRAVITY * dt, MAX_FALL_SPEED);
  body.onGround = false;

  body.x += body.vx * dt;
  resolveAxis(body, solids, "x");

  body.y += body.vy * dt;
  resolveAxis(body, solids, "y");
}

function resolveAxis(body, solids, axis) {
  for (var i = 0; i < solids.length; i++) {
    var s = solids[i];
    if (!aabbOverlap(body, s)) continue;

    if (axis === "x") {
      if (body.vx > 0) body.x = s.x - body.w;
      else if (body.vx < 0) body.x = s.x + s.w;
      body.vx = 0;
    } else {
      if (body.vy > 0) {
        body.y = s.y - body.h;
        body.onGround = true;
      } else if (body.vy < 0) {
        body.y = s.y + s.h;
      }
      body.vy = 0;
    }
  }
}

function aabbOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
