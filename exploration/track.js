"use strict";

// ---- Track: a 200x200m grid (1m cells) with an oval ring marked as track. ----
// The track is one big triangle mesh (two triangles per cell, vertex-colored
// grass/asphalt) so the whole ground is a single draw call.

var MAP_SIZE = 200;
var CELL = 1;
var TRACK_CENTER_X = 0.5 * MAP_SIZE / CELL; // in cell units
var TRACK_CENTER_Z = 0.5 * MAP_SIZE / CELL;
var TRACK_RADIUS_X = 70; // cell units
var TRACK_RADIUS_Z = 45;
var TRACK_WIDTH = 12; // cell units

// Returns 1 inside the track ring, 0 on grass, with a smooth falloff at
// the edge (see track2.js's trackAmount for why the falloff needs to span
// several meters instead of ~1 cell: a narrow gradient between 1m-spaced
// grid vertices reads as jagged sawtooth stairsteps at shallow view angles).
function trackAmount(cellX, cellZ) {
  var dx = (cellX - TRACK_CENTER_X) / TRACK_RADIUS_X;
  var dz = (cellZ - TRACK_CENTER_Z) / TRACK_RADIUS_Z;
  var d = Math.sqrt(dx * dx + dz * dz);
  var minRadius = Math.min(TRACK_RADIUS_X, TRACK_RADIUS_Z);
  var ringHalfWidth = (TRACK_WIDTH / 2) / minRadius;
  var edgeSoftness = 4 / minRadius;
  var dist = Math.abs(d - 1) - ringHalfWidth; // <0 inside track, >0 outside
  var t = 1 - Math.max(0, Math.min(1, dist / edgeSoftness));
  return t * t * (3 - 2 * t); // smoothstep: eases both ends of the gradient
}

function lerpColor(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    1,
  ];
}

function createGroundBufferInfo(gl) {
  var cellsPerAxis = MAP_SIZE / CELL;
  var positions = [];
  var colors = [];
  var grass = [0.35, 0.65, 0.3, 1];
  var asphalt = [0.35, 0.35, 0.38, 1];

  function vertexColor(cx, cz) {
    var t = trackAmount(cx, cz);
    return lerpColor(grass, asphalt, t);
  }

  for (var cz = 0; cz < cellsPerAxis; cz++) {
    for (var cx = 0; cx < cellsPerAxis; cx++) {
      var x0 = (cx - cellsPerAxis / 2) * CELL;
      var x1 = x0 + CELL;
      var z0 = (cz - cellsPerAxis / 2) * CELL;
      var z1 = z0 + CELL;

      // Colors are sampled per-vertex (at true grid corners), so WebGL
      // interpolates a smooth gradient across the track edge instead of
      // a hard per-cell step.
      var c00 = vertexColor(cx, cz);
      var c10 = vertexColor(cx + 1, cz);
      var c11 = vertexColor(cx + 1, cz + 1);
      var c01 = vertexColor(cx, cz + 1);

      var quad = [
        { p: [x0, 0, z0], c: c00 },
        { p: [x1, 0, z1], c: c11 },
        { p: [x1, 0, z0], c: c10 },
        { p: [x0, 0, z0], c: c00 },
        { p: [x0, 0, z1], c: c01 },
        { p: [x1, 0, z1], c: c11 },
      ];
      quad.forEach(function(v) {
        positions.push(v.p[0], v.p[1], v.p[2]);
        colors.push(v.c[0] * 255, v.c[1] * 255, v.c[2] * 255, v.c[3] * 255);
      });
    }
  }

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

// Decorative markers placed off-track, spaced around the outer edge of the ring.
function createMarkerPositions() {
  var markers = [];
  var count = 16;
  for (var i = 0; i < count; i++) {
    var angle = (i / count) * Math.PI * 2;
    var rx = (TRACK_RADIUS_X + 10) * CELL;
    var rz = (TRACK_RADIUS_Z + 10) * CELL;
    var x = Math.cos(angle) * rx;
    var z = Math.sin(angle) * rz;
    markers.push([x, 1, z]);
  }
  return markers;
}
