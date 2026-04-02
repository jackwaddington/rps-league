import { useHealth } from '../contexts/HealthContext';

export function GapBanner() {
    const { health, offline } = useHealth();

    if (offline) {
        return <div className="gap-banner">⚠️ Cannot connect to server. Retrying…</div>;
    }

    if (!health) return null;

    const gapFilling = health.gap.status === 'filling';
    const coldStart = !health.crawlComplete && !!health.crawlOldestSeen;
    const trueColdStart = gapFilling && !health.firstGame;

    if (trueColdStart) {
        return <div className="gap-banner">System coming online.</div>;
    }

    if (coldStart) {
        return <div className="gap-banner">System coming online…</div>;
    }

    if (!gapFilling) return null;

    if (!health.gap.end) {
        return <div className="gap-banner">Connecting to live stream…</div>;
    }

    return <div className="gap-banner">Importing missed games. Results may be incomplete.</div>;
}
