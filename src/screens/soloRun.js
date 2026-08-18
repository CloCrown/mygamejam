import { EVENTS } from '../data/events.js';
import { createMashEvent } from '../mechanics/mash.js';
import { localPlayer } from '../player.js';

const FACTORIES = { mash: createMashEvent };

export function createSoloRunScreen(canvas, goTo) {
  const playable = EVENTS.filter((e) => FACTORIES[e.mechanic]);
  let i = 0;
  let phase = 'playing';
  let result = null;
  let isNewRecord = false;
  let current = null;

  function startCurrent() {
    const cfg = playable[i];
    current = FACTORIES[cfg.mechanic](cfg, canvas, onComplete);
    phase = 'playing';
  }

  function onComplete(res) {
    result = res;
    isNewRecord = localPlayer.setResult(playable[i].key, res.score);
    phase = 'result';
  }

  startCurrent();

  function onKeyDown(e) {
    if (e.repeat) return;
    if (e.code === 'Escape') {
      goTo('home');
      return;
    }
    if (phase === 'result' && e.code === 'Enter') {
      i++;
      if (i >= playable.length) goTo('home');
      else startCurrent();
    }
  }

  function update(dt) {
    if (phase === 'playing') current.update(dt);
  }

  function render(ctx) {
    if (phase === 'playing') {
      current.render(ctx);
      return;
    }
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = '20px sans-serif';
    ctx.fillText('Score: ' + Math.round(result.score), canvas.width / 2, 100);

    ctx.font = '14px sans-serif';
    const record = localPlayer.getRecord(playable[i].key);
    ctx.fillStyle = isNewRecord ? '#ffd54f' : '#fff';
    ctx.fillText(
      isNewRecord ? 'Nouveau record !' : 'Record: ' + Math.round(record),
      canvas.width / 2,
      130
    );

    ctx.fillStyle = '#fff';
    ctx.fillText('Entree pour continuer', canvas.width / 2, 165);
  }

  return { onKeyDown, update, render };
}
