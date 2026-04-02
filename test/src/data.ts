// Types matching the frontend client shapes

export interface MatchResult {
    game_id: string;
    game_time: number;
    player_a: string;
    move_a: string;
    player_b: string;
    move_b: string;
    winner: string | null;
}

export interface MatchPage {
    matches: MatchResult[];
    total: number;
}

export interface LeaderboardEntry {
    rank: number;
    player: string;
    wins: number;
}

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

export interface DataHealth {
    validGames: number;
    excludedGames: number;
    firstGame: string | null;
    lastGame: string | null;
    crawlComplete: string | null;
    crawlOldestSeen: string | null;
    gap: {
        start: string | null;
        end: string | null;
        closed: string | null;
        status: 'none' | 'filling' | 'closed';
    };
}

// --- Players: 10 first names × 17 surnames = 170 players ---
//
// Mix of French, German, and British names. First × last cross freely —
// the combination space gives enough variety at scale.

const FIRST_NAMES = [
    'Sophie', 'Pierre', 'Camille',          // French
    'Klaus', 'Greta', 'Hans', 'Britta',     // German
    'James', 'Emma', 'Oliver',              // British
];

const LAST_NAMES = [
    'Dupont', 'Martin', 'Dubois', 'Bernard', 'Lefèvre', 'Rousseau',   // French
    'Müller', 'Schmidt', 'Weber', 'Fischer', 'Becker', 'Richter',     // German
    'Smith', 'Jones', 'Taylor', 'Brown', 'Davies',                    // British
];

// 10 × 17 = 170
export const PLAYERS = FIRST_NAMES.flatMap((first) => LAST_NAMES.map((last) => `${first} ${last}`));

// --- Move cycle ---
//
// Each player has a phase (playerIdx % 3) that determines their starting move.
// On each subsequent day, every player advances one step in their cycle:
//
//   Phase 0: ROCK → SCISSORS → PAPER → ROCK → ...
//   Phase 1: SCISSORS → PAPER → ROCK → SCISSORS → ...
//   Phase 2: PAPER → ROCK → SCISSORS → PAPER → ...
//
// Result: on any given day, ~1/3 of players throw each move, so games have
// real winners. And the pattern is obvious in the UI — great for verifying
// charts and leaderboard math.

const CYCLE = ['ROCK', 'SCISSORS', 'PAPER'] as const;

export function moveForPlayer(playerIdx: number, dayIdx: number): string {
    return CYCLE[(playerIdx % 3 + dayIdx) % 3]!;
}

// --- Date helpers ---

export function today(): string {
    return new Date().toISOString().slice(0, 10);
}

export function offsetDate(base: string, days: number): string {
    const d = new Date(base + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

// --- Match generation ---

function computeWinner(playerA: string, playerB: string, moveA: string, moveB: string): string | null {
    if (moveA === moveB) return null;
    if (
        (moveA === 'ROCK' && moveB === 'SCISSORS') ||
        (moveA === 'SCISSORS' && moveB === 'PAPER') ||
        (moveA === 'PAPER' && moveB === 'ROCK')
    ) return playerA;
    return playerB;
}

// 3 rounds of N games per day (N = 170 → 510 games/day).
// Offsets 5, 7, 11 are all non-zero mod 170, so no self-play.
// None are divisible by 3, so each player always faces an opponent
// with a different phase — guaranteeing real wins and losses.
const ROUND_OFFSETS = [5, 7, 11, 3]; // 3 is divisible by 3 → same-phase matchups → ties

export function generateMatches(numDays: number, endDate: string = today()): MatchResult[] {
    if (numDays === 0) return [];

    const games: MatchResult[] = [];
    const N = PLAYERS.length; // 170

    for (let d = 0; d < numDays; d++) {
        const dayIdx = d; // used for move cycle; 0 = oldest day
        const daysAgo = numDays - 1 - d;
        const date = offsetDate(endDate, -daysAgo);
        const baseTime = new Date(date + 'T09:00:00Z').getTime();

        let gameNum = 0;
        for (const offset of ROUND_OFFSETS) {
            for (let aIdx = 0; aIdx < N; aIdx++) {
                const bIdx = (aIdx + offset) % N;

                const playerA = PLAYERS[aIdx]!;
                const playerB = PLAYERS[bIdx]!;

                const moveA = moveForPlayer(aIdx, dayIdx);
                const moveB = moveForPlayer(bIdx, dayIdx);
                const winner = computeWinner(playerA, playerB, moveA, moveB);

                games.push({
                    game_id: `mock-${date}-${gameNum.toString().padStart(4, '0')}`,
                    game_time: baseTime + gameNum * 60_000, // one game per minute
                    player_a: playerA,
                    move_a: moveA,
                    player_b: playerB,
                    move_b: moveB,
                    winner,
                });
                gameNum++;
            }
        }
    }

    // Most recent first
    return games.sort((a, b) => b.game_time - a.game_time);
}

// --- Query helpers ---

const PAGE_SIZE = 50;

export function latestMatches(games: MatchResult[], limit: number, afterMs?: number): MatchResult[] {
    const filtered = afterMs != null ? games.filter((g) => g.game_time > afterMs) : games;
    return filtered.slice(0, limit);
}

export function matchesByDate(games: MatchResult[], date: string, page: number): MatchPage {
    const filtered = games.filter((g) => new Date(g.game_time).toISOString().slice(0, 10) === date);
    const start = (page - 1) * PAGE_SIZE;
    return { matches: filtered.slice(start, start + PAGE_SIZE), total: filtered.length };
}

export function matchesByPlayer(games: MatchResult[], player: string, page: number): MatchPage {
    const lower = player.toLowerCase();
    const filtered = games.filter(
        (g) => g.player_a.toLowerCase() === lower || g.player_b.toLowerCase() === lower,
    );
    const start = (page - 1) * PAGE_SIZE;
    return { matches: filtered.slice(start, start + PAGE_SIZE), total: filtered.length };
}

export function computeLeaderboard(games: MatchResult[], from: string, to: string): LeaderboardEntry[] {
    const stats = new Map<string, { wins: number; losses: number; ties: number }>();
    for (const g of games) {
        const day = new Date(g.game_time).toISOString().slice(0, 10);
        if (day < from || day > to) continue;
        for (const p of [g.player_a, g.player_b]) {
            if (!stats.has(p)) stats.set(p, { wins: 0, losses: 0, ties: 0 });
        }
        if (g.winner === null) {
            stats.get(g.player_a)!.ties++;
            stats.get(g.player_b)!.ties++;
        } else {
            stats.get(g.winner)!.wins++;
            const loser = g.winner === g.player_a ? g.player_b : g.player_a;
            stats.get(loser)!.losses++;
        }
    }
    return [...stats.entries()]
        .sort(([, a], [, b]) => b.wins - a.wins)
        .map(([player, s], i) => ({ rank: i + 1, player, ...s }));
}

export function computePlayerStats(games: MatchResult[]): Map<string, PlayerStats> {
    const map = new Map<string, PlayerStats>();

    for (let pi = 0; pi < PLAYERS.length; pi++) {
        const name = PLAYERS[pi]!;
        const pg = games.filter((g) => g.player_a === name || g.player_b === name);

        type DayData = { wins: number; losses: number; ties: number; rock: number; paper: number; scissors: number };
        const byDayMap = new Map<string, DayData>();

        let wins = 0, losses = 0, ties = 0;
        const moves = { ROCK: 0, PAPER: 0, SCISSORS: 0 };
        let maxStreak = 0, currentStreak = 0;

        // Sort ascending for streak computation
        const sorted = [...pg].sort((a, b) => a.game_time - b.game_time);

        for (const g of sorted) {
            const myMove = (g.player_a === name ? g.move_a : g.move_b).toUpperCase() as 'ROCK' | 'PAPER' | 'SCISSORS';
            const day = new Date(g.game_time).toISOString().slice(0, 10);

            if (!byDayMap.has(day)) byDayMap.set(day, { wins: 0, losses: 0, ties: 0, rock: 0, paper: 0, scissors: 0 });
            const dd = byDayMap.get(day)!;

            moves[myMove]++;
            if (myMove === 'ROCK') dd.rock++;
            else if (myMove === 'PAPER') dd.paper++;
            else dd.scissors++;

            if (g.winner === null) {
                ties++; dd.ties++; currentStreak = 0;
            } else if (g.winner === name) {
                wins++; dd.wins++; currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
            } else {
                losses++; dd.losses++; currentStreak = 0;
            }
        }

        const total = wins + losses + ties;
        const byDay = [...byDayMap.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([day, d]) => ({ day, ...d }));

        map.set(name.toLowerCase(), {
            name,
            rank: null, // assigned below
            total,
            wins,
            losses,
            ties,
            winRate: total > 0 ? Math.round((wins / total) * 1000) / 10 : 0,
            longestWinStreak: maxStreak,
            moves,
            byDay,
        });
    }

    // Assign ranks by wins descending (same logic as real backend)
    const ranked = [...map.values()].sort((a, b) => b.wins - a.wins);
    ranked.forEach((s, i) => { s.rank = i + 1; });

    return map;
}
