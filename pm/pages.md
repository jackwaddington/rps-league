# Pages

Four pages: Live · Matches · Leaderboard (in the nav, in that order) · Player (reached by clicking any player name, not in the nav per se, but searchable from top bar).

All data availability decisions are governed by data_states.md. Pages only offer views that are backed by reliable data.

---

## Matches

Purpose: Browse match results by date.

For players: Did my game get recorded? What happened today?

For fans: Replay any day. See who played who.

### Matches controls

- ← Prev / Next → — step one day back or forward. Bounded by `health.firstGame` on the left, today on the right.
- Date picker — jump to any date within the available range.
- Today button — appears only when viewing a past date.
- Sort — time column header is clickable; toggles ascending/descending. Default: newest first.

### Matches behaviour

| State | Behaviour |
| --- | --- |
| Today, gap closed | Polls every 5s. Shows current count. |
| Today, gap open | Banner warns data is incomplete. Page still shows what's in the DB. |
| Past date, data available | Single fetch. Static. |
| Past date, no data yet | "No games on this date." — banner provides context if cold-starting. |
| No games at all | "No games on this date." |

### Matches table columns

Date · Time (UTC) · Player A · Move · ← / → / = · Move · Player B

The middle column is the result indicator: `←` = Player A wins, `→` = Player B wins, `=` = tie. Player names are links to the Player page.

Pagination: 50 per page. Page controls appear when total > 50.

### Matches notes

- No player filter on this page. The global player search (header) navigates to the Player page.
- Date navigation is disabled for dates outside the available data range.

---

## Live

Purpose: See games as they arrive from the stream in real time.

Always available in the nav. Most useful when the DB is catching up (gap open), but the stream is always running.

For players: My game might not be in the DB yet — is it in the stream?

For fans: Something is happening right now.

### Live behaviour

- SSE stream. Newest games prepended.
- Games accumulate as long as the page is open in the browser — navigating away and back does not reset the list.
- No date picker, no pagination, no sorting. Raw real-time window.
- Empty state: "Waiting for games…" until the first game arrives.

### Live table columns

Same as Matches: Date · Time (UTC) · Player A · Move · ← / → / = · Move · Player B

---

## Leaderboard

Purpose: Rankings — today, a date range, or all time.

For players: Where do I sit? Am I climbing?

For fans: Who is dominant? Who do we watch?

### Leaderboard controls

- Today button — today's standings. Reliable only when gap is closed.
- Date range — From / To date pickers. Prev/Next shift the window by one day.
- All time button — full dataset. Shows a "catching up" notice if cold-starting with no prior data.

### Leaderboard behaviour

| State | Behaviour |
| --- | --- |
| Today, gap closed | Full standings. |
| Today, gap open | Banner warns. Table shown with what we have. |
| Date range, data available | Full standings for range. |
| Date range, partial data | Notice that historical data may be incomplete. |
| All time, hasPriorData | Show standings. Trust prior trawl. |
| All time, cold start no prior | "Catching up — historical data not yet available." |
| No entries for range | "No games in this range." |

### Leaderboard table columns

`#` (rank) · Player (link) · Wins · Losses · Ties

All columns sortable. Default: most wins first. Rank reflects the selected date range, not all-time rank.

### Leaderboard notes

- No win rate column. RPS is three-outcome — raw W/L/T counts are unambiguous. If win rate is added later, formula must be wins ÷ (wins + losses + ties).
- Rank is recomputed per query. Sorting by player name keeps the rank visible so you can find someone alphabetically and still see their standing.

---

## Player

Purpose: Everything about one player.

For players: Your record, your patterns, your history.

For fans: Who is this person? How do they play?

### Player header

Player name · rank (all-time, or rank within filtered date range if a range is active).

### Player stats cards

Wins · Losses · Ties (count + % of total). Rock · Paper · Scissors (count + % of total). Best win streak (all-time only — hidden when a date range is active).

Stats reflect the active date filter. When no filter is set, stats are all-time.

### Player match history

- Opponent filter — autocomplete (`PlayerSearch` component). Narrows the table to head-to-head games.
- Date filter — From / To pickers. Narrows both the stats cards and the match history table.

Table columns: Date · Time (UTC) · Player (dimmed, not linked) · Move · ← / → / = · Move · Opponent (link). Winner row is normal weight, loser dimmed — same two-tone convention as Matches and Live.

Paginated 50 per page.

### Player behaviour

| State | Behaviour |
| --- | --- |
| Normal | Stats + history as above. |
| Loading | "Loading…" — nothing renders until stats return. |
| Date filter active | Stats recalculate for range. Rank shows position within that range. Best streak hidden. |
| Opponent filter active | Table narrows to H2H games. |
| No matches for opponent | "No matches between {player} and {opponent}." |
| No matches at all | "No matches found." |
| Cold start, no prior data | Banner provides context. Stats show what's in the DB. |

### Player notes

- Player is not in the nav. Get here by clicking any player name.
- The global player search in the header navigates directly to any player's page.
- No explicit back button — browser back is sufficient.

---

## Global header

Persistent across all pages.

- Player search (left) — autocomplete, navigates to Player page on select. Clears after navigation.
- Nav links — Live · Matches · Leaderboard
- Site title — RPS League (right)
- Theme toggle — light / dark

---

## Known limitations / future improvements

**Player page — stats don't update with opponent filter**
The W/L/T and R/P/S metric cards respond to the date filter but not to the opponent filter. When you narrow match history to a specific opponent, the cards still show all-time stats. Fixing this requires a backend endpoint that accepts both player + opponent, or computing stats from the full (non-paginated) match set.

**Player page — no W/L/T filter on match history**
Users cannot filter the match table to show only wins, only losses, or only ties. Because results are paginated server-side, this would require a `?result=win|loss|tie` parameter on the matches endpoint rather than client-side filtering.

**Matches page — sort by player or move not supported**
The Matches page supports time sort (asc/desc) only. Sorting by player name or move is ambiguous (which player?) and would require backend changes to accept a `sortBy` parameter with consistent pagination ordering.

**Matches page — player filters / head-to-head on a day**
The Matches page doesn't support filtering by player on a given date, or drilling into head-to-head results for that day. The backend already supports both (`?date=X&player=Y` and `?playerA=X&playerB=Y&from=date&to=date`). Frontend would need two PlayerSearch inputs above the player columns, with clicking a name populating the corresponding filter.

**Global date context**
Date range is currently per-page state. A shared date context set once in the header — with all pages reflecting it — would simplify cross-page navigation. The main tradeoff is that Matches is currently a day-browser (single date); a global range filter would change its character. Worth exploring if users want to follow a specific period across all views simultaneously.

**Client-side filtering for Player page**
Sending a player's full game history to the browser once and filtering locally would eliminate extra API calls for every date or opponent filter interaction. Feasible given ~2,000 games per player.

**SSE live feed pushed to browser**
Currently the frontend polls the backend for live games. Forwarding the Reaktor SSE stream directly to connected browser clients would give true real-time updates without polling.
