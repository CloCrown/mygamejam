const OPTIONS = [
  { label: 'Solo', target: 'solo' },
  { label: 'Multi', target: 'multi' },
  { label: 'Options', target: 'options' },
];

export function createHomeScreen(canvas, goTo) {
  let index = 0;

  function onKeyDown(e) {
    if (e.repeat) return;
    if (e.code === 'ArrowUp') index = (index + OPTIONS.length - 1) % OPTIONS.length;
    else if (e.code === 'ArrowDown') index = (index + 1) % OPTIONS.length;
    else if (e.code === 'Enter') goTo(OPTIONS[index].target);
  }

  function update() {}

  function render(ctx) {
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = '28px sans-serif';
    ctx.fillText('Unicorn Games', canvas.width / 2, 60);

    ctx.font = '18px sans-serif';
    OPTIONS.forEach((opt, i) => {
      const y = 120 + i * 36;
      ctx.fillStyle = i === index ? '#ffd54f' : '#fff';
      ctx.fillText((i === index ? '> ' : '') + opt.label, canvas.width / 2, y);
    });
  }

  return { onKeyDown, update, render };
}
