"use strict";

// ---- Track2: winding circuits defined by waypoints instead of an oval
// formula. Same single-draw-call ground mesh approach as track.js, but data
// driven so several circuits can share the same code (see TRACKS below). ----

// Each entry: mapSize (grid extent, meters), trackWidth (cell units), and
// waypoints (cell units, grid-centered) tracing a closed loop — the last
// point connects back to the first.
var TRACKS = [
  {
    name: "Slalom Valley",
    mapSize: 400,
    trackWidth: 36,
    waypoints: [
      [-140, 0], [-80, 60], [0, 20], [60, 70],
      [130, 0], [80, -50], [20, -20], [-40, -70], [-110, -30],
    ],
  },
  {
    name: "Figure Eight",
    mapSize: 400,
    trackWidth: 30,
    waypoints: [
      [-90, -60], [-30, -60], [0, -10], [30, 40], [90, 40],
      [110, 0], [90, -40], [30, -40], [0, 10], [-30, 60],
      [-90, 60], [-110, 0],
    ],
  },
  {
    name: "Grand Oval",
    mapSize: 400,
    trackWidth: 40,
    waypoints: [
      [-130, -60], [130, -60], [160, 0], [130, 60],
      [-130, 60], [-160, 0],
    ],
  },
  {
    name: "Zigzag Sprint",
    mapSize: 400,
    trackWidth: 28,
    waypoints: [
      [-150, 0], [-90, 50], [-30, -50], [30, 50],
      [90, -50], [150, 0], [90, 40], [-90, -40],
    ],
  },
  {
    name: "Spiral Ring",
    mapSize: 400,
    trackWidth: 32,
    waypoints: [
      [0, -120], [85, -85], [120, 0], [85, 85],
      [0, 120], [-85, 85], [-120, 0], [-85, -85],
    ],
  },
  {
    name: "Triangle Chicane",
    mapSize: 400,
    trackWidth: 34,
    waypoints: [
      [0, -140], [40, -50], [140, 70], [60, 40],
      [0, 100], [-60, 40], [-140, 70], [-40, -50],
    ],
  },
  {
    name: "Custom 1",
    mapSize: 500,
    trackWidth: 32,
    // Hand-tuned in the track.html waypoint editor.
    waypoints: [
      [-154, -83], [-162, 119], [-94, 13], [-62, 179], [-5, 171],
      [9, 92], [77, 121], [60, -32], [130, -20], [186, 147],
      [190, 30], [210, -70], [4, -127],
    ],
  },
  {
    name: "Serpentine",
    mapSize: 400,
    trackWidth: 26,
    waypoints: [
      [-160, 0], [-120, 60], [-70, -50], [-20, 60],
      [30, -50], [80, 60], [130, -50], [160, 0],
      [130, 40], [-130, 40],
    ],
  },
];

var CELL = 1;

// Smallest distance from (x,z) to any segment of a closed waypoint loop.
function distanceToTrackPath(waypoints, x, z) {
  var minDist = Infinity;
  for (var i = 0; i < waypoints.length; i++) {
    var a = waypoints[i];
    var b = waypoints[(i + 1) % waypoints.length];
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

function lerpColor(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    1,
  ];
}

// Builds ground mesh + marker positions + spawn info for one track config.
// Returns the same shape game.js expects: { mapSize, trackRadiusX,
// createGroundBufferInfo(gl), createMarkerPositions() }.
function createTrack(config) {
  var mapSize = config.mapSize;
  var trackWidth = config.trackWidth;
  var waypoints = config.waypoints;

  // Approximate half-width of the loop, for the spawn point.
  var trackRadiusX = 0;
  waypoints.forEach(function(p) {
    trackRadiusX = Math.max(trackRadiusX, Math.abs(p[0]));
  });

  // Returns 1 on the track path, 0 on grass, with a smooth falloff at the
  // edge. The falloff spans several meters (not ~1 cell) because the ground
  // mesh only has one vertex per meter: a narrow gradient collapses to a
  // single interpolated band between grid vertices, which reads as jagged
  // sawtooth stairsteps when the edge is viewed at a shallow/tangential
  // angle. A wider, smoothstep-shaped falloff spreads the transition across
  // several vertices so it blends smoothly from any viewing angle.
  function trackAmount(cellX, cellZ) {
    var dist = distanceToTrackPath(waypoints, cellX - mapSize / 2, cellZ - mapSize / 2) - trackWidth / 2;
    var edgeSoftness = 4;
    var t = 1 - Math.max(0, Math.min(1, dist / edgeSoftness));
    return t * t * (3 - 2 * t); // smoothstep: eases both ends of the gradient
  }

  function createGroundBufferInfo(gl) {
    var cellsPerAxis = mapSize / CELL;
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
    var offset = trackWidth / 2 + 4;
    for (var i = 0; i < waypoints.length; i++) {
      var a = waypoints[i];
      var b = waypoints[(i + 1) % waypoints.length];
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

  // One full rainbow (all 7 colors, side by side across the track width),
  // at the midpoint of the segment after the spawn waypoint — never at
  // spawn itself, which would be collected on the very first frame. Order
  // matches PICKUP_COLORS in game.js: index i is color i (red=0 .. violet=6).
  function createPickupPositions() {
    var a = waypoints[1 % waypoints.length];
    var b = waypoints[2 % waypoints.length];
    var mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    var dx = b[0] - a[0], dz = b[1] - a[1];
    var len = Math.hypot(dx, dz) || 1;
    var nx = -dz / len, nz = dx / len;
    var spacing = Math.min(trackWidth / 8, 4);
    var positions = [];
    for (var c = 0; c < 7; c++) {
      var t = c - 3; // -3..3, centers the row of 7 on the midpoint
      positions.push([mx + nx * spacing * t, mz + nz * spacing * t]);
    }
    return positions;
  }

  // One rock obstacle per track segment, at the segment's midpoint offset
  // sideways by a pseudo-random fraction of the track width — skips segment
  // 0->1 (spawn, would be an unfair immediate hit) and 1->2 (the pickup
  // row, see createPickupPositions). A simple deterministic hash of the
  // segment index stands in for Math.random() so the same track always
  // lays out the same obstacles (same config in, same result out, like
  // every other create*Positions here).
  // Returns { positions, types }: types is a parallel array of OBSTACLE_TYPES
  // names, one per position, so callers can pass both straight into
  // obstacles.js's createObstacles(positions, types). Every 3rd segment gets
  // a "barrel" (movable/destructible) instead of the default static "rock",
  // using a second deterministic hash so the type choice doesn't correlate
  // with the offset hash above.
  function createObstaclePositions() {
    var positions = [];
    var types = [];
    for (var i = 2; i < waypoints.length; i++) {
      var a = waypoints[i];
      var b = waypoints[(i + 1) % waypoints.length];
      var mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      var dx = b[0] - a[0], dz = b[1] - a[1];
      var len = Math.hypot(dx, dz) || 1;
      var nx = -dz / len, nz = dx / len;
      var hash = Math.sin(i * 12.9898) * 43758.5453;
      var frac = (hash - Math.floor(hash)) * 2 - 1; // -1..1, deterministic per segment
      var offset = frac * (trackWidth / 2 - 6); // stay clear of the track edge
      positions.push([mx + nx * offset, mz + nz * offset]);
      var typeHash = Math.sin(i * 78.233) * 12345.678;
      var typeFrac = typeHash - Math.floor(typeHash); // 0..1, deterministic per segment
      types.push(typeFrac < 0.3 ? "barrel" : "rock");
    }
    return { positions: positions, types: types };
  }

  // Spawn spots for the non-player horses (see game.js's obstacleHorse and
  // aiHorse) — on the track itself, not a fixed offset from map bounds
  // (which only happened to land on the road for some TRACKS configs and
  // put the horses on the grass for others). Two waypoints deep into the
  // loop (clear of spawn and the pickup row at 1->2, like
  // createObstaclePositions), offset a bit sideways from the segment
  // midpoint and from each other so the two horses don't spawn stacked.
  function createHorseSpawnPositions() {
    function spotAt(segmentIndex, sideFrac) {
      var a = waypoints[segmentIndex % waypoints.length];
      var b = waypoints[(segmentIndex + 1) % waypoints.length];
      var mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      var dx = b[0] - a[0], dz = b[1] - a[1];
      var len = Math.hypot(dx, dz) || 1;
      var nx = -dz / len, nz = dx / len;
      var heading = Math.atan2(dx, dz);
      var offset = sideFrac * (trackWidth / 2 - 6);
      return { x: mx + nx * offset, z: mz + nz * offset, heading: heading };
    }
    return {
      obstacle: spotAt(3, -0.4),
      ai: spotAt(4, 0.4),
    };
  }

  // Finish line: a thin strip across the track at the spawn waypoint, drawn
  // as ground-level decoration (checkered-style alternating colors along
  // its width) so the player can see where a lap starts/ends.
  function createFinishLinePositions() {
    var a = waypoints[0];
    var b = waypoints[1 % waypoints.length];
    var dx = b[0] - a[0], dz = b[1] - a[1];
    var len = Math.hypot(dx, dz) || 1;
    var nx = -dz / len, nz = dx / len;
    var half = trackWidth / 2;
    return { x: a[0], z: a[1], nx: nx, nz: nz, half: half };
  }

  return {
    mapSize: mapSize,
    trackRadiusX: trackRadiusX,
    createGroundBufferInfo: createGroundBufferInfo,
    createMarkerPositions: createMarkerPositions,
    createPickupPositions: createPickupPositions,
    createObstaclePositions: createObstaclePositions,
    createHorseSpawnPositions: createHorseSpawnPositions,
    createFinishLinePositions: createFinishLinePositions,
    waypoints: waypoints,
  };
}
