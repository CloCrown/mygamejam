"use strict";

// Builds the unicorn's cube rig (buffers + scene-graph nodes) and returns a
// handle used to attach it to a parent node, animate it, and draw it.
function createUnicornRig(gl) {
  var bodyBufferInfo = createCubeBufferInfo(gl, 1, [0.95, 0.92, 0.98, 1]);
  var hornBufferInfo = createCubeBufferInfo(gl, 1, [1.0, 0.85, 0.3, 1]);
  var maneBufferInfo = createCubeBufferInfo(gl, 1, [0.85, 0.55, 0.95, 1]);
  var torsoBufferInfo = { numElements: bodyBufferInfo.numElements, positionBuffer: null, colorBuffer: bodyBufferInfo.colorBuffer };
  {
    var s = 0.5, positions = [];
    var faces = [
      [[-s,-s, s],[ s,-s, s],[ s, s, s],[-s, s, s]],
      [[-s,-s,-s],[-s, s,-s],[ s, s,-s],[ s,-s,-s]],
      [[-s, s,-s],[-s, s, s],[ s, s, s],[ s, s,-s]],
      [[-s,-s,-s],[ s,-s,-s],[ s,-s, s],[-s,-s, s]],
      [[ s,-s,-s],[ s, s,-s],[ s, s, s],[ s,-s, s]],
      [[-s,-s,-s],[-s,-s, s],[-s, s, s],[-s, s,-s]],
    ];
    faces.forEach(function(f) {
      [0,1,2, 0,2,3].forEach(function(vi) {
        positions.push(f[vi][0] * 1.1, f[vi][1] * 1.1, f[vi][2] * 2.2);
      });
    });
    torsoBufferInfo.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, torsoBufferInfo.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
  }

  var partBufferInfo = {
    body: torsoBufferInfo,
    horn: hornBufferInfo,
    tail: maneBufferInfo,
    "tail-tip": maneBufferInfo,
  };

  var objects = [];
  var nodeInfosByName = {};

  var unicornNodeDescriptions = {
    name: "root",
    draw: false,
    children: [
      { name: "body", translation: [0, 2.5, 0], children: [
        { name: "neck", translation: [0, 0.9, 1.1], children: [
          { name: "head", translation: [0, 0.6, 0.7], children: [
            { name: "horn", translation: [0, 0.7, 0.2], scale: [0.3, 0.9, 0.3] },
          ]},
        ]},
        { name: "tail", translation: [0, 0.2, -1.2], children: [
          { name: "tail-tip", translation: [0, -0.6, -0.3] },
        ]},
        { name: "leg-fl", translation: [-0.5, -1, 0.9], children: [
          { name: "hoof-fl", translation: [0, -1, 0] },
        ]},
        { name: "leg-fr", translation: [0.5, -1, 0.9], children: [
          { name: "hoof-fr", translation: [0, -1, 0] },
        ]},
        { name: "leg-bl", translation: [-0.5, -1, -0.9], children: [
          { name: "hoof-bl", translation: [0, -1, 0] },
        ]},
        { name: "leg-br", translation: [0.5, -1, -0.9], children: [
          { name: "hoof-br", translation: [0, -1, 0] },
        ]},
      ]},
    ],
  };

  function makeNode(nodeDescription) {
    var trs = new TRS();
    var node = new Node(trs);
    nodeInfosByName[nodeDescription.name] = { trs: trs, node: node };
    trs.translation = nodeDescription.translation || trs.translation;
    trs.scale = nodeDescription.scale || trs.scale;
    if (nodeDescription.draw !== false) {
      node.drawInfo = {
        uniforms: {
          u_colorOffset: [0, 0, 0, 0],
          u_colorMult: [1, 1, 1, 1],
        },
        bufferInfo: partBufferInfo[nodeDescription.name] || bodyBufferInfo,
      };
      objects.push(node);
    }
    makeNodes(nodeDescription.children).forEach(function(child) {
      child.setParent(node);
    });
    return node;
  }

  function makeNodes(nodeDescriptions) {
    return nodeDescriptions ? nodeDescriptions.map(makeNode) : [];
  }

  var root = makeNode(unicornNodeDescriptions);

  // Advances the gallop animation. `gait` is 0..1 (0 = standing still).
  function animate(time, gait) {
    var speed = 3;
    var c = time * speed;
    var adjust;

    adjust = Math.abs(Math.sin(c * 2)) * 0.3 * gait;
    nodeInfosByName["body"].trs.translation[1] = 2.5 + adjust;

    adjust = Math.sin(c) * 0.5 * gait;
    nodeInfosByName["leg-fl"].trs.rotation[0] = adjust;
    nodeInfosByName["leg-fr"].trs.rotation[0] = adjust;
    nodeInfosByName["leg-bl"].trs.rotation[0] = -adjust;
    nodeInfosByName["leg-br"].trs.rotation[0] = -adjust;

    adjust = Math.sin(c + 0.3) * 0.4 * gait;
    nodeInfosByName["hoof-fl"].trs.rotation[0] = -adjust;
    nodeInfosByName["hoof-fr"].trs.rotation[0] = -adjust;
    nodeInfosByName["hoof-bl"].trs.rotation[0] = adjust;
    nodeInfosByName["hoof-br"].trs.rotation[0] = adjust;

    adjust = Math.sin(c * 2) * 0.15 * gait;
    nodeInfosByName["neck"].trs.rotation[0] = adjust;
    adjust = Math.sin(c * 2 + 0.2) * 0.1 * gait;
    nodeInfosByName["head"].trs.rotation[0] = adjust;

    adjust = Math.sin(c * 2) * 0.5;
    nodeInfosByName["tail"].trs.rotation[0] = adjust * 0.3;
    nodeInfosByName["tail-tip"].trs.rotation[0] = adjust;
  }

  return {
    root: root,
    objects: objects,
    nodeInfosByName: nodeInfosByName,
    animate: animate,
  };
}
