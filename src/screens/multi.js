export function createMultiScreen(canvas, goTo) {
  function onKeyDown(e) {
    if (e.repeat) return;
    if (e.code === 'Enter' || e.code === 'Escape') goTo('home');
  }

  function update() {}

  function render(ctx) {
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = '20px sans-serif';
    ctx.fillText('Mode Multi - bientot disponible', canvas.width / 2, 120);
    ctx.font = '14px sans-serif';
    ctx.fillText('Entree pour revenir au menu', canvas.width / 2, 160);
  }

  return { onKeyDown, update, render };
}
