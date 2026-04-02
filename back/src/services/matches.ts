import db from '../db.js';

const VALID_MOVES = `UPPER(move_a) IN ('ROCK','PAPER','SCISSORS') AND UPPER(move_b) IN ('ROCK','PAPER','SCISSORS')`;

export interface MatchResult {
    game_id: string;
    game_time: number;
    player_a: string;
    move_a: string;
    player_b: string;
    move_b: string;
    winner: string | null;
}

export function getLatest(limit = 50, after?: number): MatchResult[] {
    if (after !== undefined) {
        return db
            .prepare(
                `
            SELECT game_id, game_time, player_a, move_a, player_b, move_b, winner
            FROM games
            WHERE ${VALID_MOVES} AND game_time > ?
            ORDER BY game_time DESC
            LIMIT ?
        `,
            )
            .all(after, limit) as MatchResult[];
    }
    return db
        .prepare(
            `
        SELECT game_id, game_time, player_a, move_a, player_b, move_b, winner
        FROM games
        WHERE ${VALID_MOVES}
        ORDER BY game_time DESC
        LIMIT ?
    `,
        )
        .all(limit) as MatchResult[];
}

export function getByDate(
    date: string,
    page = 1,
    pageSize = 50,
    sortDir: 'asc' | 'desc' = 'asc',
): { matches: MatchResult[]; total: number } {
    const dir = sortDir === 'desc' ? 'DESC' : 'ASC';
    const offset = (page - 1) * pageSize;
    const matches = db
        .prepare(
            `
        SELECT game_id, game_time, player_a, move_a, player_b, move_b, winner
        FROM games
        WHERE date(game_time/1000, 'unixepoch') = ?
          AND ${VALID_MOVES}
        ORDER BY game_time ${dir}
        LIMIT ? OFFSET ?
    `,
        )
        .all(date, pageSize, offset) as MatchResult[];

    const { total } = db
        .prepare(
            `
        SELECT COUNT(*) as total FROM games
        WHERE date(game_time/1000, 'unixepoch') = ?
          AND ${VALID_MOVES}
    `,
        )
        .get(date) as { total: number };

    return { matches, total };
}

export function getByPlayer(
    player: string,
    page = 1,
    pageSize = 50,
    from?: string,
    to?: string,
): { matches: MatchResult[]; total: number } {
    const offset = (page - 1) * pageSize;
    const dateFilter = from && to ? `AND date(game_time/1000, 'unixepoch') BETWEEN ? AND ?` : '';
    const dateArgs = from && to ? [from, to] : [];

    const matches = db
        .prepare(
            `
        SELECT game_id, game_time, player_a, move_a, player_b, move_b, winner
        FROM games
        WHERE (LOWER(player_a) = LOWER(?) OR LOWER(player_b) = LOWER(?))
          AND ${VALID_MOVES}
          ${dateFilter}
        ORDER BY game_time DESC
        LIMIT ? OFFSET ?
    `,
        )
        .all(player, player, ...dateArgs, pageSize, offset) as MatchResult[];

    const { total } = db
        .prepare(
            `
        SELECT COUNT(*) as total FROM games
        WHERE (LOWER(player_a) = LOWER(?) OR LOWER(player_b) = LOWER(?))
          AND ${VALID_MOVES}
          ${dateFilter}
    `,
        )
        .get(player, player, ...dateArgs) as { total: number };

    return { matches, total };
}

export function getMatchesBetween(
    playerA: string,
    playerB: string,
    from: string,
    to: string,
    page = 1,
    pageSize = 50,
): { matches: MatchResult[]; total: number; aWins: number; bWins: number; ties: number } {
    const offset = (page - 1) * pageSize;

    const matches = db
        .prepare(
            `
        SELECT game_id, game_time, player_a, move_a, player_b, move_b, winner
        FROM games
        WHERE (
            (LOWER(player_a) = LOWER(?) AND LOWER(player_b) = LOWER(?)) OR
            (LOWER(player_a) = LOWER(?) AND LOWER(player_b) = LOWER(?))
        )
          AND ${VALID_MOVES}
          AND date(game_time/1000, 'unixepoch') BETWEEN ? AND ?
        ORDER BY game_time DESC
        LIMIT ? OFFSET ?
    `,
        )
        .all(playerA, playerB, playerB, playerA, from, to, pageSize, offset) as MatchResult[];

    const agg = db
        .prepare(
            `
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN LOWER(winner) = LOWER(?) THEN 1 ELSE 0 END) as aWins,
            SUM(CASE WHEN LOWER(winner) = LOWER(?) THEN 1 ELSE 0 END) as bWins,
            SUM(CASE WHEN winner IS NULL THEN 1 ELSE 0 END) as ties
        FROM games
        WHERE (
            (LOWER(player_a) = LOWER(?) AND LOWER(player_b) = LOWER(?)) OR
            (LOWER(player_a) = LOWER(?) AND LOWER(player_b) = LOWER(?))
        )
          AND ${VALID_MOVES}
          AND date(game_time/1000, 'unixepoch') BETWEEN ? AND ?
    `,
        )
        .get(playerA, playerB, playerA, playerB, playerB, playerA, from, to) as {
        total: number; aWins: number; bWins: number; ties: number;
    };

    return { matches, total: agg.total, aWins: agg.aWins, bWins: agg.bWins, ties: agg.ties };
}
