"use strict";

// Audio contract: procedural sound only (ZzFX for one-shot SFX, ZzFXM-style
// note sequencing for music), no imported audio files — at js13k's 13KB
// budget a single mp3/ogg can burn the whole remaining margin, while ZzFX's
// params array costs a handful of bytes per sound.
//
// ZzFX is a MIT-licensed single-function lib by Frank Force
// (KilledByAPixel). Source: https://killedbyapixel.github.io/ZzFX/
// The generator below is a compacted re-derivation of it, not the literal
// upstream minified source, to keep byte cost down under this budget.

var Audio_ = (function() {
  var audioCtx = null;
  function ctx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  // zzfxG(...) synthesizes one sound effect into a sample array.
  // Params: [volume, randomness, frequency, attack, sustain, release,
  //          shape(0=triangle,1=sine), shapeCurve, slide, pitchJump,
  //          pitchJumpTime, noise, sustainVolume, decay]
  function zzfxG(v, rand, freq, att, sus, rel, shape, curve, slide,
    pJump, pJumpT, noise, susV, dec) {
    var PI2 = 6.283185307179586, sr = ctx().sampleRate;
    v = (v || 1) * .3; freq = freq || 220;
    att = (att || 0) * sr || 1; dec = (dec || 0) * sr;
    sus = (sus || 0) * sr; rel = (rel || 0) * sr;
    curve = curve || 1; slide = (slide || 0) * 500 * PI2 / sr / sr;
    pJump = (pJump || 0) * PI2 / sr; pJumpT = (pJumpT || 0) * sr;
    noise = noise || 0;
    susV = susV === undefined ? 1 : susV;
    var f = freq *= (1 + (rand || 0) * 2 * Math.random() - (rand || 0)) * PI2 / sr;
    var len = att + dec + sus + rel | 0;
    var b = new Array(len), t = 0, j = 1, s, tp;
    for (var i = 0; i < len; i++) {
      tp = t / PI2 % 1;
      s = shape ? Math.sin(t) : 1 - 2 * tp * (tp < .5 ? 1 : -1);
      s = (s < 0 ? -1 : 1) * Math.abs(s) ** curve * v *
        (i < att ? i / att :
          i < att + dec ? 1 - ((i - att) / dec) * (1 - susV) :
          i < att + dec + sus ? susV :
          (len - i) / (rel || 1) * susV);
      b[i] = s;
      f = freq += slide;
      t += f - f * noise * (1 - (Math.sin(i) + 1) * 1e9 % 2);
      if (j && ++j > pJumpT) { freq += pJump; j = 0; }
    }
    return b;
  }

  function zzfxPlay(params) {
    var buf = zzfxG.apply(null, params);
    var c = ctx();
    var buffer = c.createBuffer(1, buf.length, c.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < buf.length; i++) data[i] = Math.max(-1, Math.min(1, buf[i]));
    var src = c.createBufferSource();
    src.buffer = buffer;
    src.connect(c.destination);
    src.start();
  }

  // One entry per one-shot sound effect (see zzfxG param order above).
  var ZZFX_PARAMS = {
    jump: [1.2, .1, 300, 0, .05, .1, 1, 1.5, 20],
    land: [1, .1, 120, 0, .04, .08, 0, 1, -10, 0, 0, 2],
    pickup: [.8, 0, 600, 0, .05, .08, 0, 2, 0, 400, .06],
    effectActivate: [1.2, .05, 440, 0, .08, .15, 1, 1.8, 200, 300, .08],
    hitSoft: [.9, .2, 100, 0, .03, .1, 0, 1, 0, 0, 0, 3],
    hitHard: [1, .3, 80, 0, .02, .25, 0, 1.2, -20, 0, 0, 5, .4],
  };

  function play(name) {
    var params = ZZFX_PARAMS[name];
    if (!params) return; // silent no-op: unimplemented or intentionally muted
    try { zzfxPlay(params); } catch (e) {}
  }

  // Minimal music player: no separate tracker format, just a note sequence
  // rendered with one shared ZzFX instrument voice — much cheaper than a
  // full ZzFXM pattern under this byte budget.
  var MUSIC_BASE_FREQ = 110;
  var MUSIC_INSTRUMENT = [.4, 0, MUSIC_BASE_FREQ, .02, .1, .2, 1, 1.2, 0, 0, 0, 0, .5];
  var MUSIC_PATTERN = [0, 3, 5, 3, 7, 5, 3, 0, -2, 3, 5, 3, 8, 7, 5, 3];
  var MUSIC_NOTE_MS = 280;

  var musicPlaying = false, musicStep = 0;

  function playMusicStep() {
    var note = MUSIC_PATTERN[musicStep++ % MUSIC_PATTERN.length];
    if (note) {
      MUSIC_INSTRUMENT[2] = MUSIC_BASE_FREQ * Math.pow(2, note / 12);
      try { zzfxPlay(MUSIC_INSTRUMENT); } catch (e) {}
    }
  }

  // Browsers block audio before a user gesture; game.js already calls this
  // from the first canvas click (pointer lock request), which counts.
  function startMusic() {
    if (musicPlaying || !MUSIC_PATTERN) return;
    musicPlaying = true;
    playMusicStep();
    setInterval(playMusicStep, MUSIC_NOTE_MS);
  }

  return { play: play, startMusic: startMusic };
})();
