import { EventEmitter } from 'node:events';
import type { MatchResult } from './services/matches.js';

export const gameEvents = new EventEmitter();

// typed helper so callers don't need to cast
export function emitGame(game: MatchResult) {
    gameEvents.emit('game', game);
}
