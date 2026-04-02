import Fastify from 'fastify';
import cors from '@fastify/cors';
import {
    PLAYERS, generateMatches, moveForPlayer, today,
    latestMatches, matchesByDate, matchesByPlayer,
    computeLeaderboard, computePlayerStats,
    type MatchResult, type DataHealth,
} from './data.js';
import { SCENARIOS, SCENARIO_LIST, type ScenarioName } from './scenarios.js';

// --- State ---

let currentScenarioName: ScenarioName = 'gap-closed';
let games: MatchResult[] = [];
let playerStatsMap = computePlayerStats([]);
let currentHealth: DataHealth = SCENARIOS['gap-closed'].makeHealth();

function applyScenario(name: ScenarioName) {
    const s = SCENARIOS[name];
    currentScenarioName = name;
    games = generateMatches(s.days);
    playerStatsMap = computePlayerStats(games);
    currentHealth = s.makeHealth();
    console.log(`[mock] scenario → ${name}  (${games.length} games)`);
}

applyScenario('gap-closed');

// --- Server ---

const app = Fastify({ logger: false });
app.register(cors, { origin: true });

// === Real API endpoints ===

app.get<{ Querystring: { after?: string } }>('/api/matches/latest', async (req) => {
    const afterMs = req.query.after ? new Date(req.query.after).getTime() : undefined;
    return latestMatches(games, 50, afterMs);
});

app.get<{ Querystring: { date?: string; player?: string; page?: string } }>(
    '/api/matches',
    async (req, reply) => {
        const { date, player, page } = req.query;
        const pageNum = page ? Math.max(1, parseInt(page)) : 1;
        if (date) return matchesByDate(games, date, pageNum);
        if (player) return matchesByPlayer(games, decodeURIComponent(player), pageNum);
        reply.code(400).send({ error: 'Provide date or player query param' });
    },
);

app.get<{ Params: { name: string } }>('/api/player/:name', async (req, reply) => {
    const key = decodeURIComponent(req.params.name).toLowerCase();
    const stats = playerStatsMap.get(key);
    if (!stats) { reply.code(404).send({ error: 'Player not found' }); return; }
    return stats;
});

app.get('/api/players', async () => {
    return PLAYERS.map((name) => ({ name }));
});

app.get('/api/health', async () => {
    return currentHealth;
});

app.get('/api/leaderboard/today', async () => {
    const t = today();
    return computeLeaderboard(games, t, t);
});

app.get<{ Querystring: { from?: string; to?: string } }>('/api/leaderboard', async (req, reply) => {
    const { from, to } = req.query;
    if (!from || !to) { reply.code(400).send({ error: 'from and to are required' }); return; }
    return computeLeaderboard(games, from, to);
});

// === Live SSE stream ===

let liveSeq = 0;

function generateLiveGame(): MatchResult {
    const aIdx = Math.floor(Math.random() * PLAYERS.length);
    let bIdx = Math.floor(Math.random() * (PLAYERS.length - 1));
    if (bIdx >= aIdx) bIdx++;

    const dayIdx = Math.floor(Date.now() / 86_400_000); // stable within a day
    const playerA = PLAYERS[aIdx]!;
    const playerB = PLAYERS[bIdx]!;
    const moveA = moveForPlayer(aIdx, dayIdx);
    const moveB = moveForPlayer(bIdx, dayIdx);
    const BEATS: Record<string, string> = { ROCK: 'SCISSORS', SCISSORS: 'PAPER', PAPER: 'ROCK' };
    const winner = moveA === moveB ? null : BEATS[moveA] === moveB ? playerA : playerB;

    return {
        game_id: `live-${Date.now()}-${liveSeq++}`,
        game_time: Date.now(),
        player_a: playerA,
        move_a: moveA,
        player_b: playerB,
        move_b: moveB,
        winner,
    };
}

const liveClients = new Set<NodeJS.Timeout>();

app.get('/api/live', (req, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });
    reply.raw.flushHeaders();

    const heartbeat = setInterval(() => reply.raw.write(': ping\n\n'), 15_000);
    const ticker = setInterval(() => {
        const game = generateLiveGame();
        reply.raw.write(`data: ${JSON.stringify(game)}\n\n`);
    }, 3_000);

    liveClients.add(ticker);
    req.raw.on('close', () => {
        clearInterval(heartbeat);
        clearInterval(ticker);
        liveClients.delete(ticker);
    });
});

// === Mock control endpoints ===

app.post<{ Params: { name: string } }>('/mock/scenario/:name', async (req, reply) => {
    const name = req.params.name as ScenarioName;
    if (!SCENARIOS[name]) {
        reply.code(400).send({ error: `Unknown scenario: ${name}. Valid: ${Object.keys(SCENARIOS).join(', ')}` });
        return;
    }
    applyScenario(name);
    return { ok: true, scenario: name, games: games.length };
});

app.get('/mock/state', async () => {
    const s = SCENARIOS[currentScenarioName];
    const oldest = games.length > 0 ? games[games.length - 1] : null;
    const newest = games.length > 0 ? games[0] : null;
    return {
        scenario: currentScenarioName,
        label: s.label,
        description: s.description,
        games: games.length,
        players: PLAYERS.length,
        dateRange: oldest && newest ? {
            from: new Date(oldest.game_time).toISOString().slice(0, 10),
            to: new Date(newest.game_time).toISOString().slice(0, 10),
        } : null,
        health: currentHealth,
    };
});

app.get('/mock', async (_req, reply) => {
    const s = SCENARIOS[currentScenarioName];
    const oldest = games.length > 0 ? games[games.length - 1] : null;
    const newest = games.length > 0 ? games[0] : null;
    const dateRange = oldest && newest ? {
        from: new Date(oldest.game_time).toISOString().slice(0, 10),
        to: new Date(newest.game_time).toISOString().slice(0, 10),
    } : null;

    reply.type('text/html').send(renderPanel({
        current: currentScenarioName,
        label: s.label,
        gameCount: games.length,
        dateRange,
        health: currentHealth,
    }));
});

// === HTML control panel ===

function renderPanel(opts: {
    current: string;
    label: string;
    gameCount: number;
    dateRange: { from: string; to: string } | null;
    health: DataHealth;
}) {
    const rows = SCENARIO_LIST.map((s) => {
        const active = s.name === opts.current;
        return `<tr class="${active ? 'active' : ''}">
      <td><button onclick="activate('${s.name}')">${s.label}</button></td>
      <td class="desc">${s.description}</td>
    </tr>`;
    }).join('');

    const range = opts.dateRange ? `${opts.dateRange.from} &rarr; ${opts.dateRange.to}` : '&mdash;';
    const gapStatus = opts.health.gap.status;
    const crawlDone = opts.health.crawlComplete ? '&#10003;' : '&mdash;';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>RPS Mock</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: ui-monospace, 'Cascadia Code', monospace; background: #f5f5f5; color: #111; padding: 36px 32px; max-width: 740px; }
    a { color: #0066cc; }
    h1 { font-size: 1.3rem; color: #000; letter-spacing: -0.02em; }
    .sub { color: #888; font-size: 0.78rem; margin-top: 4px; margin-bottom: 36px; }
    h2 { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.12em; color: #888; margin: 28px 0 10px; }

    table { width: 100%; border-collapse: collapse; }
    td { padding: 6px 10px; vertical-align: middle; }
    tr { border-bottom: 1px solid #ddd; }
    tr.active { background: #e8f0fe; }
    tr.active td:first-child button { background: #1a56db; color: #fff; font-weight: 700; border-color: #1a56db; }
    button {
      font-family: inherit; font-size: 0.82rem; padding: 4px 14px;
      background: #fff; color: #333; border: 1px solid #ccc;
      border-radius: 4px; cursor: pointer; min-width: 130px; text-align: left;
    }
    button:hover { background: #f0f0f0; color: #000; }
    .desc { color: #666; font-size: 0.78rem; }

    .stats { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 4px; }
    .stat { background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: 12px 16px; min-width: 110px; }
    .stat .val { font-size: 1.1rem; font-weight: 700; color: #000; }
    .stat .lbl { font-size: 0.65rem; color: #888; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 3px; }

    pre {
      background: #fff; border: 1px solid #ddd; border-radius: 6px;
      padding: 14px 16px; font-size: 0.73rem; color: #555; overflow-x: auto;
      line-height: 1.5;
    }
    .note {
      background: #fffbe6; border: 1px solid #e6d87a; color: #7a6500;
      padding: 10px 14px; border-radius: 4px; font-size: 0.75rem; margin-top: 28px;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <h1>RPS Mock Server</h1>
  <p class="sub">
    port 3002 &nbsp;&middot;&nbsp;
    state JSON &rarr; <a href="/mock/state">/mock/state</a>
  </p>

  <h2>Scenario</h2>
  <table><tbody>${rows}</tbody></table>

  <h2>Current State</h2>
  <div class="stats">
    <div class="stat">
      <div class="val">${opts.label}</div>
      <div class="lbl">Scenario</div>
    </div>
    <div class="stat">
      <div class="val">${opts.gameCount}</div>
      <div class="lbl">Games</div>
    </div>
    <div class="stat">
      <div class="val" style="font-size:0.85rem">${range}</div>
      <div class="lbl">Date Range</div>
    </div>
    <div class="stat">
      <div class="val">${gapStatus}</div>
      <div class="lbl">Gap Status</div>
    </div>
    <div class="stat">
      <div class="val">${crawlDone}</div>
      <div class="lbl">Crawl Done</div>
    </div>
  </div>

  <h2>Health Payload</h2>
  <pre>${JSON.stringify(opts.health, null, 2)}</pre>

  <div class="note">
    <strong>Note:</strong> The frontend polls health every 2s while warming up or gap-filling,
    and slows to 10s once <code>crawlComplete</code> is set and <code>gap.status !== 'filling'</code>.
    Switching scenarios is picked up within 10s — no page reload needed.
  </div>

  <script>
    function activate(name) {
      fetch('/mock/scenario/' + name, { method: 'POST' })
        .then(() => {
          location.reload();
        })
        .catch(console.error);
    }
  </script>
</body>
</html>`;
}

// --- Start ---

const port = parseInt(process.env.PORT ?? '3002');
app.listen({ port, host: '0.0.0.0' }, (err) => {
    if (err) { console.error(err); process.exit(1); }
    console.log(`[mock] http://localhost:${port}/mock  ← control panel`);
});
