"use strict";

// Exploration: a live debug panel with X/Y/Z sliders to find the tail
// chain's correct rotation by eye instead of guessing values, changing
// code, and reloading each time. Kept in its own file, easy to drop —
// see CLAUDE.md, exploration phase.
//
// The same angle is applied to every link of TAIL_CHAIN (not split across
// links) so the whole tail swings as one rigid segment while searching for
// the right direction; once the right axis/angle is found it can be
// re-split proportionally in horse-rig-skinned.js like the other
// procedural rotations there.
var TailDebugPanel = (function() {
  var TAIL_CHAIN = ["spine.003", "spine.002", "spine.001", "spine"];
  var state = { x: 0, y: 0, z: 0 };

  function createUI() {
    var panel = document.createElement("div");
    panel.style.cssText =
      "position:fixed;top:12px;right:12px;z-index:1000;" +
      "background:rgba(20,20,30,0.85);color:#fff;font:12px system-ui,sans-serif;" +
      "padding:10px 12px;border-radius:8px;width:220px;";
    panel.innerHTML =
      "<div style='font-weight:bold;margin-bottom:6px;'>Tail rotation (debug)</div>" +
      ["x", "y", "z"].map(function(axis) {
        return (
          "<div style='margin-bottom:6px;'>" +
          "<label>" + axis.toUpperCase() + ": <span id='tail-debug-" + axis + "-val'>0.00</span> rad</label><br>" +
          "<input id='tail-debug-" + axis + "' type='range' min='-3.1416' max='3.1416' step='0.01' value='0' style='width:100%;'>" +
          "</div>"
        );
      }).join("") +
      "<button id='tail-debug-reset' style='width:100%;padding:4px;'>Reset to 0</button>";
    document.body.appendChild(panel);

    ["x", "y", "z"].forEach(function(axis) {
      var input = panel.querySelector("#tail-debug-" + axis);
      var valEl = panel.querySelector("#tail-debug-" + axis + "-val");
      input.addEventListener("input", function() {
        state[axis] = parseFloat(input.value);
        valEl.textContent = state[axis].toFixed(2);
      });
    });
    panel.querySelector("#tail-debug-reset").addEventListener("click", function() {
      ["x", "y", "z"].forEach(function(axis) {
        state[axis] = 0;
        panel.querySelector("#tail-debug-" + axis).value = 0;
        panel.querySelector("#tail-debug-" + axis + "-val").textContent = "0.00";
      });
    });
  }

  createUI();

  // Call once per frame, after horse.animate(...) and before
  // playerRoot.updateWorldMatrix(), so this override isn't clobbered by
  // the procedural animation and does get baked into the world matrices
  // used for skinning/rendering that frame.
  function apply(rig) {
    TAIL_CHAIN.forEach(function(name) {
      var trs = rig.nodeInfosByName[name].trs;
      trs.rotation[0] = state.x;
      trs.rotation[1] = state.y;
      trs.rotation[2] = state.z;
    });
  }

  return { apply: apply };
})();
