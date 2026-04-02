import db from '../db.js';

const VALID_MOVES = `UPPER(move_a) IN ('ROCK','PAPER','SCISSORS') AND UPPER(move_b) IN ('ROCK','PAPER','SCISSORS')`;

export interface PlayerStats {
    name: string;
    rank: number | null;
    total: number;
    wins: number;
    losses: number;
    ties: number;
    winRate: number;
    longestWinStreak: number;
    moves: { ROCK: number; PAPER: number; SCISSORS: number };
    byDay: {
        day: string;
        wins: number;
        losses: number;
        ties: number;
        rock: number;
        paper: number;
        scissors: number;
    }[];
}

export interface PlayerSummary {
    name: string;
    rank: number | null;
    total: number;
    wins: number;
    losses: number;
    ties: number;
    winRate: number;
    moves: { ROCK: number; PAPER: number; SCISSORS: number };
}

export function getPlayerStatsInRange(player: string, from: string, to: string): PlayerSummary | null {
    const exists = db
        .prepare(`SELECT 1 FROM games WHERE (LOWER(player_a) = LOWER(?) OR LOWER(player_b) = LOWER(?)) LIMIT 1`)
        .get(player, player);
    if (!exists) return null;

    const stats = db
        .prepare(
            `
        SELECT
            COUNT(*) as total,
            COALESCE(SUM(CASE WHEN winner = ? THEN 1 ELSE 0 END), 0) as wins,
            COALESCE(SUM(CASE WHEN winner IS NULL THEN 1 ELSE 0 END), 0) as ties
        FROM games
        WHERE (LOWER(player_a) = LOWER(?) OR LOWER(player_b) = LOWER(?))
          AND ${VALID_MOVES}
          AND date(game_time/1000, 'unixepoch') BETWEEN ? AND ?
    `,
        )
        .get(player, player, player, from, to) as { total: number; wins: number; ties: number };

    const moveRows = db
        .prepare(
            `
        SELECT
            UPPER(CASE WHEN LOWER(player_a) = LOWER(?) THEN move_a ELSE move_b END) as move,
            COUNT(*) as count
        FROM games
        WHERE (LOWER(player_a) = LOWER(?) OR LOWER(player_b) = LOWER(?))
          AND ${VALID_MOVES}
          AND date(game_time/1000, 'unixepoch') BETWEEN ? AND ?
        GROUP BY move
    `,
        )
        .all(player, player, player, from, to) as { move: string; count: number }[];

    const moves = { ROCK: 0, PAPER: 0, SCISSORS: 0 };
    for (const row of moveRows) {
        if (row.move in moves) moves[row.move as keyof typeof moves] = row.count;
    }

    const rankRow = db
        .prepare(
            `
        SELECT rank FROM (
            SELECT winner as player, RANK() OVER (ORDER BY COUNT(*) DESC) as rank
            FROM games
            WHERE winner IS NOT NULL AND ${VALID_MOVES}
              AND date(game_time/1000, 'unixepoch') BETWEEN ? AND ?
            GROUP BY winner
        ) WHERE LOWER(player) = LOWER(?)
    `,
        )
        .get(from, to, player) as { rank: number } | undefined;

    const losses = stats.total - stats.wins - stats.ties;
    return {
        name: player,
        rank: rankRow?.rank ?? null,
        total: stats.total,
        wins: stats.wins,
        losses,
        ties: stats.ties,
        winRate: stats.total > 0 ? Math.round((stats.wins / stats.total) * 1000) / 10 : 0,
        moves,
    };
}

export function getPlayerStats(player: string): PlayerStats | null {
    // Check player exists
    const exists = db
        .prepare(
            `
        SELECT 1 FROM games
        WHERE (LOWER(player_a) = LOWER(?) OR LOWER(player_b) = LOWER(?))
        LIMIT 1
    `,
        )
        .get(player, player);

    if (!exists) return null;

    // Overall stats
    const stats = db
        .prepare(
            `
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN winner = ? THEN 1 ELSE 0 END) as wins,
            SUM(CASE WHEN winner IS NULL THEN 1 ELSE 0 END) as ties
        FROM games
        WHERE (LOWER(player_a) = LOWER(?) OR LOWER(player_b) = LOWER(?))
          AND ${VALID_MOVES}
    `,
        )
        .get(player, player, player) as { total: number; wins: number; ties: number };

    // Move distribution
    const moveRows = db
        .prepare(
            `
        SELECT
            UPPER(CASE WHEN LOWER(player_a) = LOWER(?) THEN move_a ELSE move_b END) as move,
            COUNT(*) as count
        FROM games
        WHERE (LOWER(player_a) = LOWER(?) OR LOWER(player_b) = LOWER(?))
          AND ${VALID_MOVES}
        GROUP BY move
    `,
        )
        .all(player, player, player) as { move: string; count: number }[];

    const moves = { ROCK: 0, PAPER: 0, SCISSORS: 0 };
    for (const row of moveRows) {
        if (row.move in moves) moves[row.move as keyof typeof moves] = row.count;
    }

    // Per-day breakdown including move counts
    const byDay = db
        .prepare(
            `
        SELECT
            date(game_time/1000, 'unixepoch') as day,
            SUM(CASE WHEN winner = ? THEN 1 ELSE 0 END) as wins,
            SUM(CASE WHEN winner IS NULL THEN 1 ELSE 0 END) as ties,
            COUNT(*) - SUM(CASE WHEN winner = ? THEN 1 ELSE 0 END) - SUM(CASE WHEN winner IS NULL THEN 1 ELSE 0 END) as losses,
            SUM(CASE WHEN UPPER(CASE WHEN LOWER(player_a) = LOWER(?) THEN move_a ELSE move_b END) = 'ROCK' THEN 1 ELSE 0 END) as rock,
            SUM(CASE WHEN UPPER(CASE WHEN LOWER(player_a) = LOWER(?) THEN move_a ELSE move_b END) = 'PAPER' THEN 1 ELSE 0 END) as paper,
            SUM(CASE WHEN UPPER(CASE WHEN LOWER(player_a) = LOWER(?) THEN move_a ELSE move_b END) = 'SCISSORS' THEN 1 ELSE 0 END) as scissors
        FROM games
        WHERE (LOWER(player_a) = LOWER(?) OR LOWER(player_b) = LOWER(?))
          AND ${VALID_MOVES}
        GROUP BY day
        ORDER BY day ASC
    `,
        )
        .all(player, player, player, player, player, player, player) as {
        day: string;
        wins: number;
        losses: number;
        ties: number;
        rock: number;
        paper: number;
        scissors: number;
    }[];

    // Longest win streak — computed from ordered game results
    const gameResults = db
        .prepare(
            `
        SELECT CASE WHEN winner = ? THEN 'WIN' WHEN winner IS NULL THEN 'TIE' ELSE 'LOSE' END as result
        FROM games
        WHERE (LOWER(player_a) = LOWER(?) OR LOWER(player_b) = LOWER(?))
          AND ${VALID_MOVES}
        ORDER BY game_time ASC
    `,
        )
        .all(player, player, player) as { result: string }[];

    let longestWinStreak = 0;
    let currentStreak = 0;
    for (const { result } of gameResults) {
        if (result === 'WIN') {
            currentStreak++;
            if (currentStreak > longestWinStreak) longestWinStreak = currentStreak;
        } else {
            currentStreak = 0;
        }
    }

    const losses = stats.total - stats.wins - stats.ties;

    const rankRow = db
        .prepare(
            `
        SELECT rank FROM (
            SELECT winner as player, RANK() OVER (ORDER BY COUNT(*) DESC) as rank
            FROM games
            WHERE winner IS NOT NULL AND ${VALID_MOVES}
            GROUP BY winner
        ) WHERE LOWER(player) = LOWER(?)
    `,
        )
        .get(player) as { rank: number } | undefined;

    return {
        name: player,
        rank: rankRow?.rank ?? null,
        total: stats.total,
        wins: stats.wins,
        losses,
        ties: stats.ties,
        winRate: stats.total > 0 ? Math.round((stats.wins / stats.total) * 1000) / 10 : 0,
        longestWinStreak,
        moves,
        byDay,
    };
}
