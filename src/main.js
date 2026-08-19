import { init, GameLoop } from 'kontra';
import { createHomeScreen } from './screens/home.js';
import { createOptionsScreen } from './screens/options.js';
import { createMultiScreen } from './screens/multi.js';
import { createSoloMenuScreen } from './screens/soloMenu.js';
import { createSoloRunScreen } from './screens/soloRun.js';
import { drawBackground } from './background.js';

const { canvas } = init();
const ctx = canvas.getContext('2d');

let screen = null;
let elapsed = 0;

function goTo(name, payload) {
  if (name === 'home') screen = createHomeScreen(canvas, goTo);
  else if (name === 'options') screen = createOptionsScreen(canvas, goTo);
  else if (name === 'multi') screen = createMultiScreen(canvas, goTo);
  else if (name === 'solo') screen = createSoloMenuScreen(canvas, goTo);
  else if (name === 'soloPlay') screen = createSoloRunScreen(canvas, goTo, payload);
}

window.addEventListener('keydown', (e) => {
  if (screen && screen.onKeyDown) screen.onKeyDown(e);
});

goTo('home');

const loop = GameLoop({
  update(dt) {
    elapsed += dt;
    if (screen && screen.update) screen.update(dt);
  },
  render() {
    drawBackground(ctx, canvas, elapsed);
    if (screen && screen.render) screen.render(ctx);
  },
});

loop.start();
