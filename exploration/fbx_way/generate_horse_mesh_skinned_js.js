"use strict";

// Turns horse_rig_skinned.json (written by extract_horse_rig_skinned.py) into
// game/horse-mesh-skinned.js: bind-pose bone transforms plus one linear-blend
// -skinned mesh, instead of the rigid per-bone parts in horse-mesh.js.
//
// This is an experiment kept alongside the working rigid-skin files
// (horse-mesh.js / horse-rig.js) to fix visible joint tearing during the
// gait animation. Nothing here is wired into game.js yet.
//
// Usage: node exploration/fbx_way/generate_horse_mesh_skinned_js.js

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const IN_PATH = path.join(__dirname, "horse_rig_skinned.json");
const OUT_PATH = path.join(ROOT, "game", "horse-mesh-skinned.js");

function main() {
  const data = JSON.parse(fs.readFileSync(IN_PATH, "utf8"));
  const boneNames = Object.keys(data.bones);
  const boneIndex = {};
  boneNames.forEach((name, i) => { boneIndex[name] = i; });

  const bonesOut = boneNames.map((name) => {
    const b = data.bones[name];
    const parentIdx = b.parent === null ? -1 : boneIndex[b.parent];
    if (b.parent !== null && parentIdx === undefined) {
      throw new Error(`${name}: parent ${b.parent} not found`);
    }
    return `  { name: ${JSON.stringify(name)}, head: [${b.head.join(",")}], parent: ${parentIdx} }`;
  });

  // Tail bones (the spine->spine.003 chain, see horse-rig-skinned.js's
  // TAIL_CHAIN) run mostly along Y (the tail hangs down, Y range ~0.77 vs
  // ~0.3 on X and ~0.18 on Z), so thinning it means scaling its X/Z
  // cross-section around the chain's own center in bind-pose game space,
  // not around world origin (Z in particular sits around 0.6, not 0 -
  // scaling from the origin would shift the tail toward the body instead of
  // just narrowing it).
  const TAIL_BONES = new Set(["spine", "spine.001", "spine.002", "spine.003"]);
  const TAIL_WIDTH_SCALE = 0.6;
  const tailXs = [], tailZs = [];
  for (const v of data.vertices) {
    if (v.influences.some(([name]) => TAIL_BONES.has(name))) {
      tailXs.push(v.position[0]);
      tailZs.push(v.position[2]);
    }
  }
  const tailCenterX = (Math.min(...tailXs) + Math.max(...tailXs)) / 2;
  const tailCenterZ = (Math.min(...tailZs) + Math.max(...tailZs)) / 2;

  // Each vertex: position (bind pose) + UV + up to 2 (boneIndex, weight)
  // pairs, flattened to boneA, weightA, boneB, weightB (weightB implied by
  // 1 - weightA when only one influence exists, so store both explicitly to
  // keep the runtime loop branch-free).
  const positions = [];
  const texcoords = [];
  const boneA = [];
  const weightA = [];
  const boneB = [];
  const weightB = [];
  for (const v of data.vertices) {
    const isTail = v.influences.some(([boneName]) => TAIL_BONES.has(boneName));
    if (isTail) {
      v.position = [
        tailCenterX + (v.position[0] - tailCenterX) * TAIL_WIDTH_SCALE,
        v.position[1],
        tailCenterZ + (v.position[2] - tailCenterZ) * TAIL_WIDTH_SCALE,
      ];
    }
    positions.push(v.position[0], v.position[1], v.position[2]);
    texcoords.push(v.uv[0], v.uv[1]);
    const inf = v.influences;
    if (inf.length === 0) {
      boneA.push(0); weightA.push(0);
      boneB.push(0); weightB.push(0);
    } else if (inf.length === 1) {
      boneA.push(boneIndex[inf[0][0]]); weightA.push(inf[0][1]);
      boneB.push(0); weightB.push(0);
    } else {
      boneA.push(boneIndex[inf[0][0]]); weightA.push(inf[0][1]);
      boneB.push(boneIndex[inf[1][0]]); weightB.push(inf[1][1]);
    }
  }

  const HIDE = [139, 90, 60, 255];
  const HORN_COLOR = [60, 110, 230, 255];
  const numVertices = data.vertices.length;
  const colors = [];
  for (const v of data.vertices) {
    const isHorn = v.influences.some(([boneName]) => boneName === "horn");
    colors.push(...(isHorn ? HORN_COLOR : HIDE));
  }

  const source = `"use strict";

// Linear-blend-skinned horse mesh, extracted from
// exploration/fbx_way/new_horse_1.glb via
// exploration/fbx_way/extract_horse_rig_skinned.py and formatted by
// exploration/fbx_way/generate_horse_mesh_skinned_js.js.
//
// Experiment kept alongside horse-mesh.js (the shipped rigid-skin rig) to
// fix visible joint tearing during the gait animation: every vertex here
// blends up to 2 bone influences instead of rigidly following exactly one,
// so a joint's skin stretches smoothly across the bend instead of tearing
// into two independently-rotating rigid chunks.
//
// HORSE_BONES[i] = { head: bind-pose absolute position, parent: index into
// this same array, or -1 for a root }. HORSE_SKIN holds one flat mesh: bind
// -pose positions plus UV plus, per vertex, up to 2 (boneIndex, weight)
// influences (boneB/weightB are 0 when a vertex has only one influence).
// uv comes straight from Blender's default (un-hand-unwrapped) UV layer, so
// it's coarse — the texture in horse-rig-skinned.js is generated to read ok
// under that mapping rather than assuming a clean per-part unwrap.
var HORSE_BONES = [
${bonesOut.join(",\n")}
];

var HORSE_SKIN = {
  positions: [${positions.join(",")}],
  uvs: [${texcoords.join(",")}],
  boneA: [${boneA.join(",")}],
  weightA: [${weightA.join(",")}],
  boneB: [${boneB.join(",")}],
  weightB: [${weightB.join(",")}],
  colors: [${colors.join(",")}],
  indices: [${data.indices.join(",")}],
};
`;

  fs.writeFileSync(OUT_PATH, source);
  console.log(`wrote ${OUT_PATH}: ${boneNames.length} bones, ${numVertices} vertices, ${data.indices.length / 3} triangles`);
}

main();
