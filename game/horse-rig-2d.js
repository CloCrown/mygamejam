"use strict";

// Runtime 2D skinned rig, built from HORSE_BONES_2D_DATA / HORSE_SKIN_2D
// (horse-mesh-2d.js, generated — see exploration/extract_horse_rig_2d.py
// and exploration/generate_horse_mesh_2d_js.js). This replaces the
// hand-picked bone positions in the earlier horse-rig-2d-prototype.js now
// that a real Blender-authored rig + Automatic Weights export exists.
//
// Same model as explore-3's horse-rig-skinned.js (3D unicorn, abandoned
// concept, see CLAUDE.md): a scene-graph of bones animated every frame by
// pure periodic functions (no stored keyframes), then linear-blend skinning
// reprojects every silhouette point from its 1-2 influencing bones. Only
// difference here is 2D instead of 3D — positions/rotations are (x,y)+angle
// instead of full 3D matrices.

function buildHorseRig2D() {
  var bones = HORSE_BONES_2D_DATA;
  var numBones = bones.length;

  // Bind-pose local offset of each bone's head relative to its parent's
  // head - this is what a bone rotation pivots around.
  var localOffset = new Array(numBones);
  for (var i = 0; i < numBones; i++) {
    var b = bones[i];
    if (b.parent < 0) {
      localOffset[i] = [b.head[0], b.head[1]];
    } else {
      var p = bones[b.parent];
      localOffset[i] = [b.head[0] - p.head[0], b.head[1] - p.head[1]];
    }
  }

  var localAngle = new Float32Array(numBones);
  var worldX = new Float32Array(numBones);
  var worldY = new Float32Array(numBones);
  var worldAngle = new Float32Array(numBones);
  var worldCos = new Float32Array(numBones);
  var worldSin = new Float32Array(numBones);

  var byName = {};
  bones.forEach(function (b, i) { byName[b.name] = i; });

  var rig = { rootOffsetY: 0 };

  function updateWorld() {
    for (var i = 0; i < numBones; i++) {
      var parent = bones[i].parent;
      var ox = localOffset[i][0], oy = localOffset[i][1];
      if (parent < 0) {
        worldX[i] = ox;
        worldY[i] = oy + rig.rootOffsetY;
        worldAngle[i] = localAngle[i];
      } else {
        var cos = worldCos[parent], sin = worldSin[parent];
        worldX[i] = worldX[parent] + ox * cos - oy * sin;
        worldY[i] = worldY[parent] + ox * sin + oy * cos;
        worldAngle[i] = worldAngle[parent] + localAngle[i];
      }
      worldCos[i] = Math.cos(worldAngle[i]);
      worldSin[i] = Math.sin(worldAngle[i]);
    }
  }
  updateWorld();

  // Bind-pose world position of every bone head, needed to compute each
  // vertex's offset from its influencing bone(s) once, up front.
  var bindX = worldX.slice();
  var bindY = worldY.slice();

  var skin = HORSE_SKIN_2D;
  var numVerts = skin.positions.length / 2;
  var skinnedPositions = new Float32Array(skin.positions.length);

  // Precompute each vertex's offset from its bone(s) bind position, in the
  // bone's bind orientation frame (inverse rotate), so updateSkin() only
  // needs to re-rotate by the bone's *current* angle each frame.
  var localVX = new Float32Array(numVerts * 2); // offset from boneA, in boneA's bind frame
  var localVY = new Float32Array(numVerts * 2);
  for (var v = 0; v < numVerts; v++) {
    var px = skin.positions[v * 2], py = skin.positions[v * 2 + 1];
    var a = skin.boneA[v];
    var dxA = px - bindX[a], dyA = py - bindY[a];
    var cosA = worldCos[a], sinA = worldSin[a];
    // inverse-rotate by bind angle: local = R(-angle) * delta
    localVX[v * 2] = dxA * cosA + dyA * sinA;
    localVY[v * 2] = -dxA * sinA + dyA * cosA;

    var b = skin.boneB[v];
    if (b >= 0) {
      var dxB = px - bindX[b], dyB = py - bindY[b];
      var cosB = worldCos[b], sinB = worldSin[b];
      localVX[v * 2 + 1] = dxB * cosB + dyB * sinB;
      localVY[v * 2 + 1] = -dxB * sinB + dyB * cosB;
    }
  }

  function updateSkin() {
    for (var v = 0; v < numVerts; v++) {
      var a = skin.boneA[v], wa = skin.weightA[v];
      var cosA = worldCos[a], sinA = worldSin[a];
      var lax = localVX[v * 2], lay = localVY[v * 2];
      var ax = worldX[a] + lax * cosA - lay * sinA;
      var ay = worldY[a] + lax * sinA + lay * cosA;

      var x = ax * wa, y = ay * wa;
      var b = skin.boneB[v], wb = skin.weightB[v];
      if (b >= 0 && wb > 0) {
        var cosB = worldCos[b], sinB = worldSin[b];
        var lbx = localVX[v * 2 + 1], lby = localVY[v * 2 + 1];
        var bx = worldX[b] + lbx * cosB - lby * sinB;
        var by = worldY[b] + lbx * sinB + lby * cosB;
        x += bx * wb;
        y += by * wb;
      }
      skinnedPositions[v * 2] = x;
      skinnedPositions[v * 2 + 1] = y;
    }
  }

  rig.byName = byName;
  rig.localAngle = localAngle;
  rig.worldX = worldX;
  rig.worldY = worldY;
  rig.updateWorld = updateWorld;
  rig.updateSkin = updateSkin;
  rig.skinnedPositions = skinnedPositions;
  rig.indices = skin.indices;
  rig.boneA = skin.boneA;
  rig.boneB = skin.boneB;
  rig.weightA = skin.weightA;
  rig.weightB = skin.weightB;
  return rig;
}

// Splits rig.indices into a triangle list per named group (each group: a
// list of bone names whose skinned triangles belong to it), plus a
// "body" list for everything left over. Each vertex is assigned to
// whichever of its (up to 2) influencing bones has the higher blend
// weight - boneA is Blender's vertex-group insertion order, not weight
// order, so a vertex can easily have boneB as its true dominant influence
// (e.g. most of "head" is boneA=neck/boneB=head with head's weight
// higher). A triangle belongs to a group only if all 3 of its vertices'
// dominant bone is in that group. Groups are checked in order, so list
// more specific groups (e.g. just the toe bones) before broader ones
// (e.g. the whole leg) if a triangle could match both.
//
// Originally just a body/legs split so the renderer could draw the body
// once and the legs twice (near + far phase) instead of duplicating the
// whole horse - drawing the whole silhouette twice is what produced the
// "two ghost horses" look when this was first tried. Generalized to
// arbitrary named groups to let a subset of a leg (e.g. just the hooves)
// be colored differently from the rest of it.
function splitTrianglesByBoneGroups(rig, groups) {
  var groupBoneSets = groups.map(function (g) {
    var set = {};
    g.bones.forEach(function (name) { set[rig.byName[name]] = true; });
    return set;
  });
  var result = { body: [] };
  groups.forEach(function (g) { result[g.name] = []; });

  var numVerts = rig.boneA.length;
  var dominantBone = new Int32Array(numVerts);
  for (var v = 0; v < numVerts; v++) {
    var b = rig.boneB[v];
    dominantBone[v] = (b >= 0 && rig.weightB[v] > rig.weightA[v]) ? b : rig.boneA[v];
  }

  var idx = rig.indices;
  for (var t = 0; t < idx.length; t += 3) {
    var ia = idx[t], ib = idx[t + 1], ic = idx[t + 2];
    var matched = false;
    for (var g = 0; g < groups.length; g++) {
      var set = groupBoneSets[g];
      if (set[dominantBone[ia]] && set[dominantBone[ib]] && set[dominantBone[ic]]) {
        result[groups[g].name].push(ia, ib, ic);
        matched = true;
        break;
      }
    }
    if (!matched) result.body.push(ia, ib, ic);
  }

  Object.keys(result).forEach(function (key) {
    result[key] = new Uint16Array(result[key]);
  });
  return result;
}

// Back-compat wrapper for the original 2-group (body/legs) call shape.
function splitBodyAndLegTriangles(rig, legBoneNames) {
  var split = splitTrianglesByBoneGroups(rig, [{ name: "legs", bones: legBoneNames }]);
  return { body: split.body, legs: split.legs };
}

// ---- Gait cycle: identical shape to horse-rig-skinned.js's legCycle/animate
// (explore-3), just applied to this 2D bone set.
//
// Only 2 leg *shapes* exist in the mesh (thigh.L/front_thigh.L, see CLAUDE.md
// decision "2 pattes d'abord" and "reutiliser les 2 formes existantes" for
// the far pair) - the far-side pair is drawn by animating a *second* rig
// instance (same mesh/bones, see buildFarLegPhaseOffset below) with a phase
// offset, then rendering it behind the near rig with a small visual offset,
// same cheat horse-2d-outline.js's 4 leg() calls already use.
var LEGS_2D_RIG = [
  { thigh: "thigh.L", shin: "foot.L", toe: "toe.L", phase: 0.0 },
  { thigh: "front_thigh.L", shin: "front_foot.L", toe: "front_toe.L", phase: 0.5 },
];
// Extra phase added on top of the above when animating the far-side rig
// instance, so the far legs don't move in lockstep with the near ones.
var FAR_LEG_PHASE_OFFSET_2D = 0.25;
var STANCE_RATIO_2D = 0.4;
var SWING_2D = 0.5;
var KNEE_BEND_2D = 0.8;

function easeInOut2D(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

function legCycle2DRig(t, phaseOffset) {
  var lt = (t + phaseOffset) % 1;
  if (lt < 0) lt += 1;
  if (lt < STANCE_RATIO_2D) {
    var stanceT = lt / STANCE_RATIO_2D;
    return { lift: 0, swing: SWING_2D - SWING_2D * 2 * stanceT };
  }
  var flightT = (lt - STANCE_RATIO_2D) / (1 - STANCE_RATIO_2D);
  return {
    lift: Math.sin(flightT * Math.PI),
    swing: -SWING_2D + SWING_2D * 2 * easeInOut2D(flightT),
  };
}

// Root bounce + neck lag + tail wave, same model as horse-rig-skinned.js's
// animate() in explore-3: the body bob comes from how much lift the legs
// have at each instant, the head trails that bounce by a short phase delay
// instead of reacting instantly, and the tail chain gets a constant per-link
// bend so it reads as trailing rather than rigid.
var TAIL_CHAIN_2D = ["tail.001", "tail.002"];

// Idle pose: legs straight/vertical (localAngle 0, not "gait cycle frozen at
// t=0" which happened to land mid-stride - see CLAUDE.md/game-platformer.html
// discussion of the standing pose looking off). Tail/neck keep a small sway
// so standing still doesn't read as a static image.
function animateHorseRig2DIdle(rig, time) {
  LEGS_2D_RIG.forEach(function (leg) {
    rig.localAngle[rig.byName[leg.thigh]] = 0;
    rig.localAngle[rig.byName[leg.shin]] = 0;
  });
  rig.rootOffsetY = 0;
  rig.localAngle[rig.byName["spine.001"]] = 0;
  rig.localAngle[rig.byName.neck] = Math.sin(time * 1.2) * 0.03;
  var tailLiftPerLink = 0.35;
  TAIL_CHAIN_2D.forEach(function (name) {
    rig.localAngle[rig.byName[name]] = tailLiftPerLink + Math.sin(time * 1.5) * 0.05;
  });
  rig.updateWorld();
  rig.updateSkin();
}

function animateHorseRig2D(rig, time, speed, extraPhase) {
  if (!speed) {
    animateHorseRig2DIdle(rig, time);
    return;
  }
  var t = time * speed;
  var phase = extraPhase || 0;
  var totalLift = 0;
  LEGS_2D_RIG.forEach(function (leg) {
    var cycle = legCycle2DRig(t, leg.phase + phase);
    rig.localAngle[rig.byName[leg.thigh]] = cycle.swing;
    rig.localAngle[rig.byName[leg.shin]] = Math.max(cycle.lift, 0) * KNEE_BEND_2D;
    totalLift += cycle.lift;
  });

  var bounce = totalLift * 0.004; // meters, small since the rig is ~0.1 units tall
  rig.rootOffsetY = bounce;

  var spine001 = rig.byName["spine.001"];
  rig.localAngle[spine001] = bounce * 2;

  var neckLagC = (t - 0.05) * 2 * Math.PI;
  rig.localAngle[rig.byName.neck] = Math.sin(neckLagC) * 0.12;

  var tailLiftPerLink = 0.35;
  TAIL_CHAIN_2D.forEach(function (name) {
    rig.localAngle[rig.byName[name]] = tailLiftPerLink + Math.sin(t * 2 * Math.PI) * 0.15;
  });

  rig.updateWorld();
  rig.updateSkin();
}

// Jump pose. First attempt (front legs tucked, back legs trailing, based on
// a gallop-leap reference sheet) didn't read as "jumping" in the game - a
// platformer jump silhouette reads better with front legs reaching forward
// and up (like reaching for the landing) and back legs tucked under the
// body, so this is the opposite leg arrangement from the first attempt.
// A single fixed pose blended in by jumpBlend (0 = pure gait, 1 = full jump
// pose), same mechanism as before.
var JUMP_POSE_2D = {
  "front_thigh.L": -0.9,
  "front_foot.L": -0.3,
  "thigh.L": 0.7,
  "foot.L": 0.9,
  "spine.001": 0.15,
  // Neck sits at ~138deg from horizontal at rest (mostly vertical, tilted
  // back - see exploration/horse_rig_2d.json bind pose); this stretches it
  // forward/down during a jump, same "extend from rest" idea as the tail.
  // Negative rotated it up instead - flipped to positive.
  neck: 0.6,
  head: 0.3,
  // Tail hangs near-vertical at rest (~-84deg/-87deg from horizontal, see
  // exploration/horse_rig_2d.json bind pose). Full horizontal (~1.47/1.52
  // rad) read as too extreme in-game; this is about halfway there, enough
  // to trail up and back during a jump without looking snapped flat.
  "tail.001": 0.75,
  "tail.002": 0.75,
};

function animateHorseRig2DWithJump(rig, time, speed, extraPhase, jumpBlend) {
  animateHorseRig2D(rig, time, speed, extraPhase);
  if (!jumpBlend) return;
  var blend = Math.min(Math.max(jumpBlend, 0), 1);
  Object.keys(JUMP_POSE_2D).forEach(function (name) {
    var i = rig.byName[name];
    rig.localAngle[i] = rig.localAngle[i] * (1 - blend) + JUMP_POSE_2D[name] * blend;
  });
  rig.updateWorld();
  rig.updateSkin();
}
