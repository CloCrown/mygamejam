"use strict";

// Experimental linear-blend-skinned horse rig, built from HORSE_BONES/
// HORSE_SKIN (horse-mesh-skinned.js). Not wired into game.js yet — kept
// alongside the shipped rigid-part rig (horse-rig.js) to compare whether
// blending 2 bone influences per vertex fixes the joint tearing visible
// during the gait animation, without touching what already works.
//
// Every bone is a Node in the usual scene-graph shape (bone.head as its
// translation relative to its parent's head), animated exactly like
// horse-rig.js's gait. Instead of one rigid mesh chunk per bone, there is a
// single mesh whose vertex buffer is rewritten every frame: each vertex is
// pulled toward wherever its 1-2 influencing bones currently are, weighted,
// which is what keeps the skin continuous across a bending joint instead of
// tearing into independently-rotating rigid pieces.

// Draws a bay-horse coat (chestnut-brown body, violet mane/tail/hooves, a
// softer belly tone) on a small canvas and uploads it as a WebGL texture.
// Generated at runtime instead of shipped as an image: free in build size,
// and the coarse UV layout (Blender's default project, never hand-unwrapped
// — see generate_horse_mesh_skinned_js.js) means a photographic texture
// would look wrong wherever it seams anyway, so an organic, mostly-uniform
// paint job that tolerates a rough mapping is the better fit here.
function createHorseCoatTexture(gl) {
  var size = 128;
  var canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  var ctx = canvas.getContext("2d");

  var BODY = "#8a5a34";
  var BODY_DARK = "#6e4527";
  var BODY_LIGHT = "#a5714a";
  var BELLY = "#b98a5e";
  var MANE = "#6b2fa0";
  var MANE_LIGHT = "#9c5fd6";

  ctx.fillStyle = BODY;
  ctx.fillRect(0, 0, size, size);

  // Soft vertical gradient: darker "spine" band across the middle rows,
  // lighter "belly" band along the top/bottom edges — with the UV mapping
  // this coarse, a directional gradient reads better across seams than any
  // detail that assumes a specific body part lands in a specific UV cell.
  var gradient = ctx.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, BELLY);
  gradient.addColorStop(0.5, BODY_DARK);
  gradient.addColorStop(1, BELLY);
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 1;

  // Mottled patches for an organic, non-flat coat, in muted body tones only
  // (never a stray bright color) so it stays plausible under UV distortion.
  var patchColors = [BODY_LIGHT, BODY_DARK, BELLY];
  for (var i = 0; i < 220; i++) {
    var x = Math.random() * size;
    var y = Math.random() * size;
    var r = 2 + Math.random() * 5;
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = patchColors[i % patchColors.length];
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Mane/tail/hoof points: the coarse UV bunches extremities into a few
  // small cells, so a handful of blotches near the texture's edges (where
  // those cells tend to land after the default project) reads as "mane
  // points" without needing to track exact UV islands. A violet gradient
  // instead of flat near-black gives those extremities a fantastical,
  // unicorn-coded color instead of ordinary horse points.
  var maneGradient = ctx.createLinearGradient(0, 0, size, size);
  maneGradient.addColorStop(0, MANE_LIGHT);
  maneGradient.addColorStop(1, MANE);
  ctx.fillStyle = maneGradient;
  ctx.fillRect(0, 0, size, size * 0.12);
  ctx.fillRect(0, size * 0.88, size, size * 0.12);
  ctx.fillRect(0, 0, size * 0.12, size);
  ctx.fillRect(size * 0.88, 0, size * 0.12, size);

  var texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return texture;
}

function createHorseRigSkinned(gl, hornColorRgba) {
  var numBones = HORSE_BONES.length;
  var nodes = new Array(numBones);
  var bindInverse = new Array(numBones);
  var nodeInfosByName = {};

  var rootTrs = new TRS();
  rootTrs.rotation[1] = Math.PI; // see horse-rig.js: armature authored facing +Z
  var root = new Node(rootTrs);

  for (var i = 0; i < numBones; i++) {
    var bone = HORSE_BONES[i];
    var parentHead = bone.parent >= 0 ? HORSE_BONES[bone.parent].head : [0, 0, 0];
    var trs = new TRS();
    trs.translation = [
      bone.head[0] - parentHead[0],
      bone.head[1] - parentHead[1],
      bone.head[2] - parentHead[2],
    ];
    var info = { trs: trs, node: new Node(trs) };
    nodes[i] = info;
    nodeInfosByName[bone.name] = info;
  }
  for (var i = 0; i < numBones; i++) {
    var parent = HORSE_BONES[i].parent;
    nodes[i].node.setParent(parent >= 0 ? nodes[parent].node : root);
  }

  // Bind pose has no rotation on any node, so each bone's bind world matrix
  // is a pure translation to its absolute head; its inverse is needed once,
  // not every frame, to turn "current world matrix" into a skinning delta.
  root.updateWorldMatrix();
  for (var i = 0; i < numBones; i++) {
    bindInverse[i] = m4.inverse(nodes[i].node.worldMatrix);
  }

  var skin = HORSE_SKIN;
  var numVertices = skin.positions.length / 3;
  var skinnedPositions = new Float32Array(skin.positions.length);

  var positionBuffer = gl.createBuffer();
  var colorBuffer = gl.createBuffer();
  var texcoordBuffer = gl.createBuffer();
  var normalBuffer = gl.createBuffer();
  var useVertexColorBuffer = gl.createBuffer();

  // UV coords never change (bind-pose UVs, no skinning needed for them), so
  // this is the one static per-index buffer alongside colors.
  var expandedTexcoords = new Float32Array(skin.indices.length * 2);
  for (var ti = 0; ti < skin.indices.length; ti++) {
    var tvi = skin.indices[ti];
    expandedTexcoords[ti * 2] = skin.uvs[tvi * 2];
    expandedTexcoords[ti * 2 + 1] = skin.uvs[tvi * 2 + 1];
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, expandedTexcoords, gl.STATIC_DRAW);

  var texture = createHorseCoatTexture(gl);

  // The horn is a distinct color that the shared coat texture can't show
  // (its UV cell is shared with most of the body — see
  // generate_horse_mesh_skinned_js.js's comments), so its vertices opt
  // out of the texture and use their flat vertex color instead (see
  // a_useVertexColor in game.html). hornColorRgba (0..1 floats, from the
  // player's pre-race pick — see PICKUP_COLORS) overrides skin.colors'
  // baked-in horn color for those vertices only, so the horn's paint
  // reflects the player's choice instead of the fixed color the mesh was
  // generated with.
  var hornBoneIndex = HORSE_BONES.findIndex(function(b) { return b.name === "horn"; });
  var hornColorBytes = hornColorRgba && [
    Math.round(hornColorRgba[0] * 255),
    Math.round(hornColorRgba[1] * 255),
    Math.round(hornColorRgba[2] * 255),
    Math.round(hornColorRgba[3] * 255),
  ];

  // skin.colors holds one RGBA per unindexed vertex, but drawing uses
  // gl.drawArrays over the expanded (indexed-then-flattened) triangle list
  // below, same as skin.positions — so colors need the same per-index
  // expansion, or the color buffer is shorter than the vertex count drawn
  // and WebGL reads past its end into undefined GPU memory (the iridescent
  // noise on the legs before this fix).
  var expandedColors = new Uint8Array(skin.indices.length * 4);
  var expandedUseVertexColor = new Float32Array(skin.indices.length);
  for (var ci = 0; ci < skin.indices.length; ci++) {
    var cvi = skin.indices[ci];
    var isHorn = skin.boneA[cvi] === hornBoneIndex || skin.boneB[cvi] === hornBoneIndex;
    var rgba = (isHorn && hornColorBytes) ? hornColorBytes : [
      skin.colors[cvi * 4], skin.colors[cvi * 4 + 1], skin.colors[cvi * 4 + 2], skin.colors[cvi * 4 + 3],
    ];
    expandedColors[ci * 4] = rgba[0];
    expandedColors[ci * 4 + 1] = rgba[1];
    expandedColors[ci * 4 + 2] = rgba[2];
    expandedColors[ci * 4 + 3] = rgba[3];
    expandedUseVertexColor[ci] = isHorn ? 1 : 0;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, expandedColors, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, useVertexColorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, expandedUseVertexColor, gl.STATIC_DRAW);

  var expandedPositions = new Float32Array(skin.indices.length * 3);
  var expandedNormals = new Float32Array(skin.indices.length * 3);

  var meshNode = new Node(new TRS());
  meshNode.setParent(root);
  meshNode.drawInfo = {
    uniforms: {
      u_colorOffset: [0, 0, 0, 0],
      u_colorMult: [1, 1, 1, 1],
    },
    bufferInfo: {
      numElements: skin.indices.length,
      positionBuffer: positionBuffer,
      colorBuffer: colorBuffer,
      texcoordBuffer: texcoordBuffer,
      normalBuffer: normalBuffer,
      useVertexColorBuffer: useVertexColorBuffer,
      texture: texture,
    },
  };

  var skinMatrix = new Array(numBones);
  for (var i = 0; i < numBones; i++) skinMatrix[i] = new Float32Array(16);

  function updateSkin() {
    for (var i = 0; i < numBones; i++) {
      m4.multiply(nodes[i].node.worldMatrix, bindInverse[i], skinMatrix[i]);
    }

    for (var v = 0; v < numVertices; v++) {
      var px = skin.positions[v * 3], py = skin.positions[v * 3 + 1], pz = skin.positions[v * 3 + 2];
      var a = skin.boneA[v], wa = skin.weightA[v];
      var b = skin.boneB[v], wb = skin.weightB[v];

      var ma = skinMatrix[a];
      var ax = ma[0]*px+ma[4]*py+ma[8]*pz+ma[12];
      var ay = ma[1]*px+ma[5]*py+ma[9]*pz+ma[13];
      var az = ma[2]*px+ma[6]*py+ma[10]*pz+ma[14];

      var x = ax * wa, y = ay * wa, z = az * wa;
      if (wb > 0) {
        var mb = skinMatrix[b];
        var bx = mb[0]*px+mb[4]*py+mb[8]*pz+mb[12];
        var by = mb[1]*px+mb[5]*py+mb[9]*pz+mb[13];
        var bz = mb[2]*px+mb[6]*py+mb[10]*pz+mb[14];
        x += bx * wb; y += by * wb; z += bz * wb;
      }

      skinnedPositions[v * 3] = x;
      skinnedPositions[v * 3 + 1] = y;
      skinnedPositions[v * 3 + 2] = z;
    }

    var indices = skin.indices;
    for (var t = 0; t < indices.length; t++) {
      var vi = indices[t];
      expandedPositions[t * 3] = skinnedPositions[vi * 3];
      expandedPositions[t * 3 + 1] = skinnedPositions[vi * 3 + 1];
      expandedPositions[t * 3 + 2] = skinnedPositions[vi * 3 + 2];
    }

    // Flat per-triangle normal (low-poly look, matches the unlit vertex
    // colors already used here), recomputed every frame since skinning
    // moves the geometry.
    for (var f = 0; f < expandedPositions.length; f += 9) {
      var ax = expandedPositions[f], ay = expandedPositions[f+1], az = expandedPositions[f+2];
      var bx = expandedPositions[f+3], by = expandedPositions[f+4], bz = expandedPositions[f+5];
      var cx = expandedPositions[f+6], cy = expandedPositions[f+7], cz = expandedPositions[f+8];
      var ux = bx-ax, uy = by-ay, uz = bz-az;
      var vx = cx-ax, vy = cy-ay, vz = cz-az;
      var nx = uy*vz - uz*vy, ny = uz*vx - ux*vz, nz = ux*vy - uy*vx;
      var len = Math.hypot(nx, ny, nz) || 1;
      nx /= len; ny /= len; nz /= len;
      for (var k = 0; k < 3; k++) {
        expandedNormals[f + k*3] = nx;
        expandedNormals[f + k*3 + 1] = ny;
        expandedNormals[f + k*3 + 2] = nz;
      }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, expandedPositions, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, expandedNormals, gl.DYNAMIC_DRAW);
  }

  // Left/right bone groups, derived from the ".L"/".R" naming convention
  // instead of hand-listed, so any future rig change (renamed/added bones)
  // stays in sync automatically. Meant for procedural reactions (e.g. an
  // impact flinch) that need to grab "everything on this side" without
  // re-deriving the pairing at each call site.
  var leftBoneNames = [];
  var rightBoneNames = [];
  Object.keys(nodeInfosByName).forEach(function(name) {
    if (/\.L(\.\d+)?$/.test(name)) leftBoneNames.push(name);
    else if (/\.R(\.\d+)?$/.test(name)) rightBoneNames.push(name);
  });

  // Gait animation: identical model to horse-rig.js (same phases, same
  // constants), driven by the same named bones — this experiment only
  // changes how the mesh is skinned, not how the skeleton moves.
  var LEGS = [
    { thigh: "thigh.L", shin: "shin.L", phase: 0.00 },
    { thigh: "thigh.R", shin: "shin.R", phase: 0.10 },
    { thigh: "front_thigh.L", shin: "front_shin.L", phase: 0.45 },
    { thigh: "front_thigh.R", shin: "front_shin.R", phase: 0.55 },
  ];
  var STANCE_RATIO = 0.4;
  var SWING = 0.5;
  var KNEE_BEND = 0.9;
  var BODY_PIVOT_Y = nodeInfosByName["spine.005"].trs.translation[1];
  var TAIL_CHAIN = ["spine.003", "spine.002", "spine.001", "spine"];

  function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

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

  function animate(time, gait) {
    var speed = 1.6;
    var t = time * speed;

    var backLift = 0;
    var backRoll = 0;
    LEGS.forEach(function(leg, i) {
      var cycle = legCycle(t, leg.phase);
      nodeInfosByName[leg.thigh].trs.rotation[0] = cycle.swing * gait;
      nodeInfosByName[leg.shin].trs.rotation[0] = -cycle.lift * KNEE_BEND * gait;
      if (i < 2) {
        backLift += cycle.lift;
        backRoll += i === 0 ? -cycle.lift : cycle.lift;
      }
    });

    var backBounce = backLift * 0.08 * gait;
    nodeInfosByName["spine.005"].trs.translation[1] = BODY_PIVOT_Y + backBounce;
    nodeInfosByName["spine.005"].trs.rotation[2] = backRoll * 0.1 * gait;

    // The neck trails the body bounce by a short phase delay instead of
    // reacting in the same instant, so the head reads as following the
    // body's motion rather than being rigidly welded to it.
    var neckLagC = (t - 0.05) * 2 * Math.PI;
    nodeInfosByName["spine.009"].trs.rotation[0] = -backBounce * 1.5 + Math.sin(neckLagC) * 0.08 * gait;

    // The bind pose hangs the tail chain parallel to Y (straight down).
    // rotation[2] at this exact angle landed the tail parallel to Z,
    // confirmed by the user against the in-game gizmo. Kept as-is —
    // parallel to X still needs a different, separately-verified value.
    var tailLiftPerLink = (Math.PI / 2) / TAIL_CHAIN.length;
    TAIL_CHAIN.forEach(function(name) {
      nodeInfosByName[name].trs.rotation[2] = tailLiftPerLink;
    });

    root.updateWorldMatrix();
    updateSkin();
  }

  return {
    root: root,
    objects: [meshNode],
    nodeInfosByName: nodeInfosByName,
    leftBoneNames: leftBoneNames,
    rightBoneNames: rightBoneNames,
    animate: animate,
  };
}
