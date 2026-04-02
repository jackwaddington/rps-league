import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { Game } from '../types';

// Module-level state persists across component mounts/unmounts
let games: Game[] = [];
const subscribers = new Set<(games: Game[]) => void>();

function addGame(game: Game) {
    if (games.some((g) => g.game_id === game.game_id)) return;
    games = [game, ...games];
    subscribers.forEach((fn) => fn(games));
}

// Start connection once for the lifetime of the page
api.liveStream(addGame);

export function useLiveGames() {
    const [snapshot, setSnapshot] = useState(games);

    useEffect(() => {
        setSnapshot(games); // pick up any games that arrived before mount
        subscribers.add(setSnapshot);
        return () => { subscribers.delete(setSnapshot); };
    }, []);

    return { games: snapshot };
}
