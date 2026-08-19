import { getKey } from '../playerConfig.js';
import { drawUnicorn } from '../unicorn.js';

const TRACK_X0 = 60;
const TRACK_X1 = 420;
const GROUND_Y = 170;

export function createMashEvent(cfg, canvas, onComplete) {
  let progress = 0;
  let timeLeft = cfg.duration;
  let lastKey = null;
  let finished = false;
  let runPhase = 0;

  function handleKey(e) {
    if (finished || e.repeat) return;
    const left = getKey('left');
    const right = getKey('right');
    if (e.code !== left && e.code !== right) return;
    if (e.code !== lastKey) {
      progress += 2;
      lastKey = e.code;
      runPhase += 1.2;
    }
  }

  window.addEventListener('keydown', handleKey);

  return {
    update(dt) {
      if (finished) return;
      timeLeft -= dt;
      if (progress >= 100 || timeLeft <= 0) {
        finished = true;
        window.removeEventListener('keydown', handleKey);
        onComplete({ score: Math.min(progress, 100) });
      }
    },
    render(ctx) {
      ctx.fillStyle = '#fff';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(cfg.name, canvas.width / 2, 40);

      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(TRACK_X0 - 10, GROUND_Y + 24);
      ctx.lineTo(TRACK_X1 + 20, GROUND_Y + 24);
      ctx.stroke();

      ctx.strokeStyle = cfg.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(TRACK_X1 + 10, GROUND_Y - 30);
      ctx.lineTo(TRACK_X1 + 10, GROUND_Y + 24);
      ctx.stroke();
      ctx.fillStyle = cfg.color;
      ctx.beginPath();
      ctx.moveTo(TRACK_X1 + 10, GROUND_Y - 30);
      ctx.lineTo(TRACK_X1 + 26, GROUND_Y - 24);
      ctx.lineTo(TRACK_X1 + 10, GROUND_Y - 18);
      ctx.closePath();
      ctx.fill();

      const x = TRACK_X0 + (Math.min(progress, 100) / 100) * (TRACK_X1 - TRACK_X0);
      drawUnicorn(ctx, x, GROUND_Y, { scale: 1, body: '#fff', accent: cfg.color, phase: runPhase });

      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.fillText('Temps: ' + Math.max(timeLeft, 0).toFixed(1) + 's', canvas.width / 2, 220);
      ctx.fillText('Alterne: ' + getKey('left') + ' / ' + getKey('right'), canvas.width / 2, 245);
    },
  };
}
