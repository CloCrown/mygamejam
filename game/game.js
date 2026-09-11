"use strict";

// Assembles the scene from gl-utils.js (matrix/scene-graph helpers),
// track2.js (ground/markers, one of several TRACKS configs) and
// horse-mesh.js/horse-rig.js (the player character, a segmented low-poly
// mesh with a gait animation), then runs input, camera and the render loop.

function main(trackIndex, hornColor) {
  var canvas = document.querySelector("#canvas");
  var gl = canvas.getContext("webgl");
  if (!gl) return;

  var track = createTrack(TRACKS[trackIndex]);
  var MAP_SIZE = track.mapSize;
  var TRACK_RADIUS_X = track.trackRadiusX;

  var groundBufferInfo = track.createGroundBufferInfo(gl);
  var markerBufferInfo = createCubeBufferInfo(gl, 2, [0.9, 0.2, 0.2, 1]);
  var markerPositions = track.createMarkerPositions();

  // Finish line: a checkered row of flat black/white cubes across the track
  // width, at the spawn waypoint.
  var finishLine = track.createFinishLinePositions();
  var finishBufferInfoBlack = createCubeBufferInfo(gl, 2, [0.05, 0.05, 0.05, 1]);
  var finishBufferInfoWhite = createCubeBufferInfo(gl, 2, [0.95, 0.95, 0.95, 1]);
  var finishLineSquares = [];
  (function() {
    var count = Math.ceil((finishLine.half * 2) / 2);
    for (var i = 0; i < count; i++) {
      var t = -finishLine.half + i * 2 + 1;
      finishLineSquares.push({
        x: finishLine.x + finishLine.nx * t,
        z: finishLine.z + finishLine.nz * t,
        black: i % 2 === 0,
      });
    }
  })();

  // Rainbow power-ups: 7 pickups (see powerups.js) aligned side by side,
  // each arming one temporary effect that overrides a tuning constant
  // below; a collected pickup respawns after PICKUP_RESPAWN_DELAY.
  var pickupBufferInfo = createCubeBufferInfo(gl, 1.6, [1, 1, 1, 1]);
  var pickups = createPickups(track.createPickupPositions());
  var activeEffect = null; // ActiveEffect | null

  // Obstacles (see obstacles.js/obstacle-types.js): one buffer per
  // registered type, built generically from OBSTACLE_TYPES — adding a new
  // type there (or in a type-defining file loaded after it) is enough to
  // make it drawable, no change needed here.
  var obstacleBufferInfoByType = {};
  Object.keys(OBSTACLE_TYPES).forEach(function(typeName) {
    var t = OBSTACLE_TYPES[typeName];
    // createCubeBufferInfo takes a single uniform size, so a non-cube type
    // (t.size with unequal x/y/z) is built at its largest dimension (t.maxSize,
    // precomputed in obstacle-types.js) and squashed to the real proportions
    // via a per-draw non-uniform scale (t.scale) below — one shared cube
    // mesh instead of a distinct buffer per shape.
    obstacleBufferInfoByType[typeName] = createCubeBufferInfo(gl, t.maxSize, t.color);
  });
  var obstacleSpawns = track.createObstaclePositions();
  var obstacles = createObstacles(obstacleSpawns.positions, obstacleSpawns.types);

  // ---- Manual-trigger powerups: "&" fires the fixed horn-color effect
  // (on cooldown), "é" fires whatever pickup color is currently in
  // reserve (armed by touching a box, one slot, replaces on new touch).
  var reservedColor = null; // 0..6 | null
  var hornCooldownReadyAt = 0;

  // ---- Timer + minimap overlays (plain DOM/2D canvas, no WebGL). ----
  var timerEl = document.querySelector("#timer");
  var minimap = document.querySelector("#minimap");
  var minimapCtx = minimap.getContext("2d");
  var raceStartTime = null;

  function formatTime(seconds) {
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function worldToMinimap(x, z) {
    var half = (MAP_SIZE / 2) * CELL;
    return [
      (x + half) / (half * 2) * minimap.width,
      (z + half) / (half * 2) * minimap.height,
    ];
  }

  function drawMinimap() {
    var ctx = minimapCtx;
    ctx.clearRect(0, 0, minimap.width, minimap.height);

    ctx.strokeStyle = "#ccc";
    ctx.lineWidth = 3;
    ctx.beginPath();
    track.waypoints.forEach(function(w, i) {
      var p = worldToMinimap(w[0], w[1]);
      if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    });
    ctx.closePath();
    ctx.stroke();

    var spawn = worldToMinimap(track.waypoints[0][0], track.waypoints[0][1]);
    ctx.fillStyle = "#fff";
    ctx.fillRect(spawn[0] - 3, spawn[1] - 3, 6, 6);

    var pp = worldToMinimap(player.x, player.z);
    ctx.fillStyle = "#f22";
    ctx.beginPath();
    ctx.arc(pp[0], pp[1], 4, 0, Math.PI * 2);
    ctx.fill();

    var op = worldToMinimap(obstacleHorse.state.x, obstacleHorse.state.z);
    ctx.fillStyle = "#66f";
    ctx.beginPath();
    ctx.arc(op[0], op[1], 4, 0, Math.PI * 2);
    ctx.fill();

    var aip = worldToMinimap(aiHorse.state.x, aiHorse.state.z);
    ctx.fillStyle = "#f8f";
    ctx.beginPath();
    ctx.arc(aip[0], aip[1], 4, 0, Math.PI * 2);
    ctx.fill();
  }


  var program = createProgram(
    gl,
    document.querySelector("#vertex-shader-3d").text,
    document.querySelector("#fragment-shader-3d").text
  );
  var positionLoc = gl.getAttribLocation(program, "a_position");
  var colorLoc = gl.getAttribLocation(program, "a_color");
  var texcoordLoc = gl.getAttribLocation(program, "a_texcoord");
  var normalLoc = gl.getAttribLocation(program, "a_normal");
  var useVertexColorLoc = gl.getAttribLocation(program, "a_useVertexColor");
  var matrixLoc = gl.getUniformLocation(program, "u_matrix");
  var worldLoc = gl.getUniformLocation(program, "u_world");
  var colorMultLoc = gl.getUniformLocation(program, "u_colorMult");
  var colorOffsetLoc = gl.getUniformLocation(program, "u_colorOffset");
  var useTextureLoc = gl.getUniformLocation(program, "u_useTexture");

  function degToRad(d) {
    return d * Math.PI / 180;
  }

  var fieldOfViewRadians = degToRad(60);

  var HORSE_SCALE = 2.2;

  // ---- Player state & controls ----
  // Start the unicorn on the track, at its western point.
  var player = {
    x: -TRACK_RADIUS_X * CELL,
    z: 0,
    heading: degToRad(45), // radians, 0 = facing +Z — smoothed, used for rendering/camera; debug: was a separate 45deg offset on the root, folded into heading itself since spawnHorse's root has no rotation of its own to carry it
    y: 0, vy: 0, grounded: true, // jump state, always available (not power-up gated)
  };

  // Every horse rendered in the scene shares construction (root + skinned
  // rig) via spawnHorse (see horse-instance.js) — only their behavior
  // differs, applied to each instance's `state` before syncToState()/
  // animate() run in the frame loop below.
  //
  // Player: state IS `player` above (not a copy), so player movement code
  // just writes x/z/heading directly and the instance follows.
  var playerHorse = spawnHorse(gl, HORSE_SCALE, player, PICKUP_COLORS[hornColor]);

  // Spawn spots for both non-player horses come from the track itself (see
  // track2.js's createHorseSpawnPositions) — a fixed offset from map
  // bounds only happened to land on the road for some TRACKS configs and
  // put both horses on the grass for others.
  var horseSpawns = track.createHorseSpawnPositions();

  // Collision-test bot: no behavior of its own (never moves on its own),
  // but unlike a true static obstacle it does get shoved by contact — see
  // the push-apart resolution below, which moves obstacleHorse.state too.
  var obstacleHorse = spawnHorse(gl, HORSE_SCALE, horseSpawns.obstacle);
  obstacleHorse.syncToState();
  var wasColliding = false; // edge-detects contact start, so hitSoft plays once per bump, not every frame while overlapping

  // AI/chase horse: steers toward and chases the player every frame (see
  // ai-horse.js), unlike obstacleHorse above. Spawned near the pickup row
  // so it's immediately visible/testable at race start.
  var aiHorse = spawnHorse(gl, HORSE_SCALE, createAiHorse(horseSpawns.ai.x, horseSpawns.ai.z, horseSpawns.ai.heading));
  var aiWasColliding = false;

  // AI power-ups: same reserve-then-activate model as the player (arm on
  // touch via collectPickupsToReserve, fire via activateReservedEffect —
  // both already generic over "any {x,z}", see powerups.js), but since the
  // AI has no "é" key, it activates on its own after a random human-ish
  // delay instead of waiting for input.
  var aiActiveEffect = null; // ActiveEffect | null
  var aiReservedColor = null; // 0..6 | null
  var aiActivateAt = null; // timestamp (game clock) to auto-fire aiReservedColor, or null when nothing's reserved

  // Collision radii: a bit larger than the half-length of the 2.2m-long
  // body so the head/tail also count, kept as simple circles in the XZ plane.
  var UNICORN_COLLISION_RADIUS = 1.3;

  var MOVE_SPEED = 12; // meters/sec
  var TURN_SPEED = 2.2; // radians/sec, Q/D steering
  var JUMP_SPEED = 9; // m/s, initial vertical velocity on Space
  var GRAVITY = 24; // m/s^2

  var keys = {};
  // Edge-triggered presses (& for the horn powerup, é for the reserved
  // pickup effect): both should fire once per press, not repeatedly while
  // held, so keydown latches a flag here that drawScene consumes and
  // clears the same frame — reading `keys` directly would keep firing
  // every frame the key stays down.
  var justPressed = {};
  window.addEventListener("keydown", function(e) {
    var key = e.key.toLowerCase();
    if (!keys[key]) justPressed[key] = true;
    keys[key] = true;
  });
  window.addEventListener("keyup", function(e) { keys[e.key.toLowerCase()] = false; });

  // Camera orbits independently of the unicorn's heading: dragging the mouse
  // (pointer lock) only swings the view around it, steering is Z/S/Q/D.
  var MOUSE_SENSITIVITY = 0.0025;
  var camOrbit = 0; // radians, added to heading for the camera only
  canvas.addEventListener("click", function() {
    canvas.requestPointerLock();
    Audio_.startMusic(); // first user gesture: browsers block audio before this
  });
  window.addEventListener("mousemove", function(e) {
    if (document.pointerLockElement === canvas) {
      camOrbit -= e.movementX * MOUSE_SENSITIVITY;
    }
  });

  function resizeCanvasToDisplaySize(canvas) {
    var width = canvas.clientWidth;
    var height = canvas.clientHeight;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  gl.useProgram(program);
  gl.enableVertexAttribArray(positionLoc);
  gl.enableVertexAttribArray(colorLoc);
  gl.enableVertexAttribArray(texcoordLoc);
  gl.enableVertexAttribArray(normalLoc);

  window.__debugPlayer = player;
  window.__debugObstacle = obstacleHorse.state;
  window.__debugAi = aiHorse.state;
  window.__debugGetActiveEffect = function() { return activeEffect; };
  window.__debugGetPickups = function() { return pickups; };

  var lastTime = 0;
  requestAnimationFrame(drawScene);

  function drawScene(timeMs) {
    var time = timeMs * 0.001;
    var dt = lastTime ? Math.min(time - lastTime, 0.1) : 0;
    lastTime = time;
    if (raceStartTime === null) raceStartTime = time;
    timerEl.textContent = formatTime(time - raceStartTime);

    resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.6, 0.8, 0.95, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // ---- Power-ups: expire the active effect, respawn collected pickups
    // after their delay, then arm the reserve slot on a new touch (not
    // activate immediately — "é" fires it, see below). Touching a new
    // color always replaces whatever was in reserve (never stacks). ----
    activeEffect = tickEffect(activeEffect, time);
    tickPickups(pickups, time);
    var effectRadius = UNICORN_COLLISION_RADIUS * effectScaleMultiplier(activeEffect);
    var reservedColorBefore = reservedColor;
    reservedColor = collectPickupsToReserve(pickups, player, reservedColor, time, effectRadius);
    if (reservedColor !== reservedColorBefore) Audio_.play("pickup");

    // "&": fixed horn-color effect, on its own cooldown (independent of
    // the reserve slot — the horn color never runs out).
    if (justPressed["&"]) {
      var hornResult = activateHornEffect(hornColor, hornCooldownReadyAt, time);
      if (hornResult) {
        activeEffect = hornResult.effect;
        hornCooldownReadyAt = hornResult.cooldownReadyAt;
        Audio_.play("effectActivate");
      }
    }
    // "é": fires whatever's in reserve, clearing the slot.
    if (justPressed["é"] && reservedColor !== null) {
      activeEffect = activateReservedEffect(reservedColor, time);
      reservedColor = null;
      Audio_.play("effectActivate");
    }
    justPressed["&"] = false;
    justPressed["é"] = false;

    effectRadius = UNICORN_COLLISION_RADIUS * effectScaleMultiplier(activeEffect);

    // ---- AI power-ups: same tick/collect as the player above, but fires
    // on its own after a random delay instead of waiting for "é". ----
    aiActiveEffect = tickEffect(aiActiveEffect, time);
    var aiEffectRadius = UNICORN_COLLISION_RADIUS * effectScaleMultiplier(aiActiveEffect);
    var aiReservedColorBefore = aiReservedColor;
    aiReservedColor = collectPickupsToReserve(pickups, aiHorse.state, aiReservedColor, time, aiEffectRadius);
    if (aiReservedColor !== aiReservedColorBefore) {
      // Newly armed: schedule a human-ish random delay (0.5-2.5s) before it
      // fires on its own, same one-slot-replaces-on-new-touch rule as the
      // player's reserve (re-touching resets the timer along with the color).
      aiActivateAt = time + 0.5 + Math.random() * 2;
    }
    if (aiReservedColor !== null && time >= aiActivateAt) {
      aiActiveEffect = activateReservedEffect(aiReservedColor, time);
      aiReservedColor = null;
      aiActivateAt = null;
    }
    aiEffectRadius = UNICORN_COLLISION_RADIUS * effectScaleMultiplier(aiActiveEffect);

    // ---- Jump: Space gives a vertical impulse, simple gravity, lands back
    // on the ground plane — always available, independent of power-ups
    // (orange only boosts the impulse strength). ----
    if (keys[" "] && player.grounded) {
      player.vy = JUMP_SPEED * effectJumpMultiplier(activeEffect);
      player.grounded = false;
      Audio_.play("jump");
    }
    var wasGrounded = player.grounded;
    player.vy -= GRAVITY * dt;
    player.y += player.vy * dt;
    if (player.y <= 0) {
      player.y = 0;
      player.vy = 0;
      player.grounded = true;
      if (!wasGrounded) Audio_.play("land");
    }

    // ---- Movement: Z/S (AZERTY) drive forward/back along the unicorn's
    // current heading, Q/D turn it left/right. ----
    var throttle = 0, turn = 0;
    if (keys["z"] || keys["arrowup"]) throttle += 1;
    if (keys["s"] || keys["arrowdown"]) throttle -= 1;
    if (keys["q"] || keys["arrowleft"]) turn += 1;
    if (keys["d"] || keys["arrowright"]) turn -= 1;

    var turnSpeed = TURN_SPEED * effectTurnMultiplier(activeEffect);
    player.heading += turn * turnSpeed * dt;

    var moving = throttle !== 0;
    var moveSpeed = MOVE_SPEED * effectSpeedMultiplier(activeEffect);
    if (moving) {
      player.x += Math.sin(player.heading) * throttle * moveSpeed * dt;
      player.z += Math.cos(player.heading) * throttle * moveSpeed * dt;
    }
    // How fast the player is currently going, normalized 0..1 — feeds every
    // movable-obstacle push-apart below (see movableObstacleShare in
    // obstacles.js), not just collision-specific state.
    var speedFrac = Math.min(Math.abs(throttle) * moveSpeed / MOVE_SPEED, 1);

    var mapHalf = (MAP_SIZE / 2) * CELL;
    player.x = Math.max(-mapHalf, Math.min(mapHalf, player.x));
    player.z = Math.max(-mapHalf, Math.min(mapHalf, player.z));

    // ---- Collision: two circles in the XZ plane; on overlap, split the
    // push-apart between the player and the obstacle instead of only
    // moving the player, weighted by the player's current speed — a fast
    // hit shoves the obstacle hard and barely slows the player down, a
    // near-stationary bump against the obstacle mostly moves the player
    // back out instead. This is the no-damage "who's faster wins" contact;
    // a separate, harder knockback is planned for the perforation power-up.
    // Yellow (invincibility) skips this entirely — the horse passes through. ----
    if (effectIsInvincible(activeEffect)) {
      wasColliding = false; // passing through doesn't count as a bump
    } else {
      var minDist = UNICORN_COLLISION_RADIUS + effectRadius;
      var colliding = Math.hypot(player.x - obstacleHorse.state.x, player.z - obstacleHorse.state.z) < minDist;
      if (colliding && !wasColliding) Audio_.play("hitSoft");
      wasColliding = colliding;

      // Same pushApart/movableObstacleShare formula as the generic obstacle
      // list below (see obstacles.js) — the horse obstacle isn't a
      // registry entry (it has its own rig/animation instead of a cube
      // buffer), so it can't just be another array element, but it still
      // goes through the one shared push-apart implementation.
      var d = pushApart(player, obstacleHorse.state.x, obstacleHorse.state.z, minDist, movableObstacleShare(speedFrac));
      obstacleHorse.state.x += d.dx;
      obstacleHorse.state.z += d.dz;

      // Track obstacles: type-dependent (see obstacle-types.js) — default
      // "rock" blocks fully, a `movable` type instead yields proportionally.
      resolveObstacleCollisions(obstacles, player, effectRadius, speedFrac);
    }

    // AI horse: chases the player every frame (see ai-horse.js) regardless
    // of the player's own invincibility (that only exempts the player from
    // *being pushed*, it doesn't freeze the AI) — its own power-ups affect
    // its speed the same way they affect the player's (effectSpeedMultiplier
    // in powerups.js). Contact resolution is skipped only when either side
    // is currently invincible.
    updateAiHorse(aiHorse.state, player, dt, effectSpeedMultiplier(aiActiveEffect));
    if (effectIsInvincible(activeEffect) || effectIsInvincible(aiActiveEffect)) {
      aiWasColliding = false;
    } else {
      var aiMinDist = UNICORN_COLLISION_RADIUS * effectScaleMultiplier(activeEffect) + aiEffectRadius;
      var aiColliding = Math.hypot(player.x - aiHorse.state.x, player.z - aiHorse.state.z) < aiMinDist;
      if (aiColliding && !aiWasColliding) Audio_.play("hitSoft");
      aiWasColliding = aiColliding;
      var aiD = pushApart(player, aiHorse.state.x, aiHorse.state.z, aiMinDist, movableObstacleShare(speedFrac));
      aiHorse.state.x += aiD.dx;
      aiHorse.state.z += aiD.dz;
    }

    var effectScale = HORSE_SCALE * effectScaleMultiplier(activeEffect);
    playerHorse.root.source.scale = [effectScale, effectScale, effectScale];
    var aiEffectScale = HORSE_SCALE * effectScaleMultiplier(aiActiveEffect);
    aiHorse.root.source.scale = [aiEffectScale, aiEffectScale, aiEffectScale];

    // ---- Camera: third-person, orbits around the unicorn independently of
    // its heading (mouse only steers the view, never the unicorn itself). ----
    var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    var projectionMatrix = m4.perspective(fieldOfViewRadians, aspect, 0.5, 800);

    var camDist = 14, camHeight = 6.5;
    var camAngle = player.heading + camOrbit;
    var cameraPosition = [
      player.x - Math.sin(camAngle) * camDist,
      camHeight,
      player.z - Math.cos(camAngle) * camDist,
    ];
    var target = [player.x, 1.5, player.z];
    var up = [0, 1, 0];
    var cameraMatrix = m4.lookAt(cameraPosition, target, up);
    var viewMatrix = m4.inverse(cameraMatrix);
    var viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);

    playerHorse.syncToState();
    playerHorse.rig.animate(time, moving ? 1 : 0);
    // Exploration: live tail-rotation debug panel (see
    // tail-debug-panel.js) — overrides the tail chain's rotation with
    // slider values, applied after animate() so it isn't clobbered by it.
    TailDebugPanel.apply(playerHorse.rig);
    // Exploration: live side-rotation debug panel (see
    // side-debug-panel.js) — overrides one side's bones with slider values.
    SideDebugPanel.apply(playerHorse.rig);
    playerHorse.root.updateWorldMatrix();

    obstacleHorse.syncToState();
    obstacleHorse.rig.animate(time, 0);
    // rig.animate() ends with an internal root.updateWorldMatrix() call on
    // the rig's own (parentless) root — that recomputes it as if it had no
    // parent, clobbering the transform syncToState() just applied through
    // the instance's outer root. Re-running updateWorldMatrix() on the
    // outer root re-propagates the correct parented transform back down;
    // see the same pattern for playerHorse above (needed there anyway for
    // the debug panels applied after animate()).
    obstacleHorse.root.updateWorldMatrix();

    aiHorse.syncToState();
    aiHorse.rig.animate(time, 1); // always "moving" — it's always chasing
    aiHorse.root.updateWorldMatrix();

    function drawObject(bufferInfo, worldMatrix, colorMult, colorOffset) {
      var matrix = m4.multiply(viewProjectionMatrix, worldMatrix);

      gl.bindBuffer(gl.ARRAY_BUFFER, bufferInfo.positionBuffer);
      gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, bufferInfo.colorBuffer);
      gl.vertexAttribPointer(colorLoc, 4, gl.UNSIGNED_BYTE, true, 0, 0);

      // Textured meshes (the horse) carry a texcoord buffer + texture and
      // switch the shader to sample it instead of vertex color; everything
      // else (ground, markers, gizmo) keeps the cheap flat-color path, but
      // a_texcoord stays bound to *something* (the position buffer works,
      // its content is never read since u_useTexture is 0) since the
      // attribute is always enabled.
      if (bufferInfo.texcoordBuffer) {
        gl.bindBuffer(gl.ARRAY_BUFFER, bufferInfo.texcoordBuffer);
        gl.vertexAttribPointer(texcoordLoc, 2, gl.FLOAT, false, 0, 0);
        gl.bindTexture(gl.TEXTURE_2D, bufferInfo.texture);
        gl.uniform1f(useTextureLoc, 1);
      } else {
        gl.bindBuffer(gl.ARRAY_BUFFER, bufferInfo.positionBuffer);
        gl.vertexAttribPointer(texcoordLoc, 2, gl.FLOAT, false, 12, 0);
        gl.uniform1f(useTextureLoc, 0);
      }

      // Objects without a computed normal buffer (ground, markers, gizmo)
      // use a fixed up-facing normal via the disabled-attribute constant
      // value, cheap flat lighting good enough for those flat shapes.
      if (bufferInfo.normalBuffer) {
        gl.enableVertexAttribArray(normalLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, bufferInfo.normalBuffer);
        gl.vertexAttribPointer(normalLoc, 3, gl.FLOAT, false, 0, 0);
      } else {
        gl.disableVertexAttribArray(normalLoc);
        gl.vertexAttrib3f(normalLoc, 0, 1, 0);
      }

      // Per-vertex "use flat vertex color instead of the texture" flag
      // (see the horn on the horse); defaults to 0 (always follow
      // u_useTexture as before) for every object without this buffer.
      if (bufferInfo.useVertexColorBuffer) {
        gl.enableVertexAttribArray(useVertexColorLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, bufferInfo.useVertexColorBuffer);
        gl.vertexAttribPointer(useVertexColorLoc, 1, gl.FLOAT, false, 0, 0);
      } else {
        gl.disableVertexAttribArray(useVertexColorLoc);
        gl.vertexAttrib1f(useVertexColorLoc, 0);
      }

      gl.uniformMatrix4fv(matrixLoc, false, matrix);
      gl.uniformMatrix4fv(worldLoc, false, worldMatrix);
      gl.uniform4fv(colorMultLoc, colorMult);
      gl.uniform4fv(colorOffsetLoc, colorOffset);

      gl.drawArrays(gl.TRIANGLES, 0, bufferInfo.numElements);
    }

    // Ground (single draw call for the whole 200x200m map).
    drawObject(groundBufferInfo, m4.identity(), [1, 1, 1, 1], [0, 0, 0, 0]);

    // Markers around the outer edge of the ring.
    markerPositions.forEach(function(p) {
      var m = m4.translation(p[0], p[1], p[2]);
      drawObject(markerBufferInfo, m, [1, 1, 1, 1], [0, 0, 0, 0]);
    });

    // Finish line: checkered squares across the track at the spawn waypoint.
    finishLineSquares.forEach(function(sq) {
      var m = m4.translation(sq.x, 0.05, sq.z);
      m4.scale(m, 1, 0.05, 1, m);
      drawObject(sq.black ? finishBufferInfoBlack : finishBufferInfoWhite, m, [1, 1, 1, 1], [0, 0, 0, 0]);
    });

    // Rainbow pickups still on the track, spinning/bobbing so they read as
    // collectibles rather than scenery.
    pickups.forEach(function(p) {
      if (p.respawnAt !== null) return;
      var m = m4.translation(p.x, 1.5 + Math.sin(time * 2 + p.color) * 0.3, p.z);
      m4.yRotate(m, time * 1.5, m);
      drawObject(pickupBufferInfo, m, PICKUP_COLORS[p.color], [0, 0, 0, 0]);
    });

    // Obstacles along the track — position may change frame to frame for a
    // movable type (see resolveObstacleCollisions above), but the draw
    // itself has no other per-frame state. A destroyed obstacle is skipped
    // entirely rather than drawn some other way — future rubble/debris
    // visuals belong to whatever code calls destroyObstacle(), not here.
    // The buffer is a shared cube at each type's largest dimension (see
    // obstacleBufferInfoByType above); scaling it back down per-axis here
    // gives every type its real proportions from one mesh.
    obstacles.forEach(function(o) {
      if (o.destroyed) return;
      var t = o.typeInfo;
      var m = m4.translation(o.x, t.yOffset, o.z);
      m4.scale(m, t.scale[0], t.scale[1], t.scale[2], m);
      drawObject(obstacleBufferInfoByType[o.type], m, [1, 1, 1, 1], [0, 0, 0, 0]);
    });

    // Horses (player + collision-test bot + AI chaser). The player and AI
    // horses are tinted by their own active effect's color — the only
    // feedback either gets that a power-up is running (no HUD); the
    // static bot draws at its rig's own default tint (u_colorMult,
    // untouched by power-ups, since it never picks any up).
    var effectTint = activeEffect ? PICKUP_COLORS[activeEffect.color] : [1, 1, 1, 1];
    playerHorse.rig.objects.forEach(function(object) {
      var uniforms = object.drawInfo.uniforms;
      drawObject(object.drawInfo.bufferInfo, object.worldMatrix, effectTint, uniforms.u_colorOffset);
    });
    var aiEffectTint = aiActiveEffect ? PICKUP_COLORS[aiActiveEffect.color] : [1, 1, 1, 1];
    aiHorse.rig.objects.forEach(function(object) {
      var uniforms = object.drawInfo.uniforms;
      drawObject(object.drawInfo.bufferInfo, object.worldMatrix, aiEffectTint, uniforms.u_colorOffset);
    });
    obstacleHorse.rig.objects.forEach(function(object) {
      var uniforms = object.drawInfo.uniforms;
      drawObject(object.drawInfo.bufferInfo, object.worldMatrix, uniforms.u_colorMult, uniforms.u_colorOffset);
    });

    drawMinimap();

    requestAnimationFrame(drawScene);
  }
}

// ---- Pre-race menu: pick a fixed horn color (used by the "&" powerup,
// see powerups.js), then a track. Track buttons are disabled until a
// color is chosen so a race never starts without one. ----
function showTrackMenu() {
  var menu = document.querySelector("#track-menu");
  var colorList = document.querySelector("#horn-color-list");
  var list = document.querySelector("#track-list");
  var selectedHornColor = null;
  var trackButtons = [];

  var colorSwatches = colorList ? PICKUP_COLORS.map(function(rgba, i) {
    var swatch = document.createElement("button");
    swatch.style.background =
      "rgb(" + Math.round(rgba[0]*255) + "," + Math.round(rgba[1]*255) + "," + Math.round(rgba[2]*255) + ")";
    swatch.style.width = "32px";
    swatch.style.height = "32px";
    swatch.style.margin = "4px";
    swatch.style.border = "2px solid transparent";
    swatch.style.cursor = "pointer";
    swatch.addEventListener("click", function() {
      selectedHornColor = i;
      colorSwatches.forEach(function(s, si) { s.style.border = si === i ? "2px solid #fff" : "2px solid transparent"; });
      trackButtons.forEach(function(b) { b.disabled = false; });
    });
    colorList.appendChild(swatch);
    return swatch;
  }) : [];

  TRACKS.forEach(function(t, i) {
    var btn = document.createElement("button");
    btn.textContent = t.name;
    btn.disabled = true;
    btn.addEventListener("click", function() {
      if (selectedHornColor === null) return;
      menu.style.display = "none";
      document.querySelector("#canvas").style.display = "block";
      document.querySelector("#timer").style.display = "block";
      document.querySelector("#minimap").style.display = "block";
      main(i, selectedHornColor);
    });
    list.appendChild(btn);
    trackButtons.push(btn);
  });
}

showTrackMenu();
