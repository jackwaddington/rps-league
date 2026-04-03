# Manual Testing Guide

Test via `/test` (mock environment). Switch scenarios using the control panel at `/panel`.

---

## Setup

```bash
docker compose up --build
```

- `/test` — frontend against mock data
- `/panel` — switch scenarios

---

## Scenarios

### Live (normal operation)

**Panel:** Live · **What to check:**

- No gap banner
- Matches: shows games, prev/next nav works, Today button visible
- Leaderboard: Today / Date range / All time all available; data shows W/L/T counts
- Player: click any player name → stats + match history loads; R/P/S abbreviations in history; metric cards right-aligned

---

### Cold Start (empty DB, gap open)

**Panel:** Cold Start · **What to check:**

- Banner: "System coming online."
- Nav: Live link present (gap is open)
- Matches: no games (days=0 in mock) → "No games on this date."
- Leaderboard: Today button hidden; defaults to All time → "Historical data not yet available — catching up."
- Live tab: shows "Waiting for games…" (no mock SSE)

---

### Gap Connecting (prior data, waiting for first live game)

**Panel:** Gap Connecting · **What to check:**

- Banner: "Connecting to live stream…"
- Nav: Live link present
- Matches: historical dates work; today shows warning about incomplete data
- Leaderboard: Today button hidden; All time shows data (prior data trusted)
- Live tab: "Waiting for games…"

> The live stream itself (games arriving in real-time) can only be verified in the real environment. Mock confirms the banner and nav state.

---

### Gap Filling (gap.end known, backfill in progress)

**Panel:** Gap Filling · **What to check:**

- Banner: "Importing missed games. Results may be incomplete."
- Nav: Live link present
- Matches: today shows warning banner (data incomplete)
- Leaderboard: Today button hidden; All time shows data
- Live tab: games should stream in; count increments; newest first; scrollable (no cap)

---

### Gap Closed (fully resolved)

**Panel:** Gap Closed · **What to check:**

- No banner
- Nav: Live link present (always visible)
- Matches: Today works, prev/next nav works
- Leaderboard: Today / Date range / All time all available
- Player: full stats including best win streak

---

### Empty (no data at all)

**Panel:** Empty · **What to check:**

- No banner (no gap, no data)
- Matches: "No games on this date."
- Leaderboard: "No games in this range."
- Player search: no results

---

## Cross-cutting checks

| Check | Where |
| --- | --- |
| Light/dark theme toggle works | Header |
| Player search autocomplete | Header |
| Player names are links to Player page | Matches, Leaderboard |
| Pagination appears when >50 results | Matches, Player |
| R/P/S (not Rock/Paper/Scissors) in match rows | Matches, Live, Player |
| Losses and Ties dimmed vs Wins normal weight | Leaderboard, Player |
| Metric card counts right-aligned | Player |
| Loser dimmed, winner normal weight (← / → result) | Matches, Live, Player |

---

## Real environment only

These states require a live Reaktor API connection and cannot be mocked:

- Gap Connecting → Filling transition (first SSE game sets gap.end)
- Live tab streaming with real games
- Crawl completing (crawlComplete field becoming set)
