import { Link } from 'react-router-dom';
import { useLiveGames } from '../hooks/useLiveGames';

function fmtTime(ms: number) {
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' });
}

function fmtDate(ms: number) {
    return new Date(ms).toISOString().slice(0, 10);
}

export function Live() {
    const { games } = useLiveGames();

    return (
        <div>
            <h1>Live</h1>
            <p className="range-label">
                {games.length === 0 ? 'Waiting for games…' : `${games.length} games received`}
            </p>

            {games.length === 0 ? (
                <div className="empty">Waiting for games…</div>
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
        </div>
    );
}
