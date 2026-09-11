"use strict";

// Builds the low-poly horse's rig (buffers + scene-graph nodes) from the
// bone-skinned mesh chunks in horse-mesh.js, and returns a handle used to
// attach it to a parent node, animate it, and draw it.
//
// Every part is one bone of the source armature: a rigid mesh chunk with no
// smooth skinning/weights, rotating as a whole around its bone's rest-pose
// head. Parts form the armature's own multi-level chain (pelvis -> spine ->
// neck -> head, shoulder -> thigh -> shin -> foot -> toe per leg), so
// rotating a thigh carries its shin, foot and hoof with it.
function createHorseRig(gl) {
  var partNames = Object.keys(HORSE_PARTS);

  var objects = [];
  var nodeInfosByName = {};

  // The armature was authored facing +Z; the game's forward is -Z, so the
  // whole rig is turned 180 degrees here once instead of at every call site.
  var rootTrs = new TRS();
  rootTrs.rotation[1] = Math.PI;
  var root = new Node(rootTrs);

  // pivots are absolute, vertices are relative to their own pivot, so a
  // node's local translation is the step from its parent's pivot to its own.
  // Using the raw pivot here would compound every ancestor's offset.
  function makePartNode(name) {
    var part = HORSE_PARTS[name];
    var parentPivot = part.parent ? HORSE_PARTS[part.parent].pivot : [0, 0, 0];
    var trs = new TRS();
    trs.translation = [
      part.pivot[0] - parentPivot[0],
      part.pivot[1] - parentPivot[1],
      part.pivot[2] - parentPivot[2],
    ];
    var node = new Node(trs);
    nodeInfosByName[name] = { trs: trs, node: node };
    node.drawInfo = {
      uniforms: {
        u_colorOffset: [0, 0, 0, 0],
        u_colorMult: [1, 1, 1, 1],
      },
      bufferInfo: createHorsePartBufferInfo(gl, name),
    };
    objects.push(node);
    return node;
  }

  partNames.forEach(makePartNode);
  partNames.forEach(function(name) {
    var parent = HORSE_PARTS[name].parent;
    nodeInfosByName[name].node.setParent(parent ? nodeInfosByName[parent].node : root);
  });

  // Gallop leg-cycle model, same shape as unicorn-rig.js: 1 cycle = t 0..1
  // (looping), each leg offset within it. Real gallop order: back-left ->
  // back-right -> front-left -> front-right -> suspension.
  //
  // -Z is forward, so the head chain is spine.009 -> .010 -> .011 and the
  // tail chain is spine.003 -> .002 -> .001 -> spine, both hanging off the
  // geometry-less armature root alongside the pelvis at spine.005.
  var LEGS = [
    { thigh: "thigh.L", shin: "shin.L", phase: 0.00 },
    { thigh: "thigh.R", shin: "shin.R", phase: 0.10 },
    { thigh: "front_thigh.L", shin: "front_shin.L", phase: 0.45 },
    { thigh: "front_thigh.R", shin: "front_shin.R", phase: 0.55 },
  ];
  var STANCE_RATIO = 0.4; // fraction of cycle the hoof is planted vs airborne
  var SWING = 0.5;        // radians, leg swing amplitude fore/aft
  var KNEE_BEND = 0.9;    // radians, how far the knee/hock folds at full lift
  var BODY_PIVOT_Y = HORSE_PARTS["spine.005"].pivot[1];
  var TAIL_CHAIN = ["spine.003", "spine.002", "spine.001", "spine"];

  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  // Returns { lift, swing } for one leg at global cycle time `t`.
  function legCycle(t, phaseOffset) {
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

  // Advances the gallop animation. `gait` is 0..1 (0 = standing still).
  function animate(time, gait) {
    var speed = 1.6; // cycles per second at full gait
    var t = time * speed;

    var backLift = 0;
    var backRoll = 0;
    LEGS.forEach(function(leg, i) {
      var cycle = legCycle(t, leg.phase);
      nodeInfosByName[leg.thigh].trs.rotation[0] = cycle.swing * gait;
      // The knee folds only while the hoof is off the ground, which is what
      // reads as a gallop rather than four swinging sticks.
      nodeInfosByName[leg.shin].trs.rotation[0] = -cycle.lift * KNEE_BEND * gait;
      if (i < 2) {
        backLift += cycle.lift;
        backRoll += i === 0 ? -cycle.lift : cycle.lift;
      }
    });

    // Body rises on the back legs' push (peaks near suspension) and rolls
    // with the left/right stagger between them.
    var backBounce = backLift * 0.08 * gait;
    nodeInfosByName["spine.005"].trs.translation[1] = BODY_PIVOT_Y + backBounce;
    nodeInfosByName["spine.005"].trs.rotation[2] = backRoll * 0.1 * gait;

    var c = t * 2 * Math.PI;
    nodeInfosByName["spine.009"].trs.rotation[0] = -backBounce * 1.5 + Math.sin(c) * 0.08 * gait;

    // Tail wag, spread down the chain so the tip trails the base.
    var tailSway = Math.sin(c) * 0.12;
    TAIL_CHAIN.forEach(function(name, i) {
      nodeInfosByName[name].trs.rotation[1] = tailSway * Math.pow(0.7, i);
    });
  }

  return {
    root: root,
    objects: objects,
    nodeInfosByName: nodeInfosByName,
    animate: animate,
  };
}
