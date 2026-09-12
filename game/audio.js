"use strict";

// Audio contract: procedural sound only (ZzFX-style synthesis for one-shot
// SFX, a shared-instrument note sequencer for music), no imported audio
// files - at js13k's 13KB budget a single mp3/ogg can burn the whole
// remaining margin, while a params array costs a handful of bytes per sound.
//
// ZzFX is a MIT-licensed single-function lib by Frank Force
// (KilledByAPixel). Source: https://killedbyapixel.github.io/ZzFX/
// zzfxG below is a compacted re-derivation of it, not the literal upstream
// minified source, to keep byte cost down under this budget. Ported from
// explore-3's game/audio.js (same contract, same synthesis core), retuned
// for this platformer's event names.

var Audio_ = (function () {
  var audioCtx = null;
  var masterGain = null;
  var volume = 1;
  try {
    var savedVol = localStorage.getItem("volume");
    if (savedVol !== null) volume = Math.max(0, Math.min(1, parseFloat(savedVol)));
  } catch (e) {}

  function ctx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = volume;
      masterGain.connect(audioCtx.destination);
    }
    return audioCtx;
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (masterGain) masterGain.gain.value = volume;
    try { localStorage.setItem("volume", volume); } catch (e) {}
  }

  function getVolume() {
    return volume;
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
    src.connect(masterGain);
    src.start();
  }

  // One entry per one-shot sound effect (see zzfxG param order above).
  // Keys match the Audio_.play(name) calls in game.js.
  var ZZFX_PARAMS = {
    jump: [1.2, .1, 300, 0, .05, .1, 1, 1.5, 20],
    land: [1, .1, 120, 0, .04, .08, 0, 1, -10, 0, 0, 2],
    pickup: [.8, 0, 600, 0, .05, .08, 0, 2, 0, 400, .06],
    hornPickup: [1, .05, 700, 0, .06, .12, 1, 2, 0, 500, .08, 0, .7],
    effectActivate: [1.2, .05, 440, 0, .08, .15, 1, 1.8, 200, 300, .08],
    hit: [1, .3, 90, 0, .03, .18, 0, 1.2, -15, 0, 0, 4, .4],
    gameOver: [1.1, .15, 200, 0, .1, .5, 0, 1.6, -60, 0, 0, 1, .3],
    finish: [1.2, .05, 500, 0, .1, .3, 1, 1.6, 300, 400, .1, 0, .8],
  };

  function play(name) {
    var params = ZZFX_PARAMS[name];
    if (!params) return; // silent no-op: unimplemented or intentionally muted
    try { zzfxPlay(params); } catch (e) {}
  }

  // Minimal music player: no separate tracker format, just a note sequence
  // rendered with one shared instrument voice - much cheaper under this
  // byte budget than a full multi-channel ZzFXM pattern.
  var MUSIC_BASE_FREQ = 220;
  var MUSIC_INSTRUMENT = [.35, 0, MUSIC_BASE_FREQ, .01, .1, .15, 1, 1.2, 0, 0, 0, 0, .5];
  var MUSIC_PATTERN = [0, 4, 7, 4, 0, 4, 7, 11, 9, 7, 4, 0, 7, 4, 0, -5];
  var MUSIC_NOTE_MS = 220;

  var musicPlaying = false, musicStep = 0, musicTimer = null;

  function playMusicStep() {
    var note = MUSIC_PATTERN[musicStep++ % MUSIC_PATTERN.length];
    if (note !== null) {
      MUSIC_INSTRUMENT[2] = MUSIC_BASE_FREQ * Math.pow(2, note / 12);
      try { zzfxPlay(MUSIC_INSTRUMENT); } catch (e) {}
    }
  }

  // Browsers block audio before a user gesture; game.js calls this from the
  // "Jouer" menu action, which counts as that gesture.
  function startMusic() {
    if (musicPlaying) return;
    musicPlaying = true;
    playMusicStep();
    musicTimer = setInterval(playMusicStep, MUSIC_NOTE_MS);
  }

  return { play: play, startMusic: startMusic, setVolume: setVolume, getVolume: getVolume };
})();
