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
import { getPlayerStats } from '../services/player.js';

function ts(day: string, offsetMs = 0): number {
    return new Date(`${day}T12:00:00Z`).getTime() + offsetMs;
}

function insert(
    id: string,
    day: string,
    pa: string,
    ma: string,
    pb: string,
    mb: string,
    winner: string | null,
    offsetMs = 0,
) {
    db.prepare(
        'INSERT INTO games (game_id, game_time, player_a, move_a, player_b, move_b, source, winner) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(id, ts(day, offsetMs), pa, ma, pb, mb, 'test', winner);
}

// Alice's game sequence (ordered by offsetMs):
// W W L T W W W — longest streak = 3 (last three)
// Moves as player_a: ROCK, PAPER, SCISSORS, ROCK, ROCK, PAPER, ROCK
// Total: 7 games, 5 wins, 1 loss, 1 tie
const DAY = '2024-01-15';

beforeAll(() => {
    insert('a1', DAY, 'Alice', 'ROCK', 'Bob', 'SCISSORS', 'Alice', 0); // W
    insert('a2', DAY, 'Alice', 'PAPER', 'Bob', 'ROCK', 'Alice', 1000); // W
    insert('a3', DAY, 'Bob', 'ROCK', 'Alice', 'SCISSORS', 'Bob', 2000); // L (Alice is player_b)
    insert('a4', DAY, 'Alice', 'ROCK', 'Bob', 'ROCK', null, 3000); // T
    insert('a5', DAY, 'Alice', 'ROCK', 'Bob', 'SCISSORS', 'Alice', 4000); // W
    insert('a6', DAY, 'Alice', 'PAPER', 'Bob', 'ROCK', 'Alice', 5000); // W
    insert('a7', DAY, 'Alice', 'ROCK', 'Bob', 'SCISSORS', 'Alice', 6000); // W
    // Exotic move game — should not count toward stats
    insert('a8', DAY, 'Alice', 'DYNAMITE', 'Bob', 'SCISSORS', 'Alice', 7000);
});

describe('getPlayerStats', () => {
    it('returns null for unknown player', () => {
        expect(getPlayerStats('Nobody')).toBeNull();
    });

    it('returns correct win/loss/tie counts', () => {
        const stats = getPlayerStats('Alice');
        expect(stats?.wins).toBe(5);
        expect(stats?.losses).toBe(1);
        expect(stats?.ties).toBe(1);
        expect(stats?.total).toBe(7);
    });

    it('computes win rate as a percentage rounded to 1dp', () => {
        const stats = getPlayerStats('Alice');
        // 5/7 = 71.4...% → 71.4
        expect(stats?.winRate).toBe(71.4);
    });

    it('computes longest win streak', () => {
        const stats = getPlayerStats('Alice');
        // sequence: W W L T W W W → streak of 3
        expect(stats?.longestWinStreak).toBe(3);
    });

    it('counts move distribution correctly', () => {
        const stats = getPlayerStats('Alice');
        // Alice's moves: a1=ROCK, a2=PAPER, a3=SCISSORS(as player_b), a4=ROCK,
        //                a5=ROCK, a6=PAPER, a7=ROCK — a8 exotic excluded
        expect(stats?.moves.ROCK).toBe(4);
        expect(stats?.moves.PAPER).toBe(2);
        expect(stats?.moves.SCISSORS).toBe(1);
    });

    it('returns byDay breakdown', () => {
        const stats = getPlayerStats('Alice');
        expect(stats?.byDay).toHaveLength(1);
        expect(stats?.byDay[0]).toMatchObject({
            day: DAY,
            wins: 5,
            losses: 1,
            ties: 1,
        });
    });

    it('is case-insensitive', () => {
        const lower = getPlayerStats('alice');
        const upper = getPlayerStats('ALICE');
        expect(lower?.total).toBe(upper?.total);
    });
});
