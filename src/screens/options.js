import { getKey, setKey, getActions } from '../playerConfig.js';

const LABELS = {
  forward: 'Avancer',
  backward: 'Reculer',
  left: 'Gauche',
  right: 'Droite',
  jump: 'Sauter',
};

export function createOptionsScreen(canvas, goTo) {
  const actions = getActions();
  let index = 0;
  let listening = false;

  function onKeyDown(e) {
    if (e.repeat) return;
    if (listening) {
      if (e.code !== 'Escape') setKey(actions[index], e.code);
      listening = false;
      return;
    }
    if (e.code === 'ArrowUp') index = (index + actions.length - 1) % actions.length;
    else if (e.code === 'ArrowDown') index = (index + 1) % actions.length;
    else if (e.code === 'Enter') listening = true;
    else if (e.code === 'Escape') goTo('home');
  }

  function update() {}

  function render(ctx) {
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = '24px sans-serif';
    ctx.fillText('Options - Touches', canvas.width / 2, 50);

    ctx.font = '16px sans-serif';
    actions.forEach((action, i) => {
      const y = 90 + i * 28;
      const selected = i === index;
      ctx.fillStyle = selected ? '#ffd54f' : '#fff';
      const keyLabel = selected && listening ? '...' : getKey(action);
      ctx.fillText(`${LABELS[action]}: ${keyLabel}`, canvas.width / 2, y);
    });

    ctx.fillStyle = '#aaa';
    ctx.font = '12px sans-serif';
    ctx.fillText('Entree pour changer, Echap pour revenir', canvas.width / 2, 245);
  }

  return { onKeyDown, update, render };
}
