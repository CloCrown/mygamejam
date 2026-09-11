"use strict";

// Common construction for every horse rendered in the scene (player,
// AI/chase horse, collision-test bot): same scene-graph root + skinned rig,
// built once here instead of copy-pasted per instance in game.js. Behavior
// (how state changes frame to frame — player input, ai-horse.js's chase
// logic, or nothing at all for a static bot) stays external; this only
// owns spawning and the state->transform sync every instance needs
// regardless of behavior.
//
// state: any object with x/z/heading fields (radians, 0 = facing +Z) —
// the player passes its existing `player` object directly so there's one
// state, not a duplicate synced from it; other instances pass a fresh
// {x, z, heading} from ai-horse.js or a plain literal.
// hornColorRgba (optional): passed straight through to
// createHorseRigSkinned — only the player horse (tinted by its chosen horn
// color) uses this; every other instance omits it.
function spawnHorse(gl, scale, state, hornColorRgba) {
  var root = new Node(new TRS());
  var rig = createHorseRigSkinned(gl, hornColorRgba);
  rig.root.setParent(root);
  root.source.scale = [scale, scale, scale];

  // Applies state.x/(y)/z/heading to the root's transform and re-derives
  // its world matrix — call once per frame after behavior code has updated
  // `state`, before animate()/draw so both see the current frame's pose.
  // state.y is optional (only the player has jump height; every other
  // instance stays grounded at 0) so a plain {x, z, heading} literal works
  // for non-player instances without an explicit y: 0.
  function syncToState() {
    root.source.translation[0] = state.x;
    root.source.translation[1] = state.y || 0;
    root.source.translation[2] = state.z;
    root.source.rotation[1] = state.heading;
    root.updateWorldMatrix();
  }

  return { root: root, rig: rig, state: state, syncToState: syncToState };
}
