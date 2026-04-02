// keep the database complete and current

import 'dotenv/config';
import db, { getMeta, setMeta, deleteMeta } from './db.js';
import { emitGame } from './events.js';
import type { MatchResult } from './services/matches.js';

const TOKEN = process.env['TOKEN'] ?? '';
const BASE = process.env['BASE_URL'] ?? '';
const CRAWL_DELAY_MS = parseInt(process.env['CRAWL_DELAY_MS'] ?? '0', 10);

function parseTime(t: unknown): number {
    if (typeof t === 'string') {
        return new Date(t).getTime();
    } else if (typeof t === 'number' && t < 9999999999) {
        return t * 1000;
    }
    return t as number;
}

const insert = db.prepare(`
    INSERT OR IGNORE INTO games
    (game_id, game_time, player_a, move_a, player_b, move_b, source, winner)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertAnomaly = db.prepare(`
    INSERT OR IGNORE INTO anomalies (game_id, reason, detected_at)
    VALUES (?, ?, ?)
`);

async function fetchPage(url: string): Promise<{ data: any[]; cursor: string | null }> {
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${TOKEN}` },
    });

    if (!res.ok) {
        throw new Error(`HTTP ${res.status} on ${url}`);
    }

    return await res.json();
}

function checkAnomaly(game: any): string[] {
    const reasons: string[] = [];

    if (game.player_a === game.player_b) {
        reasons.push('self-play');
    }

    const validMoves = ['ROCK', 'PAPER', 'SCISSORS'];
    if (!validMoves.includes(game.move_a)) {
        reasons.push(`invalid move_a: ${game.move_a}`);
    }
    if (!validMoves.includes(game.move_b)) {
        reasons.push(`invalid move_b: ${game.move_b}`);
    }

    if (game.game_time < 1577836800000 || game.game_time > Date.now() + 60000) {
        reasons.push(`suspicious timestamp: ${game.game_time}`);
    }

    return reasons;
}

function insertPage(data: any[], source: string, onInserted?: (game: MatchResult) => void): number {
    let inserted = 0;
    for (const game of data) {
        const playerA = game.playerA.name.trim();
        const playerB = game.playerB.name.trim();
        const moveA = game.playerA.played.toUpperCase();
        const moveB = game.playerB.played.toUpperCase();
        const gameTime = parseTime(game.time);

        const winner = calculateWinner(playerA, moveA, playerB, moveB);

        const result = insert.run(
            game.gameId,
            gameTime,
            playerA,
            moveA,
            playerB,
            moveB,
            source,
            winner,
        );

        if (result.changes > 0) {
            inserted++;
            const reasons = checkAnomaly({
                player_a: playerA,
                player_b: playerB,
                move_a: moveA,
                move_b: moveB,
                game_time: gameTime,
            });

            if (reasons.length > 0) {
                insertAnomaly.run(game.gameId, reasons.join(', '), Date.now());
            }

            onInserted?.({ game_id: game.gameId, game_time: gameTime, player_a: playerA, move_a: moveA, player_b: playerB, move_b: moveB, winner });
        }
    }
    return inserted;
}

// Full crawl for initial load and ongoing validation.
async function crawlFullHistory() {
    console.log('Starting full history crawl...');
    let url = `${BASE}/history`;
    let page = 0;

    // Reset progress tracking for this crawl run
    deleteMeta('crawl_oldest_seen');

    while (true) {
        try {
            const data = await fetchPage(url);
            const inserted = insertPage(data.data, 'history');
            page++;
            console.log(`page ${page}: ${inserted} new records`);

            // Track how far back the crawl has reached
            if (data.data.length > 0) {
                const oldest = Math.min(...data.data.map((g: any) => parseTime(g.time)));
                setMeta('crawl_oldest_seen', oldest.toString());
            }

            if (!data.cursor) {
                console.log('END - history fully crawled');
                deleteMeta('crawl_oldest_seen');
                setMeta('history_crawl_complete', Date.now().toString());
                break;
            }

            url = `${BASE}${data.cursor}`;
            // Aggressive crawl — the API is flaky so 429s are expected and handled.
            // Tune via CRAWL_DELAY_MS in .env (default 200ms).
            await new Promise((r) => setTimeout(r, CRAWL_DELAY_MS));
        } catch (e: any) {
            // Back off longer on 429 — the API is telling us to slow down
            const is429 = e?.message?.includes('429');
            const wait = is429 ? 5000 : 1000;
            console.log(`Error (${is429 ? '429 rate limit' : 'other'}), retrying in ${wait}ms:`, e);
            await new Promise((r) => setTimeout(r, wait));
        }
    }
}

async function followLiveStream() {
    const url = `${BASE}/live`;

    while (true) {
        try {
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${TOKEN}` },
            });

            if (!res.ok) {
                console.log(`Live stream HTTP ${res.status} - reconecting in 5s`);
                await new Promise((r) => setTimeout(r, 5000));
                continue;
            }

            const reader = res.body!.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value);
                const lines = text.split('\n');

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const json = line.slice(6);
                    try {
                        const game = JSON.parse(json);
                        if (!getMeta('gap_end')) {
                            setMeta('gap_end', parseTime(game.time).toString());
                            console.log(
                                `Gap ends at: ${new Date(parseTime(game.time)).toISOString()}`,
                            );
                        }
                        const inserted = insertPage([game], 'live', emitGame);
                        if (inserted > 0) {
                            console.log(`live: ${game.playerA.name} vs ${game.playerB.name}`);
                        }
                    } catch {
                        // ignore malformed lines
                    }
                }
            }
        } catch (e) {
            console.log('Live stream error: reconnecting in 5s', e);
            await new Promise((r) => setTimeout(r, 5000));
        }
    }
}

async function catchRecentGaps() {
    const gapStart = getMeta('gap_start');
    if (!gapStart) {
        console.log('No gap_start recorded - skipping catch up');
        return;
    }

    const targetTime = parseInt(gapStart);
    console.log(`Catching up gaps since: ${new Date(targetTime).toISOString()}`);

    let url = `${BASE}/history`;
    let page = 0;

    while (true) {
        try {
            const data = await fetchPage(url);
            const inserted = insertPage(data.data, 'history');
            page++;
            console.log(`catchup page ${page}: ${inserted} new records`);

            // Check if we've gone back far enough
            const oldest = Math.min(...data.data.map((g: any) => parseTime(g.time)));
            if (oldest <= targetTime) {
                console.log(`Reached gap_start after ${page} pages - catch up complete`);
                break;
            }

            if (!data.cursor) {
                console.log('END - reached bottom of history during catch up');
                break;
            }

            url = `${BASE}${data.cursor}`;
            await new Promise((r) => setTimeout(r, 1000));
        } catch (e) {
            console.log('Error, retrying in 500ms:', e);
            await new Promise((r) => setTimeout(r, 500));
        }
    }
}

// what if i started it, stopped it, started it, stopped it - would we miss a bit?

async function pollRecentHistory() {
    console.log('Starting recent history poller...');

    while (true) {
        try {
            const data = await fetchPage(`${BASE}/history`);
            const inserted = insertPage(data.data, 'history');
            if (inserted > 0) {
                console.log(`poller: ${inserted} new records from recent history`);
            }

            // Check if gap is closed
            const gapEnd = getMeta('gap_end');
            if (gapEnd) {
                const newest = Math.max(...data.data.map((g: any) => parseTime(g.time)));
                if (newest >= parseInt(gapEnd)) {
                    setMeta('gap_closed', Date.now().toString());
                    console.log('Gap closed - stopping poller');
                    return;
                }
            }
        } catch (e) {
            console.log('Poller error:', e);
        }

        await new Promise((r) => setTimeout(r, 10000));
    }
}

function calculateWinner(
    playerA: string,
    moveA: string,
    playerB: string,
    moveB: string,
): string | null {
    if (moveA === moveB) return null; // draw
    if (
        (moveA === 'ROCK' && moveB === 'SCISSORS') ||
        (moveA === 'SCISSORS' && moveB === 'PAPER') ||
        (moveA === 'PAPER' && moveB === 'ROCK')
    )
        return playerA;
    return playerB;
}

async function main() {
    // Clear stale gap state from any previous run
    deleteMeta('gap_start');
    deleteMeta('gap_end');
    deleteMeta('gap_closed');

    // Record the newest game we have before we start
    const newest = db.prepare('SELECT MAX(game_time) as t FROM games').get() as {
        t: number | null;
    };
    if (newest.t) {
        setMeta('gap_start', newest.t.toString());
        console.log(`Gap starts at: ${new Date(newest.t).toISOString()}`);
    }

    followLiveStream(); // start immediately, records gap_end on first record
    catchRecentGaps(); // pages back until gap_start, runs concurrently
    pollRecentHistory(); // watches page 1 until gap_end is reached
    crawlFullHistory(); // full validation crawl in background

    console.log('Ingestion ready.');
}

main();
