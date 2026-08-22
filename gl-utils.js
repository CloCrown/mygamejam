"use strict";

var m4 = {
  identity: function(dst) {
    dst = dst || new Float32Array(16);
    dst[0]=1; dst[1]=0; dst[2]=0; dst[3]=0;
    dst[4]=0; dst[5]=1; dst[6]=0; dst[7]=0;
    dst[8]=0; dst[9]=0; dst[10]=1; dst[11]=0;
    dst[12]=0; dst[13]=0; dst[14]=0; dst[15]=1;
    return dst;
  },
  copy: function(src, dst) {
    dst = dst || new Float32Array(16);
    for (var i = 0; i < 16; i++) dst[i] = src[i];
    return dst;
  },
  multiply: function(a, b, dst) {
    dst = dst || new Float32Array(16);
    var b00=b[0],b01=b[1],b02=b[2],b03=b[3];
    var b10=b[4],b11=b[5],b12=b[6],b13=b[7];
    var b20=b[8],b21=b[9],b22=b[10],b23=b[11];
    var b30=b[12],b31=b[13],b32=b[14],b33=b[15];
    var a00=a[0],a01=a[1],a02=a[2],a03=a[3];
    var a10=a[4],a11=a[5],a12=a[6],a13=a[7];
    var a20=a[8],a21=a[9],a22=a[10],a23=a[11];
    var a30=a[12],a31=a[13],a32=a[14],a33=a[15];
    dst[0]=b00*a00+b01*a10+b02*a20+b03*a30;
    dst[1]=b00*a01+b01*a11+b02*a21+b03*a31;
    dst[2]=b00*a02+b01*a12+b02*a22+b03*a32;
    dst[3]=b00*a03+b01*a13+b02*a23+b03*a33;
    dst[4]=b10*a00+b11*a10+b12*a20+b13*a30;
    dst[5]=b10*a01+b11*a11+b12*a21+b13*a31;
    dst[6]=b10*a02+b11*a12+b12*a22+b13*a32;
    dst[7]=b10*a03+b11*a13+b12*a23+b13*a33;
    dst[8]=b20*a00+b21*a10+b22*a20+b23*a30;
    dst[9]=b20*a01+b21*a11+b22*a21+b23*a31;
    dst[10]=b20*a02+b21*a12+b22*a22+b23*a32;
    dst[11]=b20*a03+b21*a13+b22*a23+b23*a33;
    dst[12]=b30*a00+b31*a10+b32*a20+b33*a30;
    dst[13]=b30*a01+b31*a11+b32*a21+b33*a31;
    dst[14]=b30*a02+b31*a12+b32*a22+b33*a32;
    dst[15]=b30*a03+b31*a13+b32*a23+b33*a33;
    return dst;
  },
  translation: function(tx, ty, tz, dst) {
    dst = dst || new Float32Array(16);
    dst[0]=1; dst[1]=0; dst[2]=0; dst[3]=0;
    dst[4]=0; dst[5]=1; dst[6]=0; dst[7]=0;
    dst[8]=0; dst[9]=0; dst[10]=1; dst[11]=0;
    dst[12]=tx; dst[13]=ty; dst[14]=tz; dst[15]=1;
    return dst;
  },
  xRotate: function(m, angle, dst) {
    var c = Math.cos(angle), s = Math.sin(angle);
    var m10=m[4],m11=m[5],m12=m[6],m13=m[7];
    var m20=m[8],m21=m[9],m22=m[10],m23=m[11];
    dst = dst || new Float32Array(16);
    if (dst !== m) for (var i=0;i<16;i++) dst[i]=m[i];
    dst[4]=c*m10+s*m20; dst[5]=c*m11+s*m21; dst[6]=c*m12+s*m22; dst[7]=c*m13+s*m23;
    dst[8]=c*m20-s*m10; dst[9]=c*m21-s*m11; dst[10]=c*m22-s*m12; dst[11]=c*m23-s*m13;
    return dst;
  },
  yRotate: function(m, angle, dst) {
    var c = Math.cos(angle), s = Math.sin(angle);
    var m00=m[0],m01=m[1],m02=m[2],m03=m[3];
    var m20=m[8],m21=m[9],m22=m[10],m23=m[11];
    dst = dst || new Float32Array(16);
    if (dst !== m) for (var i=0;i<16;i++) dst[i]=m[i];
    dst[0]=c*m00-s*m20; dst[1]=c*m01-s*m21; dst[2]=c*m02-s*m22; dst[3]=c*m03-s*m23;
    dst[8]=c*m20+s*m00; dst[9]=c*m21+s*m01; dst[10]=c*m22+s*m02; dst[11]=c*m23+s*m03;
    return dst;
  },
  zRotate: function(m, angle, dst) {
    var c = Math.cos(angle), s = Math.sin(angle);
    var m00=m[0],m01=m[1],m02=m[2],m03=m[3];
    var m10=m[4],m11=m[5],m12=m[6],m13=m[7];
    dst = dst || new Float32Array(16);
    if (dst !== m) for (var i=0;i<16;i++) dst[i]=m[i];
    dst[0]=c*m00+s*m10; dst[1]=c*m01+s*m11; dst[2]=c*m02+s*m12; dst[3]=c*m03+s*m13;
    dst[4]=c*m10-s*m00; dst[5]=c*m11-s*m01; dst[6]=c*m12-s*m02; dst[7]=c*m13-s*m03;
    return dst;
  },
  scale: function(m, sx, sy, sz, dst) {
    dst = dst || new Float32Array(16);
    dst[0]=sx*m[0]; dst[1]=sx*m[1]; dst[2]=sx*m[2]; dst[3]=sx*m[3];
    dst[4]=sy*m[4]; dst[5]=sy*m[5]; dst[6]=sy*m[6]; dst[7]=sy*m[7];
    dst[8]=sz*m[8]; dst[9]=sz*m[9]; dst[10]=sz*m[10]; dst[11]=sz*m[11];
    if (dst !== m) { dst[12]=m[12]; dst[13]=m[13]; dst[14]=m[14]; dst[15]=m[15]; }
    return dst;
  },
  perspective: function(fov, aspect, near, far, dst) {
    dst = dst || new Float32Array(16);
    var f = Math.tan(Math.PI * 0.5 - 0.5 * fov);
    var rangeInv = 1.0 / (near - far);
    dst[0]=f/aspect; dst[1]=0; dst[2]=0; dst[3]=0;
    dst[4]=0; dst[5]=f; dst[6]=0; dst[7]=0;
    dst[8]=0; dst[9]=0; dst[10]=(near+far)*rangeInv; dst[11]=-1;
    dst[12]=0; dst[13]=0; dst[14]=near*far*rangeInv*2; dst[15]=0;
    return dst;
  },
  lookAt: function(eye, target, up, dst) {
    dst = dst || new Float32Array(16);
    function sub(a,b){return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
    function norm(v){var l=Math.hypot(v[0],v[1],v[2]);return l>1e-5?[v[0]/l,v[1]/l,v[2]/l]:[0,0,0];}
    function cross(a,b){return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];}
    var zAxis = norm(sub(eye, target));
    var xAxis = norm(cross(up, zAxis));
    var yAxis = norm(cross(zAxis, xAxis));
    dst[0]=xAxis[0]; dst[1]=xAxis[1]; dst[2]=xAxis[2]; dst[3]=0;
    dst[4]=yAxis[0]; dst[5]=yAxis[1]; dst[6]=yAxis[2]; dst[7]=0;
    dst[8]=zAxis[0]; dst[9]=zAxis[1]; dst[10]=zAxis[2]; dst[11]=0;
    dst[12]=eye[0]; dst[13]=eye[1]; dst[14]=eye[2]; dst[15]=1;
    return dst;
  },
  inverse: function(m, dst) {
    dst = dst || new Float32Array(16);
    var m00=m[0],m01=m[1],m02=m[2],m03=m[3];
    var m10=m[4],m11=m[5],m12=m[6],m13=m[7];
    var m20=m[8],m21=m[9],m22=m[10],m23=m[11];
    var m30=m[12],m31=m[13],m32=m[14],m33=m[15];
    var tmp0=m22*m33, tmp1=m32*m23, tmp2=m12*m33, tmp3=m32*m13;
    var tmp4=m12*m23, tmp5=m22*m13, tmp6=m02*m33, tmp7=m32*m03;
    var tmp8=m02*m23, tmp9=m22*m03, tmp10=m02*m13, tmp11=m12*m03;
    var tmp12=m20*m31, tmp13=m30*m21, tmp14=m10*m31, tmp15=m30*m11;
    var tmp16=m10*m21, tmp17=m20*m11, tmp18=m00*m31, tmp19=m30*m01;
    var tmp20=m00*m21, tmp21=m20*m01, tmp22=m00*m11, tmp23=m10*m01;

    var t0 = (tmp0*m11+tmp3*m21+tmp4*m31) - (tmp1*m11+tmp2*m21+tmp5*m31);
    var t1 = (tmp1*m01+tmp6*m21+tmp9*m31) - (tmp0*m01+tmp7*m21+tmp8*m31);
    var t2 = (tmp2*m01+tmp7*m11+tmp10*m31) - (tmp3*m01+tmp6*m11+tmp11*m31);
    var t3 = (tmp5*m01+tmp8*m11+tmp11*m21) - (tmp4*m01+tmp9*m11+tmp10*m21);

    var d = 1.0 / (m00*t0 + m10*t1 + m20*t2 + m30*t3);

    dst[0]=d*t0; dst[1]=d*t1; dst[2]=d*t2; dst[3]=d*t3;
    dst[4]=d*((tmp1*m10+tmp2*m20+tmp5*m30)-(tmp0*m10+tmp3*m20+tmp4*m30));
    dst[5]=d*((tmp0*m00+tmp7*m20+tmp8*m30)-(tmp1*m00+tmp6*m20+tmp9*m30));
    dst[6]=d*((tmp3*m00+tmp6*m10+tmp11*m30)-(tmp2*m00+tmp7*m10+tmp10*m30));
    dst[7]=d*((tmp4*m00+tmp9*m10+tmp10*m20)-(tmp5*m00+tmp8*m10+tmp11*m20));
    dst[8]=d*((tmp12*m13+tmp15*m23+tmp16*m33)-(tmp13*m13+tmp14*m23+tmp17*m33));
    dst[9]=d*((tmp13*m03+tmp18*m23+tmp21*m33)-(tmp12*m03+tmp19*m23+tmp20*m33));
    dst[10]=d*((tmp14*m03+tmp19*m13+tmp22*m33)-(tmp15*m03+tmp18*m13+tmp23*m33));
    dst[11]=d*((tmp17*m03+tmp20*m13+tmp23*m23)-(tmp16*m03+tmp21*m13+tmp22*m23));
    dst[12]=d*((tmp14*m22+tmp17*m32+tmp13*m12)-(tmp16*m32+tmp12*m12+tmp15*m22));
    dst[13]=d*((tmp20*m32+tmp12*m02+tmp19*m22)-(tmp18*m22+tmp21*m32+tmp13*m02));
    dst[14]=d*((tmp18*m12+tmp23*m32+tmp15*m02)-(tmp22*m32+tmp14*m02+tmp19*m12));
    dst[15]=d*((tmp22*m22+tmp16*m02+tmp21*m12)-(tmp20*m12+tmp23*m22+tmp17*m02));
    return dst;
  },
};

function createCubeBufferInfo(gl, size, color) {
  var s = size * 0.5;
  var positions = [];
  var colors = [];
  var faces = [
    [[-s,-s, s],[ s,-s, s],[ s, s, s],[-s, s, s]], // front
    [[-s,-s,-s],[-s, s,-s],[ s, s,-s],[ s,-s,-s]], // back
    [[-s, s,-s],[-s, s, s],[ s, s, s],[ s, s,-s]], // top
    [[-s,-s,-s],[ s,-s,-s],[ s,-s, s],[-s,-s, s]], // bottom
    [[ s,-s,-s],[ s, s,-s],[ s, s, s],[ s,-s, s]], // right
    [[-s,-s,-s],[-s,-s, s],[-s, s, s],[-s, s,-s]], // left
  ];
  faces.forEach(function(f) {
    var idx = [0,1,2, 0,2,3];
    idx.forEach(function(vi) {
      positions.push(f[vi][0], f[vi][1], f[vi][2]);
      colors.push(color[0]*255, color[1]*255, color[2]*255, color[3]*255);
    });
  });

  var positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

  var colorBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(colors), gl.STATIC_DRAW);

  return {
    numElements: positions.length / 3,
    positionBuffer: positionBuffer,
    colorBuffer: colorBuffer,
  };
}

function compileShader(gl, type, source) {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

function createProgram(gl, vsSource, fsSource) {
  var program = gl.createProgram();
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vsSource));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fsSource));
  gl.linkProgram(program);
  return program;
}

var TRS = function() {
  this.translation = [0, 0, 0];
  this.rotation = [0, 0, 0];
  this.scale = [1, 1, 1];
};

TRS.prototype.getMatrix = function(dst) {
  dst = dst || new Float32Array(16);
  var t = this.translation;
  var r = this.rotation;
  var s = this.scale;
  m4.translation(t[0], t[1], t[2], dst);
  m4.xRotate(dst, r[0], dst);
  m4.yRotate(dst, r[1], dst);
  m4.zRotate(dst, r[2], dst);
  m4.scale(dst, s[0], s[1], s[2], dst);
  return dst;
};

var Node = function(source) {
  this.children = [];
  this.localMatrix = m4.identity();
  this.worldMatrix = m4.identity();
  this.source = source;
};

Node.prototype.setParent = function(parent) {
  if (this.parent) {
    var ndx = this.parent.children.indexOf(this);
    if (ndx >= 0) this.parent.children.splice(ndx, 1);
  }
  if (parent) parent.children.push(this);
  this.parent = parent;
};

Node.prototype.updateWorldMatrix = function(parentWorldMatrix) {
  var source = this.source;
  if (source) source.getMatrix(this.localMatrix);

  if (parentWorldMatrix) {
    m4.multiply(parentWorldMatrix, this.localMatrix, this.worldMatrix);
  } else {
    m4.copy(this.localMatrix, this.worldMatrix);
  }

  var worldMatrix = this.worldMatrix;
  this.children.forEach(function(child) {
    child.updateWorldMatrix(worldMatrix);
  });
};
