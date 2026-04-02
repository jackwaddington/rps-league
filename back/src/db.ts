import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';

const DB_PATH = process.env['DB_PATH'] ?? 'games.db';
if (DB_PATH.includes('/')) mkdirSync(DB_PATH.replace(/\/[^/]+$/, ''), { recursive: true });
const db = new Database(DB_PATH);

db.exec(`
        CREATE TABLE IF NOT EXISTS games (
            game_id     TEXT PRIMARY KEY,
            game_time   INTEGER NOT NULL,
            player_a    TEXT NOT NULL,
            move_a      TEXT NOT NULL,
            player_b    TEXT NOT NULL,
            move_b      TEXT NOT NULL,
            source      TEXT NOT NULL,
            winner      TEXT
        )
      `);

db.exec(`
        CREATE TABLE IF NOT EXISTS meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
      `);

db.exec(`
        CREATE TABLE IF NOT EXISTS anomalies (
        game_id TEXT PRIMARY KEY,
        reason TEXT NOT NULL,
        detected_at INTEGER NOT NULL
      )
`);

export function getMeta(key: string): string | null {
    const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as
        | { value: string }
        | undefined;
    return row ? row.value : null;
}

export function setMeta(key: string, value: string): void {
    db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(key, value);
}

export function deleteMeta(key: string): void {
    db.prepare('DELETE FROM meta WHERE key = ?').run(key);
}

export default db;
