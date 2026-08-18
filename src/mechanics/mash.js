export function createMashEvent(cfg, canvas, onComplete) {
  let progress = 0;
  let timeLeft = cfg.duration;
  let lastKey = null;
  let finished = false;

  function handleKey(e) {
    if (finished || e.repeat) return;
    if (e.code !== cfg.keys[0] && e.code !== cfg.keys[1]) return;
    if (e.code !== lastKey) {
      progress += 2;
      lastKey = e.code;
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
      const barX = 50;
      const barY = 100;
      const barW = canvas.width - 100;
      const barH = 30;

      ctx.fillStyle = '#fff';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(cfg.name, canvas.width / 2, 60);

      ctx.strokeStyle = cfg.color;
      ctx.strokeRect(barX, barY, barW, barH);
      ctx.fillStyle = cfg.color;
      ctx.fillRect(barX, barY, (Math.min(progress, 100) / 100) * barW, barH);

      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.fillText('Temps: ' + Math.max(timeLeft, 0).toFixed(1) + 's', canvas.width / 2, 160);
      ctx.fillText('Alterne: ' + cfg.keys.join(' / '), canvas.width / 2, 185);
    },
  };
}
