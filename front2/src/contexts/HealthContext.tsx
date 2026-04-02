import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { DataHealth } from '../types';

const POLL_FAST = 10_000;
const POLL_SLOW = 30_000;

interface HealthState {
    health: DataHealth | null;
    offline: boolean;
}

const HealthContext = createContext<HealthState>({ health: null, offline: false });

export function useHealth() {
    return useContext(HealthContext);
}

export function HealthProvider({ children }: { children: React.ReactNode }) {
    const [health, setHealth] = useState<DataHealth | null>(null);
    const [offline, setOffline] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        function schedule(ms: number) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = setInterval(tick, ms);
        }

        async function tick() {
            try {
                const h = await api.health();
                setHealth(h);
                setOffline(false);
                const done = !!h.crawlComplete && h.gap.status !== 'filling';
                schedule(done ? POLL_SLOW : POLL_FAST);
            } catch {
                setOffline(true);
                schedule(POLL_FAST);
            }
        }

        tick();
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, []);

    return <HealthContext.Provider value={{ health, offline }}>{children}</HealthContext.Provider>;
}
