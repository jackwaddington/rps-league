import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useHealth } from '../contexts/HealthContext';
import type { Game } from '../types';

function fmtTime(ms: number) {
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' });
}

function fmtDate(ms: number) {
    return new Date(ms).toISOString().slice(0, 10);
}

function today() { return new Date().toISOString().slice(0, 10); }

function prevDay(date: string) {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
}

function nextDay(date: string) {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
}

export function Matches() {
    const { health } = useHealth();

    const [date, setDate] = useState(today());
    const [games, setGames] = useState<Game[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    const firstDate = health?.firstGame ?? '';

    // Poll today every 5s; fetch once for past dates
    useEffect(() => {
        function fetch_() {
            api.matchesByDate(date, page, undefined, sortDir).then(({ matches, total }) => {
                setGames(matches);
                setTotal(total);
            });
        }
        fetch_();
        if (date !== today()) return;
        const interval = setInterval(fetch_, 5000);
        return () => clearInterval(interval);
    }, [date, page, sortDir]);

    function goToDate(d: string) { setDate(d); setPage(1); }
    function toggleSort() { setSortDir((d) => d === 'asc' ? 'desc' : 'asc'); setPage(1); }

    const totalPages = Math.ceil(total / 50);

    const coldStart = !!health && !health.crawlComplete && !!health.crawlOldestSeen;
    const gapFilling = health?.gap.status === 'filling';
    const showWarning = date === today() && (coldStart || gapFilling);
    const showCaveat = date !== today() && coldStart;

    return (
        <div>
            <h1>Matches</h1>
            <div className="controls">
                <button onClick={() => goToDate(prevDay(date))} disabled={!!firstDate && date <= firstDate}>← Prev</button>
                <button onClick={() => goToDate(nextDay(date))} disabled={date >= today()}>Next →</button>
                <input
                    type="date"
                    value={date}
                    min={firstDate || undefined}
                    max={today()}
                    onChange={(e) => goToDate(e.target.value)}
                />
                {date !== today() && (
                    <button onClick={() => goToDate(today())}>Today</button>
                )}
            </div>

            <p className="range-label">
                {total} games on {date}
                {showWarning && <span className="text-dim"> · Some results from today are still being imported.</span>}
                {showCaveat && <span className="text-dim"> · Historical data may be incomplete — history crawl still running.</span>}
            </p>

            {games.length === 0 ? (
                <div className="empty">No games on this date.</div>
            ) : (
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th className="sortable" onClick={toggleSort}>
                                    Time (UTC){sortDir === 'asc' ? ' ↑' : ' ↓'}
                                </th>
                                <th style={{ textAlign: 'right' }}>Player</th>
                                <th style={{ textAlign: 'right' }}>Move</th>
                                <th></th>
                                <th>Move</th>
                                <th>Player</th>
                            </tr>
                        </thead>
                        <tbody>
                            {games.map((g) => {
                                const tie = g.winner === null;
                                const aWins = g.winner === g.player_a;
                                const clsA = tie ? 'text-dimmer' : aWins ? '' : 'text-dimmer';
                                const clsB = tie ? 'text-dimmer' : aWins ? 'text-dimmer' : '';
                                const abbr = (m: string) => m[0];
                                return (
                                    <tr key={g.game_id}>
                                        <td className="text-dimmer">{fmtDate(g.game_time)}</td>
                                        <td className="text-dimmer">{fmtTime(g.game_time)}</td>
                                        <td className={clsA} style={{ textAlign: 'right' }}><Link to={`/player/${encodeURIComponent(g.player_a)}`}>{g.player_a}</Link></td>
                                        <td className={clsA} style={{ textAlign: 'right' }}>{abbr(g.move_a)}</td>
                                        <td className={tie ? 'text-dimmer' : ''} style={{ textAlign: 'center' }}>{tie ? '=' : aWins ? '←' : '→'}</td>
                                        <td className={clsB}>{abbr(g.move_b)}</td>
                                        <td className={clsB}><Link to={`/player/${encodeURIComponent(g.player_b)}`}>{g.player_b}</Link></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {totalPages > 1 && (
                <div className="pagination">
                    <button onClick={() => setPage((p) => p - 1)} disabled={page === 1}>← Prev</button>
                    <span className="text-dimmer">Page {page} of {totalPages}</span>
                    <button onClick={() => setPage((p) => p + 1)} disabled={page === totalPages}>Next →</button>
                </div>
            )}
        </div>
    );
}
