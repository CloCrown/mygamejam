"use strict";

// Assembles the scene from gl-utils.js (matrix/scene-graph helpers),
// track.js (ground/markers) and unicorn-rig.js (the player character),
// then runs input, camera and the render loop.

function main() {
  var canvas = document.querySelector("#canvas");
  var gl = canvas.getContext("webgl");
  if (!gl) return;

  var groundBufferInfo = createGroundBufferInfo(gl);
  var markerBufferInfo = createCubeBufferInfo(gl, 2, [0.9, 0.2, 0.2, 1]);
  var markerPositions = createMarkerPositions();

  var program = createProgram(
    gl,
    document.querySelector("#vertex-shader-3d").text,
    document.querySelector("#fragment-shader-3d").text
  );
  var positionLoc = gl.getAttribLocation(program, "a_position");
  var colorLoc = gl.getAttribLocation(program, "a_color");
  var matrixLoc = gl.getUniformLocation(program, "u_matrix");
  var colorMultLoc = gl.getUniformLocation(program, "u_colorMult");
  var colorOffsetLoc = gl.getUniformLocation(program, "u_colorOffset");

  function degToRad(d) {
    return d * Math.PI / 180;
  }

  var fieldOfViewRadians = degToRad(60);

  // Player rig root: positioned/rotated each frame from player state.
  var playerRoot = new Node(new TRS());
  var unicorn = createUnicornRig(gl);
  unicorn.root.setParent(playerRoot);

  // A second, static unicorn placed a bit ahead on the track, used to
  // prove out circle-circle collision: the player unicorn should be
  // physically blocked from passing through it, not just flash a color.
  var obstacleRoot = new Node(new TRS());
  var obstacleUnicorn = createUnicornRig(gl);
  obstacleUnicorn.root.setParent(obstacleRoot);
  obstacleRoot.source.translation[0] = -TRACK_RADIUS_X * CELL + 20;
  obstacleRoot.source.translation[2] = 8;
  obstacleRoot.source.rotation[1] = Math.PI * 0.5;
  obstacleRoot.updateWorldMatrix();

  // Collision radii: a bit larger than the half-length of the 2.2m-long
  // body so the head/tail also count, kept as simple circles in the XZ plane.
  var UNICORN_COLLISION_RADIUS = 1.3;

  // ---- Player state & controls ----
  // Start the unicorn on the track, at its western point.
  var player = {
    x: -TRACK_RADIUS_X * CELL,
    z: 0,
    heading: 0, // radians, 0 = facing +Z — smoothed, used for rendering/camera
  };

  var MOVE_SPEED = 12; // meters/sec
  var TURN_SPEED = 1.5; // radians/sec, how fast A/D turn the heading

  var keys = {};
  window.addEventListener("keydown", function(e) { keys[e.key.toLowerCase()] = true; });
  window.addEventListener("keyup", function(e) { keys[e.key.toLowerCase()] = false; });

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

  window.__debugPlayer = player;
  window.__debugObstacle = { x: obstacleRoot.source.translation[0], z: obstacleRoot.source.translation[2] };

  var lastTime = 0;
  requestAnimationFrame(drawScene);

  function drawScene(timeMs) {
    var time = timeMs * 0.001;
    var dt = lastTime ? Math.min(time - lastTime, 0.1) : 0;
    lastTime = time;

    resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.6, 0.8, 0.95, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // ---- Movement: vehicle-style. W/S drive forward/back along the
    // unicorn's current heading, A/D turn that heading in place. ----
    var throttle = 0;
    if (keys["w"] || keys["arrowup"]) throttle += 1;
    if (keys["s"] || keys["arrowdown"]) throttle -= 1;
    if (keys["a"] || keys["arrowleft"]) player.heading += TURN_SPEED * dt;
    if (keys["d"] || keys["arrowright"]) player.heading -= TURN_SPEED * dt;

    var moving = throttle !== 0;
    if (moving) {
      player.x += Math.sin(player.heading) * throttle * MOVE_SPEED * dt;
      player.z += Math.cos(player.heading) * throttle * MOVE_SPEED * dt;
    }

    var mapHalf = (MAP_SIZE / 2) * CELL;
    player.x = Math.max(-mapHalf, Math.min(mapHalf, player.x));
    player.z = Math.max(-mapHalf, Math.min(mapHalf, player.z));

    // ---- Collision: physically block the player from overlapping the
    // static obstacle unicorn. Two circles in the XZ plane; on overlap,
    // push the player back out along the center-to-center axis so it
    // rests tangent to the obstacle instead of passing through it. ----
    var obstacleX = obstacleRoot.source.translation[0];
    var obstacleZ = obstacleRoot.source.translation[2];
    var dx = player.x - obstacleX;
    var dz = player.z - obstacleZ;
    var dist = Math.hypot(dx, dz);
    var minDist = UNICORN_COLLISION_RADIUS * 2;
    if (dist < minDist) {
      var pushDist = minDist - dist;
      var nx = dist > 1e-5 ? dx / dist : 1;
      var nz = dist > 1e-5 ? dz / dist : 0;
      player.x += nx * pushDist;
      player.z += nz * pushDist;
    }

    playerRoot.source.translation[0] = player.x;
    playerRoot.source.translation[2] = player.z;
    playerRoot.source.rotation[1] = player.heading;

    // ---- Camera: third-person, follows behind the unicorn's heading. ----
    var aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    var projectionMatrix = m4.perspective(fieldOfViewRadians, aspect, 0.5, 800);

    var camDist = 9, camHeight = 4.5;
    var cameraPosition = [
      player.x - Math.sin(player.heading) * camDist,
      camHeight,
      player.z - Math.cos(player.heading) * camDist,
    ];
    var target = [player.x, 1.5, player.z];
    var up = [0, 1, 0];
    var cameraMatrix = m4.lookAt(cameraPosition, target, up);
    var viewMatrix = m4.inverse(cameraMatrix);
    var viewProjectionMatrix = m4.multiply(projectionMatrix, viewMatrix);

    unicorn.animate(time, moving ? 1 : 0);
    playerRoot.updateWorldMatrix();
    obstacleUnicorn.animate(time, 0);
    obstacleRoot.updateWorldMatrix();

    function drawObject(bufferInfo, worldMatrix, colorMult, colorOffset) {
      var matrix = m4.multiply(viewProjectionMatrix, worldMatrix);

      gl.bindBuffer(gl.ARRAY_BUFFER, bufferInfo.positionBuffer);
      gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, bufferInfo.colorBuffer);
      gl.vertexAttribPointer(colorLoc, 4, gl.UNSIGNED_BYTE, true, 0, 0);

      gl.uniformMatrix4fv(matrixLoc, false, matrix);
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

    // Unicorn rigs (player + static obstacle).
    unicorn.objects.forEach(function(object) {
      var uniforms = object.drawInfo.uniforms;
      drawObject(object.drawInfo.bufferInfo, object.worldMatrix, uniforms.u_colorMult, uniforms.u_colorOffset);
    });
    obstacleUnicorn.objects.forEach(function(object) {
      var uniforms = object.drawInfo.uniforms;
      drawObject(object.drawInfo.bufferInfo, object.worldMatrix, uniforms.u_colorMult, uniforms.u_colorOffset);
    });

    requestAnimationFrame(drawScene);
  }
}

main();
