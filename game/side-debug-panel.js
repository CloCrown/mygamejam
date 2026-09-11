"use strict";

// Exploration: a live debug panel with X/Y/Z sliders to preview how
// rotating every left-side bone (or every right-side bone) as one group
// deforms the horse, ahead of building the actual hit-reaction animation.
// Uses horse-rig-skinned.js's leftBoneNames/rightBoneNames instead of a
// hand-picked bone list, so whichever side is picked here covers the same
// bones the eventual impact code will use. Kept in its own file, easy to
// drop — see CLAUDE.md, exploration phase.
var SideDebugPanel = (function() {
  var state = { side: "left", x: 0, y: 0, z: 0 };

  function createUI() {
    var panel = document.createElement("div");
    panel.style.cssText =
      "position:fixed;top:260px;right:12px;z-index:1000;" +
      "background:rgba(20,20,30,0.85);color:#fff;font:12px system-ui,sans-serif;" +
      "padding:10px 12px;border-radius:8px;width:220px;";
    panel.innerHTML =
      "<div style='font-weight:bold;margin-bottom:6px;'>Side rotation (debug)</div>" +
      "<div style='margin-bottom:6px;'>" +
      "<label><input type='radio' name='side-debug-side' value='left' checked> Left</label> " +
      "<label><input type='radio' name='side-debug-side' value='right'> Right</label>" +
      "</div>" +
      ["x", "y", "z"].map(function(axis) {
        return (
          "<div style='margin-bottom:6px;'>" +
          "<label>" + axis.toUpperCase() + ": <span id='side-debug-" + axis + "-val'>0.00</span> rad</label><br>" +
          "<input id='side-debug-" + axis + "' type='range' min='-3.1416' max='3.1416' step='0.01' value='0' style='width:100%;'>" +
          "</div>"
        );
      }).join("") +
      "<button id='side-debug-reset' style='width:100%;padding:4px;'>Reset to 0</button>";
    document.body.appendChild(panel);

    panel.querySelectorAll("input[name='side-debug-side']").forEach(function(radio) {
      radio.addEventListener("change", function() {
        if (radio.checked) state.side = radio.value;
      });
    });

    ["x", "y", "z"].forEach(function(axis) {
      var input = panel.querySelector("#side-debug-" + axis);
      var valEl = panel.querySelector("#side-debug-" + axis + "-val");
      input.addEventListener("input", function() {
        state[axis] = parseFloat(input.value);
        valEl.textContent = state[axis].toFixed(2);
      });
    });
    panel.querySelector("#side-debug-reset").addEventListener("click", function() {
      ["x", "y", "z"].forEach(function(axis) {
        state[axis] = 0;
        panel.querySelector("#side-debug-" + axis).value = 0;
        panel.querySelector("#side-debug-" + axis + "-val").textContent = "0.00";
      });
    });
  }

  createUI();

  // Call once per frame, after horse.animate(...) and before
  // playerRoot.updateWorldMatrix(), so this override isn't clobbered by
  // the procedural animation and does get baked into the world matrices
  // used for skinning/rendering that frame.
  function apply(rig) {
    var names = state.side === "left" ? rig.leftBoneNames : rig.rightBoneNames;
    names.forEach(function(name) {
      var trs = rig.nodeInfosByName[name].trs;
      trs.rotation[0] = state.x;
      trs.rotation[1] = state.y;
      trs.rotation[2] = state.z;
    });
  }

  return { apply: apply };
})();
