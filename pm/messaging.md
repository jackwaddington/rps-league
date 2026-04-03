# User-facing messaging

## Principles

- Be factual. Don't state things we aren't certain about.
- Don't hedge with "hopefully", "should", "estimated" — if we're not sure, don't say it.
- Users are players and fans. They don't need to understand our ingestion pipeline.
- One banner, not five warnings. Pages add context only when the banner alone isn't enough.
- When we don't have data, say so clearly and show what we do have.

---

## System states and what we say

### Gap open (missing games being imported)

The server was offline and games were played that we didn't capture live. We are backfilling from history.

| Location | Message |
| --- | --- |
| GapBanner (site-wide) | "Importing missed games. Results may be incomplete." |
| Matches — today view | *(banner is sufficient — no extra page message)* |
| Leaderboard — today view | *(banner is sufficient)* |
| Leaderboard — all time view | "Today's results are incomplete — games are still being imported." |

What we don't say: time estimates. The fill duration is unpredictable (multiple restarts, multiple gaps). No promise we can keep.

### Cold start — no prior data

The DB is empty. We are building history from scratch. Nothing is available yet except the live stream.

| Location | Message |
| --- | --- |
| GapBanner | "System coming online." |
| Leaderboard — all time | "Historical data not yet available." |
| Any historical date | *(show empty state — "No games on this date." — banner provides context)* |

### Cold start — prior data exists

The DB has data from a previous run. We trust it. The trawl is running as a completeness check, not a prerequisite.

| Location | Message |
| --- | --- |
| GapBanner | "Importing missed games. Results may be incomplete." *(same as gap open)* |
| Historical pages | *(show data — no extra warning needed)* |
| Leaderboard — all time | *(show data — trust prior trawl)* |

### Normal operation

Gap closed, data available. No banner. No warnings. Pages just show data.

---

## Empty states (no data for the requested view)

| Context | Message |
| --- | --- |
| Matches — no games on selected date | "No games on this date." |
| Live — no games received yet | "Waiting for games…" |
| Leaderboard — no entries in range | "No games in this range." |
| Player — no matches found | "No matches found." |
| Player — no H2H matches | "No matches between {player} and {opponent}." |
| Loading (stats not yet returned) | "Loading…" |

---

## Strings we avoid

| Avoid | Because |
| --- | --- |
| "Data may be temporarily unavailable" | Vague — says nothing actionable |
| "Please wait while we sync…" | Implies we know it'll finish soon |
| "History crawl running" | Internal language, not meaningful to players/fans |
| Time estimates ("ready in ~2 hours") | We can't reliably predict this |
