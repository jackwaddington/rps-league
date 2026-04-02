import { describe, it, expect, beforeAll, vi } from 'vitest';

vi.mock('../db.js', async () => {
    const { default: Database } = await import('better-sqlite3');
    const db = new Database(':memory:');
    db.exec(`
        CREATE TABLE IF NOT EXISTS games (
            game_id   TEXT PRIMARY KEY,
            game_time INTEGER NOT NULL,
            player_a  TEXT NOT NULL,
            move_a    TEXT NOT NULL,
            player_b  TEXT NOT NULL,
            move_b    TEXT NOT NULL,
            source    TEXT NOT NULL,
            winner    TEXT
        )
    `);
    return { default: db, getMeta: () => null, setMeta: () => {}, deleteMeta: () => {} };
});

import db from '../db.js';
import { getLeaderboard } from '../services/leaderboard.js';

const DAY1 = '2024-01-15';
const DAY2 = '2024-01-16';

function ts(day: string): number {
    return new Date(`${day}T12:00:00Z`).getTime();
}

function insert(
    id: string,
    day: string,
    pa: string,
    ma: string,
    pb: string,
    mb: string,
    winner: string | null,
) {
    db.prepare(
        'INSERT INTO games (game_id, game_time, player_a, move_a, player_b, move_b, source, winner) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(id, ts(day), pa, ma, pb, mb, 'test', winner);
}

beforeAll(() => {
    // DAY1: Alice 3 wins, Bob 1 win, 1 tie
    insert('g1', DAY1, 'Alice', 'ROCK', 'Bob', 'SCISSORS', 'Alice');
    insert('g2', DAY1, 'Alice', 'PAPER', 'Bob', 'ROCK', 'Alice');
    insert('g3', DAY1, 'Bob', 'ROCK', 'Alice', 'SCISSORS', 'Bob');
    insert('g4', DAY1, 'Alice', 'SCISSORS', 'Bob', 'PAPER', 'Alice');
    insert('g5', DAY1, 'Alice', 'ROCK', 'Bob', 'ROCK', null); // tie
    // DAY2: Charlie 2 wins, Alice 1 win
    insert('g6', DAY2, 'Charlie', 'ROCK', 'Alice', 'SCISSORS', 'Charlie');
    insert('g7', DAY2, 'Charlie', 'PAPER', 'Bob', 'ROCK', 'Charlie');
    insert('g8', DAY2, 'Alice', 'ROCK', 'Charlie', 'SCISSORS', 'Alice');
});

describe('getLeaderboard', () => {
    it('ranks players by wins within a date range', () => {
        const result = getLeaderboard(DAY1, DAY1);
        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({ rank: 1, player: 'Alice', wins: 3 });
        expect(result[1]).toMatchObject({ rank: 2, player: 'Bob', wins: 1 });
    });

    it('returns empty array when no games in range', () => {
        expect(getLeaderboard('2020-01-01', '2020-01-01')).toEqual([]);
    });

    it('spans multiple days correctly', () => {
        const result = getLeaderboard(DAY1, DAY2);
        // Alice: 3+1=4, Charlie: 2, Bob: 1
        expect(result[0]).toMatchObject({ rank: 1, player: 'Alice', wins: 4 });
        expect(result[1]).toMatchObject({ rank: 2, player: 'Charlie', wins: 2 });
        expect(result[2]).toMatchObject({ rank: 3, player: 'Bob', wins: 1 });
    });

    it('does not count ties as wins', () => {
        const result = getLeaderboard(DAY1, DAY1);
        const alice = result.find((r) => r.player === 'Alice');
        expect(alice?.wins).toBe(3); // tie in g5 not counted
    });

    it('assigns sequential rank starting at 1', () => {
        const result = getLeaderboard(DAY1, DAY2);
        expect(result.map((r) => r.rank)).toEqual([1, 2, 3]);
    });
});
