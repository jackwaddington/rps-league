import type { DataHealth } from './data.js';
import { today, offsetDate } from './data.js';

export type ScenarioName = 'empty' | 'cold-start' | 'gap-connecting' | 'gap-filling' | 'gap-closed';

export interface Scenario {
    name: ScenarioName;
    label: string;
    description: string;
    days: number;
    makeHealth: () => DataHealth;
}

// Scenarios cover every distinct UI state the frontend can show.
// Switch between them in the control panel at http://localhost:3001/mock.

export const SCENARIOS: Record<ScenarioName, Scenario> = {
    empty: {
        name: 'empty',
        label: 'Back End Down',
        description: 'No games, no health data. Completely blank slate.',
        days: 0,
        makeHealth: () => ({
            validGames: 0,
            excludedGames: 0,
            firstGame: null,
            lastGame: null,
            crawlComplete: null,
            crawlOldestSeen: null,
            gap: { start: null, end: null, closed: null, status: 'none' },
        }),
    },

    'cold-start': {
        name: 'cold-start',
        label: 'Cold Start',
        description: 'Empty DB, gap open. Live feed only. Banner: "System coming online."',
        days: 0,
        makeHealth: () => {
            const t = today();
            return {
                validGames: 0,
                excludedGames: 0,
                firstGame: null,
                lastGame: null,
                crawlComplete: null,
                crawlOldestSeen: null,
                gap: {
                    start: t + 'T00:00:00.000Z',
                    end: null,
                    closed: null,
                    status: 'filling',
                },
            };
        },
    },

    'gap-connecting': {
        name: 'gap-connecting',
        label: 'Crawling History',
        description: 'gap.status=filling, gap.end=null. Banner: "Connecting to live stream…"',
        days: 5,
        makeHealth: () => {
            const t = today();
            return {
                validGames: 2550,
                excludedGames: 8,
                firstGame: offsetDate(t, -4),
                lastGame: t,
                crawlComplete: offsetDate(t, -1) + 'T08:00:00.000Z',
                crawlOldestSeen: offsetDate(t, -4) + 'T09:00:00.000Z',
                gap: {
                    start: t + 'T06:00:00.000Z',
                    end: null,
                    closed: null,
                    status: 'filling',
                },
            };
        },
    },

    'gap-filling': {
        name: 'gap-filling',
        label: "Gap in Today's Data",
        description: 'gap.status=filling, gap.end set. Banner shows estimated completion time.',
        days: 5,
        makeHealth: () => {
            const t = today();
            return {
                validGames: 2550,
                excludedGames: 8,
                firstGame: offsetDate(t, -4),
                lastGame: t,
                crawlComplete: offsetDate(t, -1) + 'T08:00:00.000Z',
                crawlOldestSeen: offsetDate(t, -4) + 'T09:00:00.000Z',
                gap: {
                    start: t + 'T06:00:00.000Z',
                    end: t + 'T08:00:00.000Z',
                    closed: null,
                    status: 'filling',
                },
            };
        },
    },

    'gap-closed': {
        name: 'gap-closed',
        label: 'Data Complete',
        description: 'gap.status=closed. Full data, gap resolved.',
        days: 7,
        makeHealth: () => {
            const t = today();
            return {
                validGames: 3570,
                excludedGames: 12,
                firstGame: offsetDate(t, -6),
                lastGame: t,
                crawlComplete: offsetDate(t, -1) + 'T08:00:00.000Z',
                crawlOldestSeen: offsetDate(t, -6) + 'T09:00:00.000Z',
                gap: {
                    start: t + 'T06:00:00.000Z',
                    end: t + 'T08:00:00.000Z',
                    closed: t + 'T08:30:00.000Z',
                    status: 'closed',
                },
            };
        },
    },

};

export const SCENARIO_LIST = Object.values(SCENARIOS);
