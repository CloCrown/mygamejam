"use strict";

// Checks game/horse-mesh.js + game/horse-rig.js against horse_rig.json: part
// count, parent forest, array integrity, and — the one that actually matters —
// that running the scene graph in the rest pose reproduces every bone's
// absolute pivot, which is what proves the parent-relative translations.
//
// Usage: node exploration/fbx_way/verify_horse_rig.js

const fs = require("fs");
const vm = require("vm");
const path = require("path");

const GAME = path.join(__dirname, "..", "..", "game");
const RIG_JSON = path.join(__dirname, "horse_rig.json");

const buffers = [];
const gl = {
  ARRAY_BUFFER: 1,
  STATIC_DRAW: 2,
  createBuffer: () => ({}),
  bindBuffer: () => {},
  bufferData: (t, data) => buffers.push(data),
};

const ctx = vm.createContext({ console, Math, Float32Array, Uint8Array, Object });
for (const f of ["gl-utils.js", "horse-mesh.js", "horse-rig.js"]) {
  vm.runInContext(fs.readFileSync(path.join(GAME, f), "utf8"), ctx, { filename: f });
}

const P = ctx.HORSE_PARTS;
const names = Object.keys(P);
let failures = 0;
const check = (ok, msg) => {
  if (!ok) { failures++; console.log("FAIL " + msg); } else { console.log("ok   " + msg); }
};

check(names.length === 31, `part count 31 (got ${names.length})`);

// (a) every parent resolves to a real part, or null
const badParent = names.filter((n) => P[n].parent !== null && !(P[n].parent in P));
check(badParent.length === 0, `all parents resolve (bad: ${badParent})`);

const roots = names.filter((n) => P[n].parent === null);
check(roots.length === 2 && roots.includes("spine.003") && roots.includes("spine.005"),
  `exactly 2 roots spine.003/spine.005 (got ${roots})`);

// (b)+(c) array consistency and finite values
let badArrays = [];
for (const n of names) {
  const p = P[n];
  if (p.positions.length % 9 !== 0) badArrays.push(n + ":not-whole-triangles");
  if (p.positions.some((v) => !Number.isFinite(v))) badArrays.push(n + ":nonfinite-pos");
  if (p.color.length !== 4) badArrays.push(n + ":bad-color-len");
  if (p.color.some((v) => !Number.isInteger(v) || v < 0 || v > 255)) badArrays.push(n + ":bad-color");
  if (p.pivot.length !== 3 || p.pivot.some((v) => !Number.isFinite(v))) badArrays.push(n + ":bad-pivot");
}
check(badArrays.length === 0, `arrays consistent, finite, triangle-aligned (bad: ${badArrays})`);

// (e) no cycles, single connected forest
let acyclic = true;
for (const n of names) {
  let seen = new Set([n]), cur = P[n].parent;
  while (cur) { if (seen.has(cur)) { acyclic = false; break; } seen.add(cur); cur = P[cur].parent; }
}
check(acyclic, "no cyclic parent chains");

// front hooves must hang off the front legs, not the rig root
check(P["front_toe.L"].parent === "front_shin.L" && P["front_toe.R"].parent === "front_shin.R",
  "front toes reparented past the geometry-less front_foot bones");

// triangle count matches the source JSON exactly
const src = JSON.parse(fs.readFileSync(RIG_JSON, "utf8")).parts;
const srcTris = Object.values(src).reduce((a, p) => a + p.indices.length / 3, 0);
const outTris = names.reduce((a, n) => a + P[n].positions.length / 9, 0);
check(srcTris === outTris, `triangle count preserved (${srcTris} vs ${outTris})`);

// THE REAL TEST: build the rig, run the scene graph, compare world-space
// vertex positions in the rest pose against the source's absolute coordinates.
const rig = ctx.createHorseRig(gl);
check(rig.root && rig.objects && rig.nodeInfosByName && typeof rig.animate === "function",
  "returns {root, objects, nodeInfosByName, animate}");
check(rig.objects.length === 31, `31 drawable objects (got ${rig.objects.length})`);

const posBytes = buffers.filter((b) => b instanceof Float32Array);
const colBytes = buffers.filter((b) => b instanceof Uint8Array);
check(posBytes.length === 31 && colBytes.length === 31, "31 position + 31 color buffers uploaded");
check(posBytes.every((p, i) => colBytes[i].length / 4 === p.length / 3),
  "expanded color buffers have one RGBA per vertex");
check(rig.objects.every((o) => o.drawInfo.bufferInfo.numElements % 3 === 0),
  "every part draws whole triangles");

rig.root.updateWorldMatrix();
let maxErr = 0, worst = "";
for (const n of names) {
  const m = rig.nodeInfosByName[n].node.worldMatrix;
  // rest pose has no per-part rotation, so the translation column is the
  // world pivot after whatever fixed rotation is baked into the rig root
  // (currently 180deg around Y, since the armature was authored facing +Z
  // but the game's forward is -Z) — mirror that same turn onto the raw
  // JSON pivot before comparing, rather than assuming root is identity.
  const [px, py, pz] = P[n].pivot;
  const want = [-px, py, -pz];
  const got = [m[12], m[13], m[14]];
  for (let i = 0; i < 3; i++) {
    const e = Math.abs(got[i] - want[i]);
    if (e > maxErr) { maxErr = e; worst = n; }
  }
}
check(maxErr < 1e-6, `rest-pose world pivots match the 180deg-turned absolute pivots (max err ${maxErr.toExponential(2)} at ${worst})`);

// animating must not produce NaN anywhere in the hierarchy
for (const t of [0, 0.3, 1.7, 5.5]) {
  rig.animate(t, 1);
  rig.root.updateWorldMatrix();
}
const nan = names.filter((n) => Array.from(rig.nodeInfosByName[n].node.worldMatrix).some((v) => !Number.isFinite(v)));
check(nan.length === 0, `no NaN in world matrices after animate (bad: ${nan})`);

// hooves should stay above ground-ish and legs should actually move
rig.animate(0, 0);
rig.root.updateWorldMatrix();
const restY = rig.nodeInfosByName["toe.L"].node.worldMatrix[13];
let moved = false;
for (let t = 0; t < 2; t += 0.05) {
  rig.animate(t, 1);
  rig.root.updateWorldMatrix();
  if (Math.abs(rig.nodeInfosByName["toe.L"].node.worldMatrix[13] - restY) > 0.05) moved = true;
}
check(moved, "rear hoof actually changes height during the gallop");

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exit(failures ? 1 : 0);
