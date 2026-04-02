import type { Game, MatchPage, LeaderboardEntry, PlayerStats, PlayerSummary, DataHealth } from '../types';

const BASE = import.meta.env.VITE_API_BASE ?? '';

async function get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`);
    if (!res.ok) throw new Error(`API ${res.status} ${path}`);
    return res.json();
}

export const api = {
    latestMatches: (after?: string) => {
        const qs = after ? `?after=${encodeURIComponent(after)}` : '';
        return get<Game[]>(`/api/matches/latest${qs}`);
    },

    matchesByDate: (date: string, page = 1, player?: string, sort?: 'asc' | 'desc') => {
        const params = new URLSearchParams({ date, page: String(page) });
        if (player) params.set('player', player);
        if (sort) params.set('sort', sort);
        return get<MatchPage>(`/api/matches?${params}`);
    },

    matchesByPlayer: (player: string, page = 1, from?: string, to?: string) => {
        const params = new URLSearchParams({ player, page: String(page) });
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        return get<MatchPage>(`/api/matches?${params}`);
    },

    leaderboard: (from: string, to: string) =>
        get<LeaderboardEntry[]>(`/api/leaderboard?from=${from}&to=${to}`),

    leaderboardToday: () =>
        get<LeaderboardEntry[]>('/api/leaderboard/today'),

    playerStats: (player: string, from?: string, to?: string) => {
        const params = new URLSearchParams();
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        const qs = params.toString() ? `?${params}` : '';
        return get<PlayerStats | PlayerSummary>(`/api/player/${encodeURIComponent(player)}${qs}`);
    },

    health: () => get<DataHealth>('/api/health'),

    players: () => get<{ name: string }[]>('/api/players'),

    liveStream: (onGame: (game: Game) => void): (() => void) => {
        const es = new EventSource(`${BASE}/api/live`);
        es.onmessage = (e) => {
            try { onGame(JSON.parse(e.data)); } catch { /* ignore malformed */ }
        };
        return () => es.close();
    },
};
