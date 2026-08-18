const COLORS = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#3949ab', '#8e24aa'];

export function drawBackground(ctx, canvas, t) {
  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  const shift = Math.sin(t * 0.2) * 0.05;
  COLORS.forEach((color, i) => {
    const stop = Math.min(1, Math.max(0, i / (COLORS.length - 1) + shift));
    grad.addColorStop(stop, color);
  });
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
