"use strict";

// Static (non-skinned, non-animated) horse rig built straight from
// horse-mesh-from-glb.js (exploration/fbx_way/horse.glb — no armature/vertex
// groups in that file, so no gait animation is possible here). Kept
// alongside horse-rig-skinned.js (the animated, new_horse.glb-based rig)
// while exploring whether horse.glb is usable as a drop-in replacement.
function createHorseRigFromGlb(gl) {
  var positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(HORSE_STATIC_MESH.positions), gl.STATIC_DRAW);

  var colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(HORSE_STATIC_MESH.colors), gl.STATIC_DRAW);

  // The armature convention elsewhere in this project (horse-rig.js,
  // horse-rig-skinned.js) faces the source geometry +Z and turns it 180
  // degrees here to match the game's -Z forward.
  var rootTrs = new TRS();
  rootTrs.rotation[1] = Math.PI;
  var root = new Node(rootTrs);

  var meshNode = new Node(new TRS());
  meshNode.setParent(root);
  meshNode.drawInfo = {
    uniforms: {
      u_colorOffset: [0, 0, 0, 0],
      u_colorMult: [1, 1, 1, 1],
    },
    bufferInfo: {
      numElements: HORSE_STATIC_MESH.positions.length / 3,
      positionBuffer: positionBuffer,
      colorBuffer: colorBuffer,
    },
  };

  return {
    root: root,
    objects: [meshNode],
    nodeInfosByName: {},
    animate: function() {}, // no armature in horse.glb: static pose only
  };
}
