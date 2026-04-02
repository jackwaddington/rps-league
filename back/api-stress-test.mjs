// api-stress-test.mjs
// Crawls the full /history API as fast as possible, 10 runs, 10-min intervals.
// No DB writes. Appends results to api-stress-results.tsv

import { config } from 'dotenv';
import { appendFileSync, existsSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '.env') });

const TOKEN   = process.env['TOKEN']    ?? '';
const BASE    = process.env['BASE_URL'] ?? '';
const RESULTS = resolve(__dirname, 'api-stress-results.tsv');
const RUNS    = 10;
const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

if (!existsSync(RESULTS)) {
    writeFileSync(RESULTS, 'run\tstart_time\telapsed_s\tpages\trecords\terrors\trec_per_s\tavg_page_ms\n');
    console.log(`Created ${RESULTS}`);
}

async function fetchPage(url) {
    const start = Date.now();
    const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    const elapsed = Date.now() - start;
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status, elapsed });
    const json = await res.json();
    return { json, elapsed };
}

async function runCrawl(runNum) {
    const startTs = new Date().toISOString();
    const wallStart = Date.now();

    let url = `${BASE}/history`;
    let pages = 0;
    let records = 0;
    let errors = 0;
    let totalPageMs = 0;

    console.log(`\n=== Run ${runNum}/10  ${startTs} ===`);

    while (true) {
        try {
            const { json, elapsed } = await fetchPage(url);
            pages++;
            records += json.data.length;
            totalPageMs += elapsed;

            if (pages % 50 === 0) {
                process.stdout.write(`  page ${pages}, ${records} records, ${errors} errors\r`);
            }

            if (!json.cursor) break;
            url = `${BASE}${json.cursor}`;
        } catch (err) {
            errors++;
            const status = err.status ?? '???';
            console.log(`  [error] ${status} on page ${pages + 1} — retrying immediately`);
            // Retry same URL immediately (no sleep — testing raw behaviour)
            await new Promise(r => setTimeout(r, 200));
        }
    }

    const elapsed_s = ((Date.now() - wallStart) / 1000).toFixed(1);
    const rec_per_s  = (records / parseFloat(elapsed_s)).toFixed(0);
    const avg_page_ms = pages > 0 ? (totalPageMs / pages).toFixed(0) : 0;

    const row = [runNum, startTs, elapsed_s, pages, records, errors, rec_per_s, avg_page_ms].join('\t');
    appendFileSync(RESULTS, row + '\n');

    console.log(`\n  Done: ${pages} pages | ${records} records | ${errors} errors | ${elapsed_s}s | ${rec_per_s} rec/s | avg ${avg_page_ms}ms/page`);
    return { elapsed_s, pages, records, errors };
}

function printTable() {
    const lines = require('fs').readFileSync(RESULTS, 'utf8').trim().split('\n');
    console.log('\n' + lines.join('\n'));
}

async function main() {
    console.log(`Starting ${RUNS}-run stress test. Interval: 10 minutes.`);
    console.log(`Results → ${RESULTS}\n`);

    for (let i = 1; i <= RUNS; i++) {
        await runCrawl(i);

        if (i < RUNS) {
            const nextRun = new Date(Date.now() + INTERVAL_MS);
            console.log(`  Next run at ${nextRun.toLocaleTimeString()} (in 10 minutes)…`);
            await new Promise(r => setTimeout(r, INTERVAL_MS));
        }
    }

    console.log('\n\n=== All runs complete ===');
    // Print final table
    const { readFileSync } = await import('fs');
    const lines = readFileSync(RESULTS, 'utf8').trim().split('\n');
    const headers = lines[0].split('\t');
    const rows = lines.slice(1).map(l => l.split('\t'));

    // Pad columns
    const widths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => (r[i] ?? '').length)));
    const fmt = (row) => row.map((v, i) => v.padStart(widths[i])).join('  ');
    console.log('\n' + fmt(headers));
    console.log(widths.map(w => '-'.repeat(w)).join('  '));
    rows.forEach(r => console.log(fmt(r)));
}

main().catch(console.error);
