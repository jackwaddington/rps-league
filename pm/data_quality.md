# Data Quality

## What counts as a valid game

A game is only included in leaderboards, player stats, and match listings if both moves are one of: ROCK, PAPER, SCISSORS (case-insensitive).

Games with any other move value (e.g. BLADE, LIZARD, DOG, or anything else) are stored in the DB for auditing but excluded from all calculations. The result of such a game is undefined — there is no correct winner to compute.

This is a deliberate decision. The assignment says to build an RPS league. If a move is not part of RPS, the game is not a valid RPS game.

## Anomaly detection

For every record inserted, we check:

- **Self-play** — player_a and player_b are the same name
- **Invalid moves** — move is not ROCK, PAPER, or SCISSORS
- **Suspicious timestamps** — time before 2020 or in the future

Anomalies are recorded in a separate `anomalies` table with the game_id and reason. The health bar on the dashboard shows the anomaly count.

## Current counts (as of first full crawl)

- 33 anomalies, all self-play
- All invalid-move games excluded from stats via SQL filter: `UPPER(move_a) IN ('ROCK','PAPER','SCISSORS') AND UPPER(move_b) IN ('ROCK','PAPER','SCISSORS')`

## Gap detection

A **gap** is the window of time where the ingestor was not running — games that were played but not captured by the live feed.

### How it works

On every startup, before connecting to anything:

1. **`gap_start`** is set to the timestamp of the newest game already in the DB — "where we left off."
2. **`followLiveStream()`** connects to the live feed. The first game received sets **`gap_end`** — "where the live feed picks up."
3. The gap = all games between `gap_start` and `gap_end`. These are missed games that need to be backfilled from history.

Three processes run concurrently to close it:

- **`catchRecentGaps()`** — crawls history pages backwards until it reaches `gap_start`.
- **`pollRecentHistory()`** — polls page 1 of history every 10s until the newest record there is ≥ `gap_end`.
- When `pollRecentHistory()` confirms page 1 has caught up, **`gap_closed`** is set and the poller stops.

### Multiple restarts

Each restart resets `gap_start` to the newest game currently in the DB. By that point, previous gaps are already filled, so successive restarts only create small gaps equal to the actual downtime window. There is no compounding effect.

### Fresh database (no prior data)

If the DB is empty, `gap_start` is not set. `catchRecentGaps()` skips (nothing to catch up to). The full history crawl (`crawlFullHistory()`) handles everything — it pages through all history from newest to oldest and is the sole source of truth until it completes.

### Gap status values

| Status    | Meaning                                                             |
| --------- | ------------------------------------------------------------------- |
| `none`    | No gap detected — DB was empty at start, or this is the first run. |
| `filling` | `gap_start` and/or `gap_end` are set; backfill in progress.        |
| `closed`  | History has caught up to the live feed's start point.              |

## Data health indicators (health bar)

- Total game count
- Date range (first game → last game)
- Gap status: none / filling / closed (gap = window where ingestor was not running)
- DB verified time: when the full history crawl last completed
- Anomaly count
