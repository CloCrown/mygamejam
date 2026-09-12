"use strict";

// Exploration: player state + keyboard input + jump, wired to physics-2d.js
// and horse-rig-2d.js. Kept separate from the rig/mesh files so player
// control logic can change without touching the animation pipeline.

var RUN_SPEED = 420;
var JUMP_SPEED = 980;

// One rebindable {code, label} per action (not the multi-code redundancy
// the first version had, e.g. both KeyA and KeyQ for "left") - a rebind
// needs a single slot per action to overwrite. `code` (KeyboardEvent.code)
// drives actual input matching, since it's the stable physical key
// position regardless of layout; `label` is only the display text shown in
// Options, captured from KeyboardEvent.key at rebind time so it shows the
// character the user's own keyboard layout actually produces (e.g. "Q" on
// AZERTY where a QWERTY layout would show "A" for the same physical key -
// KeyboardEvent.code alone can't tell them apart, see CLAUDE.md/game.js
// Options screen discussion). Defaults are the international WASD standard
// (code-wise); AZERTY players remap left/right themselves via Options.
var DEFAULT_KEY_BINDINGS = {
  left: { code: "KeyA", label: "A" },
  right: { code: "KeyD", label: "D" },
  jump: { code: "Space", label: "Espace" },
  activate: { code: "KeyE", label: "E" },
  fire: { code: "KeyI", label: "I" },
};

var KEY_BINDINGS_STORAGE_KEY = "horseRunKeyBindings";

function loadKeyBindings() {
  var bindings = {};
  Object.keys(DEFAULT_KEY_BINDINGS).forEach(function (action) {
    var d = DEFAULT_KEY_BINDINGS[action];
    bindings[action] = { code: d.code, label: d.label };
  });
  try {
    var saved = JSON.parse(localStorage.getItem(KEY_BINDINGS_STORAGE_KEY));
    if (saved) {
      Object.keys(bindings).forEach(function (action) {
        var s = saved[action];
        if (s && typeof s.code === "string" && typeof s.label === "string") {
          bindings[action] = s;
        }
      });
    }
  } catch (e) {
    // localStorage unavailable (private mode, etc.) or corrupt saved value -
    // fall back to defaults already set above, nothing else to do.
  }
  return bindings;
}

function saveKeyBindings(bindings) {
  try {
    localStorage.setItem(KEY_BINDINGS_STORAGE_KEY, JSON.stringify(bindings));
  } catch (e) {
    // ignore - rebinding still works for the current session even if it
    // can't persist across reloads.
  }
}

var KEY_BINDINGS = loadKeyBindings();

function createPlayer(x, y) {
  return {
    x: x, y: y, w: 170, h: 170,
    vx: 0, vy: 0,
    onGround: false,
    facingRight: true,
    animTime: 0,
    keys: { left: false, right: false, jump: false, activate: false, fire: false },
  };
}

function setupPlayerInput(player) {
  function codeToAction(code) {
    var actions = Object.keys(KEY_BINDINGS);
    for (var i = 0; i < actions.length; i++) {
      if (KEY_BINDINGS[actions[i]].code === code) return actions[i];
    }
    return null;
  }
  window.addEventListener("keydown", function (e) {
    var action = codeToAction(e.code);
    if (action) player.keys[action] = true;
  });
  window.addEventListener("keyup", function (e) {
    var action = codeToAction(e.code);
    if (action) player.keys[action] = false;
  });
}

function updatePlayer(player, dt) {
  var moving = false;
  if (player.keys.left) { player.vx = -RUN_SPEED; player.facingRight = false; moving = true; }
  else if (player.keys.right) { player.vx = RUN_SPEED; player.facingRight = true; moving = true; }
  else player.vx = 0;

  if (player.keys.jump && player.onGround) {
    player.vy = -JUMP_SPEED;
  }

  if (moving) player.animTime += dt;
}
