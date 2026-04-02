import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';

interface Props {
    value: string;
    onChange: (value: string) => void;
    onSelect?: (value: string) => void;
    placeholder?: string;
}

export function PlayerSearch({ value, onChange, onSelect, placeholder = 'Search player…' }: Props) {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [allPlayers, setAllPlayers] = useState<string[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        api.players().then((rows) => setAllPlayers(rows.map((r) => r.name)));
    }, []);

    useEffect(() => {
        if (value.length < 1) { setSuggestions([]); return; }
        const lower = value.toLowerCase();
        setSuggestions(allPlayers.filter((p) => p !== value && p.toLowerCase().includes(lower)).slice(0, 8));
    }, [value, allPlayers]);

    function pick(name: string) {
        onChange(name);
        onSelect?.(name);
        setSuggestions([]);
    }

    function clear() {
        onChange('');
        setSuggestions([]);
        inputRef.current?.focus();
    }

    return (
        <div className="player-search" style={{ marginBottom: 0 }}>
            <input
                ref={inputRef}
                type="text"
                autoComplete="off"
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
            />
            {value && <button className="clear-btn" onClick={clear}>✕</button>}
            {suggestions.length > 0 && (
                <ul className="player-suggestions">
                    {suggestions.map((name) => (
                        <li key={name} onMouseDown={() => pick(name)}>{name}</li>
                    ))}
                </ul>
            )}
        </div>
    );
}
