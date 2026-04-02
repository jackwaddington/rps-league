import db, { getMeta } from '../db.js';

const VALID_MOVES = `UPPER(move_a) IN ('ROCK','PAPER','SCISSORS') AND UPPER(move_b) IN ('ROCK','PAPER','SCISSORS')`;

export interface DataHealth {
    validGames: number; // games with valid RPS moves — used in all stats
    excludedGames: number; // exotic moves + self-play, stored but not counted
    firstGame: string | null; // ISO date of oldest valid game
    lastGame: string | null; // ISO date of newest valid game
    crawlComplete: string | null; // ISO datetime when full history crawl finished
    crawlOldestSeen: string | null; // ISO datetime of oldest record seen in current crawl (null when complete)
    gap: {
        start: string | null;
        end: string | null;
        closed: string | null;
        status: 'none' | 'filling' | 'closed';
    };
}

export function getDataHealth(): DataHealth {
    const { validGames } = db
        .prepare(`SELECT COUNT(*) as validGames FROM games WHERE ${VALID_MOVES}`)
        .get() as { validGames: number };

    const { totalGames } = db
        .prepare('SELECT COUNT(*) as totalGames FROM games')
        .get() as { totalGames: number };

    const range = db
        .prepare(
            `SELECT MIN(game_time) as first, MAX(game_time) as last FROM games WHERE ${VALID_MOVES}`,
        )
        .get() as { first: number | null; last: number | null };

    const crawlComplete = getMeta('history_crawl_complete');
    const crawlOldestSeen = getMeta('crawl_oldest_seen');
    const gapStart = getMeta('gap_start');
    const gapEnd = getMeta('gap_end');
    const gapClosed = getMeta('gap_closed');

    let status: 'none' | 'filling' | 'closed' = 'none';
    if (gapClosed) status = 'closed';
    else if (gapEnd) status = 'filling';
    else if (gapStart) status = 'filling';

    return {
        validGames,
        excludedGames: totalGames - validGames,
        firstGame: range.first ? new Date(range.first).toISOString().slice(0, 10) : null,
        lastGame: range.last ? new Date(range.last).toISOString().slice(0, 10) : null,
        crawlComplete: crawlComplete ? new Date(parseInt(crawlComplete)).toISOString() : null,
        crawlOldestSeen: crawlOldestSeen ? new Date(parseInt(crawlOldestSeen)).toISOString() : null,
        gap: {
            start: gapStart ? new Date(parseInt(gapStart)).toISOString() : null,
            end: gapEnd ? new Date(parseInt(gapEnd)).toISOString() : null,
            closed: gapClosed ? new Date(parseInt(gapClosed)).toISOString() : null,
            status,
        },
    };
}
