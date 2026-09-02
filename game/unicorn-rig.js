"use strict";

// Builds the unicorn's cube rig (buffers + scene-graph nodes) and returns a
// handle used to attach it to a parent node, animate it, and draw it.
//
// Rig convention: every joint that needs children AND its own visible box is
// split into a "pivot" node (draw:false, holds the translation/rotation the
// gait animates) plus a "-box" leaf child (draw:true, holds the scale that
// gives it its shape). This matters because a node's scale also stretches
// the local space its children are translated in - a pivot's own scale must
// stay [1,1,1] so a child joint's offset isn't warped by its parent's box
// size. Leaf parts with no children of their own (horn, ears, hooves,
// tail-tip, mane tufts) can set scale directly, no split needed.
function createUnicornRig(gl) {
  var bodyBufferInfo = createCubeBufferInfo(gl, 1, [0.95, 0.92, 0.98, 1]);
  var hornBufferInfo = createCubeBufferInfo(gl, 1, [1.0, 0.85, 0.3, 1]);
  var maneBufferInfo = createCubeBufferInfo(gl, 1, [0.85, 0.55, 0.95, 1]);
  var hoofBufferInfo = createCubeBufferInfo(gl, 1, [0.3, 0.25, 0.28, 1]);
  var torsoBufferInfo = { numElements: bodyBufferInfo.numElements, positionBuffer: null, colorBuffer: bodyBufferInfo.colorBuffer };
  {
    var s = 0.5, positions = [];
    var faces = [
      [[-s,-s, s],[ s,-s, s],[ s, s, s],[-s, s, s]],
      [[-s,-s,-s],[-s, s,-s],[ s, s,-s],[ s,-s,-s]],
      [[-s, s,-s],[-s, s, s],[ s, s, s],[ s, s,-s]],
      [[-s,-s,-s],[ s,-s,-s],[ s,-s, s],[-s,-s, s]],
      [[ s,-s,-s],[ s, s,-s],[ s, s, s],[ s,-s, s]],
      [[-s,-s,-s],[-s,-s, s],[-s, s, s],[-s, s,-s]],
    ];
    faces.forEach(function(f) {
      [0,1,2, 0,2,3].forEach(function(vi) {
        positions.push(f[vi][0] * 1.1, f[vi][1] * 1.1, f[vi][2] * 2.2);
      });
    });
    torsoBufferInfo.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, torsoBufferInfo.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
  }

  var partBufferInfo = {
    body: torsoBufferInfo,
    horn: hornBufferInfo,
    "tail-box": maneBufferInfo,
    "tail-mid-box": maneBufferInfo,
    "tail-tip": maneBufferInfo,
    "mane-1": maneBufferInfo,
    "mane-2": maneBufferInfo,
    "hoof-fl": hoofBufferInfo,
    "hoof-fr": hoofBufferInfo,
    "hoof-bl": hoofBufferInfo,
    "hoof-br": hoofBufferInfo,
  };

  var objects = [];
  var nodeInfosByName = {};

  var THIGH_LEN = 0.85, SHIN_LEN = 0.7;

  // One leg: hip pivot -> thigh box -> knee pivot -> shin box -> hoof leaf.
  function legDescription(suffix, hipX, hipZ) {
    return {
      name: "leg-" + suffix,
      draw: false,
      translation: [hipX, -0.5, hipZ],
      children: [
        { name: "leg-" + suffix + "-box", translation: [0, -THIGH_LEN / 2, 0], scale: [0.32, THIGH_LEN, 0.32] },
        { name: "shin-" + suffix, draw: false, translation: [0, -THIGH_LEN, 0], children: [
          { name: "shin-" + suffix + "-box", translation: [0, -SHIN_LEN / 2, 0], scale: [0.26, SHIN_LEN, 0.26] },
          { name: "hoof-" + suffix, translation: [0, -SHIN_LEN, 0.05], scale: [0.3, 0.22, 0.36] },
        ]},
      ],
    };
  }

  var unicornNodeDescriptions = {
    name: "root",
    draw: false,
    children: [
      { name: "body", translation: [0, 2.5, 0], children: [
        { name: "neck", draw: false, translation: [0, 0.85, 1.05], children: [
          { name: "neck-box", translation: [0, 0.15, 0.4], scale: [0.42, 0.55, 0.9] },
          { name: "mane-1", translation: [0, 0.46, 0.65], scale: [0.16, 0.26, 0.22] },
          { name: "mane-2", translation: [0, 0.38, 0.25], scale: [0.18, 0.3, 0.26] },
          { name: "head", draw: false, translation: [0, 0.35, 0.8], children: [
            { name: "head-box", scale: [0.62, 0.5, 0.68] },
            { name: "horn", translation: [0, 0.55, 0.25], scale: [0.2, 0.85, 0.2] },
            { name: "ear-l", translation: [-0.24, 0.42, -0.05], scale: [0.13, 0.3, 0.1] },
            { name: "ear-r", translation: [0.24, 0.42, -0.05], scale: [0.13, 0.3, 0.1] },
          ]},
        ]},
        { name: "tail", draw: false, translation: [0, 0.15, -1.15], children: [
          { name: "tail-box", translation: [0, -0.32, 0], scale: [0.3, 0.65, 0.3] },
          { name: "tail-mid", draw: false, translation: [0, -0.65, -0.1], children: [
            { name: "tail-mid-box", translation: [0, -0.27, 0], scale: [0.26, 0.55, 0.26] },
            { name: "tail-tip", translation: [0, -0.55, -0.08], scale: [0.2, 0.45, 0.2] },
          ]},
        ]},
        legDescription("fl", -0.5, 0.9),
        legDescription("fr", 0.5, 0.9),
        legDescription("bl", -0.5, -0.9),
        legDescription("br", 0.5, -0.9),
      ]},
    ],
  };

  function makeNode(nodeDescription) {
    var trs = new TRS();
    var node = new Node(trs);
    nodeInfosByName[nodeDescription.name] = { trs: trs, node: node };
    trs.translation = nodeDescription.translation || trs.translation;
    trs.scale = nodeDescription.scale || trs.scale;
    if (nodeDescription.draw !== false) {
      node.drawInfo = {
        uniforms: {
          u_colorOffset: [0, 0, 0, 0],
          u_colorMult: [1, 1, 1, 1],
        },
        bufferInfo: partBufferInfo[nodeDescription.name] || bodyBufferInfo,
      };
      objects.push(node);
    }
    makeNodes(nodeDescription.children).forEach(function(child) {
      child.setParent(node);
    });
    return node;
  }

  function makeNodes(nodeDescriptions) {
    return nodeDescriptions ? nodeDescriptions.map(makeNode) : [];
  }

  var root = makeNode(unicornNodeDescriptions);

  // Gallop leg-cycle model: 1 cycle = t 0..1 (looping), each leg offset
  // within it. Real gallop order: back-left -> back-right -> front-left ->
  // front-right -> suspension. Ratios tuned for this rig, not degrees.
  var LEG_PHASES = { bl: 0.00, br: 0.10, fl: 0.45, fr: 0.55 };
  var STANCE_RATIO = 0.4; // fraction of cycle the hoof is planted vs airborne
  var SWING = 0.5;        // radians, thigh sweep amplitude fore/aft

  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  // Returns { lift: 0..1 airborne height, swing: radians fore(+)/aft(-) }
  // for one leg at global cycle time `t`.
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

  var HOOF_LIFT_MAX = 0.9; // matches old shin swing amplitude

  // Advances the gallop animation. `gait` is 0..1 (0 = standing still).
  function animate(time, gait) {
    var speed = 1.6; // cycles per second at full gait
    var t = time * speed;
    var adjust;

    var legs = {
      bl: legCycle(t, LEG_PHASES.bl),
      br: legCycle(t, LEG_PHASES.br),
      fl: legCycle(t, LEG_PHASES.fl),
      fr: legCycle(t, LEG_PHASES.fr),
    };

    ["fl", "fr", "bl", "br"].forEach(function(suffix) {
      var leg = legs[suffix];
      nodeInfosByName["leg-" + suffix].trs.rotation[0] = leg.swing * gait;
      nodeInfosByName["shin-" + suffix].trs.rotation[0] = leg.lift * HOOF_LIFT_MAX * gait;
      nodeInfosByName["hoof-" + suffix].trs.rotation[0] = -leg.swing * 0.4 * gait;
    });

    // Body rises on the back legs' push (peaks near suspension).
    var backBounce = (legs.bl.lift + legs.br.lift) * 0.15 * gait;
    nodeInfosByName["body"].trs.translation[1] = 2.5 + backBounce;

    // Pelvis rolls with the left/right stagger between the back legs.
    nodeInfosByName["body"].trs.rotation[2] = (legs.br.lift - legs.bl.lift) * 0.14 * gait;

    var c = t * 2 * Math.PI;
    adjust = Math.sin(c) * 0.15 * gait;
    nodeInfosByName["neck"].trs.rotation[0] = -backBounce * 1.5 + adjust;
    adjust = Math.sin(c + 0.2) * 0.1 * gait;
    nodeInfosByName["head"].trs.rotation[0] = adjust;

    nodeInfosByName["ear-l"].trs.rotation[2] = Math.sin(time * 0.7) * 0.06;
    nodeInfosByName["ear-r"].trs.rotation[2] = -Math.sin(time * 0.7 + 0.4) * 0.06;

    var maneSway = Math.sin(time * 2) * 0.12 + Math.sin(c) * 0.1 * gait;
    nodeInfosByName["mane-1"].trs.rotation[0] = maneSway;
    nodeInfosByName["mane-2"].trs.rotation[0] = maneSway * 0.8;

    adjust = Math.sin(c) * 0.5;
    nodeInfosByName["tail"].trs.rotation[0] = adjust * 0.25;
    nodeInfosByName["tail-mid"].trs.rotation[0] = adjust * 0.5;
    nodeInfosByName["tail-tip"].trs.rotation[0] = adjust;
  }

  return {
    root: root,
    objects: objects,
    nodeInfosByName: nodeInfosByName,
    animate: animate,
  };
}
