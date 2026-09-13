"use strict";

// Exploration: first platformer level layout - platforms at varying
// heights, obstacles to jump over, collectibles to pick up, a finish line
// at the end. Built by a function (not static data) because groundY must
// follow the real canvas height (fullscreen canvas, see game-platformer.html)
// instead of a fixed pixel value - a fixed GROUND_Y left most of a tall
// screen empty. See CLAUDE.md exploration-phase rule.
//
// Dimensions scaled up ~2.4x from the first pass (player.w/h went from 70
// to 170 in player-2d.js, to make the horse readably large on a fullscreen
// canvas) - obstacle/collectible/platform sizes and gaps follow the same
// factor so they stay proportioned to the player.
//
// Level is built from a repeating ~1600px "chunk" pattern (platforms,
// obstacle, collectibles, horn box, monster) instead of one long hand-laid
// sequence - stretching the original single-pass layout's X coordinates
// would have left long empty flat stretches with nothing to do. Chunk
// height offsets/obstacle type/monster patrol vary per repeat (via `variant
// % N`) so the repetition doesn't read as an obvious 1:1 loop.

function buildLevel1(groundY) {
  var CHUNK_WIDTH = 1600;
  var CHUNK_COUNT = 15; // ~3.7x the original 4-chunk-equivalent 6500px level
  var width = CHUNK_WIDTH * CHUNK_COUNT + 400; // + trailing runway to the finish line

  var platforms = [{ x: 0, y: groundY, w: width, h: 2000 }];
  var obstacles = [];
  var collectibles = [];
  var hornBoxes = [];
  var monsterDefs = [];

  var OBSTACLE_TYPES_CYCLE = ["wall", "spike", "crate"];

  for (var i = 0; i < CHUNK_COUNT; i++) {
    var base = i * CHUNK_WIDTH;
    var variant = i % 3; // rotates platform height pattern every 3 chunks

    var platHeights = variant === 0
      ? [200, 320]
      : variant === 1
      ? [150, 290]
      : [230, 150, 360];

    if (variant !== 2) {
      platforms.push({ x: base + 800, y: groundY - platHeights[0], w: 260, h: 30 });
      platforms.push({ x: base + 1250, y: groundY - platHeights[1], w: 220, h: 30 });
    } else {
      platforms.push({ x: base + 700, y: groundY - platHeights[0], w: 280, h: 30 });
      platforms.push({ x: base + 1150, y: groundY - platHeights[1], w: 190, h: 30 });
      platforms.push({ x: base + 1450, y: groundY - platHeights[2], w: 260, h: 30 });
    }

    obstacles.push({
      x: base + 450, y: groundY - 70, w: 55, h: 70,
      type: OBSTACLE_TYPES_CYCLE[i % OBSTACLE_TYPES_CYCLE.length],
    });
    if (i % 2 === 1) {
      obstacles.push({
        x: base + 1050, y: groundY - 50, w: 150, h: 50,
        type: "spike",
      });
    }

    collectibles.push({ x: base + 340, y: groundY - 280, w: 36, h: 36 });
    collectibles.push({ x: base + 900, y: groundY - platHeights[0] - 100, w: 36, h: 36 });

    hornBoxes.push({
      x: base + 650 + (i % 3) * 150,
      y: i % 2 === 0 ? groundY - 60 : groundY - platHeights[0] - 40,
      w: 44, h: 44,
    });

    // Skip the very first monster spawn (i === 0 would land right on top
    // of the player's start position, x=100 in game.js) - gives the
    // player a safe stretch to get moving before the first enemy shows up.
    if (i > 0) {
      monsterDefs.push({
        x: base + 150 + (i % 3) * 250,
        y: groundY - 65, w: 65, h: 65,
        patrolDistance: 100 + (i % 4) * 30,
        tier: 1,
      });
    }
    // Tougher tier 2 every third chunk (destroys a heart slot on contact
    // instead of just costing a heart - see game.js's checkObstacleHit).
    if (i % 3 === 2) {
      monsterDefs.push({
        x: base + 1250, y: groundY - 65, w: 65, h: 65,
        patrolDistance: 120,
        tier: 2,
      });
    }
  }

  return {
    width: width,
    groundY: groundY,
    platforms: platforms,
    obstacles: obstacles,
    collectibles: collectibles,
    hornBoxes: hornBoxes,
    monsterDefs: monsterDefs,

    // Finish line: not solid, ends the level on overlap - see
    // game-platformer.js's checkFinish().
    finish: { x: width - 200, y: groundY - 320, w: 32, h: 320 },
  };
}
