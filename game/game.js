"use strict";

// Central game loop - wires together physics, level, player, rig, HUD.
// See CLAUDE.md "Perimetre par tache" before editing this file: most new
// features should extend a registry (PICKUP_TYPES below, OBSTACLE_TYPES if
// obstacle variety grows) instead of adding a branch here.

var canvas = document.querySelector("#canvas");
var ctx = canvas.getContext("2d");

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// groundY sits a fixed margin above the bottom of the real (fullscreen)
// canvas instead of a hardcoded pixel value, so the level fills the screen
// on any window size instead of leaving the bottom half empty.
var GROUND_MARGIN = 80;
var level = buildLevel1(canvas.height - GROUND_MARGIN);
var player = createPlayer(100, level.groundY - 200);
setupPlayerInput(player);

var monsters = level.monsterDefs.map(createMonster);

// State machine: title (menu: Play/Options/Quit) -> playing -> finished
// (see drawFinishScreen). playing <-> paused via Escape (see drawPauseScreen).
// Only game.js reads/writes gameState.
var gameState = "title";

// ---- Title menu: entries + selection, keyboard (arrows + Enter/Space) and
// mouse (hover to select, click to activate) both drive the same
// `menuIndex`/`activateMenuEntry`. Quit is a placeholder (no action
// defined yet, see CLAUDE.md) - present and selectable, but its action is
// a no-op for now.
var MENU_ENTRIES = [
  { label: "Jouer", action: function () { gameState = "playing"; Audio_.startMusic(); } },
  { label: "Options", action: function () { gameState = "options"; } },
  { label: "Quitter", action: function () {} },
];
var menuIndex = 0;
var menuEntryRects = []; // filled by drawTitleScreen each frame, used for mouse hit-testing

function activateMenuEntry(index) {
  MENU_ENTRIES[index].action();
}

// ---- Options screen: rebindable actions (see player-2d.js's KEY_BINDINGS /
// DEFAULT_KEY_BINDINGS). Selecting a row and pressing Enter/Space or
// clicking it enters "listening" mode (awaitingBindFor holds the action
// name); the next keydown becomes that action's new binding instead of
// being interpreted as a game input, then is saved to localStorage. Esc
// cancels listening without changing anything, and also returns from the
// Options screen to the title menu when not listening. ----
var OPTIONS_ACTIONS = ["left", "right", "jump", "activate"];
var OPTIONS_LABELS = { left: "Gauche", right: "Droite", jump: "Sauter", activate: "Activer la corne" };
var optionsIndex = 0;
var optionsEntryRects = [];
var awaitingBindFor = null;

// Display label for a freshly-pressed key: e.key reflects the user's own
// keyboard layout (e.g. "q" on AZERTY for the same physical key QWERTY
// calls "a"), unlike e.code which is layout-independent - see
// player-2d.js's KEY_BINDINGS comment for why both are needed.
function keyEventToLabel(e) {
  if (e.code === "Space") return "Espace";
  if (e.key.length === 1) return e.key.toUpperCase();
  return e.key; // e.g. "ArrowLeft", "Control" - shown as-is
}

window.addEventListener("keydown", function (e) {
  if (gameState === "options" && awaitingBindFor) {
    if (e.code !== "Escape") {
      KEY_BINDINGS[awaitingBindFor] = { code: e.code, label: keyEventToLabel(e) };
      saveKeyBindings(KEY_BINDINGS);
    }
    awaitingBindFor = null;
    return;
  }
  if (gameState === "title") {
    if (e.code === "ArrowUp") menuIndex = (menuIndex - 1 + MENU_ENTRIES.length) % MENU_ENTRIES.length;
    else if (e.code === "ArrowDown") menuIndex = (menuIndex + 1) % MENU_ENTRIES.length;
    else if (e.code === "Space" || e.code === "Enter") activateMenuEntry(menuIndex);
    return;
  }
  if (gameState === "options") {
    if (e.code === "ArrowUp") optionsIndex = (optionsIndex - 1 + OPTIONS_ACTIONS.length) % OPTIONS_ACTIONS.length;
    else if (e.code === "ArrowDown") optionsIndex = (optionsIndex + 1) % OPTIONS_ACTIONS.length;
    else if (e.code === "Space" || e.code === "Enter") awaitingBindFor = OPTIONS_ACTIONS[optionsIndex];
    else if (e.code === "Escape") gameState = "title";
    return;
  }
  if (gameState === "gameover") {
    if (e.code === "Space" || e.code === "Enter") {
      resetGame();
      gameState = "title";
    }
    return;
  }
  if (gameState === "playing" && e.code === "Escape") {
    gameState = "paused";
    return;
  }
  if (gameState === "paused" && e.code === "Escape") {
    gameState = "playing";
    return;
  }
});
canvas.addEventListener("mousemove", function (e) {
  var my = e.clientY;
  var rects = gameState === "title" ? menuEntryRects : gameState === "options" ? optionsEntryRects : null;
  if (!rects) return;
  for (var i = 0; i < rects.length; i++) {
    var r = rects[i];
    if (my >= r.y && my <= r.y + r.h) {
      if (gameState === "title") menuIndex = i; else optionsIndex = i;
      break;
    }
  }
});
canvas.addEventListener("click", function (e) {
  var mx = e.clientX, my = e.clientY;
  if (gameState === "title") {
    for (var i = 0; i < menuEntryRects.length; i++) {
      var r = menuEntryRects[i];
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
        activateMenuEntry(i);
        return;
      }
    }
  } else if (gameState === "options") {
    if (awaitingBindFor) return; // let the next keydown handler capture the bind
    for (var j = 0; j < optionsEntryRects.length; j++) {
      var r2 = optionsEntryRects[j];
      if (mx >= r2.x && mx <= r2.x + r2.w && my >= r2.y && my <= r2.y + r2.h) {
        optionsIndex = j;
        awaitingBindFor = OPTIONS_ACTIONS[j];
        return;
      }
    }
  } else if (gameState === "gameover") {
    resetGame();
    gameState = "title";
  }
});

var rig = buildHorseRig2D();
// Body-part groups for independently colored regions (see horse-mesh-2d.js
// for the full bone list). The torso (spine.001/spine.002/spin.003) has no
// group of its own and falls through to "body" - the current Blender
// weight paint models the torso as a blend of the neighboring limb/neck/
// tail bones rather than giving the spine bones their own dominant weight
// anywhere, so no code-side split can isolate a real "torso" region until
// that's repainted (see CLAUDE.md 2D mesh/rig row - any shape/weight
// change starts in Blender, never edited by hand here).
var meshSplit = splitTrianglesByBoneGroups(rig, [
  { name: "toes", bones: ["toe.L", "front_toe.L"] },
  { name: "legs", bones: ["thigh.L", "foot.L", "front_thigh.L", "front_foot.L"] },
  { name: "thighs", bones: ["thigh.L", "front_thigh.L"] },
  { name: "shins", bones: ["foot.L", "front_foot.L"] },
  { name: "tail", bones: ["tail.001", "tail.002"] },
  { name: "neck", bones: ["neck"] },
  { name: "head", bones: ["head"] },
]);

// Concats several index groups into one Uint16Array, for drawing a set of
// same-colored groups as a single fill() call - a separate fill per group
// leaves a hairline seam at the shared edge (canvas antialiasing at the
// triangle boundary) even when the color is identical, see drawTris below.
function concatIndices() {
  var total = 0;
  for (var i = 0; i < arguments.length; i++) total += arguments[i].length;
  var out = new Uint16Array(total);
  var offset = 0;
  for (var j = 0; j < arguments.length; j++) {
    out.set(arguments[j], offset);
    offset += arguments[j].length;
  }
  return out;
}

// Default single-color silhouette (everything but the sabots, which stay
// a contrasting color) - all the individually-selectable groups above,
// merged back into one fill so the default look has no internal seams.
var MESH_SKIN_TAN = concatIndices(
  meshSplit.body, meshSplit.legs,
  meshSplit.tail, meshSplit.neck, meshSplit.head
);

// Rig/mesh authored in Blender units, ~0.96 units tall after the latest
// re-export (clean contour Fill + Beautify, then rescaled in Blender - see
// CLAUDE.md); scale to make the horse about as tall as the player hitbox
// (player.h), matching physics-2d's pixel space. Source art faces
// right-to-left (see my_horse_side_view.svg, horse-rig-2d-real-test.html),
// mirrored per-frame to match facing.
var HORSE_SCALE = player.h / 0.96;
var HORSE_PIVOT_X = 0; // meters, roughly the horse's mid-body X in bind pose
var HORSE_PIVOT_Y = 0.04;

var collected = 0;
var hitFlashTime = 0;
var ownedHorn = -1; // -1 = none yet, else index into HORN_COLORS
var hornPopupTime = 0;
var wasActivateDown = false;

// ---- Horn power-up registry: one entry per HORN_COLORS index (same order,
// see horn-item-2d.js). Each `apply` runs once when that horn is consumed
// (E key). Effects not designed yet - all no-op placeholders for now, see
// CLAUDE.md "Périmètre par tâche". Add real behavior (speed boost, higher
// jump, invincibility, etc.) inside the matching apply() only; nothing
// else in game.js needs to change to wire a new effect in.
var HORN_EFFECTS = [
  { name: "rouge", apply: function () {} },
  { name: "orange", apply: function () {} },
  { name: "jaune", apply: function () {} },
  { name: "vert", apply: function () {} },
  { name: "bleu", apply: function () {} },
  { name: "indigo", apply: function () {} },
  { name: "violet", apply: function () {} },
];

// Consumes the owned horn on a fresh press of the activate key (edge-detect
// against wasActivateDown so holding the key doesn't retrigger every
// frame), then runs that color's HORN_EFFECTS entry.
function updateHornActivation() {
  var down = player.keys.activate;
  if (down && !wasActivateDown && ownedHorn >= 0) {
    Audio_.play("effectActivate");
    HORN_EFFECTS[ownedHorn].apply();
    ownedHorn = -1;
  }
  wasActivateDown = down;
}

// ---- Pickup registry: add a new pickup type here (array field on `level`,
// an onCollect callback) instead of adding a new hand-written loop in
// collectPickups(). See CLAUDE.md perimeter table. ----
var PICKUP_TYPES = {
  collectibles: {
    onCollect: function () {
      collected++;
      Audio_.play("pickup");
    },
  },
  hornBoxes: {
    onCollect: function () {
      ownedHorn = Math.floor(Math.random() * HORN_COLORS.length);
      hornPopupTime = 1.2;
      Audio_.play("hornPickup");
    },
  },
};

function collectPickups() {
  Object.keys(PICKUP_TYPES).forEach(function (key) {
    var list = level[key];
    var type = PICKUP_TYPES[key];
    for (var i = list.length - 1; i >= 0; i--) {
      if (aabbOverlap(player, list[i])) {
        list.splice(i, 1);
        type.onCollect();
      }
    }
  });
}

// ---- Obstacle registry: one entry per level.obstacles `type` (default
// "wall" when unset). `draw` renders the obstacle (screen-space rect
// already camera-adjusted); `onPlayerLanded` runs once when the player's
// fall is stopped by landing on top of that obstacle (see checkObstacleHit)
// and returns true to break/remove it instead of causing a hit - see
// CLAUDE.md obstacle perimeter table. Add a new obstacle look in its own
// obstacle-<nom>.js file, then wire it in here only. ----
var OBSTACLE_TYPES = {
  wall: {
    draw: function (ctx, x, y, w, h) {
      ctx.fillStyle = "#8b2f2f";
      ctx.fillRect(x, y, w, h);
    },
    onPlayerLanded: function () { return false; },
  },
  spike: {
    draw: drawSpikeObstacle,
    onPlayerLanded: function () { return false; },
  },
  crate: {
    draw: drawCrateObstacle,
    onPlayerLanded: function () {
      Audio_.play("land");
      return true;
    },
  },
};

// ---- Lives / damage: 3 hearts, lost on contact with an obstacle or
// monster. invulnerableTime blocks further hits for a beat after one lands
// (both to give the player room to get clear and so a single prolonged
// overlap doesn't chain-drain every heart at once), decremented in loop().
// ----
var MAX_LIVES = 3;
var lives = MAX_LIVES;
var invulnerableTime = 0;
var INVULNERABLE_DURATION = 1.5;

function takeHit() {
  if (invulnerableTime > 0) return;
  lives--;
  invulnerableTime = INVULNERABLE_DURATION;
  hitFlashTime = 0.2;
  Audio_.play("hit");
  if (lives <= 0) {
    gameState = "gameover";
    Audio_.play("gameOver");
  }
}

var wasOnGround = true;

// Top-landing tolerance in px: how close the player's feet must be to an
// obstacle's top edge (after stepBody's collision resolve) to count as
// "landed on top of it" rather than a side hit.
var OBSTACLE_TOP_MARGIN = 4;

function checkObstacleHit() {
  for (var i = 0; i < level.obstacles.length; i++) {
    var o = level.obstacles[i];
    if (!aabbOverlap(player, o)) continue;

    var type = OBSTACLE_TYPES[o.type] || OBSTACLE_TYPES.wall;
    var landedOnTop = player.onGround && player.y + player.h <= o.y + OBSTACLE_TOP_MARGIN;
    if (landedOnTop && type.onPlayerLanded()) {
      level.obstacles.splice(i, 1);
      return;
    }
    if (!landedOnTop) {
      takeHit();
      return;
    }
  }
  for (var j = 0; j < monsters.length; j++) {
    if (aabbOverlap(player, monsters[j])) {
      takeHit();
      return;
    }
  }
}

function checkFinish() {
  if (gameState === "playing" && aabbOverlap(player, level.finish)) {
    gameState = "finished";
    Audio_.play("finish");
  }
}

var camX = 0;
function updateCamera() {
  var targetX = player.x - canvas.width / 2 + player.w / 2;
  camX += (targetX - camX) * 0.1;
  camX = Math.max(0, Math.min(camX, level.width - canvas.width));
}

function drawHorse(ctx, screenX, screenY, facingRight, time) {
  ctx.save();
  ctx.translate(screenX, screenY);
  // Source mesh is authored facing left (see my_horse_side_view.svg /
  // horse-rig-2d-real-test.html) - flip when facing right instead of left.
  if (facingRight) ctx.scale(-1, 1);

  function toScreen(mx, my) {
    return [(mx - HORSE_PIVOT_X) * HORSE_SCALE, -(my - HORSE_PIVOT_Y) * HORSE_SCALE];
  }
  function drawTris(idx, offX, offY, fill) {
    // One path for the whole triangle group instead of one beginPath/fill
    // per triangle: same-color adjacent triangles filled individually leave
    // a faint seam line at each shared edge (canvas antialiasing at the
    // triangle boundary), visible as hairline cracks across the body.
    // Batching them into a single fill removes those internal seams.
    var pos = rig.skinnedPositions;
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (var t = 0; t < idx.length; t += 3) {
      var ia = idx[t], ib = idx[t + 1], ic = idx[t + 2];
      var pa = toScreen(pos[ia * 2], pos[ia * 2 + 1]);
      var pb = toScreen(pos[ib * 2], pos[ib * 2 + 1]);
      var pc = toScreen(pos[ic * 2], pos[ic * 2 + 1]);
      ctx.moveTo(pa[0] + offX, pa[1] + offY);
      ctx.lineTo(pb[0] + offX, pb[1] + offY);
      ctx.lineTo(pc[0] + offX, pc[1] + offY);
      ctx.closePath();
    }
    ctx.fill();
  }

  var speed = player.onGround && (player.keys.left || player.keys.right) ? 1.6 : 0;
  // Blend into the fixed jump pose while airborne; jumpBlend eases in/out
  // over ~0.15s around takeoff/landing instead of snapping, using onGround
  // as the on/off signal (see player-2d.js for jump/gravity handling).
  var jumpBlend = player.onGround ? 0 : 1;
  animateHorseRig2DWithJump(rig, time, speed, FAR_LEG_PHASE_OFFSET_2D, jumpBlend);
  drawTris(meshSplit.legs, -4, -2, "#a9713f");
  drawTris(meshSplit.toes, -4, -2, "#2d5f8a");
  animateHorseRig2DWithJump(rig, time, speed, 0, jumpBlend);
  drawTris(MESH_SKIN_TAN, 0, 0, "#c98a52");
  drawTris(meshSplit.toes, 0, 0, "#3d7fb8");

  ctx.restore();
}

function drawLevel(ctx) {
  ctx.fillStyle = "#5a3d1f";
  level.platforms.forEach(function (p) {
    ctx.fillRect(p.x - camX, p.y, p.w, p.h);
  });
  level.obstacles.forEach(function (o) {
    var type = OBSTACLE_TYPES[o.type] || OBSTACLE_TYPES.wall;
    type.draw(ctx, o.x - camX, o.y, o.w, o.h);
  });
  ctx.fillStyle = "#e8c93a";
  level.collectibles.forEach(function (c) {
    ctx.beginPath();
    ctx.arc(c.x - camX + c.w / 2, c.y + c.h / 2, c.w / 2, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#1a1a1a";
  level.hornBoxes.forEach(function (b) {
    ctx.fillRect(b.x - camX, b.y, b.w, b.h);
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x - camX + 3, b.y + 3, b.w - 6, b.h - 6);
  });

  var f = level.finish;
  var poleX = f.x - camX + f.w / 2;
  ctx.fillStyle = "#cccccc";
  ctx.fillRect(poleX - 3, f.y, 6, f.h);
  ctx.fillStyle = "#e8433a";
  ctx.beginPath();
  ctx.moveTo(poleX + 3, f.y);
  ctx.lineTo(poleX + 40, f.y + 15);
  ctx.lineTo(poleX + 3, f.y + 30);
  ctx.closePath();
  ctx.fill();

  monsters.forEach(function (m) { drawMonster(ctx, m, camX); });
}

// Draws one heart icon centered at (x, y), `size` tall. `filled` false
// draws just the outline (an empty/lost life slot).
function drawHeart(ctx, x, y, size, filled) {
  var s = size / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x, y, x - s, y - s * 0.6, x - s, y + s * 0.1);
  ctx.bezierCurveTo(x - s, y + s * 0.7, x - s * 0.4, y + s, x, y + s * 1.3);
  ctx.bezierCurveTo(x + s * 0.4, y + s, x + s, y + s * 0.7, x + s, y + s * 0.1);
  ctx.bezierCurveTo(x + s, y - s * 0.6, x, y, x, y + s * 0.35);
  ctx.closePath();
  if (filled) {
    ctx.fillStyle = "#e0463f";
    ctx.fill();
    ctx.strokeStyle = "#7a1f1a";
  } else {
    ctx.strokeStyle = "#999";
  }
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawHud(ctx) {
  // Lives, top-left, above the collectibles counter. Flashes while
  // invulnerable (brief post-hit grace period) so the player can see the
  // window during which further hits don't cost another heart.
  var heartSize = 30;
  var flashing = invulnerableTime > 0 && Math.sin(invulnerableTime * 20) > 0;
  for (var i = 0; i < MAX_LIVES; i++) {
    if (flashing) continue;
    drawHeart(ctx, 16 + i * (heartSize + 6) + heartSize / 2, 16 + heartSize / 2, heartSize, i < lives);
  }

  ctx.fillStyle = "#222";
  ctx.font = "20px sans-serif";
  ctx.fillText("Collectibles: " + collected + " / " + (collected + level.collectibles.length), 16, 65);

  // Owned-horn box, fixed top-right: empty slot outline when nothing owned
  // yet, otherwise the current horn drawn inside it.
  var boxSize = 64;
  var boxX = canvas.width - boxSize - 16;
  var boxY = 16;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(boxX, boxY, boxSize, boxSize);
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 2;
  ctx.strokeRect(boxX, boxY, boxSize, boxSize);
  if (ownedHorn >= 0) {
    drawHornItem(ctx, boxX + boxSize / 2, boxY + boxSize / 2, boxSize * 0.7, ownedHorn, 0);
  }

  if (hornPopupTime > 0) {
    ctx.fillStyle = "#222";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("Corne obtenue !", boxX + boxSize, boxY + boxSize + 20);
    ctx.textAlign = "left";
  }
}

function drawFinishScreen(ctx) {
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "48px sans-serif";
  ctx.fillText("Arrivee !", canvas.width / 2, canvas.height / 2 - 20);
  ctx.font = "24px sans-serif";
  ctx.fillText("Collectibles : " + collected + " / " + (collected + level.collectibles.length), canvas.width / 2, canvas.height / 2 + 30);
  ctx.textAlign = "left";
}

function drawPauseScreen(ctx) {
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "48px sans-serif";
  ctx.fillText("Pause", canvas.width / 2, canvas.height / 2 - 20);
  ctx.font = "24px sans-serif";
  ctx.fillText("Echap pour reprendre", canvas.width / 2, canvas.height / 2 + 30);
  ctx.textAlign = "left";
}

function resetGame() {
  player.x = 100;
  player.y = level.groundY - 200;
  player.vx = 0;
  player.vy = 0;
  collected = 0;
  ownedHorn = -1;
  hornPopupTime = 0;
  lives = MAX_LIVES;
  invulnerableTime = 0;
  camX = 0;
  level = buildLevel1(level.groundY);
  monsters = level.monsterDefs.map(createMonster);
}

function drawGameOverScreen(ctx, time) {
  ctx.fillStyle = "rgba(40,0,0,0.7)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "bold 52px sans-serif";
  ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 30);
  ctx.font = "22px sans-serif";
  var blink = Math.sin(time * 3) > 0;
  if (blink) ctx.fillText("Appuie sur Espace ou clique pour revenir au menu", canvas.width / 2, canvas.height / 2 + 30);
  ctx.textAlign = "left";
}

function drawTitleScreen(ctx, time) {
  drawBackground(ctx, canvas.width, canvas.height, 0, level.groundY);
  drawHorse(ctx, canvas.width / 2, level.groundY, true, time);

  var overlay = ctx.createLinearGradient(0, 0, 0, canvas.height);
  overlay.addColorStop(0, "rgba(0,0,0,0.5)");
  overlay.addColorStop(0.5, "rgba(0,0,0,0.15)");
  overlay.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 12;

  ctx.fillStyle = "#fff";
  ctx.font = "bold 64px sans-serif";
  ctx.fillText("Horse Run", canvas.width / 2, canvas.height * 0.26);

  // Menu entries: centered stack, current selection highlighted (bigger,
  // yellow, with a pointer arrow) - same visual for keyboard and mouse
  // selection since both just move menuIndex. menuEntryRects is rebuilt
  // every frame here and read by the mousemove/click handlers above for
  // hit-testing, so layout only needs to be defined in this one place.
  var entryHeight = 56;
  var startY = canvas.height * 0.26 + 90;
  menuEntryRects = [];
  MENU_ENTRIES.forEach(function (entry, i) {
    var y = startY + i * entryHeight;
    var selected = i === menuIndex;
    ctx.font = selected ? "bold 34px sans-serif" : "28px sans-serif";
    ctx.fillStyle = selected ? "#f2d43d" : "#fff";
    ctx.fillText(entry.label, canvas.width / 2, y);
    if (selected) {
      var textWidth = ctx.measureText(entry.label).width;
      ctx.fillText(">", canvas.width / 2 - textWidth / 2 - 34, y);
    }
    var rectW = 260, rectH = entryHeight - 8;
    menuEntryRects.push({
      x: canvas.width / 2 - rectW / 2, y: y - rectH + 12, w: rectW, h: rectH,
    });
  });

  // Controls reminder, bottom of the screen. Reflects the current bindings
  // (remappable in Options) instead of a hardcoded layout.
  ctx.font = "18px sans-serif";
  ctx.fillStyle = "#fff";
  var controlsY = canvas.height - 70;
  ctx.fillText(
    KEY_BINDINGS.left.label + "/" + KEY_BINDINGS.right.label + " : courir, Fleches aussi",
    canvas.width / 2, controlsY
  );
  ctx.fillText(
    KEY_BINDINGS.jump.label + " : sauter        " + KEY_BINDINGS.activate.label + " : activer la corne",
    canvas.width / 2, controlsY + 26
  );

  ctx.shadowBlur = 0;
  ctx.textAlign = "left";
}

function drawOptionsScreen(ctx, time) {
  drawBackground(ctx, canvas.width, canvas.height, 0, level.groundY);
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 10;

  ctx.fillStyle = "#fff";
  ctx.font = "bold 44px sans-serif";
  ctx.fillText("Options", canvas.width / 2, canvas.height * 0.2);

  ctx.font = "18px sans-serif";
  ctx.fillText("Reglages clavier - Fleches directionnelles marchent toujours en plus", canvas.width / 2, canvas.height * 0.2 + 36);

  var rowHeight = 60;
  var startY = canvas.height * 0.2 + 110;
  var labelX = canvas.width / 2 - 140;
  var valueX = canvas.width / 2 + 140;
  optionsEntryRects = [];
  OPTIONS_ACTIONS.forEach(function (action, i) {
    var y = startY + i * rowHeight;
    var selected = i === optionsIndex;
    var listening = awaitingBindFor === action;

    ctx.textAlign = "left";
    ctx.font = selected ? "bold 24px sans-serif" : "22px sans-serif";
    ctx.fillStyle = selected ? "#f2d43d" : "#fff";
    ctx.fillText(OPTIONS_LABELS[action], labelX, y);

    ctx.textAlign = "right";
    if (listening) {
      var blink = Math.sin(time * 6) > 0;
      ctx.fillStyle = "#e0463f";
      ctx.fillText(blink ? "Appuie sur une touche..." : "", valueX, y);
    } else {
      ctx.fillStyle = selected ? "#f2d43d" : "#ccc";
      ctx.fillText(KEY_BINDINGS[action].label, valueX, y);
    }

    var rectH = rowHeight - 10;
    optionsEntryRects.push({ x: labelX - 10, y: y - rectH + 10, w: valueX - labelX + 20, h: rectH });
  });

  ctx.textAlign = "center";
  ctx.font = "16px sans-serif";
  ctx.fillStyle = "#ccc";
  ctx.fillText("Entree/clic : changer la touche        Echap : retour", canvas.width / 2, startY + OPTIONS_ACTIONS.length * rowHeight + 30);

  ctx.shadowBlur = 0;
  ctx.textAlign = "left";
}

var lastTs = null;
var titleTime = 0;
function loop(ts) {
  if (lastTs === null) lastTs = ts;
  var dt = Math.min((ts - lastTs) / 1000, 1 / 30);
  lastTs = ts;

  if (gameState === "title") {
    titleTime += dt;
    drawTitleScreen(ctx, titleTime);
    requestAnimationFrame(loop);
    return;
  }

  if (gameState === "options") {
    titleTime += dt;
    drawOptionsScreen(ctx, titleTime);
    requestAnimationFrame(loop);
    return;
  }

  if (gameState === "playing") {
    updatePlayer(player, dt);
    if (player.keys.jump && player.onGround) Audio_.play("jump");
    var solids = level.platforms.concat(level.obstacles);
    stepBody(player, solids, dt);
    player.x = Math.max(0, Math.min(player.x, level.width - player.w));
    if (!wasOnGround && player.onGround) Audio_.play("land");
    wasOnGround = player.onGround;

    monsters.forEach(function (m) { updateMonster(m, dt); });

    collectPickups();
    updateHornActivation();
    checkObstacleHit();
    checkFinish();
    if (hitFlashTime > 0) hitFlashTime -= dt;
    if (hornPopupTime > 0) hornPopupTime -= dt;
    if (invulnerableTime > 0) invulnerableTime -= dt;
    updateCamera();
  }

  drawBackground(ctx, canvas.width, canvas.height, camX, level.groundY);
  drawLevel(ctx);
  drawHorse(ctx, player.x - camX + player.w / 2, player.y + player.h, player.facingRight, player.animTime);
  if (hitFlashTime > 0) {
    ctx.fillStyle = "rgba(255,0,0,0.25)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  drawHud(ctx);
  if (gameState === "finished") drawFinishScreen(ctx);
  if (gameState === "gameover") {
    titleTime += dt;
    drawGameOverScreen(ctx, titleTime);
  }
  if (gameState === "paused") drawPauseScreen(ctx);

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
