"use strict";

// ---- Track2: a winding circuit defined by waypoints instead of an oval
// formula. Same 200x200m grid + single-draw-call ground mesh as track.js,
// same exported API (MAP_SIZE/CELL/TRACK_RADIUS_X + the two factories),
// so game.html can swap between the two by choosing which script to load. ----

var MAP_SIZE = 400;
var CELL = 1;
var TRACK_WIDTH = 12; // cell units

// Waypoints (in cell units, grid-centered) tracing a slalom-like loop.
// The path is closed: the last point connects back to the first.
// Scaled 2x from the original layout to double the track's footprint.
var TRACK_WAYPOINTS = [
  [-140, 0],
  [-80, 60],
  [0, 20],
  [60, 70],
  [130, 0],
  [80, -50],
  [20, -20],
  [-40, -70],
  [-110, -30],
];

// Used by game.js to place the unicorn at the start of the track.
var TRACK_RADIUS_X = 140; // approximate half-width of the loop, for the spawn point

// Smallest distance from (x,z) to any segment of the closed waypoint loop.
function distanceToTrackPath(x, z) {
  var minDist = Infinity;
  for (var i = 0; i < TRACK_WAYPOINTS.length; i++) {
    var a = TRACK_WAYPOINTS[i];
    var b = TRACK_WAYPOINTS[(i + 1) % TRACK_WAYPOINTS.length];
    var abx = b[0] - a[0], abz = b[1] - a[1];
    var apx = x - a[0], apz = z - a[1];
    var abLenSq = abx * abx + abz * abz;
    var t = abLenSq > 0 ? Math.max(0, Math.min(1, (apx * abx + apz * abz) / abLenSq)) : 0;
    var cx = a[0] + abx * t, cz = a[1] + abz * t;
    var dx = x - cx, dz = z - cz;
    var dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

// Returns 1 on the track path, 0 on grass, with a smooth falloff at the
// edge (same contract as track.js's trackAmount). The falloff spans several
// meters (not ~1 cell) because the ground mesh only has one vertex per
// meter: a narrow gradient collapses to a single interpolated band between
// grid vertices, which reads as jagged sawtooth stairsteps when the edge is
// viewed at a shallow/tangential angle. A wider, smoothstep-shaped falloff
// spreads the transition across several vertices so it blends smoothly
// from any viewing angle.
function trackAmount(cellX, cellZ) {
  var dist = distanceToTrackPath(cellX - MAP_SIZE / 2, cellZ - MAP_SIZE / 2) - TRACK_WIDTH / 2;
  var edgeSoftness = 4;
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

// Decorative markers placed just outside the track, one beside each waypoint.
function createMarkerPositions() {
  var markers = [];
  var offset = TRACK_WIDTH / 2 + 4;
  for (var i = 0; i < TRACK_WAYPOINTS.length; i++) {
    var a = TRACK_WAYPOINTS[i];
    var b = TRACK_WAYPOINTS[(i + 1) % TRACK_WAYPOINTS.length];
    var mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    var dx = b[0] - a[0], dz = b[1] - a[1];
    var len = Math.hypot(dx, dz) || 1;
    // Perpendicular to the segment, pushed outward on both sides.
    var nx = -dz / len, nz = dx / len;
    markers.push([mx + nx * offset, 1, mz + nz * offset]);
    markers.push([mx - nx * offset, 1, mz - nz * offset]);
  }
  return markers;
}
