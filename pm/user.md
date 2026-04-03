# Who is our user?

## The context

This is an RPS league — competitive, with named players, tracked results, and a leaderboard.
The data is dense: 7,200 games a day, 170 players, results going back weeks.

## Primary user: the player

They play in the league. They care about:
- Did I win today?
- Where am I on the leaderboard?
- Who are the top players?
- How did I do against a specific opponent?

They are **fact-driven**. They want to look up their name and see their record quickly.
They don't need beautiful — they need accurate and fast to scan.

## Secondary user: the fan / spectator

They follow the league but don't necessarily play.
They care about:
- Who's winning overall?
- What happened today?
- Who's on a hot streak?

They benefit from a bit more visual storytelling — trends, rankings, context.

## What both users share

- They know RPS. No need to explain the rules.
- They want to find specific information quickly (a player, a day, a result).
- They might copy-paste answers from the app (e.g. "who won the last match on March 9th?").
  So data must be readable as plain text, not just visual.

They should assume data is correct unless the app explicitly says otherwise. They are not technical — they just need the numbers.

The data is quite random by nature (RPS), so this is not really a trends or visualisation exercise. It's a lookup tool: find a player, find a result, find a ranking.

## Design implications

- Player names should always be clickable links → player page
- Results should be unambiguous: WIN / LOSE / TIE, not just colour coding
- The leaderboard is the heart of the app — it should be prominent
- Dates should be navigable — prev/next day matters more than a calendar widget
- Live results are a nice-to-have, not the core experience
- Don't hide data behind too many clicks — one page should tell a useful story
