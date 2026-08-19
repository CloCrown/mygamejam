export function drawUnicorn(ctx, x, y, opts = {}) {
  const { scale = 1, body = '#fff', accent = '#e53935', phase = 0, facing = 1 } = opts;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * facing, scale);

  ctx.strokeStyle = body;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const legPhase = phase + (i % 2 === 0 ? 0 : Math.PI);
    const swing = Math.sin(legPhase) * 10;
    const baseX = i < 2 ? -12 : 10;
    ctx.beginPath();
    ctx.moveTo(baseX, 5);
    ctx.lineTo(baseX + swing * 0.3, 24 + Math.abs(swing) * 0.2);
    ctx.stroke();
  }

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 26, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(28, -10, 11, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(33, -20);
  ctx.lineTo(37, -32);
  ctx.lineTo(39, -19);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(18, -14);
  ctx.quadraticCurveTo(10, -6, 14, 4);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-24, -4);
  ctx.quadraticCurveTo(-36, -2 + Math.sin(phase * 2) * 4, -30, 10);
  ctx.stroke();

  ctx.restore();
}

export function drawUnicornTop(ctx, x, y, opts = {}) {
  const { scale = 1, body = '#fff', accent = '#e53935', heading = 0, boosting = false } = opts;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.scale(scale, scale);

  if (boosting) {
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(-14, -5);
    ctx.lineTo(-27, 0);
    ctx.lineTo(-14, 5);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  [[-8, -7], [-8, 7], [8, -7], [8, 7]].forEach(([lx, ly]) => {
    ctx.beginPath();
    ctx.ellipse(lx, ly, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-13, 0);
  ctx.quadraticCurveTo(-22, boosting ? 0 : 4, -18, boosting ? -4 : 10);
  ctx.stroke();

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 15, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(15, 0, 6, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(19, -2);
  ctx.lineTo(28, 0);
  ctx.lineTo(19, 2);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(4, -6);
  ctx.quadraticCurveTo(-4, -10, -10, -5);
  ctx.stroke();

  ctx.restore();
}
