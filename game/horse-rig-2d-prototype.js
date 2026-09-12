"use strict";

// Exploration: procedural 2D horse rig prototype. Goal is to validate the
// "bones drive a skinned silhouette" approach visually (gait quality) before
// investing more time in the Blender extraction pipeline (explore-3 method,
// see CLAUDE.md). This is a throwaway JS-only stand-in for that pipeline:
// bone positions below are hand-picked from the reference silhouette
// instead of coming from a real armature, and skin weights are a simple
// nearest-bone/nearest-two-bones heuristic instead of Blender's Weight
// Paint. Kept in its own file per the project's exploration-phase rule —
// easy to delete if the approach doesn't pan out.
//
// Reference for the gait timing: the classic Muybridge 12-frame gallop
// cycle (4 legs, each with a stance phase then a swing/flight phase,
// staggered so front and back leg pairs are offset). Bone rotation
// formulas mirror horse-rig-skinned.js's legCycle() from the abandoned
// explore-3 3D unicorn game (same phase offsets/easing, no stored frames).

// ---- Bone skeleton (hand-authored 2D positions, standing/rest pose) ----
// Coordinates are in the same space as the reference SVG viewBox (226x195),
// horse facing left. Each bone: name, parent name (or null for root), head
// position [x,y]. Angles animate around the head point.
var HORSE_BONES_2D = [
  { name: "root",         parent: null,        head: [110, 100] },
  { name: "spine",        parent: "root",      head: [110, 100] },
  { name: "neck",         parent: "spine",     head: [70, 75] },
  { name: "head",         parent: "neck",      head: [35, 55] },

  { name: "thigh.B",      parent: "spine",     head: [165, 115] }, // back leg, hip
  { name: "shin.B",       parent: "thigh.B",   head: [160, 150] },
  { name: "hoof.B",       parent: "shin.B",    head: [155, 180] },

  { name: "thigh.F",      parent: "spine",     head: [65, 115] },  // front leg, shoulder
  { name: "shin.F",       parent: "thigh.F",   head: [55, 150] },
  { name: "hoof.F",       parent: "shin.F",    head: [48, 180] },

  // Second pair (far-side legs), same rest positions, animated with a
  // phase offset — this is the standard "4 legs, 2 silhouette leg-shapes
  // drawn twice" cheat used in horse-2d-outline.js too.
  { name: "thigh.B2",     parent: "spine",     head: [140, 112] },
  { name: "shin.B2",      parent: "thigh.B2",  head: [135, 148] },
  { name: "hoof.B2",      parent: "shin.B2",   head: [130, 180] },

  { name: "thigh.F2",     parent: "spine",     head: [90, 112] },
  { name: "shin.F2",      parent: "thigh.F2",  head: [85, 148] },
  { name: "hoof.F2",      parent: "shin.F2",   head: [80, 180] },
];

function buildBoneRig2D(bones) {
  var byName = {};
  bones.forEach(function (b) {
    byName[b.name] = {
      def: b,
      localAngle: 0,
      worldPos: b.head.slice(),
      worldAngle: 0,
    };
  });
  return {
    byName: byName,
    order: bones.map(function (b) { return b.name; }),
  };
}

// Recompute world position/angle for every bone from current localAngle,
// walking parent->child so a hip rotation carries the whole leg with it.
function updateBoneWorld2D(rig) {
  rig.order.forEach(function (name) {
    var bone = rig.byName[name];
    var parentName = bone.def.parent;
    if (!parentName) {
      bone.worldPos = bone.def.head.slice();
      bone.worldAngle = bone.localAngle;
      return;
    }
    var parent = rig.byName[parentName];
    var relX = bone.def.head[0] - parent.def.head[0];
    var relY = bone.def.head[1] - parent.def.head[1];
    var cos = Math.cos(parent.worldAngle);
    var sin = Math.sin(parent.worldAngle);
    bone.worldPos = [
      parent.worldPos[0] + relX * cos - relY * sin,
      parent.worldPos[1] + relX * sin + relY * cos,
    ];
    bone.worldAngle = parent.worldAngle + bone.localAngle;
  });
}

// ---- Gait cycle, same shape as horse-rig-skinned.js's legCycle/animate ----
var LEGS_2D = [
  { thigh: "thigh.B",  shin: "shin.B",  hoof: "hoof.B",  phase: 0.00 },
  { thigh: "thigh.F",  shin: "shin.F",  hoof: "hoof.F",  phase: 0.55 },
  { thigh: "thigh.B2", shin: "shin.B2", hoof: "hoof.B2", phase: 0.10 },
  { thigh: "thigh.F2", shin: "shin.F2", hoof: "hoof.F2", phase: 0.45 },
];
var STANCE_RATIO = 0.4;
var SWING = 0.55;
var KNEE_BEND = 1.0;

function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

function legCycle2D(t, phaseOffset) {
  var lt = (t + phaseOffset) % 1;
  if (lt < 0) lt += 1;
  if (lt < STANCE_RATIO) {
    var stanceT = lt / STANCE_RATIO;
    return { lift: 0, swing: SWING - SWING * 2 * stanceT };
  }
  var flightT = (lt - STANCE_RATIO) / (1 - STANCE_RATIO);
  return {
    lift: Math.sin(flightT * Math.PI),
    swing: -SWING + SWING * 2 * easeInOut(flightT),
  };
}

function animateGait2D(rig, time, speed) {
  var t = time * speed;
  var backLift = 0;
  LEGS_2D.forEach(function (leg, i) {
    var cycle = legCycle2D(t, leg.phase);
    rig.byName[leg.thigh].localAngle = cycle.swing;
    rig.byName[leg.shin].localAngle = -Math.max(cycle.lift, 0) * KNEE_BEND;
    if (i < 2) backLift += cycle.lift;
  });
  var bounce = backLift * 3;
  rig.byName.spine.localAngle = Math.sin(t * 2 * Math.PI) * 0.02;
  rig.byName.root.def.head = [110, 100 - bounce];
  updateBoneWorld2D(rig);
}

// ---- Skin: silhouette points pulled from the reference SVG, each pinned
// to whichever bone owns that body region (nearest-bone heuristic, a
// stand-in for Blender's painted weights). Only the leg regions actually
// move with the gait in this prototype; the body/head silhouette is drawn
// as a static shape anchored to the spine, since the goal here is to prove
// the leg-cycle motion reads well, not a full skin solve. ----
function nearestBone2D(rig, boneNames, x, y) {
  var best = null, bestDist = Infinity;
  boneNames.forEach(function (name) {
    var b = rig.byName[name].def.head;
    var d = Math.hypot(b[0] - x, b[1] - y);
    if (d < bestDist) { bestDist = d; best = name; }
  });
  return best;
}

function drawHorseRig2D(ctx, rig, img, x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Static body silhouette (image), anchored to spine bounce only.
  ctx.save();
  ctx.translate(0, (rig.byName.root.worldPos[1] - 100));
  ctx.drawImage(img, 0, 0, 226, 195);
  ctx.restore();

  // Animated leg bones drawn as simple segments over the silhouette so the
  // gait motion is directly visible against the static body.
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(139,94,60,0.9)";
  LEGS_2D.forEach(function (leg) {
    var hip = rig.byName[leg.thigh];
    var knee = rig.byName[leg.shin];
    var hoof = rig.byName[leg.hoof];
    ctx.beginPath();
    ctx.moveTo(hip.worldPos[0], hip.worldPos[1]);
    ctx.lineTo(knee.worldPos[0], knee.worldPos[1]);
    ctx.lineTo(hoof.worldPos[0], hoof.worldPos[1]);
    ctx.stroke();
  });

  ctx.restore();
}
