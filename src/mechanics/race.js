import { getKey } from '../playerConfig.js';
import { drawUnicornTop } from '../unicorn.js';
import { TRACK, drawTrack, isOnTrack, startPosition } from '../data/track.js';

const TOTAL_LAPS = 3;
const ACCEL = 160;
const REVERSE_ACCEL = 90;
const FRICTION = 90;
const OFF_TRACK_FRICTION = 220;
const OFF_TRACK_CAP = 45;
const MAX_SPEED = 95;
const BOOST_SPEED = 160;
const BOOST_IMPULSE = 55;
const BOOST_DURATION = 1;
const BOOST_COST = 34;
const BOOST_REGEN = 18;
const TURN_RATE = 3;

export function createRaceEvent(cfg, canvas, onComplete) {
  const start = startPosition(TRACK);
  let x = start.x;
  let y = start.y;
  let heading = start.heading;
  let speed = 0;
  let boostTimer = 0;
  let boostGauge = 100;
  let unwrapped = TRACK.startAngle;
  let lastAngle = TRACK.startAngle;
  let elapsed = 0;
  let finished = false;
  const pressed = new Set();

  function onKeyDown(e) {
    if (finished) return;
    pressed.add(e.code);
    if (!e.repeat && e.code === getKey('jump') && boostGauge >= BOOST_COST) {
      boostGauge -= BOOST_COST;
      boostTimer = BOOST_DURATION;
      speed = Math.min(BOOST_SPEED, speed + BOOST_IMPULSE);
    }
  }
  function onKeyUp(e) {
    pressed.delete(e.code);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  function cleanup() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  }

  return {
    update(dt) {
      if (finished) return;
      elapsed += dt;
      boostGauge = Math.min(100, boostGauge + BOOST_REGEN * dt);
      boostTimer = Math.max(0, boostTimer - dt);

      if (pressed.has(getKey('left'))) heading -= TURN_RATE * dt;
      if (pressed.has(getKey('right'))) heading += TURN_RATE * dt;

      const onTrack = isOnTrack(x, y);
      const cap = boostTimer > 0 ? BOOST_SPEED : MAX_SPEED;
      if (pressed.has(getKey('forward'))) speed = Math.min(cap, speed + ACCEL * dt);
      else if (pressed.has(getKey('backward'))) speed = Math.max(-MAX_SPEED * 0.5, speed - REVERSE_ACCEL * dt);
      else {
        const f = (onTrack ? FRICTION : OFF_TRACK_FRICTION) * dt;
        if (speed > 0) speed = Math.max(0, speed - f);
        else if (speed < 0) speed = Math.min(0, speed + f);
      }
      if (!onTrack) speed = Math.min(speed, OFF_TRACK_CAP);

      x += Math.cos(heading) * speed * dt;
      y += Math.sin(heading) * speed * dt;

      const angle = Math.atan2(y - TRACK.cy, x - TRACK.cx);
      let delta = angle - lastAngle;
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      unwrapped += delta;
      lastAngle = angle;

      if (unwrapped - TRACK.startAngle >= Math.PI * 2 * TOTAL_LAPS) {
        finished = true;
        cleanup();
        const score = Math.max(0, Math.round(200 - elapsed * 4));
        onComplete({ score });
      }
    },
    render(ctx) {
      drawTrack(ctx, TRACK);

      const lap = Math.min(TOTAL_LAPS, Math.floor((unwrapped - TRACK.startAngle) / (Math.PI * 2)) + 1);
      ctx.textAlign = 'center';
      ctx.font = '14px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(cfg.name, canvas.width / 2, 18);
      ctx.textAlign = 'left';
      ctx.fillText('Tour ' + lap + '/' + TOTAL_LAPS, 10, 18);
      ctx.textAlign = 'right';
      ctx.fillText(elapsed.toFixed(1) + 's', canvas.width - 10, 18);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#333';
      ctx.fillRect(10, 24, 80, 8);
      ctx.fillStyle = boostGauge >= BOOST_COST ? '#ffd54f' : '#8d6e00';
      ctx.fillRect(10, 24, (boostGauge / 100) * 80, 8);

      drawUnicornTop(ctx, x, y, { scale: 1, body: '#fff', accent: cfg.color, heading, boosting: boostTimer > 0 });
    },
  };
}
