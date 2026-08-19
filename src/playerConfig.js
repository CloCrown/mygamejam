const STORAGE_KEY = 'playerConfig';

const DEFAULT_KEYBINDS = {
  forward: 'ArrowUp',
  backward: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  jump: 'Space',
};

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.keybinds) {
      return { keybinds: { ...DEFAULT_KEYBINDS, ...saved.keybinds } };
    }
  } catch {}
  return { keybinds: { ...DEFAULT_KEYBINDS } };
}

let config = load();

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function getConfig() {
  return config;
}

export function getKey(action) {
  return config.keybinds[action];
}

export function setKey(action, code) {
  config.keybinds[action] = code;
  save();
}

export function getActions() {
  return Object.keys(DEFAULT_KEYBINDS);
}

export function resetConfig() {
  config = { keybinds: { ...DEFAULT_KEYBINDS } };
  save();
}
