"use strict";

// Registry of obstacle types: everything game.js needs to build a buffer,
// draw an obstacle, and collide against it, keyed by type name. game.js
// only ever reads this registry generically (loop over OBSTACLE_TYPES,
// build one buffer per type, look up o.type at draw/collision time) — it
// never hardcodes a type name, so adding a new obstacle type (a barrier, a
// spike trap, whatever) only means adding an entry here plus wherever
// track2.js/obstacles.js decides which positions get which type. No edit
// to game.js needed.
//
// Each entry:
//   size: [x, y, z] cube dimensions (meters) — passed to createCubeBufferInfo
//         via its uniform `size` arg, so non-cube proportions come from a
//         non-uniform draw-time scale (game.js already does this for the
//         default "rock" squash) rather than a separate mesh per type.
//   color: [r, g, b, a] 0..1, flat vertex color (no texture, matches every
//          other simple shape in this game — pickups, markers, finish line).
//   radius: collision circle radius (meters, XZ plane), independent from
//           the visual size so a type can look bigger/smaller than its
//           actual hitbox if that reads better.
//   yOffset: where the cube's center sits above the ground (meters).
//   movable: whether contact can push this type instead of only blocking
//            the player — see resolveObstacleCollisions in obstacles.js.
//            false means "never yields" (a boulder wedged in the ground);
//            true means the same speed-weighted force-sharing the horse
//            obstacle already uses in game.js. Absent/false by default so
//            existing types (and any new one that forgets to set it) keep
//            today's fully-static behavior.
//   destructible: whether some future effect (e.g. the perforation
//                 power-up) is allowed to destroy this type on hit. Purely
//                 a flag read by that future code — obstacles.js itself
//                 never destroys anything on its own; see `destroyed` on
//                 the obstacle instance and destroyObstacle() below.
var OBSTACLE_TYPES = {
  rock: {
    size: [3, 2.4, 3], // the 0.8 y-scale from the old hardcoded draw, baked in here
    color: [0.5, 0.47, 0.45, 1],
    radius: 1.8,
    yOffset: 1.2,
    movable: false,
    destructible: false,
  },
  barrel: {
    size: [2, 2.2, 2],
    color: [0.62, 0.36, 0.16, 1],
    radius: 1.3,
    yOffset: 1.1,
    movable: true,
    destructible: true,
  },
};

var DEFAULT_OBSTACLE_TYPE = "rock";

// Precompute, once per type instead of once per obstacle per frame: the
// cube buffer is built at each type's largest dimension (createCubeBufferInfo
// takes one uniform size), and drawn back down to the real x/y/z proportions
// via a non-uniform scale — game.js reads maxSize/scale directly instead of
// re-deriving them from `size` on every obstacle, every frame.
Object.keys(OBSTACLE_TYPES).forEach(function(name) {
  var t = OBSTACLE_TYPES[name];
  t.maxSize = Math.max(t.size[0], t.size[1], t.size[2]);
  t.scale = [t.size[0] / t.maxSize, t.size[1] / t.maxSize, t.size[2] / t.maxSize];
});
