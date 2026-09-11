"use strict";

// Obstacles scattered along the track (see track2.js's
// createObstaclePositions). Each obstacle's visual/collision shape, and
// whether it can be pushed or destroyed at all, comes from OBSTACLE_TYPES
// (see obstacle-types.js) by its `type` name — never hardcoded here.
//
// pushApart is also called directly by game.js for the one horse obstacle
// (which has its own rig/animation instead of a registry entry, so it
// can't just be another array element here) — the same speed-weighted
// circle-circle resolution applies to both, so the formula itself lives
// in exactly one place.

// Resolves a circle-circle overlap between `player` and a point (ox, oz)
// with combined radius `minDist`, splitting the push-apart by
// `obstacleShare` (0 = point doesn't move, fully blocks the player; up to
// ~0.9 = point absorbs most of the push). Mutates `player.x/z` in place and
// returns the point's own displacement as {dx, dz} (0,0 when no overlap or
// obstacleShare is 0) so a movable caller can apply it to its own state.
function pushApart(player, ox, oz, minDist, obstacleShare) {
  var dx = player.x - ox, dz = player.z - oz;
  var dist = Math.hypot(dx, dz);
  if (dist >= minDist) return { dx: 0, dz: 0 };
  var pushDist = minDist - dist;
  var nx = dist > 1e-5 ? dx / dist : 1;
  var nz = dist > 1e-5 ? dz / dist : 0;
  player.x += nx * pushDist * (1 - obstacleShare);
  player.z += nz * pushDist * (1 - obstacleShare);
  return { dx: -nx * pushDist * obstacleShare, dz: -nz * pushDist * obstacleShare };
}

// positions: [[x,z], ...] from track.createObstaclePositions(). types
// (optional): parallel array of type names, same length as positions —
// defaults every position to DEFAULT_OBSTACLE_TYPE when omitted, so
// existing single-type callers don't need to change. `destroyed` starts
// false for every obstacle regardless of type; only something that later
// calls destroyObstacle() (gated by that type's `destructible` flag) sets
// it, obstacles.js never does this on its own.
//
// `typeInfo` caches the OBSTACLE_TYPES[type] lookup at creation time (an
// obstacle's type never changes after spawning) so the per-frame collision
// and draw loops in game.js do a property read instead of a dictionary
// lookup by string key, every obstacle, every frame.
function createObstacles(positions, types) {
  return positions.map(function(p, i) {
    var type = (types && types[i]) || DEFAULT_OBSTACLE_TYPE;
    return {
      x: p[0], z: p[1],
      type: type,
      typeInfo: OBSTACLE_TYPES[type],
      destroyed: false,
    };
  });
}

// Marks an obstacle destroyed if its type allows it; no-ops otherwise (so
// call sites don't need their own destructible check). Once destroyed, an
// obstacle is permanent set-dressing rubble: game.js's draw loop and
// resolveObstacleCollisions below both skip it, but it stays in the array
// (stable indices/positions) rather than being spliced out.
function destroyObstacle(obstacle) {
  if (OBSTACLE_TYPES[obstacle.type].destructible) obstacle.destroyed = true;
}

// obstacleShare curve shared by every movable circle-circle push-apart in
// the game (this file's movable obstacles and game.js's horse obstacle):
// 0 speed -> the obstacle barely gives (player mostly yields); top speed ->
// the obstacle absorbs most of the push. Clamped so the player always
// keeps at least a small share at the low end.
function movableObstacleShare(speedFrac) {
  return 0.15 + 0.75 * (speedFrac || 0);
}

// Resolves player-obstacle overlap for every live (non-destroyed) obstacle,
// via pushApart above. A non-movable type (the default — see
// obstacle-types.js) fully blocks the player (obstacleShare 0); a movable
// type splits the push by movableObstacleShare(speedFrac) and the obstacle
// keeps its own displacement.
function resolveObstacleCollisions(obstacles, player, collisionRadius, speedFrac) {
  for (var i = 0; i < obstacles.length; i++) {
    var o = obstacles[i];
    if (o.destroyed) continue;
    var obstacleShare = o.typeInfo.movable ? movableObstacleShare(speedFrac) : 0;
    var d = pushApart(player, o.x, o.z, o.typeInfo.radius + collisionRadius, obstacleShare);
    o.x += d.dx;
    o.z += d.dz;
  }
}
