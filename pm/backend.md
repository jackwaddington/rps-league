# RPS League — Backend Reference

A Rock-Paper-Scissors tournament tracking API. The backend ingests game data from an external live stream and history API, stores it in SQLite, and serves stats to the frontend.

---

## Upstream Reaktor API

### `GET /history`

Returns a page of historical game results, newest first.

**Response:**

```json
{
  "data": [
    {
      "type": "GAME_RESULT",
      "gameId": "79b2-4d1a-8e3f",
      "time": 1709123456789,
      "playerA": { "name": "Alice", "played": "ROCK" },
      "playerB": { "name": "Bob", "played": "SCISSORS" }
    }
  ],
  "cursor": "MjAyNC0wMi0yOFQxMjozNDo1Ng=="
}
```
Paginate by passing `cursor` as a query param. No cursor = most recent page.

### `GET /live`

Streams game results as Server-Sent Events.

**Event payload:** Same `GAME_RESULT` shape as above — no `cursor`, no `data` wrapper.

---

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Runtime | Node.js + TypeScript (tsx) | |
| HTTP | Fastify v5 | Schema validation built in |
| Database | better-sqlite3 | Embedded, synchronous, no network |
| Validation | Zod | Query param schemas |
| Docs | @fastify/swagger + swagger-ui | Available at `/docs` |
| Tests | vitest | Unit tests with in-memory SQLite |

---

## File Map

| File | Role |
|---|---|
| `server.ts` | Route definitions, Zod schemas, request handlers |
| `db.ts` | SQLite connection, schema creation, meta key-value helpers |
| `ingest.ts` | 4-process data ingestion pipeline, winner calculation |
| `services/matches.ts` | Query functions: latest, by date, by player, head-to-head |
| `services/player.ts` | Query functions: player stats, win streaks, move distribution |
| `services/leaderboard.ts` | Leaderboard rankings by win count and date range |
| `services/health.ts` | Ingestion pipeline status |

---

## Database Schema

### `games`
```
game_id    TEXT PRIMARY KEY   -- Unique game identifier
game_time  INTEGER NOT NULL   -- Unix timestamp (milliseconds)
player_a   TEXT NOT NULL
move_a     TEXT NOT NULL      -- ROCK, PAPER, SCISSORS, or exotic
player_b   TEXT NOT NULL
move_b     TEXT NOT NULL
source     TEXT NOT NULL      -- 'history' | 'live'
winner     TEXT               -- Winner name, or NULL for a tie
```

### `meta`
Key-value store tracking ingestion state:
- `gap_start` — newest game timestamp before ingestion started
- `gap_end` — first game received from live stream (marks the gap boundary)
- `gap_closed` — when the gap was fully backfilled
- `crawl_oldest_seen` — progress cursor for full history crawl
- `history_crawl_complete` — datetime when full crawl finished

### `anomalies`
```
game_id     TEXT PRIMARY KEY
reason      TEXT NOT NULL      -- Comma-separated anomaly descriptions
detected_at INTEGER NOT NULL   -- Unix timestamp (milliseconds)
```

---

## Data Rules

### What counts as a "valid" game
Only games where both moves are `ROCK`, `PAPER`, or `SCISSORS` (uppercased) are included in any stat. Games with exotic moves (e.g. `DYNAMITE`) are stored but excluded everywhere.

### Winner calculation (done at ingest time)
```
ROCK beats SCISSORS
SCISSORS beats PAPER
PAPER beats ROCK
Same move → NULL (tie)
```

### Anomaly flags
Detected during ingest and audit:
- **Self-play**: `player_a === player_b`
- **Invalid move**: not in {ROCK, PAPER, SCISSORS}
- **Suspicious timestamp**: before 2020-01-01, or more than 60s in the future
- **Short game_id**: fewer than 18 characters

---

## Ingestion Pipeline

Four concurrent processes run on startup:

1. **`followLiveStream()`** — persistent SSE connection to the upstream `/live` endpoint. Sets `gap_end` on first game received. Reconnects with 5s backoff on failure.

2. **`catchRecentGaps()`** — pages back through `/history` from `gap_start` to `gap_end` to backfill games missed during downtime. Runs once per startup if `gap_start` is set.

3. **`pollRecentHistory()`** — polls `/history` every 10s while the live stream catches up. Marks gap as closed when the newest polled game >= `gap_end`.

4. **`crawlFullHistory()`** — walks the entire game history from the beginning to validate all existing data. Runs in the background; sets `history_crawl_complete` when done.

Rate limiting: configurable `CRAWL_DELAY_MS` (default 200ms) between requests. On 429: 5s backoff. On other errors: 1s backoff.

### Upstream API characterisation

Before settling on the crawl delay, the upstream `/history` API was stress-tested: 10 full crawls with no artificial delay, measuring throughput and error rate.

| Metric | Observed range |
|---|---|
| Pages per full crawl | 566–568 |
| Records per full crawl | ~175,000–176,000 |
| Elapsed time (no delay) | 143–197 seconds |
| Errors per crawl (mostly 429) | 166–209 (~30% of requests) |
| Throughput | 890–1,230 records/second |
| Avg page latency | 149–235ms |

At full speed, roughly 1 in 3 requests fails. The 200ms inter-request delay was chosen to stay well within the API's rate limit while keeping crawl time reasonable. Results are logged in `back/api-stress-results.tsv`.

---

## API Endpoints

All endpoints are prefixed with `/api`.

---

### `GET /api/matches/latest`
The 50 most recent valid games.

| Param | Type | Required | Description |
|---|---|---|---|
| `after` | ISO datetime | No | Only return games after this time |

**Response:** `MatchResult[]`

---

### `GET /api/matches`
Flexible match retrieval with three modes depending on params provided.

**Mode 1 — by date:**

| Param | Type | Required |
|---|---|---|
| `date` | YYYY-MM-DD | Yes |
| `page` | number | No (default 1) |

**Mode 2 — by player:**

| Param | Type | Required |
|---|---|---|
| `player` | string | Yes |
| `page` | number | No (default 1) |

**Mode 3 — head-to-head:**

| Param | Type | Required |
|---|---|---|
| `playerA` | string | Yes |
| `playerB` | string | Yes |
| `from` | YYYY-MM-DD | No |
| `to` | YYYY-MM-DD | No |
| `page` | number | No (default 1) |

**Response:**
- Modes 1 & 2: `{ matches: MatchResult[], total: number }`
- Mode 3: `{ matches, total, aWins, bWins, ties }`

Page size: 50 records.

---

### `GET /api/player/:name`
Stats for a single player. Name is URL-encoded. All matching is case-insensitive.

| Param | Type | Required | Description |
|---|---|---|---|
| `from` | YYYY-MM-DD | No | Start of date range |
| `to` | YYYY-MM-DD | No | End of date range |

**Response (no date range):** Full `PlayerStats` — rank, move distribution, per-day breakdown, longest win streak.

**Response (with date range):** Summary `{ name, total, wins, losses, ties, winRate }`.

Returns 404 if player not found.

---

### `GET /api/players`
All unique player names, ascending.

**Response:** `{ name: string }[]`

---

### `GET /api/leaderboard/today`
Win leaderboard for today (UTC).

**Response:** `{ rank, player, wins }[]`

---

### `GET /api/leaderboard`
Win leaderboard for a date range.

| Param | Type | Required |
|---|---|---|
| `from` | YYYY-MM-DD | Yes |
| `to` | YYYY-MM-DD | Yes |

**Response:** `{ rank, player, wins }[]` — sorted by wins descending, alphabetical tiebreaker.

---

### `GET /api/health`
Ingestion pipeline status.

**Response:**
```ts
{
  validGames: number        // Games with valid RPS moves
  excludedGames: number     // Stored but not counted
  firstGame: string         // ISO date
  lastGame: string          // ISO date
  crawlComplete: string | null    // ISO datetime or null
  crawlOldestSeen: string | null  // ISO datetime or null
  gap: {
    status: 'none' | 'filling' | 'closed'
    start: string | null
    end: string | null
    closed: string | null
  }
}
```

---

## Query Conventions

- **Valid move filter** applied to all stats queries:
  ```sql
  WHERE UPPER(move_a) IN ('ROCK','PAPER','SCISSORS') AND UPPER(move_b) IN ('ROCK','PAPER','SCISSORS')
  ```
- **Case-insensitive player matching:**
  ```sql
  WHERE LOWER(player_a) = LOWER(?) OR LOWER(player_b) = LOWER(?)
  ```
- **Date range from Unix milliseconds:**
  ```sql
  WHERE date(game_time/1000, 'unixepoch') BETWEEN ? AND ?
  ```
- **Win streak** is computed in application code from an ordered list of game results, not in SQL.
- **Pagination** is offset-based: `offset = (page - 1) * 50`.
- **CORS** is open (`origin: true`).
- All endpoints return 400 on invalid input, 404 on not found.
- Prepared statements used throughout — no SQL injection risk.
