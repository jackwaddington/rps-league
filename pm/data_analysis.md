## Database overview: back/games.db

### Scale
- **164,437 total games** across **170 unique players**
- Date range: Feb 16 – Mar 10, 2026 (23 days)
- Pace: **exactly 7,200 games/day** (6,037 on the final partial day)
- Sources: `history` 164,394 | `live` 43

### Players
All 170 players have almost identical game counts (~1,860–2,064). The distribution is suspiciously uniform — this looks like simulated/bot data, not real humans. No player dominates by volume.

### Outcomes (after winner recompute)
- **99,655** games with a winner
- **49,943** draws (both players threw the same move)
- **14,913** voided — at least one player threw a non-standard move (LIZARD, SPOCK, BLADE, DOG)

### Non-standard moves
The API occasionally returns moves outside of ROCK/PAPER/SCISSORS (~9% of games). The brief only mentions RPS, so these games are voided (winner = NULL). They are distributed uniformly across all players and all days, so they don't affect leaderboard fairness.

Observed exotic moves: LIZARD, SPOCK, BLADE, DOG (~1,870–1,980 each as move_a).

### Data quality notes
- Move case is inconsistent in the raw data (ROCK / Rock / rock). The ingest pipeline normalises with `.toUpperCase()`, but early-ingested rows were not normalised. Winner values have been recomputed for all rows using uppercased moves.
- No self-play detected.

### Top players by win rate (wins / total games)
| Player | Games | Wins | Win% |
|---|---|---|---|
| Yuki Chen | 1,985 | 669 | 33.7% |
| Elena Müller | 1,872 | 610 | 32.6% |
| Hiroshi Johansson | 1,860 | 605 | 32.5% |
| Luca Okonkwo | 1,902 | 613 | 32.2% |
| Priya Garcia | 1,888 | 607 | 32.2% |

Win rates range from ~30% to ~37% (expected ~33% in fair RPS). With ~2,000 games per player this spread is too large to be noise — there are real systematic differences.

Interestingly, all players' move distributions are near-perfectly 33%/33%/33%, so the win rate variation is not explained by move choice. The most likely explanation is **non-uniform matchmaking**: head-to-head counts range from 1 to 27 games per pair (average 11.3). Some players face favourable opponents more often. The leaderboard reflects matchup draw luck as much as any real skill.

### Head-to-head dominance — seeded outcomes

Exhaustive head-to-head analysis (all 170×170 pairs, min 5 games) found **20+ pairs where one player has never lost to a specific opponent**, across up to 20 games. Examples:

| Winner | Loser | W / T / L | Games |
|---|---|---|---|
| Yuki Mensah | Aiko Mensah | 11 / 9 / 0 | 20 |
| Layla Kim | Priya Tanaka | 11 / 7 / 0 | 18 |
| Aiko Kim | Omar Patel | 11 / 6 / 0 | 17 |
| Hiroshi Johansson | Layla Silva | 9 / 2 / 0 | 11 |
| Yuki Chen | Aiko Chen | 9 / 2 / 0 | 11 |

**The cause is not move preference.** Inspecting individual matchups shows the winning player's moves are overwhelmingly the counter to the loser's moves in that specific pairing — even though both players look like 33/33/33 against the field. For example, in Yuki Chen vs Aiko Chen: Yuki played ROCK 64% of the time (vs her global 33%), and Aiko played SCISSORS 55% of the time (vs her global 33%).

**Observation:** Move distributions look uniform in aggregate (33%/33%/33% per player across all games), but become non-uniform within specific matchups. The patterns are consistent enough that they produce statistically unusual win records between certain pairs. Why this occurs is not clear from the data alone — it could reflect matchmaking patterns, player behaviour, or something else. This is an area worth deeper investigation if data analysis becomes a stakeholder priority.

### Potential UI feature (future)

The player page could show a "favourable matchups" section — opponents this player tends to beat — and a "tough matchups" section. Because the seeding is stable (same players, same tendencies), these would be predictive, not just historical. Out of scope for current submission.
