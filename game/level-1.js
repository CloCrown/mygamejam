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

function buildLevel1(groundY) {
  var width = 6500;
  return {
    width: width,
    groundY: groundY,

    // Static solid rects the player collides with (ground + floating platforms).
    platforms: [
      { x: 0, y: groundY, w: width, h: 2000 },
      { x: 800, y: groundY - 200, w: 260, h: 30 },
      { x: 1250, y: groundY - 320, w: 220, h: 30 },
      { x: 2250, y: groundY - 150, w: 280, h: 30 },
      { x: 2800, y: groundY - 290, w: 190, h: 30 },
      { x: 3550, y: groundY - 230, w: 320, h: 30 },
      { x: 4350, y: groundY - 150, w: 240, h: 30 },
      { x: 4950, y: groundY - 360, w: 260, h: 30 },
    ],

    // Obstacles: solid rects too (block movement, sit on the ground), but
    // rendered/tagged differently and cause a hit on contact instead of
    // being safely landed on top of - see game-platformer.js. `type` picks
    // the OBSTACLE_TYPES entry in game.js: "wall" (default, plain rect,
    // hit from any side including top), "spike" (same hit rule as wall,
    // just drawn as spikes - see obstacle-spike-2d.js), "crate" (solid on
    // top like a platform, breaks harmlessly when landed on from above,
    // still hits the player from the side - see obstacle-crate-2d.js).
    obstacles: [
      { x: 1450, y: groundY - 70, w: 55, h: 70, type: "wall" },
      { x: 2050, y: groundY - 50, w: 160, h: 50, type: "spike" },
      { x: 2560, y: groundY - 70, w: 55, h: 70, type: "wall" },
      { x: 3150, y: groundY - 70, w: 70, h: 70, type: "crate" },
      { x: 3900, y: groundY - 70, w: 55, h: 70, type: "wall" },
      { x: 4600, y: groundY - 50, w: 140, h: 50, type: "spike" },
      { x: 5450, y: groundY - 70, w: 55, h: 70, type: "wall" },
    ],

    // Collectibles: not solid, just picked up on overlap.
    collectibles: [
      { x: 890, y: groundY - 280, w: 36, h: 36 },
      { x: 1340, y: groundY - 400, w: 36, h: 36 },
      { x: 2340, y: groundY - 230, w: 36, h: 36 },
      { x: 2870, y: groundY - 370, w: 36, h: 36 },
      { x: 3630, y: groundY - 310, w: 36, h: 36 },
      { x: 4420, y: groundY - 230, w: 36, h: 36 },
      { x: 5030, y: groundY - 440, w: 36, h: 36 },
    ],

    // Magic horn boxes: not solid, separate from the score collectibles
    // above - grants a random horn variant (see horn-item-2d.js's
    // HORN_COLORS) on overlap instead of adding to the score.
    hornBoxes: [
      { x: 1150, y: groundY - 60, w: 44, h: 44 },
      { x: 2600, y: groundY - 200, w: 44, h: 44 },
      { x: 4000, y: groundY - 60, w: 44, h: 44 },
      { x: 5200, y: groundY - 410, w: 44, h: 44 },
    ],

    // Monster spawn defs, converted to live monster instances by
    // createMonster() in game.js (see monster-2d.js) - patrolDistance is
    // how far each monster walks from its spawn x before turning back.
    monsterDefs: [
      { x: 1050, y: groundY - 65, w: 65, h: 65, patrolDistance: 130 },
      { x: 2450, y: groundY - 65, w: 65, h: 65, patrolDistance: 180 },
      { x: 2870, y: groundY - 350, w: 60, h: 60, patrolDistance: 60 },
      { x: 4700, y: groundY - 65, w: 65, h: 65, patrolDistance: 150 },
    ],

    // Finish line: not solid, ends the level on overlap - see
    // game-platformer.js's checkFinish().
    finish: { x: width - 200, y: groundY - 320, w: 32, h: 320 },
  };
}
