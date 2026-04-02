import 'dotenv/config';
import './ingest.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { getLatest, getByDate, getByPlayer, getMatchesBetween } from './services/matches.js';
import { getLeaderboard, getLeaderboardToday } from './services/leaderboard.js';
import { getPlayerStats, getPlayerStatsInRange } from './services/player.js';
import { getDataHealth } from './services/health.js';
import { gameEvents } from './events.js';
import type { MatchResult } from './services/matches.js';
import db from './db.js';

const app = Fastify({ logger: true });

app.register(cors, { origin: true });

app.register(swagger, {
    openapi: {
        info: { title: 'RPS League API', version: '1.0.0' },
    },
});

app.register(swaggerUi, {
    routePrefix: '/docs',
});

const isoDate = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'Date (YYYY-MM-DD)' };

app.after(() => {

// --- SSE live feed ---

app.get('/api/live', (req, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });
    reply.raw.flushHeaders();

    const heartbeat = setInterval(() => reply.raw.write(': ping\n\n'), 15000);

    const listener = (game: MatchResult) => {
        reply.raw.write(`data: ${JSON.stringify(game)}\n\n`);
    };
    gameEvents.on('game', listener);

    req.raw.on('close', () => {
        clearInterval(heartbeat);
        gameEvents.off('game', listener);
    });
});

// --- Matches ---

app.get<{ Querystring: { after?: string } }>(
    '/api/matches/latest',
    {
        schema: {
            summary: 'Latest 50 games',
            tags: ['matches'],
            querystring: {
                type: 'object',
                properties: {
                    after: { type: 'string', description: 'Only return games after this ISO timestamp' },
                },
            },
        },
    },
    async (req) => {
        const after = req.query.after ? new Date(req.query.after).getTime() : undefined;
        return getLatest(50, after);
    },
);

app.get<{ Querystring: { date?: string; player?: string; playerA?: string; playerB?: string; from?: string; to?: string; page: number; sort?: string } }>(
    '/api/matches',
    {
        schema: {
            summary: 'Games by date, player, or head-to-head',
            tags: ['matches'],
            querystring: {
                type: 'object',
                properties: {
                    date: { ...isoDate, description: 'Filter by date (YYYY-MM-DD)' },
                    player: { type: 'string', minLength: 1, description: 'Filter by player name' },
                    playerA: { type: 'string', minLength: 1, description: 'Head-to-head: player A' },
                    playerB: { type: 'string', minLength: 1, description: 'Head-to-head: player B' },
                    from: { ...isoDate, description: 'Start date (YYYY-MM-DD)' },
                    to: { ...isoDate, description: 'End date (YYYY-MM-DD)' },
                    page: { type: 'integer', minimum: 1, default: 1 },
                    sort: { type: 'string', enum: ['asc', 'desc'], description: 'Sort direction for game_time' },
                },
            },
        },
    },
    async (req, reply) => {
        const { date, player, playerA, playerB, from, to, page, sort } = req.query;
        if (playerA && playerB && from && to) return getMatchesBetween(playerA, playerB, from, to, page);
        if (date && player) return getByPlayer(player, page, 50, date, date);
        if (date) return getByDate(date, page, 50, sort === 'desc' ? 'desc' : 'asc');
        if (player) return getByPlayer(player, page, undefined, from, to);
        reply.code(400).send({ error: 'Provide date, player, or playerA+playerB+from+to query params' });
    },
);

// --- Player ---

app.get<{ Params: { name: string }; Querystring: { from?: string; to?: string } }>(
    '/api/player/:name',
    {
        schema: {
            summary: 'Stats for a single player',
            tags: ['players'],
            params: {
                type: 'object',
                properties: { name: { type: 'string' } },
            },
            querystring: {
                type: 'object',
                properties: {
                    from: isoDate,
                    to: isoDate,
                },
            },
        },
    },
    async (req, reply) => {
        const player = decodeURIComponent(req.params.name);
        const { from, to } = req.query;
        if (from && to) {
            const summary = getPlayerStatsInRange(player, from, to);
            if (!summary) { reply.code(404).send({ error: 'Player not found' }); return; }
            return summary;
        }
        const stats = getPlayerStats(player);
        if (!stats) {
            reply.code(404).send({ error: 'Player not found' });
            return;
        }
        return stats;
    },
);

// --- Players ---

app.get(
    '/api/players',
    {
        schema: {
            summary: 'All player names',
            tags: ['players'],
        },
    },
    async () => {
        return db
            .prepare(
                `
        SELECT DISTINCT player_a as name FROM games
        UNION
        SELECT DISTINCT player_b as name FROM games
        ORDER BY name ASC
    `,
            )
            .all();
    },
);

// --- Health ---

app.get(
    '/api/health',
    {
        schema: {
            summary: 'Data ingestion health',
            tags: ['health'],
        },
    },
    async () => {
        return getDataHealth();
    },
);

// --- Leaderboard ---

app.get(
    '/api/leaderboard/today',
    {
        schema: {
            summary: "Today's win leaderboard",
            tags: ['leaderboard'],
        },
    },
    async () => {
        return getLeaderboardToday();
    },
);

app.get<{ Querystring: { from: string; to: string } }>(
    '/api/leaderboard',
    {
        schema: {
            summary: 'Win leaderboard for a date range',
            tags: ['leaderboard'],
            querystring: {
                type: 'object',
                required: ['from', 'to'],
                properties: {
                    from: isoDate,
                    to: isoDate,
                },
            },
        },
    },
    async (req) => {
        const { from, to } = req.query;
        return getLeaderboard(from, to);
    },
);

}); // app.after

// --- Start ---

const port = parseInt(process.env.PORT ?? '3001');

app.listen({ port, host: '0.0.0.0' }, (err) => {
    if (err) {
        app.log.error(err);
        process.exit(1);
    }
});
