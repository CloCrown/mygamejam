"use strict";

// Turns horse_rig.json (written by extract_horse_rig.py) into game/horse-mesh.js.
//
// Two shape changes happen here so the shipped runtime stays dumb:
//
// 1. Indexed positions are expanded into a raw triangle soup, because
//    createHorsePartBufferInfo draws with gl.drawArrays and has no index
//    buffer.
// 2. Bones with zero geometry (spine.004, front_foot.L/R) are absent from the
//    JSON but still sit in the middle of the parent chain, so each part's
//    parent is walked up until it lands on a bone that actually exists.
//    A part whose chain reaches the top this way gets parent: null.
//
// Usage: node exploration/fbx_way/generate_horse_mesh_js.js

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const IN_PATH = path.join(__dirname, "horse_rig.json");
const OUT_PATH = path.join(ROOT, "game", "horse-mesh.js");

const HIDE = [139, 90, 60, 255];
const MANE = [58, 42, 32, 255];
const HOOF = [48, 44, 42, 255];

// Manes, tails and hooves read as the wrong animal in a single flat brown, and
// the cost is one extra colour per part rather than per vertex.
const COLOR_BY_PART = {
  spine: MANE,
  "spine.001": MANE,
  "spine.002": MANE,
  "spine.003": MANE,
  "spine.010": MANE,
  "spine.011": MANE,
  "toe.L": HOOF,
  "toe.R": HOOF,
  "front_toe.L": HOOF,
  "front_toe.R": HOOF,
};

// Bones the extractor dropped for having no vertices, and what they hung off.
// Without these the walk below cannot get past front_foot.L/R and the front
// hooves detach from their legs.
const GEOMETRYLESS_BONE_PARENTS = {
  "spine.004": null,
  "front_foot.L": "front_shin.L",
  "front_foot.R": "front_shin.R",
};

function nearestPresentAncestor(parts, name) {
  let parent = parts[name].parent;
  while (parent && !(parent in parts)) {
    if (!(parent in GEOMETRYLESS_BONE_PARENTS)) {
      throw new Error(`${name}: unknown ancestor ${parent}`);
    }
    parent = GEOMETRYLESS_BONE_PARENTS[parent];
  }
  return parent || null;
}

function buildPart(parts, name) {
  const part = parts[name];
  const positions = [];
  for (const index of part.indices) {
    const vertex = part.positions[index];
    if (!vertex || vertex.length !== 3 || vertex.some((v) => !Number.isFinite(v))) {
      throw new Error(`${name}: bad vertex at index ${index}`);
    }
    positions.push(vertex[0], vertex[1], vertex[2]);
  }
  return {
    pivot: part.pivot,
    parent: nearestPresentAncestor(parts, name),
    color: COLOR_BY_PART[name] || HIDE,
    positions,
  };
}

function main() {
  const parts = JSON.parse(fs.readFileSync(IN_PATH, "utf8")).parts;
  const names = Object.keys(parts);

  const chunks = names.map((name) => {
    const built = buildPart(parts, name);
    const parent = built.parent === null ? "null" : JSON.stringify(built.parent);
    return [
      `  ${JSON.stringify(name)}: {`,
      `    pivot: [${built.pivot.join(",")}],`,
      `    parent: ${parent},`,
      `    color: [${built.color.join(",")}],`,
      `    positions: [${built.positions.join(",")}],`,
      `  },`,
    ].join("\n");
  });

  const source = `"use strict";

// Low-poly horse mesh, extracted from exploration/fbx_way/new_horse_1.glb via
// exploration/fbx_way/extract_horse_rig.py and formatted by
// exploration/fbx_way/generate_horse_mesh_js.js. Every vertex is assigned to
// the single bone that skins it most strongly (weight blending dropped), so
// each part is a rigid chunk rotating as one unit around its bone's rest-pose
// head, and the gait animation in horse-rig.js moves real geometry.
//
// pivot is absolute game-space; positions are relative to that pivot, so a
// node's local translation is its pivot minus its parent's. parent is null for
// the two parts whose bone hangs off the geometry-less armature root. color is
// one flat RGBA per part, expanded per-vertex when the buffer is built.
var HORSE_PARTS = {
${chunks.join("\n")}
};

function createHorsePartBufferInfo(gl, partName) {
  var part = HORSE_PARTS[partName];
  var positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(part.positions), gl.STATIC_DRAW);

  var numVertices = part.positions.length / 3;
  var colors = new Uint8Array(numVertices * 4);
  for (var i = 0; i < numVertices; i++) {
    colors.set(part.color, i * 4);
  }
  var colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);

  return {
    numElements: part.positions.length / 3,
    positionBuffer: positionBuffer,
    colorBuffer: colorBuffer,
  };
}
`;

  fs.writeFileSync(OUT_PATH, source);
  const roots = names.filter((n) => nearestPresentAncestor(parts, n) === null);
  console.log(`wrote ${OUT_PATH}: ${names.length} parts, roots: ${roots.join(", ")}`);
}

main();
