# RPS League

A live Rock-Paper-Scissors league dashboard.

> ✊ Ingests game data from the Reaktor API into SQLite  
> ✋ Serves it with a React frontend  
> ✌️ Leaderboards, player stats, match history, and a live game stream

## Demo

**Live data**

https://github.com/user-attachments/assets/1ba245b7-1ef6-4fac-99c1-741a0d677fa0

**Test environment — switching scenarios**

https://github.com/user-attachments/assets/4c5fa11c-2b65-41c4-b4f9-7caf060ac27a

## Running

> ⚠️ You need a Reaktor API access token.

```bash
cp .env.example .env
# fill in your token in .env
cp .env back/.env
docker compose up --build
```

- `localhost:8080` — the app for players and fans
- `localhost:8080/test` — test environment for engineers
- `localhost:8080/panel` — control panel to switch test scenarios

## How the ingestor works

On startup the ingestor does four things concurrently:

- Connects to the live stream (records the gap boundary)
- Crawls recent history to fill the gap since last shutdown
- Polls the latest page until the gap is confirmed closed
- Crawls full history as a background validation pass

A status banner appears when the service is in a degraded state — cold start, gap filling, or offline. No banner means everything is working normally.

## Cold start (rebuild DB from scratch)

```bash
docker compose down -v   # removes containers and the rps-db volume
docker compose up --build
```

Rebuilds from the Reaktor API — history trawl takes around 10 minutes, then up to 2 hours for the gap between live stream and stored history to close. The status banner will clear once the system is back to normal.

## Data quality notes

- Exotic moves (LIZARD, SPOCK, BLADE, DOG) are excluded — treated as void games
- Winners are computed from the moves — the API does not provide them
- Anomalies (self-play, invalid moves, suspicious timestamps) are flagged separately
- All queries normalise player names and moves to handle source data inconsistencies
