const STORAGE_KEY = 'records';

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export class Player {
  constructor(name = 'Joueur', color = '#fff', persist = false) {
    this.name = name;
    this.color = color;
    this.persist = persist;
    this.records = persist ? loadRecords() : {};
  }

  getRecord(eventKey) {
    return this.records[eventKey] ?? null;
  }

  setResult(eventKey, score) {
    const best = this.records[eventKey];
    const isNewRecord = best === undefined || score > best;
    if (isNewRecord) {
      this.records[eventKey] = score;
      if (this.persist) saveRecords(this.records);
    }
    return isNewRecord;
  }
}

export const localPlayer = new Player('Joueur', '#fff', true);
