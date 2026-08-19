import { EVENTS } from '../data/events.js';
import { FACTORIES } from '../mechanics/index.js';
import { localPlayer } from '../player.js';

export function createSoloRunScreen(canvas, goTo, eventKey) {
  const cfg = EVENTS.find((e) => e.key === eventKey);
  let phase = 'playing';
  let result = null;
  let isNewRecord = false;
  const current = FACTORIES[cfg.mechanic](cfg, canvas, onComplete);

  function onComplete(res) {
    result = res;
    isNewRecord = localPlayer.setResult(cfg.key, res.score);
    phase = 'result';
  }

  function onKeyDown(e) {
    if (e.repeat) return;
    if (e.code === 'Escape') {
      goTo('solo');
      return;
    }
    if (phase === 'result' && e.code === 'Enter') goTo('solo');
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
    const record = localPlayer.getRecord(cfg.key);
    ctx.fillStyle = isNewRecord ? '#ffd54f' : '#fff';
    ctx.fillText(
      isNewRecord ? 'Nouveau record !' : 'Record: ' + Math.round(record),
      canvas.width / 2,
      130
    );

    ctx.fillStyle = '#fff';
    ctx.fillText('Entree pour revenir aux epreuves', canvas.width / 2, 165);
  }

  return { onKeyDown, update, render };
}
