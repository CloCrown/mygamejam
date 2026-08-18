import { init, GameLoop } from 'kontra';
import { EVENTS } from './data/events.js';
import { createMashEvent } from './mechanics/mash.js';

const { canvas } = init();
const ctx = canvas.getContext('2d');

const state = {
  screen: 'menu',
  eventIndex: 0,
  lastResult: null,
};

let activeEvent = null;

function startEvent(index) {
  state.eventIndex = index;
  const cfg = EVENTS[index];
  activeEvent = createMashEvent(cfg, canvas, onEventComplete);
  state.screen = 'event';
}

function onEventComplete(result) {
  state.lastResult = result;
  state.screen = 'result';
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (state.screen === 'menu' && e.code === 'Enter') {
    startEvent(0);
  } else if (state.screen === 'result' && e.code === 'Enter') {
    activeEvent = null;
    state.screen = 'menu';
  }
});

function renderMenu() {
  ctx.fillStyle = '#fff';
  ctx.font = '24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Unicorn Games', canvas.width / 2, 80);
  ctx.font = '14px sans-serif';
  ctx.fillText('Entree pour commencer: ' + EVENTS[0].name, canvas.width / 2, 120);
}

function renderResult() {
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Score: ' + Math.round(state.lastResult.score), canvas.width / 2, 100);
  ctx.font = '14px sans-serif';
  ctx.fillText('Entree pour revenir au menu', canvas.width / 2, 140);
}

const loop = GameLoop({
  update(dt) {
    if (state.screen === 'event' && activeEvent) {
      activeEvent.update(dt);
    }
  },
  render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (state.screen === 'menu') renderMenu();
    else if (state.screen === 'event' && activeEvent) activeEvent.render(ctx);
    else if (state.screen === 'result') renderResult();
  },
});

loop.start();
