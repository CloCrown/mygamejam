import { createMashEvent } from './mash.js';
import { createRaceEvent } from './race.js';

export const FACTORIES = { mash: createMashEvent, race: createRaceEvent };
