# Data States

The frontend must only offer views that are backed by data that actually exists and is reliable. This document defines what data we have, when we have it, and what each page can legitimately show.

---

## The three data types

### Live
The SSE stream. Always running while the server is up.

**Useful when:** There is an open gap — games are arriving via the stream that are not yet in the DB.

**Redundant when:** Gap is closed — "today" (polled from DB) already shows the same data with a 5s lag, which is good enough.

### Today
Games from the current date, served from the DB.

**Reliable when:** The gap is closed — no games are missing between where the DB left off and where the live stream picked up.

**Unreliable when:** Gap is open — the DB is missing some of today's games. Do not present today's totals as complete. Do not show a leaderboard for today as if it's accurate.

### Historical (past dates)
Games from previous dates, served from the DB.

**Available when:** The DB contains data for that date. Two ways this can be true:
1. **Prior trawl exists** — the DB was populated in a previous run. History doesn't change (the API returns the same past games every time), so this data can be trusted without re-trawling.
2. **Current trawl has reached that date** — the trawl works newest-to-oldest, so recent dates become available first.

**Unavailable when:** Cold start with an empty DB and the trawl hasn't reached that date yet.

> **Trust prior data.** We continue to run the full history trawl on every startup as a completeness check — in case a previous cold start was interrupted before it finished. But if we already have DB data, we display it. We do not wait for the trawl to finish before showing history.

---

## System states

| State | hasGap | hasPriorData | Live | Today | Historical |
|---|---|---|---|---|---|
| Cold start, empty DB | true | false | ✓ only option | ✗ | ✗ — show "catching up" |
| Cold start, prior DB | true | true | ✓ | ✗ gapped | ✓ trust prior data |
| Gap closed, no prior (first full run) | false | false | redundant | ✓ | ✓ as trawl builds it |
| Gap closed, prior DB | false | true | redundant | ✓ | ✓ |
| Normal — gap closed, trawl complete | false | true | redundant | ✓ | ✓ |

**Key variables:**
- `hasGap` — `gap.status === 'filling'`
- `hasPriorData` — DB has game records from before this startup (`health.firstGame` is set)
- `trawlComplete` — `health.crawlComplete` is set

---

## What "All time" means in practice

"All time" is only a meaningful label when we have complete history. If we're in a cold start with no prior data and the trawl is still running, "all time" is a partial view and shouldn't be presented as complete. Show a "catching up" notice instead.

If `hasPriorData` is true — even if the trawl is still running — "all time" reflects what we have, which is the prior full dataset. That's accurate enough to display.

---

## UI consequences

- **Live nav link** is always visible. It is most useful when `hasGap` is true (games may not be in the DB yet), but the stream is always running.
- **Today view** is suppressed or warned when `hasGap` is true. Don't show today's leaderboard as final when data is missing.
- **Historical date navigation** is bounded by what the DB actually contains — don't let users navigate to dates we have no data for.
- **All time** shows a "catching up" notice when cold-starting with no prior data.
- **The gap banner** is the primary way we communicate non-normal state. Pages should not duplicate what the banner already says — they can add context (e.g. "historical data available from {date}") but not repeat the same warning.

---

## Messaging principles

*(see messaging.md for exact strings)*

- Be factual. Don't promise when something will be ready.
- Users are players and fans — they don't need to understand ingestion.
- One banner, not five warnings scattered across the page.
- When we don't have data, say so clearly and show what we do have.
