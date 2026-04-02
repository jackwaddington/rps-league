import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { PlayerSearch } from '../components/PlayerSearch';
import type { Game, PlayerSummary } from '../types';

function fmtTime(ms: number) {
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' });
}

function fmtDate(ms: number) {
    return new Date(ms).toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function pct(count: number, total: number) {
    return total > 0 ? `${Math.round(count / total * 100)}%` : '—';
}

function gameResult(game: Game, player: string): 'win' | 'loss' | 'tie' {
    if (game.winner === null) return 'tie';
    return game.winner === player ? 'win' : 'loss';
}

export function Player() {
    const { name } = useParams<{ name: string }>();

    const [stats, setStats] = useState<PlayerSummary | null>(null);
    const [matches, setMatches] = useState<Game[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [opponentFilter, setOpponentFilter] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    const player = decodeURIComponent(name ?? '');

    useEffect(() => {
        if (!player) return;
        setStats(null);
        api.playerStats(player, fromDate || undefined, toDate || undefined).then(setStats);
    }, [player, fromDate, toDate]);

    useEffect(() => {
        if (!player) return;
        const req = opponentFilter
            ? fetch(`/api/matches?playerA=${encodeURIComponent(player)}&playerB=${encodeURIComponent(opponentFilter)}&from=${fromDate || '2020-01-01'}&to=${toDate || '2099-12-31'}&page=${page}`).then((r) => r.json())
            : api.matchesByPlayer(player, page, fromDate || undefined, toDate || undefined);

        req.then(({ matches, total }: { matches: Game[]; total: number }) => {
            setMatches(matches);
            setTotal(total);
        });
    }, [player, opponentFilter, page, fromDate, toDate]);

    if (!stats) return <div className="empty">Loading…</div>;

    const totalPages = Math.ceil(total / 50);

    return (
        <div>
            <div className="player-header">
                <div>
                    <h1>{player}</h1>
                    <div className="subtext">
                        {stats.rank ? `Rank #${stats.rank}` : 'Unranked'} · {stats.total.toLocaleString()} games
                        {(fromDate || toDate) && <span className="text-tertiary"> · filtered</span>}
                    </div>
                </div>
                <div className="controls" style={{ marginLeft: 'auto' }}>
                    <span className="text-tertiary" style={{ margin: '0 0.25rem' }}>From</span>
                    <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
                    />
                    <span className="text-tertiary" style={{ margin: '0 0.25rem' }}>To</span>
                    <input
                        type="date"
                        value={toDate}
                        onChange={(e) => { setToDate(e.target.value); setPage(1); }}
                    />
                    {(fromDate || toDate) && (
                        <button onClick={() => { setFromDate(''); setToDate(''); setPage(1); }}>✕ dates</button>
                    )}
                </div>
            </div>

            <div className="metric-cards">
                <div className="metric-card">
                    <div className="metric-label">Wins</div>
                    <div className="metric-value">{pct(stats.wins, stats.total)}</div>
                    <div className="text-dimmer" style={{ fontSize: '0.8rem', textAlign: 'right' }}>{stats.wins.toLocaleString()}</div>
                </div>
                <div className="metric-card">
                    <div className="metric-label">Losses</div>
                    <div className="metric-value">{pct(stats.losses, stats.total)}</div>
                    <div className="text-dimmer" style={{ fontSize: '0.8rem', textAlign: 'right' }}>{stats.losses.toLocaleString()}</div>
                </div>
                <div className="metric-card">
                    <div className="metric-label">Ties</div>
                    <div className="metric-value">{pct(stats.ties, stats.total)}</div>
                    <div className="text-dimmer" style={{ fontSize: '0.8rem', textAlign: 'right' }}>{stats.ties.toLocaleString()}</div>
                </div>
                <div style={{ flex: 1 }} />
                <div className="metric-card">
                    <div className="metric-label">Rock</div>
                    <div className="metric-value">{pct(stats.moves.ROCK, stats.total)}</div>
                    <div className="text-dimmer" style={{ fontSize: '0.8rem', textAlign: 'right' }}>{stats.moves.ROCK.toLocaleString()}</div>
                </div>
                <div className="metric-card">
                    <div className="metric-label">Paper</div>
                    <div className="metric-value">{pct(stats.moves.PAPER, stats.total)}</div>
                    <div className="text-dimmer" style={{ fontSize: '0.8rem', textAlign: 'right' }}>{stats.moves.PAPER.toLocaleString()}</div>
                </div>
                <div className="metric-card">
                    <div className="metric-label">Scissors</div>
                    <div className="metric-value">{pct(stats.moves.SCISSORS, stats.total)}</div>
                    <div className="text-dimmer" style={{ fontSize: '0.8rem', textAlign: 'right' }}>{stats.moves.SCISSORS.toLocaleString()}</div>
                </div>
            </div>

            <div className="section-title" style={{ display: 'flex', alignItems: 'center' }}>
                <span>
                    Match history
                    {total > 0 && <span className="text-dimmer" style={{ fontWeight: 'normal', fontSize: '0.85rem', marginLeft: '0.75rem' }}>{total.toLocaleString()} games{fromDate || toDate ? ` · ${fromDate || '…'} → ${toDate || '…'}` : ''}</span>}
                </span>
                <div style={{ marginLeft: 'auto' }}>
                    <PlayerSearch
                        value={opponentFilter}
                        onChange={(val) => { setOpponentFilter(val); setPage(1); }}
                        onSelect={(name) => { setOpponentFilter(name); setPage(1); }}
                        placeholder="Filter by opponent…"
                    />
                </div>
            </div>

            {matches.length === 0 ? (
                <div className="empty">
                    {opponentFilter
                        ? `No matches between ${player} and ${opponentFilter}.`
                        : 'No matches found.'}
                </div>
            ) : (
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Time (UTC)</th>
                                <th style={{ textAlign: 'right' }}>Player</th>
                                <th style={{ textAlign: 'right' }}>Move</th>
                                <th></th>
                                <th>Move</th>
                                <th>Opponent</th>
                            </tr>
                        </thead>
                        <tbody>
                            {matches.map((g) => {
                                const isA = g.player_a === player;
                                const opponent = isA ? g.player_b : g.player_a;
                                const myMove = isA ? g.move_a : g.move_b;
                                const theirMove = isA ? g.move_b : g.move_a;
                                const res = gameResult(g, player);
                                const tie = res === 'tie';
                                const iWin = res === 'win';
                                const clsMe = tie ? 'text-dimmer' : iWin ? '' : 'text-dimmer';
                                const clsThem = tie ? 'text-dimmer' : iWin ? 'text-dimmer' : '';
                                return (
                                    <tr key={g.game_id}>
                                        <td className="text-dimmer">{fmtDate(g.game_time)}</td>
                                        <td className="text-dimmer">{fmtTime(g.game_time)}</td>
                                        <td className="text-dimmer" style={{ textAlign: 'right' }}>{player}</td>
                                        <td className={clsMe} style={{ textAlign: 'right' }}>{myMove[0]}</td>
                                        <td className={tie ? 'text-dimmer' : ''} style={{ textAlign: 'center' }}>{tie ? '=' : iWin ? '←' : '→'}</td>
                                        <td className={clsThem}>{theirMove[0]}</td>
                                        <td>
                                            <Link to={`/player/${encodeURIComponent(opponent)}`}>{opponent}</Link>
                                        </td>
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
