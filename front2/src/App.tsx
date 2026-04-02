import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { Matches } from './pages/Matches';
import { Leaderboard } from './pages/Leaderboard';
import { Live } from './pages/Live';
import { Player } from './pages/Player';
import { GapBanner } from './components/GapBanner';
import { PlayerSearch } from './components/PlayerSearch';
import { HealthProvider } from './contexts/HealthContext';

type Theme = 'light' | 'dark';

function getSystemTheme(): Theme {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function useTheme() {
    const [theme, setTheme] = useState<Theme>(() => {
        const stored = localStorage.getItem('theme') as Theme | null;
        return stored ?? getSystemTheme();
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    useEffect(() => {
        const mq = window.matchMedia('(prefers-color-scheme: light)');
        const handler = (e: MediaQueryListEvent) => {
            if (!localStorage.getItem('theme')) setTheme(e.matches ? 'light' : 'dark');
        };
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    const toggle = () => {
        const next: Theme = theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', next);
        setTheme(next);
    };

    return { theme, toggle };
}

function SunIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
    );
}

function MoonIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
    );
}

function PlayerRoute() {
    const { name } = useParams();
    return <Player key={name} />;
}

function AppShell({ theme, toggle }: { theme: Theme; toggle: () => void }) {
    const navigate = useNavigate();
    const [playerInput, setPlayerInput] = useState('');

    return (
        <>
            <header>
                <span className="site-title">RPS League</span>
                <nav>
                    <NavLink to="/live">Live</NavLink>
                    <NavLink to="/" end>Matches</NavLink>
                    <NavLink to="/leaderboard">Leaderboard</NavLink>
                </nav>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <PlayerSearch
                        value={playerInput}
                        onChange={setPlayerInput}
                        onSelect={(name) => { navigate(`/player/${encodeURIComponent(name)}`); setPlayerInput(''); }}
                        placeholder="Go to player…"
                    />
                    <button className="theme-toggle" onClick={toggle} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
                        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
                    </button>
                </div>
            </header>
            <GapBanner />
            <main>
                <Routes>
                    <Route path="/" element={<Matches />} />
                    <Route path="/leaderboard" element={<Leaderboard />} />
                    <Route path="/live" element={<Live />} />
                    <Route path="/player/:name" element={<PlayerRoute />} />
                </Routes>
            </main>
        </>
    );
}

export function App() {
    const { theme, toggle } = useTheme();

    return (
        <HealthProvider>
            <AppShell theme={theme} toggle={toggle} />
        </HealthProvider>
    );
}
