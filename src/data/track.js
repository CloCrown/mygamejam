export const TRACK = {
  cx: 240,
  cy: 152,
  outerRx: 205,
  outerRy: 100,
  innerRx: 130,
  innerRy: 46,
  startAngle: Math.PI / 2,
};

function normDist(x, y, t, rx, ry) {
  const dx = x - t.cx;
  const dy = y - t.cy;
  return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
}

export function isOnTrack(x, y, t = TRACK) {
  return normDist(x, y, t, t.outerRx, t.outerRy) <= 1 && normDist(x, y, t, t.innerRx, t.innerRy) >= 1;
}

export function startPosition(t = TRACK) {
  const midRx = (t.outerRx + t.innerRx) / 2;
  const midRy = (t.outerRy + t.innerRy) / 2;
  const a = t.startAngle;
  return {
    x: t.cx + Math.cos(a) * midRx,
    y: t.cy + Math.sin(a) * midRy,
    heading: a + Math.PI / 2,
  };
}

export function drawTrack(ctx, t = TRACK) {
  ctx.fillStyle = '#555';
  ctx.beginPath();
  ctx.ellipse(t.cx, t.cy, t.outerRx, t.outerRy, 0, 0, Math.PI * 2);
  ctx.ellipse(t.cx, t.cy, t.innerRx, t.innerRy, 0, 0, Math.PI * 2);
  ctx.fill('evenodd');

  ctx.fillStyle = '#2e7d32';
  ctx.beginPath();
  ctx.ellipse(t.cx, t.cy, t.innerRx, t.innerRy, 0, 0, Math.PI * 2);
  ctx.fill();

  const midRx = (t.outerRx + t.innerRx) / 2;
  const midRy = (t.outerRy + t.innerRy) / 2;
  ctx.setLineDash([8, 10]);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(t.cx, t.cy, midRx, midRy, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  const a = t.startAngle;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(t.cx + Math.cos(a) * t.innerRx, t.cy + Math.sin(a) * t.innerRy);
  ctx.lineTo(t.cx + Math.cos(a) * t.outerRx, t.cy + Math.sin(a) * t.outerRy);
  ctx.stroke();
}
