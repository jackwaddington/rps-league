import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useHealth } from '../contexts/HealthContext';
import type { LeaderboardEntry } from '../types';

function today() { return new Date().toISOString().slice(0, 10); }
function shiftDate(date: string, days: number) {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

type Mode = 'today' | 'range' | 'alltime';
type SortKey = 'wins' | 'losses' | 'ties' | 'player';
type SortDir = 'asc' | 'desc';

export function Leaderboard() {
    const { health } = useHealth();
    const isGapped = health?.gap.status === 'filling';
    const firstDate = health?.firstGame ?? undefined;
    const [mode, setMode] = useState<Mode>('today');
    const [from, setFrom] = useState(today());
    const [to, setTo] = useState(today());

    // If health loads and today is gapped, ensure we're not stuck on 'today' mode
    useEffect(() => {
        if (isGapped && mode === 'today') setMode('alltime');
    }, [isGapped]);
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [sortKey, setSortKey] = useState<SortKey>('wins');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    useEffect(() => {
        if (mode === 'today') {
            api.leaderboardToday().then(setEntries);
        } else if (mode === 'alltime') {
            api.leaderboard('2020-01-01', today()).then(setEntries);
        } else {
            api.leaderboard(from, to).then(setEntries);
        }
    }, [mode, from, to]);

    function toggleSort(key: SortKey) {
        if (sortKey === key) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    }

    function arrow(key: SortKey) {
        if (sortKey !== key) return ' ↕';
        return sortDir === 'asc' ? ' ↑' : ' ↓';
    }

    const sorted = [...entries].sort((a, b) => {
        if (sortKey === 'player') {
            const cmp = a.player.localeCompare(b.player);
            return sortDir === 'asc' ? cmp : -cmp;
        }
        const cmp = b[sortKey] - a[sortKey]; // most first
        return sortDir === 'asc' ? cmp : -cmp;
    });

    return (
        <div>
            <h1>Leaderboard</h1>
            <div className="controls">
                {!isGapped && <button className={mode === 'today' ? 'active' : ''} onClick={() => setMode('today')}>Today</button>}
                <button className={mode === 'range' ? 'active' : ''} onClick={() => setMode('range')}>Date range</button>
                <button className={mode === 'alltime' ? 'active' : ''} onClick={() => setMode('alltime')}>All time</button>
                {mode === 'range' && (
                    <>
                        <button onClick={() => { setFrom(shiftDate(from, -1)); setTo(shiftDate(to, -1)); }}>← Prev</button>
                        <button onClick={() => { setFrom(shiftDate(from, 1)); setTo(shiftDate(to, 1)); }} disabled={to >= today()}>Next →</button>
                        <input type="date" value={from} min={firstDate} max={to} onChange={(e) => setFrom(e.target.value)} />
                        <span className="text-dimmer">→</span>
                        <input type="date" value={to} min={from || firstDate} max={today()} onChange={(e) => setTo(e.target.value)} />
                    </>
                )}
            </div>

            {mode === 'alltime' && !health?.crawlComplete && !health?.crawlOldestSeen && (
                <p className="range-label text-dim">Historical data not yet available — catching up.</p>
            )}
            {mode === 'alltime' && isGapped && (
                <p className="range-label text-dim">Today's results are incomplete — games are still being imported.</p>
            )}

            {sorted.length === 0 ? (
                <div className="empty">No games in this range.</div>
            ) : (
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th className="sortable" onClick={() => toggleSort('player')}>Player{arrow('player')}</th>
                                <th className="sortable" onClick={() => toggleSort('wins')}>Wins{arrow('wins')}</th>
                                <th className="sortable" onClick={() => toggleSort('losses')}>Losses{arrow('losses')}</th>
                                <th className="sortable" onClick={() => toggleSort('ties')}>Ties{arrow('ties')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.map((e) => (
                                <tr key={e.player}>
                                    <td className="text-dimmer">{e.rank}</td>
                                    <td>
                                        <Link to={`/player/${encodeURIComponent(e.player)}`}>{e.player}</Link>
                                    </td>
                                    <td>{e.wins}</td>
                                    <td className="text-dimmer">{e.losses}</td>
                                    <td className="text-dimmer">{e.ties}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
