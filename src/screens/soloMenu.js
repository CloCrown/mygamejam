import { EVENTS } from '../data/events.js';
import { FACTORIES } from '../mechanics/index.js';
import { localPlayer } from '../player.js';

export function createSoloMenuScreen(canvas, goTo) {
  const playable = EVENTS.filter((e) => FACTORIES[e.mechanic]);
  let index = 0;

  function onKeyDown(e) {
    if (e.repeat) return;
    if (e.code === 'ArrowUp') index = (index + playable.length - 1) % playable.length;
    else if (e.code === 'ArrowDown') index = (index + 1) % playable.length;
    else if (e.code === 'Enter') goTo('soloPlay', playable[index].key);
    else if (e.code === 'Escape') goTo('home');
  }

  function update() {}

  function render(ctx) {
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = '22px sans-serif';
    ctx.fillText('Epreuves', canvas.width / 2, 40);

    ctx.font = '16px sans-serif';
    playable.forEach((cfg, i) => {
      const y = 80 + i * 28;
      const selected = i === index;
      ctx.fillStyle = selected ? '#ffd54f' : '#fff';
      ctx.textAlign = 'left';
      ctx.fillText((selected ? '> ' : '  ') + cfg.name, 60, y);

      const record = localPlayer.getRecord(cfg.key);
      ctx.textAlign = 'right';
      ctx.fillStyle = selected ? '#ffd54f' : '#aaa';
      ctx.fillText(record != null ? 'Record: ' + Math.round(record) : '-', canvas.width - 60, y);
    });

    ctx.fillStyle = '#aaa';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Entree pour jouer, Echap pour revenir', canvas.width / 2, 80 + playable.length * 28 + 20);
  }

  return { onKeyDown, update, render };
}
