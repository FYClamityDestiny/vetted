// Rating pull-request gate. Runs from the base branch; PR files are fetched as data and strictly validated.
// Nothing from the PR is ever passed through a shell (execFileSync with argument arrays only).
// Rules: account >= 30 days old with some public activity; <= 5 rating PRs per day; only ratings/ files;
// file name must be the PR author's login; human_reviewed only from the owner; the bot re-scans
// github/npm/pypi items and rejects any rating less cautious than its own result.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const { PR, AUTHOR, HEAD_SHA, HEAD_REPO, OWNER, REPO } = process.env;
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const gh = (...a) => execFileSync('gh', a, { encoding: 'utf8', maxBuffer: 1 << 26 });
const ghJson = (...a) => JSON.parse(gh('api', ...a));
const SEV = { clean: 0, unverified: 1, review: 2, block: 3 };
const problems = [], notes = [];
const isOwner = AUTHOR.toLowerCase() === OWNER.toLowerCase();

// 1. Who is submitting
const user = ghJson(`users/${AUTHOR}`);
const ageDays = (Date.now() - new Date(user.created_at)) / 864e5;
if (!isOwner) {
  if (user.type !== 'User') problems.push('Ratings must come from a personal GitHub account, not a bot or organization.');
  if (ageDays < 30) problems.push(`Your GitHub account is ${Math.floor(ageDays)} days old. Ratings need an account at least 30 days old.`);
  if (user.public_repos + user.followers < 1) problems.push('Your account needs some public activity (a public repo or a follower) before submitting ratings.');
  const since = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const recent = ghJson(`search/issues?q=${encodeURIComponent(`repo:${REPO} is:pr author:${AUTHOR} created:>=${since}`)}`).total_count;
  if (recent > 5) problems.push(`You've opened ${recent} pull requests here in the last day. The limit is 5 a day.`);
}

// 2. What changed
const files = ghJson(`repos/${REPO}/pulls/${PR}/files?per_page=100`);
const PATH = /^ratings\/(github|npm|pypi|hf|docker|openvsx|vscode|mcp|roblox)\/([A-Za-z0-9._@~-]{1,214})@([A-Za-z0-9._+~-]{1,128})\/([A-Za-z0-9-]{1,39})\.json$/;
const ratings = [];
for (const f of files) {
  if (f.status === 'removed') { if (!isOwner) problems.push(`Only the maintainer can delete ratings (${f.filename}).`); continue; }
  const m = PATH.exec(f.filename);
  if (!m) { if (!isOwner) problems.push(`Only files like ratings/<source>/<name>@<version>/<your-login>.json are allowed (got ${f.filename}).`); continue; }
  const [, source, nameEnc, version, login] = m;
  if (login.toLowerCase() !== AUTHOR.toLowerCase()) { problems.push(`${f.filename}: the file must be named after you (${AUTHOR}.json). You can't submit ratings for someone else.`); continue; }
  let r;
  try { r = JSON.parse(Buffer.from(ghJson(`repos/${HEAD_REPO}/contents/${f.filename}?ref=${HEAD_SHA}`).content, 'base64').toString('utf8')); }
  catch { problems.push(`${f.filename}: not valid JSON.`); continue; }
  const name = nameEnc.replace(/__/g, '/');
  if (r.source !== source || r.name !== name || r.version !== version) problems.push(`${f.filename}: source, name and version inside the file must match its path.`);
  if (!(r.rating in SEV)) problems.push(`${f.filename}: rating must be one of clean, unverified, review, block.`);
  if (r.human_reviewed && !isOwner) problems.push(`${f.filename}: only the maintainer can set human_reviewed.`);
  if (JSON.stringify(r).length > 20000) problems.push(`${f.filename}: too large.`);
  ratings.push({ file: f.filename, source, name, version, r });
}
if (ratings.length > 10) problems.push('At most 10 ratings per pull request.');

// 3. Re-scan what the bot can fetch, and compare
const H = join(root, 'scripts', 'vetted.mjs'), SCAN = join(root, 'scripts', 'scan.sh');
if (!problems.length) for (const { file, source, name, version, r } of ratings) {
  if (!['github', 'npm', 'pypi'].includes(source)) { notes.push(`${file}: ${source} can't be re-scanned automatically yet. The maintainer will review it.`); continue; }
  const dir = mkdtempSync(join(tmpdir(), 'vt-'));
  try {
    const pin = source === 'github' ? r.commit : version;
    const got = JSON.parse(execFileSync('node', [H, 'fetch', source, name, pin, dir], { encoding: 'utf8' }));
    if (got.error) { problems.push(`${file}: couldn't download that exact version (${got.error}).`); continue; }
    let code = 0;
    try { execFileSync('bash', [SCAN, got.dir, source], { stdio: 'pipe' }); } catch (e) { code = e.status; }
    let bot = { 0: 'clean', 1: 'review', 2: 'block', 3: 'unverified' }[code] ?? 'unverified';
    if (source !== 'github') {
      const intel = JSON.parse(execFileSync('node', [H, 'intel', source, name, version], { encoding: 'utf8' }));
      if (intel.known_malicious?.length) bot = 'block';
    }
    if (SEV[r.rating] < SEV[bot]) problems.push(`${file}: you rated it "${r.rating}" but the bot's own scan says "${bot}". Ratings can't be less cautious than the scan.`);
    else notes.push(`${file}: the bot's scan says "${bot}", consistent with your "${r.rating}".`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// 4. Report
const body = problems.length
  ? `**Rating check failed**, so this pull request is being closed.\n\n${problems.map(p => `- ${p}`).join('\n')}\n\nFix these and open a new pull request. Rules: ratings/README.md`
  : `**Rating check passed.**\n\n${notes.map(n => `- ${n}`).join('\n')}\n\nA maintainer still decides whether to merge.`;
gh('pr', 'comment', PR, '-R', REPO, '--body', body);
if (problems.length) { gh('pr', 'close', PR, '-R', REPO); process.exit(1); }
try { gh('pr', 'edit', PR, '-R', REPO, '--add-label', 'bot-verified'); } catch {}
