import db from '../db.js';

const VALID_MOVES = `UPPER(move_a) IN ('ROCK','PAPER','SCISSORS') AND UPPER(move_b) IN ('ROCK','PAPER','SCISSORS')`;

export interface LeaderboardEntry {
    rank: number;
    player: string;
    wins: number;
    losses: number;
    ties: number;
}

export function getLeaderboard(from: string, to: string): LeaderboardEntry[] {
    const rows = db
        .prepare(
            `
        WITH all_games AS (
            SELECT player_a AS player, winner FROM games
            WHERE date(game_time/1000, 'unixepoch') BETWEEN ? AND ?
              AND ${VALID_MOVES}
            UNION ALL
            SELECT player_b AS player, winner FROM games
            WHERE date(game_time/1000, 'unixepoch') BETWEEN ? AND ?
              AND ${VALID_MOVES}
        )
        SELECT
            player,
            SUM(CASE WHEN winner = player THEN 1 ELSE 0 END) AS wins,
            SUM(CASE WHEN winner != player AND winner IS NOT NULL THEN 1 ELSE 0 END) AS losses,
            SUM(CASE WHEN winner IS NULL THEN 1 ELSE 0 END) AS ties
        FROM all_games
        GROUP BY player
        ORDER BY wins DESC, player ASC
    `,
        )
        .all(from, to, from, to) as { player: string; wins: number; losses: number; ties: number }[];

    return rows.map((row, i) => ({ rank: i + 1, ...row }));
}

export function getLeaderboardToday(): LeaderboardEntry[] {
    const today = new Date().toISOString().slice(0, 10);
    return getLeaderboard(today, today);
}
