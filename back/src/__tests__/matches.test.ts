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
import { getLatest, getByDate, getByPlayer } from '../services/matches.js';

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

const DAY1 = '2024-01-15';
const DAY2 = '2024-01-16';

beforeAll(() => {
    // 3 valid games on DAY1
    insert('g1', DAY1, 'Alice', 'ROCK', 'Bob', 'SCISSORS', 'Alice', 0);
    insert('g2', DAY1, 'Alice', 'PAPER', 'Bob', 'ROCK', 'Alice', 1000);
    insert('g3', DAY1, 'Bob', 'SCISSORS', 'Alice', 'ROCK', 'Alice', 2000);
    // 2 valid games on DAY2
    insert('g4', DAY2, 'Charlie', 'ROCK', 'Alice', 'SCISSORS', 'Charlie', 0);
    insert('g5', DAY2, 'Charlie', 'PAPER', 'Bob', 'ROCK', 'Charlie', 1000);
    // 1 game with exotic move (should be excluded from results)
    insert('g6', DAY1, 'Alice', 'DYNAMITE', 'Bob', 'SCISSORS', 'Alice', 3000);
});

describe('getLatest', () => {
    it('returns results ordered newest first', () => {
        const results = getLatest(10);
        const times = results.map((r) => r.game_time);
        expect(times).toEqual([...times].sort((a, b) => b - a));
    });

    it('respects the limit', () => {
        expect(getLatest(2)).toHaveLength(2);
    });

    it('excludes games with exotic moves', () => {
        const results = getLatest(10);
        const ids = results.map((r) => r.game_id);
        expect(ids).not.toContain('g6');
    });
});

describe('getByDate', () => {
    it('returns only games from the specified date', () => {
        const { matches } = getByDate(DAY1);
        expect(matches.every((m) => m.game_id.startsWith('g'))).toBe(true);
        // g6 is DAY1 but exotic — should be excluded; g1,g2,g3 are valid
        expect(matches).toHaveLength(3);
        expect(matches.map((m) => m.game_id)).toEqual(
            expect.arrayContaining(['g1', 'g2', 'g3']),
        );
    });

    it('returns correct total count', () => {
        const { total } = getByDate(DAY1);
        expect(total).toBe(3);
    });

    it('paginates results', () => {
        const page1 = getByDate(DAY1, 1, 2);
        const page2 = getByDate(DAY1, 2, 2);
        expect(page1.matches).toHaveLength(2);
        expect(page2.matches).toHaveLength(1);
        expect(page1.total).toBe(3);
    });

    it('returns empty for a date with no games', () => {
        const { matches, total } = getByDate('2020-01-01');
        expect(matches).toHaveLength(0);
        expect(total).toBe(0);
    });
});

describe('getByPlayer', () => {
    it('returns games where the player is either side', () => {
        const { matches } = getByPlayer('Alice');
        const ids = matches.map((m) => m.game_id);
        expect(ids).toContain('g1');
        expect(ids).toContain('g2');
        expect(ids).toContain('g3');
        expect(ids).toContain('g4');
        expect(ids).not.toContain('g5'); // Charlie vs Bob
    });

    it('is case-insensitive', () => {
        const lower = getByPlayer('alice');
        const upper = getByPlayer('ALICE');
        expect(lower.total).toBe(upper.total);
    });

    it('returns correct total', () => {
        const { total } = getByPlayer('Charlie');
        expect(total).toBe(2);
    });

    it('excludes exotic-move games', () => {
        const { matches } = getByPlayer('Alice');
        expect(matches.map((m) => m.game_id)).not.toContain('g6');
    });
});
