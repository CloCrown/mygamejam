const STORAGE_KEY = 'kb';
const DEFAULTS = { left: 'ArrowLeft', right: 'ArrowRight' };

let binds = { ...DEFAULTS };
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (saved) binds = { ...DEFAULTS, ...saved };
} catch {}

export function getKey(action) {
  return binds[action];
}

export function setKey(action, code) {
  binds[action] = code;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(binds));
}

export function getActions() {
  return Object.keys(DEFAULTS);
}
