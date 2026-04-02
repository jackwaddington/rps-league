export interface Game {
    game_id: string;
    game_time: number; // Unix ms
    player_a: string;
    move_a: 'ROCK' | 'PAPER' | 'SCISSORS';
    player_b: string;
    move_b: 'ROCK' | 'PAPER' | 'SCISSORS';
    winner: string | null; // player_a | player_b | null (draw)
}

export interface MatchPage {
    matches: Game[];
    total: number;
}

export interface LeaderboardEntry {
    rank: number;
    player: string;
    wins: number;
    losses: number;
    ties: number;
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
