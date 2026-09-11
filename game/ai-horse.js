"use strict";

// Simple chase AI: a horse that steers toward the player and moves forward
// along its own heading, same movement model as the player (turn then
// move along heading, not move-directly-toward — so it reads as another
// horse running rather than a homing missile). Separate from obstacleHorse
// in game.js, which stays a plain collision-test placeholder with no
// behavior of its own.

var AI_TURN_SPEED = 2.5; // radians/sec, how fast it reorients toward the player
var AI_MOVE_SPEED = 9;   // meters/sec, deliberately slower than the player's
                          // base MOVE_SPEED (12 in game.js) so a player who
                          // keeps moving can outrun it rather than always
                          // getting caught.
var AI_STOP_DISTANCE = 2.5; // stops closing once this near, so it doesn't
                             // sit exactly on top of the player fighting
                             // the push-apart collision every frame.

// x, z: starting position. heading: initial facing, radians (0 = +Z, same
// convention as player.heading in game.js).
function createAiHorse(x, z, heading) {
  return { x: x, z: z, heading: heading || 0 };
}

// Turns toward the player (shortest angular direction) and, once roughly
// facing them, moves forward along its own heading — mirrors how the
// player's own Z/S + Q/D controls compose, so the AI's motion looks like
// another driven horse instead of a different kind of entity.
//
// speedMultiplier (optional, defaults to 1): lets game.js apply the same
// power-up speed multiplier to the AI as effectSpeedMultiplier gives the
// player (see powerups.js) — red's 1.6x boost, indigo's 1.15x, etc. — so a
// red pickup makes the AI noticeably faster too, not just the player.
function updateAiHorse(ai, player, dt, speedMultiplier) {
  var dx = player.x - ai.x, dz = player.z - ai.z;
  var dist = Math.hypot(dx, dz);
  if (dist < 1e-5) return;

  var targetHeading = Math.atan2(dx, dz);
  var diff = targetHeading - ai.heading;
  // Wrap to -PI..PI so it always turns the short way, never the long way
  // around when the target crosses the +/-PI seam.
  diff = ((diff + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

  var maxTurn = AI_TURN_SPEED * dt;
  ai.heading += Math.max(-maxTurn, Math.min(maxTurn, diff));

  if (dist > AI_STOP_DISTANCE) {
    var speed = AI_MOVE_SPEED * (speedMultiplier || 1);
    ai.x += Math.sin(ai.heading) * speed * dt;
    ai.z += Math.cos(ai.heading) * speed * dt;
  }
}
