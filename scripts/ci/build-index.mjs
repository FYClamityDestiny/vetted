// Builds docs/ratings.json from ratings/<source>/<name>@<version>/<login>.json.
// Per version: every submitter's rating, the most cautious one wins, "community" needs 3+ different accounts,
// "human_reviewed" only counts from the repo owner's file (the check workflow enforces who can set it).
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const [src = 'ratings', out = 'docs/ratings.json'] = process.argv.slice(2);
const SEV = ['clean', 'unverified', 'review', 'block'];
const items = [];
for (const source of readdirSync(src).filter(d => statSync(join(src, d)).isDirectory())) {
  for (const entry of readdirSync(join(src, source))) {
    const dir = join(src, source, entry);
    if (!statSync(dir).isDirectory()) continue;
    const at = entry.lastIndexOf('@');
    const subs = readdirSync(dir).filter(f => f.endsWith('.json')).map(f => ({ by: f.slice(0, -5), ...JSON.parse(readFileSync(join(dir, f), 'utf8')) }));
    if (!subs.length) continue;
    items.push({
      source, name: entry.slice(0, at).replace(/__/g, '/'), version: entry.slice(at + 1),
      rating: SEV[Math.max(...subs.map(s => SEV.indexOf(s.rating)))],
      submitters: subs.length,
      community: new Set(subs.map(s => s.by.toLowerCase())).size >= 3,
      human_reviewed: subs.some(s => s.human_reviewed),
      updated: subs.map(s => s.date).sort().at(-1),
      ratings: subs.map(({ by, rating, date, human_reviewed }) => ({ by, rating, date, human_reviewed: !!human_reviewed })),
    });
  }
}
items.sort((a, b) => (b.human_reviewed - a.human_reviewed) || (b.submitters - a.submitters) || a.name.localeCompare(b.name));
writeFileSync(out, JSON.stringify({ generated: new Date().toISOString(), count: items.length, items }, null, 1) + '\n');
console.log(`indexed ${items.length} rated versions`);
