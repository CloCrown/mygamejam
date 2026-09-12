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
  { label: "Play", action: function () { gameState = "playing"; Audio_.startMusic(); } },
  { label: "Options", action: function () { gameState = "options"; } },
  { label: "Quit", action: function () {} },
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
var OPTIONS_ACTIONS = ["left", "right", "jump", "activate", "fire"];
var OPTIONS_LABELS = { left: "Left", right: "Right", jump: "Jump", activate: "Activate horn", fire: "Fire" };
// "volume" is an extra row after the rebindable actions - adjusted with
// Left/Right instead of entering "listening" mode like the others (see
// awaitingBindFor handling below, which volume skips).
var OPTIONS_ROWS = OPTIONS_ACTIONS.concat(["volume"]);
var VOLUME_STEP = 0.1;
var optionsIndex = 0;
var optionsEntryRects = [];
var awaitingBindFor = null;

// Display label for a freshly-pressed key: e.key reflects the user's own
// keyboard layout (e.g. "q" on AZERTY for the same physical key QWERTY
// calls "a"), unlike e.code which is layout-independent - see
// player-2d.js's KEY_BINDINGS comment for why both are needed.
function keyEventToLabel(e) {
  if (e.code === "Space") return "Space";
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
    var onVolumeRow = OPTIONS_ROWS[optionsIndex] === "volume";
    if (e.code === "ArrowUp") optionsIndex = (optionsIndex - 1 + OPTIONS_ROWS.length) % OPTIONS_ROWS.length;
    else if (e.code === "ArrowDown") optionsIndex = (optionsIndex + 1) % OPTIONS_ROWS.length;
    else if (onVolumeRow && e.code === "ArrowLeft") Audio_.setVolume(Audio_.getVolume() - VOLUME_STEP);
    else if (onVolumeRow && e.code === "ArrowRight") Audio_.setVolume(Audio_.getVolume() + VOLUME_STEP);
    else if (!onVolumeRow && (e.code === "Space" || e.code === "Enter")) awaitingBindFor = OPTIONS_ROWS[optionsIndex];
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
        if (OPTIONS_ROWS[j] !== "volume") awaitingBindFor = OPTIONS_ROWS[j];
        return;
      }
    }
  } else if (gameState === "gameover") {
    resetGame();
    gameState = "title";
  }
});

var rig = buildHorseRig2D();
rig.updateWorld();
rig.updateSkin();

// Body-part zones for independently colored regions, classified by each
// triangle's centroid position in bind-pose mesh-local space (not by which
// bone its vertices are weighted to - see mesh-split-debug.html, an
// interactive tool kept in this repo for re-tuning these bounds visually).
// Splitting by bone weight left gaps: most of a limb's visible triangles
// near the hip/shoulder are actually dominantly weighted to the torso
// bones in the current Blender export, not to the limb bones, so a
// bone-based split of "thighs" recovered only a handful of sliver
// triangles instead of the full limb shape. Zone bounds were tuned by eye
// in mesh-split-debug.html against this exact mesh export - if the mesh
// changes (re-export from Blender), re-tune there and paste the new
// bounds back in.
var HORSE_ZONES = [
  { name: "toe", color: "#3d7fb8", xMin: 0.21, xMax: 0.38, yMin: 0.03, yMax: 0.15 },
  { name: "frontToe", color: "#1a3f5c", xMin: -0.39, xMax: -0.1, yMin: 0.03, yMax: 0.15 },
  { name: "foot", color: "#e08030", xMin: -0.39, xMax: -0.1, yMin: 0.15, yMax: 0.31 },
  { name: "frontFoot", color: "#8a4c1a", xMin: 0.1, xMax: 0.45, yMin: 0.15, yMax: 0.31 },
  { name: "thighs", color: "#ffb347", xMin: -0.53, xMax: 0.45, yMin: 0.31, yMax: 0.47 },
  { name: "tail", color: "#00aa00", xMin: 0.44, xMax: 0.8, yMin: 0.1, yMax: 0.99 },
  { name: "neck", color: "#cccc00", xMin: -0.32, xMax: -0.1, yMin: 0.75, yMax: 0.99 },
  { name: "head", color: "#00aaaa", xMin: -0.53, xMax: -0.35, yMin: 0.745, yMax: 0.92 },
  { name: "horn", color: "#ff6699", xMin: -0.53, xMax: -0.325, yMin: 0.92, yMax: 0.994 },
];
var BODY_COLOR = "#c98a52";

// Classifies each triangle by its bind-pose centroid, not by skinned
// (animated) position - so the split is stable regardless of pose, same
// approach as mesh-split-debug.html's computeZoneSplit(). A triangle falls
// in the first zone (in list order) whose box contains its centroid;
// anything unmatched stays in "body" (the implicit leftover group, mostly
// torso).
function splitTrianglesByZones(rig, zones) {
  var pos = HORSE_SKIN_2D.positions;
  var idx = rig.indices;
  var result = { body: [] };
  zones.forEach(function (z) { result[z.name] = []; });
  for (var t = 0; t < idx.length; t += 3) {
    var ia = idx[t], ib = idx[t + 1], ic = idx[t + 2];
    var cx = (pos[ia * 2] + pos[ib * 2] + pos[ic * 2]) / 3;
    var cy = (pos[ia * 2 + 1] + pos[ib * 2 + 1] + pos[ic * 2 + 1]) / 3;
    var matched = false;
    for (var z = 0; z < zones.length; z++) {
      var zn = zones[z];
      if (cx >= zn.xMin && cx <= zn.xMax && cy >= zn.yMin && cy <= zn.yMax) {
        result[zn.name].push(ia, ib, ic);
        matched = true;
        break;
      }
    }
    if (!matched) result.body.push(ia, ib, ic);
  }
  Object.keys(result).forEach(function (k) { result[k] = new Uint16Array(result[k]); });
  return result;
}
var meshSplit = splitTrianglesByZones(rig, HORSE_ZONES);

// Precomputes every mesh edge that sits between two different zones (the
// same seams visible as thin lines on the flat-colored horse - each zone
// is its own fill() call, so canvas antialiasing leaves a hairline gap at
// every zone boundary). Recolored to the active horn's color while a
// power-up is active, drawn over the normal fill - see drawZoneBoundaries
// in drawHorse below. Computed once here (bind-pose topology doesn't
// change at runtime), not per frame.
function computeZoneBoundaryEdges(rig, zoneOfTriangle) {
  var idx = rig.indices;
  var edgeZones = {}; // edge key -> zone name of the first triangle seen owning it
  var boundary = [];
  for (var t = 0; t < idx.length; t += 3) {
    var zone = zoneOfTriangle[t / 3];
    var tri = [idx[t], idx[t + 1], idx[t + 2]];
    for (var e = 0; e < 3; e++) {
      var a = tri[e], b = tri[(e + 1) % 3];
      var key = a < b ? a + "_" + b : b + "_" + a;
      if (key in edgeZones) {
        if (edgeZones[key] !== zone) boundary.push(a, b);
        edgeZones[key] = null; // seen twice - never boundary again even if a 3rd triangle shares it
      } else {
        edgeZones[key] = zone;
      }
    }
  }
  return boundary;
}
// zoneOfTriangle[i] = zone name of the i-th triangle in rig.indices, built
// by inverting meshSplit's per-zone triangle-index lists.
var zoneOfTriangle = (function () {
  var map = {};
  Object.keys(meshSplit).forEach(function (zoneName) {
    var idx = meshSplit[zoneName];
    for (var t = 0; t < idx.length; t += 3) {
      map[idx[t] + "_" + idx[t + 1] + "_" + idx[t + 2]] = zoneName;
    }
  });
  var result = [];
  var full = rig.indices;
  for (var t2 = 0; t2 < full.length; t2 += 3) {
    result.push(map[full[t2] + "_" + full[t2 + 1] + "_" + full[t2 + 2]]);
  }
  return result;
})();
var ZONE_BOUNDARY_EDGES = computeZoneBoundaryEdges(rig, zoneOfTriangle);

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

// ---- Horn power-up state: each active/timed effect below is independent
// (multiple can be active at once, e.g. speed boost while shrunk) rather
// than a single "current effect" slot, since nothing here requires them to
// be mutually exclusive. Durations decremented in loop(). ----
var fireReady = false; // red: next "I" press fires a projectile, no timer
var superJumpReady = false; // orange: next jump is a super jump, no timer
var speedBoostTime = 0; // blue
var SPEED_BOOST_DURATION = 5;
var SPEED_BOOST_MULTIPLIER = 1.8;
var shrinkTime = 0; // indigo
var SHRINK_DURATION = 5;
var SHRINK_SCALE = 0.55;
var hornInvincibleTime = 0; // yellow: separate from the post-hit invulnerableTime
var HORN_INVINCIBLE_DURATION = 5;
var SUPER_JUMP_MULTIPLIER = 1.5;
var projectiles = []; // { x, y, w, h, vx }, red horn's fired shots
var PROJECTILE_SPEED = 900;
var PROJECTILE_SIZE = 20;
var wasFireDown = false;

// ---- Horn power-up registry: one entry per HORN_COLORS index (same order,
// see horn-item-2d.js). Each `apply` runs once when that horn is consumed
// (E key). `zone` (a key into meshSplit, or null) is the body-part region
// drawHorse recolors with that horn's color while the matching state above
// is active - see the "while active" checks in drawHorse. Violet has no
// effect yet - not designed, left as a no-op placeholder like the others
// were, see CLAUDE.md "Périmètre par tâche".
var HORN_EFFECTS = [
  {
    name: "rouge", zone: "horn",
    apply: function () { fireReady = true; },
  },
  {
    name: "orange", zone: "thighs",
    apply: function () { superJumpReady = true; },
  },
  {
    name: "jaune", zone: "horn",
    apply: function () { hornInvincibleTime = HORN_INVINCIBLE_DURATION; },
  },
  {
    name: "vert", zone: null,
    apply: function () { lives = Math.min(lives + 1, MAX_LIVES); },
  },
  {
    name: "bleu", zone: "toe",
    apply: function () { speedBoostTime = SPEED_BOOST_DURATION; },
  },
  {
    name: "indigo", zone: "head",
    apply: function () { shrinkTime = SHRINK_DURATION; },
  },
  { name: "violet", zone: null, apply: function () {} },
];

// Index into HORN_COLORS of the most recently activated horn - drives
// which color the zone-boundary lines show (see activeHornColor below)
// when more than one effect is active at once (e.g. red armed to fire,
// then blue's speed boost activated on top of it): the newest activation
// wins the display, even though the older effect is still running.
var lastActivatedHorn = -1;

// Consumes the owned horn on a fresh press of the activate key (edge-detect
// against wasActivateDown so holding the key doesn't retrigger every
// frame), then runs that color's HORN_EFFECTS entry.
function updateHornActivation() {
  var down = player.keys.activate;
  if (down && !wasActivateDown && ownedHorn >= 0) {
    Audio_.play("effectActivate");
    HORN_EFFECTS[ownedHorn].apply();
    lastActivatedHorn = ownedHorn;
    ownedHorn = -1;
  }
  wasActivateDown = down;
}

// Red horn's shot: fires from the player's facing edge, travels straight,
// destroys the first monster it touches. Uses the rebindable "fire" action
// (default I, see player-2d.js's DEFAULT_KEY_BINDINGS/OPTIONS_ACTIONS
// above) like activate/jump/etc.
function updateFiring() {
  var fireKeyDown = player.keys.fire;
  if (fireKeyDown && !wasFireDown && fireReady) {
    var dir = player.facingRight ? 1 : -1;
    projectiles.push({
      x: player.x + (player.facingRight ? player.w : -PROJECTILE_SIZE),
      y: player.y + player.h / 2 - PROJECTILE_SIZE / 2,
      w: PROJECTILE_SIZE, h: PROJECTILE_SIZE,
      vx: PROJECTILE_SPEED * dir,
    });
    fireReady = false;
  }
  wasFireDown = fireKeyDown;
}

function updateProjectiles(dt) {
  for (var i = projectiles.length - 1; i >= 0; i--) {
    var p = projectiles[i];
    p.x += p.vx * dt;
    var hit = false;
    for (var j = monsters.length - 1; j >= 0; j--) {
      if (aabbOverlap(p, monsters[j])) {
        monsters.splice(j, 1);
        hit = true;
        break;
      }
    }
    if (hit || p.x < camX - 50 || p.x > camX + canvas.width + 50) {
      projectiles.splice(i, 1);
    }
  }
}

function drawProjectiles(ctx) {
  ctx.fillStyle = "#e0463f";
  projectiles.forEach(function (p) {
    ctx.beginPath();
    ctx.arc(p.x - camX + p.w / 2, p.y + p.h / 2, p.w / 2, 0, Math.PI * 2);
    ctx.fill();
  });
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
  if (invulnerableTime > 0 || hornInvincibleTime > 0) return;
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

// True while the effect for the given HORN_COLORS index is still running -
// used both to pick the zone-boundary highlight color (activeHornColor
// below) and as the fallback scan when the most recently activated horn's
// own effect has already ended.
function isHornEffectActive(colorIndex) {
  switch (colorIndex) {
    case 0: return fireReady;
    case 1: return superJumpReady;
    case 2: return hornInvincibleTime > 0;
    case 4: return speedBoostTime > 0;
    case 5: return shrinkTime > 0;
    default: return false; // green/violet: instant or no effect, never "active"
  }
}

// Zone (see HORSE_ZONES/meshSplit) -> color for every currently-active horn
// effect's own body-part region (HORN_EFFECTS[i].zone), filled solid in
// drawHorse - e.g. red keeps the "horn" (ears) zone red for as long as
// fireReady stays true. Independent from activeHornColor's zone-boundary
// highlight below: several effects' zones can be filled at once (each in
// its own color), while the boundary-line highlight only ever shows one.
function activeZoneFills() {
  var fills = {};
  for (var i = 0; i < HORN_EFFECTS.length; i++) {
    if (HORN_EFFECTS[i].zone && isHornEffectActive(i)) {
      fills[HORN_EFFECTS[i].zone] = HORN_COLORS[i];
    }
  }
  return fills;
}

// Which horn color to highlight the horse's zone-boundary lines with right
// now (see ZONE_BOUNDARY_EDGES/drawZoneBoundaries), from the horn power-up
// states in loop() - reverts to null (no highlight) automatically as soon
// as the active effect ends/is consumed, no separate timer needed here.
// Several effects can be active at once (e.g. red armed to fire while
// blue's speed boost also runs) - the most recently activated one wins the
// display (see lastActivatedHorn), falling back to scanning for any other
// still-active effect if that one has since ended.
function activeHornColor() {
  if (isHornEffectActive(lastActivatedHorn)) return HORN_COLORS[lastActivatedHorn];
  for (var i = 0; i < HORN_COLORS.length; i++) {
    if (isHornEffectActive(i)) return HORN_COLORS[i];
  }
  return null;
}

function drawHorse(ctx, screenX, screenY, facingRight, time) {
  var hornColor = activeHornColor();
  var zoneFill = activeZoneFills();
  ctx.save();
  ctx.translate(screenX, screenY);
  // Source mesh is authored facing left (see my_horse_side_view.svg /
  // horse-rig-2d-real-test.html) - flip when facing right instead of left.
  if (facingRight) ctx.scale(-1, 1);
  // Indigo horn: shrinks the whole horse visually (not player.w/h, so the
  // physics hitbox is unaffected - matches the original CLAUDE.md ROYGBIV
  // note that this effect wasn't fully speced, kept purely cosmetic here).
  var shrink = shrinkTime > 0 ? SHRINK_SCALE : 1;
  if (shrink !== 1) ctx.scale(shrink, shrink);

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

  // Draws every zone-boundary seam (see ZONE_BOUNDARY_EDGES above) in a
  // given color - these are the same hairline gaps visible between
  // body-part zones on the flat-colored horse, recolored to highlight
  // that a horn power-up is active anywhere on the horse.
  function drawZoneBoundaries(strokeColor) {
    var pos = rig.skinnedPositions;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (var i = 0; i < ZONE_BOUNDARY_EDGES.length; i += 2) {
      var a = ZONE_BOUNDARY_EDGES[i], b = ZONE_BOUNDARY_EDGES[i + 1];
      var pa = toScreen(pos[a * 2], pos[a * 2 + 1]);
      var pb = toScreen(pos[b * 2], pos[b * 2 + 1]);
      ctx.moveTo(pa[0], pa[1]);
      ctx.lineTo(pb[0], pb[1]);
    }
    ctx.stroke();
  }

  var speed = player.onGround && (player.keys.left || player.keys.right) ? 1.6 : 0;
  // Blend into the fixed jump pose while airborne; jumpBlend eases in/out
  // over ~0.15s around takeoff/landing instead of snapping, using onGround
  // as the on/off signal (see player-2d.js for jump/gravity handling).
  var jumpBlend = player.onGround ? 0 : 1;
  // Far pass: legs only (thigh+foot+toe zones), phase-shifted and slightly
  // offset to suggest depth, drawn once in a single flat leg color -
  // matches the original two-pass "near/far legs" look instead of
  // recoloring the far legs per zone too (that would look like 2 horses).
  animateHorseRig2DWithJump(rig, time, speed, FAR_LEG_PHASE_OFFSET_2D, jumpBlend);
  drawTris(meshSplit.thighs, -4, -2, zoneFill.thighs || "#a9713f");
  drawTris(meshSplit.foot, -4, -2, "#a9713f");
  drawTris(meshSplit.frontFoot, -4, -2, "#a9713f");
  drawTris(meshSplit.toe, -4, -2, zoneFill.toe || "#0d0d0d");
  drawTris(meshSplit.frontToe, -4, -2, zoneFill.toe || "#0d0d0d");

  // Near pass: every zone drawn separately (see HORSE_ZONES above). A zone
  // fills with its horn's color while that horn's own effect is active
  // (see activeZoneFills - e.g. "horn" stays red for as long as fireReady
  // is true), otherwise its normal color.
  animateHorseRig2DWithJump(rig, time, speed, 0, jumpBlend);
  drawTris(meshSplit.body, 0, 0, BODY_COLOR);
  drawTris(meshSplit.thighs, 0, 0, zoneFill.thighs || BODY_COLOR);
  drawTris(meshSplit.foot, 0, 0, BODY_COLOR);
  drawTris(meshSplit.frontFoot, 0, 0, BODY_COLOR);
  drawTris(meshSplit.tail, 0, 0, BODY_COLOR);
  drawTris(meshSplit.neck, 0, 0, BODY_COLOR);
  drawTris(meshSplit.head, 0, 0, zoneFill.head || BODY_COLOR);
  drawTris(meshSplit.horn, 0, 0, zoneFill.horn || BODY_COLOR);
  drawTris(meshSplit.toe, 0, 0, zoneFill.toe || "#1a1a1a");
  drawTris(meshSplit.frontToe, 0, 0, zoneFill.toe || "#1a1a1a");

  // While any horn power-up is active, every zone-boundary seam line on
  // the horse (see ZONE_BOUNDARY_EDGES) is traced in that horn's color, on
  // top of the normal fills above - drawn at the near pose only (matches
  // the near legs' position) so it doesn't double up with the far legs.
  if (hornColor) drawZoneBoundaries(hornColor);

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
    ctx.fillText("Horn collected!", boxX + boxSize, boxY + boxSize + 20);
    ctx.textAlign = "left";
  }
}

function drawFinishScreen(ctx) {
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "48px sans-serif";
  ctx.fillText("Finish!", canvas.width / 2, canvas.height / 2 - 20);
  ctx.font = "24px sans-serif";
  ctx.fillText("Collectibles: " + collected + " / " + (collected + level.collectibles.length), canvas.width / 2, canvas.height / 2 + 30);
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
  ctx.fillText("Esc to resume", canvas.width / 2, canvas.height / 2 + 30);
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
  if (blink) ctx.fillText("Press Space or click to return to the menu", canvas.width / 2, canvas.height / 2 + 30);
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
  ctx.fillText("Rainbow Hoof", canvas.width / 2, canvas.height * 0.26);

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
    KEY_BINDINGS.left.label + "/" + KEY_BINDINGS.right.label + ": run, arrow keys too",
    canvas.width / 2, controlsY
  );
  ctx.fillText(
    KEY_BINDINGS.jump.label + ": jump        " + KEY_BINDINGS.activate.label + ": activate horn",
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
  ctx.fillText("Key bindings - arrow keys always work as well", canvas.width / 2, canvas.height * 0.2 + 36);

  var rowHeight = 60;
  var startY = canvas.height * 0.2 + 110;
  var labelX = canvas.width / 2 - 140;
  var valueX = canvas.width / 2 + 140;
  optionsEntryRects = [];
  OPTIONS_ROWS.forEach(function (row, i) {
    var y = startY + i * rowHeight;
    var selected = i === optionsIndex;
    var isVolume = row === "volume";
    var listening = !isVolume && awaitingBindFor === row;

    ctx.textAlign = "left";
    ctx.font = selected ? "bold 24px sans-serif" : "22px sans-serif";
    ctx.fillStyle = selected ? "#f2d43d" : "#fff";
    ctx.fillText(isVolume ? "Volume" : OPTIONS_LABELS[row], labelX, y);

    ctx.textAlign = "right";
    if (isVolume) {
      // Simple filled-bar slider, same value range as Audio_.getVolume()
      // (0..1) - drawn instead of a numeric label to match the visual
      // style of a settings screen rather than raw text.
      var barW = 160, barH = 14;
      var barX = valueX - barW, barY = y - barH * 0.75;
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = selected ? "#f2d43d" : "#ccc";
      ctx.fillRect(barX, barY, barW * Audio_.getVolume(), barH);
    } else if (listening) {
      var blink = Math.sin(time * 6) > 0;
      ctx.fillStyle = "#e0463f";
      ctx.fillText(blink ? "Press a key..." : "", valueX, y);
    } else {
      ctx.fillStyle = selected ? "#f2d43d" : "#ccc";
      ctx.fillText(KEY_BINDINGS[row].label, valueX, y);
    }

    var rectH = rowHeight - 10;
    optionsEntryRects.push({ x: labelX - 10, y: y - rectH + 10, w: valueX - labelX + 20, h: rectH });
  });

  ctx.textAlign = "center";
  ctx.font = "16px sans-serif";
  ctx.fillStyle = "#ccc";
  ctx.fillText("Enter/click: rebind key        Left/Right: volume        Esc: back", canvas.width / 2, startY + OPTIONS_ROWS.length * rowHeight + 30);

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
    // Blue horn: scales the run speed updatePlayer just set, while active.
    if (speedBoostTime > 0 && player.vx !== 0) player.vx *= SPEED_BOOST_MULTIPLIER;
    // Orange horn: consumed on the next jump (edge-detected the same way
    // updatePlayer's own jump is - onGround gate already applied there).
    var jumpedThisFrame = player.keys.jump && player.onGround;
    if (jumpedThisFrame && superJumpReady) {
      player.vy *= SUPER_JUMP_MULTIPLIER;
      superJumpReady = false;
    }
    if (jumpedThisFrame) Audio_.play("jump");
    var solids = level.platforms.concat(level.obstacles);
    stepBody(player, solids, dt);
    player.x = Math.max(0, Math.min(player.x, level.width - player.w));
    if (!wasOnGround && player.onGround) Audio_.play("land");
    wasOnGround = player.onGround;

    monsters.forEach(function (m) { updateMonster(m, dt); });
    updateFiring();
    updateProjectiles(dt);

    collectPickups();
    updateHornActivation();
    checkObstacleHit();
    checkFinish();
    if (speedBoostTime > 0) speedBoostTime -= dt;
    if (shrinkTime > 0) shrinkTime -= dt;
    if (hitFlashTime > 0) hitFlashTime -= dt;
    if (hornPopupTime > 0) hornPopupTime -= dt;
    if (invulnerableTime > 0) invulnerableTime -= dt;
    if (hornInvincibleTime > 0) hornInvincibleTime -= dt;
    updateCamera();
  }

  drawBackground(ctx, canvas.width, canvas.height, camX, level.groundY);
  drawLevel(ctx);
  drawProjectiles(ctx);
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
