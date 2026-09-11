"use strict";

// Rainbow power-ups: 7 fixed, one-time pickups, each arming one temporary
// effect. Only one effect is ever active — picking up a new color replaces
// whatever was running, never stacks — so "which effect is active" is a
// single nullable tagged union (ActiveEffect | null), not 7 scattered
// booleans. `color` doubles as the discriminant: the color->effect mapping
// is fixed 1:1, so there's no separate `kind` field that could drift out of
// sync with which box was actually touched.
//
// ActiveEffect = { color: 0..6, expiresAt: number } | null
//
// expiresAt is an absolute time (game clock seconds), not a countdown
// ticked every frame — comparing `time > expiresAt` gives the right answer
// on any frame, including after a stalled/backgrounded tab, with no dt
// clamping needed just for effect timing.

var PICKUP_COLORS = [
  [0.9, 0.15, 0.15, 1], // 0 red    — speed boost
  [1.0, 0.55, 0.1,  1], // 1 orange — higher jump
  [1.0, 0.92, 0.15, 1], // 2 yellow — invincible (pass through the obstacle)
  [0.2, 0.8,  0.25, 1], // 3 green  — sharper turning
  [0.2, 0.45, 1.0,  1], // 4 blue   — grow
  [0.35, 0.2, 0.75, 1], // 5 indigo — shrink (+ small speed bonus)
  [0.7, 0.25, 0.9,  1], // 6 violet — reversed controls (the one hazard box)
];

var EFFECT_DURATION = 8; // seconds, shared by all 7 colors
var PICKUP_RESPAWN_DELAY = 20; // seconds after collection before a pickup reappears

// Builds the fixed pickup set for a race. positions: [[x,z], ...] length 7,
// from track.createPickupPositions() — track2.js owns the track geometry,
// this module never touches waypoints directly. `respawnAt` is null while
// available; set to a future timestamp on collection, cleared by
// tickPickups once that time passes — for testing pickups repeatedly
// rather than a one-shot-per-race set.
function createPickups(positions) {
  return positions.map(function(p, i) {
    return { x: p[0], z: p[1], color: i, respawnAt: null };
  });
}

var PICKUP_RADIUS = 1.5;

// Clears respawnAt on any pickup whose delay has elapsed, making it
// collectible again.
function tickPickups(pickups, time) {
  for (var i = 0; i < pickups.length; i++) {
    if (pickups[i].respawnAt !== null && time > pickups[i].respawnAt) {
      pickups[i].respawnAt = null;
    }
  }
}

// Checks the player against every available (not respawning) pickup; on a
// hit, arms its respawn timer and returns a fresh ActiveEffect, replacing
// whatever was active. Returns `effect` unchanged if nothing was touched.
function collectPickups(pickups, player, effect, time, collisionRadius) {
  for (var i = 0; i < pickups.length; i++) {
    var p = pickups[i];
    if (p.respawnAt !== null) continue;
    var dx = player.x - p.x, dz = player.z - p.z;
    if (dx * dx + dz * dz < (PICKUP_RADIUS + collisionRadius) * (PICKUP_RADIUS + collisionRadius)) {
      p.respawnAt = time + PICKUP_RESPAWN_DELAY;
      return { color: p.color, expiresAt: time + EFFECT_DURATION };
    }
  }
  return effect;
}

function tickEffect(effect, time) {
  return effect && time > effect.expiresAt ? null : effect;
}

// Manual-trigger powerups: pickups no longer arm their effect on contact,
// they load it into `reservedColor` (0..6, one slot, last touch wins,
// mirroring the "only one effect ever active" rule above) — the player
// fires it later with the "é" key via activateReservedEffect. The horn
// powerup ("&") is separate: same 7-effect table, but its color is fixed
// for the whole race (chosen before the track) and it only needs a
// cooldown instead of a reserve slot, since there's nothing to "run out
// of" — the horn color never disappears the way a picked-up box does.
var HORN_COOLDOWN = 8; // seconds, matches EFFECT_DURATION

// Arms the reserve slot on contact instead of activating immediately;
// respawn timing is unchanged from collectPickups.
function collectPickupsToReserve(pickups, player, reservedColor, time, collisionRadius) {
  for (var i = 0; i < pickups.length; i++) {
    var p = pickups[i];
    if (p.respawnAt !== null) continue;
    var dx = player.x - p.x, dz = player.z - p.z;
    if (dx * dx + dz * dz < (PICKUP_RADIUS + collisionRadius) * (PICKUP_RADIUS + collisionRadius)) {
      p.respawnAt = time + PICKUP_RESPAWN_DELAY;
      return p.color;
    }
  }
  return reservedColor;
}

// Consumes the reserve slot (if any) into a fresh ActiveEffect, replacing
// whatever was running — returns { effect, reservedColor } since both
// change together (null the slot exactly when it's spent).
function activateReservedEffect(reservedColor, time) {
  if (reservedColor === null) return null;
  return { color: reservedColor, expiresAt: time + EFFECT_DURATION };
}

// Fires the horn's fixed-color effect if its cooldown has elapsed;
// returns the new cooldown-ready timestamp (or the unchanged one if still
// on cooldown) alongside the effect, for the same reason as above.
function activateHornEffect(hornColor, cooldownReadyAt, time) {
  if (time < cooldownReadyAt) return null;
  return {
    effect: { color: hornColor, expiresAt: time + EFFECT_DURATION },
    cooldownReadyAt: time + HORN_COOLDOWN,
  };
}

// Pure readers, each total over ActiveEffect|null — no color falls through
// to undefined, no call site needs its own null-check branch.
function effectSpeedMultiplier(effect) {
  if (!effect) return 1;
  if (effect.color === 0) return 1.6;  // red
  if (effect.color === 5) return 1.15; // indigo: small + a bit faster
  return 1;
}
function effectTurnMultiplier(effect) {
  if (effect && effect.color === 3) return 1.8;  // green
  if (effect && effect.color === 6) return -1;   // violet: reversed controls
  return 1;
}
function effectScaleMultiplier(effect) {
  if (!effect) return 1;
  if (effect.color === 4) return 1.6; // blue: grow
  if (effect.color === 5) return 0.6; // indigo: shrink
  return 1;
}
function effectJumpMultiplier(effect) {
  return effect && effect.color === 1 ? 1.6 : 1; // orange
}
function effectIsInvincible(effect) {
  return !!effect && effect.color === 2; // yellow
}
