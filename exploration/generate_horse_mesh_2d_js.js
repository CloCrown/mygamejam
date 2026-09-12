"use strict";

// Converts horse_rig_2d.json (produced by extract_horse_rig_2d.py) into a
// generated JS data file for the game. Mirrors explore-3's
// generate_horse_mesh_skinned_js.js: this output is data only, never
// hand-edited — re-run this script (and the Blender extraction before it)
// whenever the rig/mesh changes in Blender.
//
// Usage: node generate_horse_mesh_2d_js.js

const fs = require("fs");
const path = require("path");

const IN_PATH = path.join(__dirname, "horse_rig_2d.json");
const OUT_PATH = path.join(__dirname, "..", "game", "horse-mesh-2d.js");

const data = JSON.parse(fs.readFileSync(IN_PATH, "utf8"));

const boneNames = Object.keys(data.bones);
const boneIndex = {};
boneNames.forEach((name, i) => { boneIndex[name] = i; });

const bonesOut = boneNames.map((name) => {
  const b = data.bones[name];
  return {
    name,
    parent: b.parent !== null ? boneIndex[b.parent] : -1,
    head: b.head,
    tail: b.tail,
  };
});

const numVerts = data.vertices.length;
const positions = new Array(numVerts * 2);
const boneA = new Array(numVerts);
const weightA = new Array(numVerts);
const boneB = new Array(numVerts);
const weightB = new Array(numVerts);

data.vertices.forEach((v, i) => {
  positions[i * 2] = v.position[0];
  positions[i * 2 + 1] = v.position[1];
  const infA = v.influences[0];
  const infB = v.influences[1];
  boneA[i] = infA ? boneIndex[infA[0]] : 0;
  weightA[i] = infA ? infA[1] : 1;
  boneB[i] = infB ? boneIndex[infB[0]] : -1;
  weightB[i] = infB ? infB[1] : 0;
});

function arrToStr(arr, decimals) {
  if (decimals === undefined) return "[" + arr.join(",") + "]";
  return "[" + arr.map((x) => x.toFixed(decimals)).join(",") + "]";
}

const lines = [];
lines.push('"use strict";');
lines.push("");
lines.push("// GENERATED FILE - do not hand-edit.");
lines.push("// Regenerate with: blender --background --python exploration/extract_horse_rig_2d.py");
lines.push("//               && node exploration/generate_horse_mesh_2d_js.js");
lines.push("");
lines.push("var HORSE_BONES_2D_DATA = " + JSON.stringify(bonesOut) + ";");
lines.push("");
lines.push("var HORSE_SKIN_2D = {");
lines.push("  positions: new Float32Array(" + arrToStr(positions, 4) + "),");
lines.push("  indices: new Uint16Array(" + arrToStr(data.indices) + "),");
lines.push("  boneA: new Uint8Array(" + arrToStr(boneA) + "),");
lines.push("  weightA: new Float32Array(" + arrToStr(weightA, 3) + "),");
lines.push("  boneB: new Int8Array(" + arrToStr(boneB) + "),");
lines.push("  weightB: new Float32Array(" + arrToStr(weightB, 3) + "),");
lines.push("};");
lines.push("");

fs.writeFileSync(OUT_PATH, lines.join("\n"));

console.log("=== 2D MESH JS GENERATED ===");
console.log("bones:", bonesOut.length);
console.log("vertices:", numVerts);
console.log("triangles:", data.indices.length / 3);
console.log("written to:", OUT_PATH);
