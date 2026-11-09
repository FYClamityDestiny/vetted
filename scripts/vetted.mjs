#!/usr/bin/env node
// Vetted data helper. Fetches and condenses registry data so the agent reads ~20 lines, not raw API dumps.
// No dependencies (Node 18+). Results cached 24h in ~/.cache/vetted.
//
//   node vetted.mjs search <source> <query> [limit]   source: github|npm|hf|docker|openvsx|mcp
//   node vetted.mjs meta   <source> <name>            pinned version, download URL, owner, flags
//   node vetted.mjs intel  <source> <name> <version>  malware lists, vulns, full dependency tree, quality grade
//   node vetted.mjs hashes <dir>                      sha256 of binaries/archives (+ VirusTotal if VT_API_KEY set)
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, extname } from 'node:path';

const CACHE = join(homedir(), '.cache', 'vetted');
const DAY = 864e5;
const enc = encodeURIComponent;
const short = (s, n = 110) => (s || '').replace(/\s+/g, ' ').slice(0, n);
const daysAgo = d => (d ? Math.round((Date.now() - new Date(d)) / DAY) : null);

let ghToken = process.env.GITHUB_TOKEN;
if (!ghToken) try { ghToken = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {}

async function get(url, opts = {}) {
  const key = createHash('sha1').update(url + (opts.body || '')).digest('hex');
  const file = join(CACHE, key + '.json');
  try { if (Date.now() - statSync(file).mtimeMs < DAY) return JSON.parse(readFileSync(file, 'utf8')); } catch {}
  const headers = { 'user-agent': 'vetted-plugin', accept: 'application/json', ...(opts.headers || {}) };
  if (url.startsWith('https://api.github.com') && ghToken) headers.authorization = `Bearer ${ghToken}`;
  const res = await fetch(url, { ...opts, headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const data = await res.json();
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(file, JSON.stringify(data));
  return data;
}

// ---------- search ----------
const search = {
  async github(q, n) {
    const d = await get(`https://api.github.com/search/repositories?q=${enc(q)}&sort=stars&per_page=${n}`);
    return d.items.map(r => ({ name: r.full_name, what: short(r.description), stars: r.stargazers_count, updated_days: daysAgo(r.pushed_at), license: r.license?.spdx_id, archived: r.archived, url: r.html_url }));
  },
  async npm(q, n) {
    const d = await get(`https://registry.npmjs.org/-/v1/search?text=${enc(q)}&size=${n}`);
    return d.objects.map(o => ({ name: o.package.name, what: short(o.package.description), version: o.package.version, updated_days: daysAgo(o.package.date), weekly_downloads: o.downloads?.weekly, license: o.package.license, url: o.package.links?.npm }));
  },
  async hf(q, n) {
    const d = await get(`https://huggingface.co/api/models?search=${enc(q)}&sort=downloads&limit=${n}`);
    return d.map(m => ({ name: m.id, downloads: m.downloads, likes: m.likes, updated_days: daysAgo(m.lastModified), url: `https://huggingface.co/${m.id}` }));
  },
  async docker(q, n) {
    const d = await get(`https://hub.docker.com/v2/search/repositories/?query=${enc(q)}&page_size=${n}`);
    return d.results.map(r => ({ name: r.repo_name, what: short(r.short_description), pulls: r.pull_count, stars: r.star_count, official: r.is_official, url: `https://hub.docker.com/r/${r.repo_name.includes('/') ? r.repo_name : '_/' + r.repo_name}` }));
  },
  async openvsx(q, n) {
    const d = await get(`https://open-vsx.org/api/-/search?query=${enc(q)}&size=${n}`);
    return d.extensions.map(e => ({ name: `${e.namespace}.${e.name}`, what: short(e.description), version: e.version, downloads: e.downloadCount, verified: e.verified, updated_days: daysAgo(e.timestamp), url: `https://open-vsx.org/extension/${e.namespace}/${e.name}` }));
  },
  async mcp(q, n) {
    const d = await get(`https://registry.modelcontextprotocol.io/v0/servers?search=${enc(q)}&limit=${n}`);
    return (d.servers || []).map(s => { const v = s.server || s; return { name: v.name, what: short(v.description), version: v.version, repo: v.repository?.url, packages: (v.packages || []).map(p => `${p.registryType || p.registry_name}:${p.identifier || p.name}`), remote: (v.remotes || []).length > 0 }; });
  },
};

// ---------- meta ----------
const meta = {
  async github(name) {
    const [r, rel] = await Promise.all([get(`https://api.github.com/repos/${name}`), get(`https://api.github.com/repos/${name}/releases/latest`)]);
    if (!r) return null;
    const owner = await get(`https://api.github.com/users/${r.owner.login}`);
    const head = await get(`https://api.github.com/repos/${name}/commits/${r.default_branch}`);
    return { name: r.full_name, what: short(r.description, 200), license: r.license?.spdx_id, stars: r.stargazers_count, forks: r.forks_count, open_issues: r.open_issues_count, created_days: daysAgo(r.created_at), pushed_days: daysAgo(r.pushed_at), archived: r.archived, renamed_from: r.full_name.toLowerCase() !== name.toLowerCase() ? name : undefined, owner: { login: owner.login, type: owner.type, account_days: daysAgo(owner.created_at), public_repos: owner.public_repos, followers: owner.followers }, latest_release: rel?.tag_name, pin: { commit: head?.sha }, download: `git clone ${r.clone_url} && git -C ${r.name} checkout ${head?.sha}` };
  },
  async npm(name) {
    const p = await get(`https://registry.npmjs.org/${name.replace('/', '%2F')}`);
    if (!p) return null;
    const v = p['dist-tags'].latest, m = p.versions[v];
    const dl = await get(`https://api.npmjs.org/downloads/point/last-month/${name}`).catch(() => null);
    const prev = Object.keys(p.time).filter(k => p.versions[k]).slice(-2)[0];
    return { name, version: v, what: short(m.description, 200), license: m.license, deprecated: m.deprecated || undefined, created_days: daysAgo(p.time.created), published_days: daysAgo(p.time[v]), monthly_downloads: dl?.downloads, maintainers: (m.maintainers || []).map(x => x.name), maintainers_changed: prev && prev !== v ? JSON.stringify(p.versions[prev]?.maintainers?.map(x => x.name).sort()) !== JSON.stringify((m.maintainers || []).map(x => x.name).sort()) : undefined, install_scripts: Object.keys(m.scripts || {}).filter(k => /install|prepare/.test(k)), deps: Object.keys(m.dependencies || {}).length, repo: m.repository?.url, provenance: !!m.dist?.attestations, pin: { version: v, integrity: m.dist.integrity }, download: m.dist.tarball };
  },
  async pypi(name) {
    const p = await get(`https://pypi.org/pypi/${name}/json`);
    if (!p) return null;
    const i = p.info, files = p.urls;
    const whl = files.find(f => f.packagetype === 'bdist_wheel') || files[0];
    return { name: i.name, version: i.version, what: short(i.summary, 200), license: i.license_expression || short(i.license, 40), yanked: i.yanked || undefined, author: i.author || i.maintainer, created_days: daysAgo(Object.values(p.releases).flat().map(f => f.upload_time).sort()[0]), published_days: daysAgo(whl?.upload_time), sdist_only: !files.some(f => f.packagetype === 'bdist_wheel'), repo: Object.values(i.project_urls || {}).find(u => /github|gitlab/.test(u)), pin: { version: i.version, sha256: whl?.digests?.sha256 }, download: whl?.url, note: 'Download with curl; never pip download an sdist (it runs setup.py).' };
  },
  async hf(name) {
    const m = await get(`https://huggingface.co/api/models/${name}`);
    if (!m) return null;
    const files = (m.siblings || []).map(s => s.rfilename);
    return { name: m.id, author: m.author, license: m.cardData?.license, downloads: m.downloads, likes: m.likes, updated_days: daysAgo(m.lastModified), gated: m.gated || undefined, safetensors: files.some(f => f.endsWith('.safetensors')), pickle_files: files.filter(f => /\.(bin|pt|pth|ckpt|pkl)$/.test(f)), custom_code: files.filter(f => f.endsWith('.py')), pin: { revision: m.sha }, download: `hf download ${m.id} --revision ${m.sha}` };
  },
  async docker(name) {
    const full = name.includes('/') ? name : `library/${name}`;
    const [r, t] = await Promise.all([get(`https://hub.docker.com/v2/repositories/${full}/`), get(`https://hub.docker.com/v2/repositories/${full}/tags?page_size=5&ordering=last_updated`)]);
    if (!r) return null;
    const tag = t.results.find(x => x.name !== 'latest') || t.results[0];
    return { name: full, what: short(r.description, 200), pulls: r.pull_count, stars: r.star_count, official: full.startsWith('library/'), updated_days: daysAgo(r.last_updated), tags: t.results.map(x => x.name), pin: { tag: tag?.name, digest: tag?.digest }, download: `docker pull ${name}@${tag?.digest}` };
  },
  async openvsx(name) {
    const [ns, n] = name.split('.');
    const e = await get(`https://open-vsx.org/api/${ns}/${n}`);
    if (!e) return null;
    return { name, version: e.version, what: short(e.description, 200), license: e.license, verified: e.verified, downloads: e.downloadCount, updated_days: daysAgo(e.timestamp), repo: e.repository, deprecated: e.deprecated || undefined, pin: { version: e.version }, download: e.files?.download };
  },
};

// ---------- intel ----------
const DEPSDEV = { npm: 'npm', pypi: 'pypi' };
async function intel(source, name, version) {
  const out = { name, version };
  const eco = { npm: 'npm', pypi: 'PyPI' }[source];
  // 1. Full dependency tree (resolved, without installing anything) + malware/vuln check on every node
  if (DEPSDEV[source] && version) {
    const g = await get(`https://api.deps.dev/v3/systems/${DEPSDEV[source]}/packages/${enc(name)}/versions/${enc(version)}:dependencies`).catch(() => null);
    const nodes = (g?.nodes || []).map(x => x.versionKey);
    out.dependency_count = Math.max(nodes.length - 1, 0);
    const queries = (nodes.length ? nodes : [{ name, version }]).map(k => ({ package: { name: k.name, ecosystem: eco }, version: k.version }));
    const malicious = [], vulns = [];
    for (let i = 0; i < queries.length; i += 500) {
      const r = await get('https://api.osv.dev/v1/querybatch', { method: 'POST', body: JSON.stringify({ queries: queries.slice(i, i + 500) }), headers: { 'content-type': 'application/json' } });
      r.results.forEach((res, j) => (res.vulns || []).forEach(v => (v.id.startsWith('MAL-') ? malicious : vulns).push(`${queries[i + j].package.name}@${queries[i + j].version}: ${v.id}`)));
    }
    out.known_malicious = malicious;            // any entry here = BLOCK
    out.known_vulnerabilities = vulns.slice(0, 15);
    out.vulnerability_total = vulns.length;
    out.young_or_risky_deps = (g?.nodes || []).filter(x => x.relation !== 'SELF').length > 0 ? 'run meta on deps with few downloads or install scripts' : undefined;
  }
  // 2. Quality grade from OpenSSF Scorecard (GitHub repos, or a package's linked repo)
  let repo = source === 'github' ? name : null;
  if (!repo && (source === 'npm' || source === 'pypi')) { const m = await meta[source](name); repo = m?.repo?.match(/github\.com[/:]([^/]+\/[^/.#]+)/)?.[1]; }
  if (repo) {
    const s = await get(`https://api.securityscorecards.dev/projects/github.com/${repo}`).catch(() => null);
    if (s) {
      out.quality = { score: s.score, grade: s.score >= 8 ? 'A' : s.score >= 6.5 ? 'B' : s.score >= 5 ? 'C' : s.score >= 3.5 ? 'D' : 'F', weak: s.checks.filter(c => c.score >= 0 && c.score < 4).map(c => c.name) };
    } else out.quality = 'not scored by OpenSSF Scorecard';
    const adv = await get(`https://api.github.com/repos/${repo}/security-advisories?per_page=5`).catch(() => null);
    if (adv?.length) out.github_advisories = adv.map(a => `${a.ghsa_id} ${a.severity} ${short(a.summary, 60)}`);
  }
  return out;
}

// ---------- hashes ----------
const BIN = new Set(['.exe', '.dll', '.so', '.dylib', '.node', '.msi', '.scr', '.jar', '.zip', '.whl', '.vsix', '.bin', '.wasm']);
async function hashes(dir) {
  const found = [];
  const walk = d => readdirSync(d, { withFileTypes: true }).forEach(e => { const p = join(d, e.name); if (e.isDirectory()) { if (e.name !== '.git') walk(p); } else if (BIN.has(extname(e.name).toLowerCase())) found.push(p); });
  walk(dir);
  const out = [];
  for (const f of found.slice(0, 50)) {
    const sha = createHash('sha256').update(readFileSync(f)).digest('hex');
    const row = { file: f.slice(dir.length + 1), sha256: sha };
    if (process.env.VT_API_KEY) {
      const r = await get(`https://www.virustotal.com/api/v3/files/${sha}`, { headers: { 'x-apikey': process.env.VT_API_KEY } }).catch(() => null);
      const s = r?.data?.attributes?.last_analysis_stats;
      row.virustotal = s ? `${s.malicious} malicious / ${s.malicious + s.undetected + s.harmless} engines` : 'unknown to VirusTotal (new or private file)';
    }
    out.push(row);
  }
  return { binaries: out.length, files: out, virustotal: process.env.VT_API_KEY ? 'checked' : 'skipped (set VT_API_KEY, free account; only hashes are sent)' };
}

// ---------- main ----------
const [cmd, src, a, b] = process.argv.slice(2);
try {
  let r;
  if (cmd === 'search' && search[src]) r = await search[src](a, Math.min(+b || 10, 30));
  else if (cmd === 'search' && src === 'pypi') r = { note: 'PyPI has no search API. Find names via GitHub search or https://pypi.org/search/?q=, then run: meta pypi <name>' };
  else if (cmd === 'meta' && meta[src]) r = await meta[src](a);
  else if (cmd === 'intel') r = await intel(src, a, b);
  else if (cmd === 'hashes') r = await hashes(src);
  else { console.error('usage: vetted.mjs search|meta <github|npm|pypi|hf|docker|openvsx|mcp> <q>  |  intel <source> <name> <version>  |  hashes <dir>'); process.exit(64); }
  console.log(JSON.stringify(r ?? { error: 'not found' }, null, 1));
} catch (e) { console.log(JSON.stringify({ error: e.message })); process.exit(1); }
