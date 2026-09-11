"use strict";

// Exploration: a classic axis gizmo (3 colored bars from the origin along
// +X/+Y/+Z), placed at the world origin as a real object in the scene
// (not a fixed screen-corner overlay). Kept in its own file so it can be
// dropped without touching any other code — see CLAUDE.md, exploration
// phase.
function createAxisGizmoBufferInfo(gl, length) {
  var thickness = length * 0.03;
  var positions = [];
  var colors = [];

  function addBox(center, size, color) {
    var s = [size[0] / 2, size[1] / 2, size[2] / 2];
    var cx = center[0], cy = center[1], cz = center[2];
    var faces = [
      [[-s[0],-s[1], s[2]],[ s[0],-s[1], s[2]],[ s[0], s[1], s[2]],[-s[0], s[1], s[2]]],
      [[-s[0],-s[1],-s[2]],[-s[0], s[1],-s[2]],[ s[0], s[1],-s[2]],[ s[0],-s[1],-s[2]]],
      [[-s[0], s[1],-s[2]],[-s[0], s[1], s[2]],[ s[0], s[1], s[2]],[ s[0], s[1],-s[2]]],
      [[-s[0],-s[1],-s[2]],[ s[0],-s[1],-s[2]],[ s[0],-s[1], s[2]],[-s[0],-s[1], s[2]]],
      [[ s[0],-s[1],-s[2]],[ s[0], s[1],-s[2]],[ s[0], s[1], s[2]],[ s[0],-s[1], s[2]]],
      [[-s[0],-s[1],-s[2]],[-s[0],-s[1], s[2]],[-s[0], s[1], s[2]],[-s[0], s[1],-s[2]]],
    ];
    faces.forEach(function(f) {
      [0,1,2, 0,2,3].forEach(function(vi) {
        positions.push(f[vi][0] + cx, f[vi][1] + cy, f[vi][2] + cz);
        colors.push(color[0]*255, color[1]*255, color[2]*255, color[3]*255);
      });
    });
  }

  // Each axis box spans from the origin to `length` along its axis, offset
  // so one end sits at the origin (not centered on it).
  addBox([length/2, 0, 0], [length, thickness, thickness], [1, 0.15, 0.15, 1]); // +X red
  addBox([0, length/2, 0], [thickness, length, thickness], [0.15, 1, 0.15, 1]); // +Y green
  addBox([0, 0, length/2], [thickness, thickness, length], [0.15, 0.45, 1, 1]); // +Z blue

  var positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  var colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(colors), gl.STATIC_DRAW);

  return {
    numElements: positions.length / 3,
    positionBuffer: positionBuffer,
    colorBuffer: colorBuffer,
  };
}
