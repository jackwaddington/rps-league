# Data model

## Raw data points (what we store per game)

| Field | Type | Example |
|---|---|---|
| game_id | string | 45c3de76c96f... |
| game_time | timestamp | 2026-03-09 23:59:34 |
| player_a | string | Layla Chen |
| move_a | ROCK/PAPER/SCISSORS | ROCK |
| player_b | string | Kwame Tanaka |
| move_b | ROCK/PAPER/SCISSORS | PAPER |
| winner | string or null | Kwame Tanaka (null = draw or invalid) |

Valid game: both moves must be ROCK/PAPER/SCISSORS. Everything else is excluded.

---

## Derived: single dimension

| Derived | From | Example |
|---|---|---|
| date | game_time | 2026-03-09 |
| result for player | winner vs player name | WIN / LOSE / TIE |
| loser | winner + player_a + player_b | Layla Chen |
| move for player | move_a or move_b depending on perspective | ROCK |

---

## Derived: combining two dimensions

| Combination | What it gives | Features |
|---|---|---|
| player + result | win rate, total W/L/T | player page, leaderboard |
| player + date | performance on a given day | player page, day view |
| player + move | move preference / distribution | player page |
| player + player | head-to-head record | player page |
| date + result | daily win/draw counts, pace | day view |
| date + player | who played most on a day, top performers | day view, leaderboard |
| move + result | does rock win more than scissors? | player page (insight) |

---

## Derived: combining three dimensions

| Combination | What it gives | Features |
|---|---|---|
| player + move + date | does their move preference change over time? | player page chart |
| player + result + date | win rate trend over time | player page chart |
| player + player + date | head-to-head on a specific day | player page |
| date + player + result | leaderboard for a date range | leaderboard |

---

## What each feature uses

### Latest results
- game_time, player_a, player_b, move_a, move_b, winner

### Day view
- date, player_a, player_b, winner → aggregated: wins per player, draw count, game count

### Player page
- player + result + date (trend)
- player + move + date (move distribution over time)
- player + player (head-to-head)
- game_time, opponent, moves, result (match history)

### Leaderboard (today / date range)
- date range + player + result → ranked win counts
