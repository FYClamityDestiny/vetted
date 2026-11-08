---
name: find
description: User describes what they need; search GitHub (or Hugging Face) for candidates, safety-scan the best ones, then install the chosen one after the user confirms. Use for "find me a repo/tool/model that...", "is there something on GitHub for...", /repo-scout:find <need>.
---

# Find → vet → install

## 1. Understand the need
Restate the need in one line. Ask one question only if the need is ambiguous (e.g. self-hosted vs SaaS, language). Note what the user already has installed (`~/.claude/skills`, `~/.claude/plugins`, `claude mcp list`, the current project's package files) so you don't suggest duplicates.

## 2. Search
GitHub (needs authenticated `gh`): run 2-4 phrasings of the need.
`gh search repos "<query>" --sort=stars --limit 15 --json fullName,description,stargazersCount,updatedAt,license,isArchived,url`
Hugging Face (when the need is a model/dataset/Space): `https://huggingface.co/api/models?search=<q>&sort=downloads&limit=15` (also `/api/datasets`, `/api/spaces`).

Drop: archived, no commits in 6 months, no license, under ~200 stars unless new and clearly rising. Keep the top 3-5.

## 3. Safety scan (each survivor)
Shallow-clone into a fresh empty temp dir. Never run anything from it.
`git clone --depth 1 <url> <tmp>/<name>`
Check and report each:
- **Install hooks:** `package.json` scripts (`preinstall`/`postinstall`/`prepare`), `setup.py` custom commands, `install.sh`, Makefile default target.
- **Remote execution:** `curl|sh`, `wget|bash`, `iex (iwr ...)`, `eval(`/`exec(` on fetched data, base64 blobs decoded and run.
- **Obfuscation:** minified/packed code in a source repo, long hex/base64 strings, binaries committed without explanation.
- **Network/exfil:** hardcoded IPs or unknown domains, telemetry on by default, reading `~/.ssh`, `.env`, browser profiles, `.claude*`.
- **Permissions it asks for:** API key scopes, broad GitHub tokens, Claude hooks or MCP servers that run on every tool call.
- **Trust signals:** author account age and other repos, contributors count, open security issues, release signatures.
For HF models: prefer `safetensors` over `.bin`/pickle; flag `trust_remote_code=True` requirements and custom `.py` files.

Rate each: ✅ Clean / ⚠️ Review (explain) / ⛔ Don't install.

## 4. Present
Table: Name | What it does | Stars/downloads | License | Safety | Install cost. Recommend one. Delete the temp clones.

## 5. Install (only after the user says yes to a specific one)
Show the exact command(s) first, then run them:
- Claude plugin: `claude plugin marketplace add <owner/repo>` then `claude plugin install <name>`
- Skill only: copy its skill folder into `~/.claude/skills/`
- MCP server: `claude mcp add ...` per its README
- App/library: clone into the folder the user names (or `~/code/<name>`), then the README's install steps, using pinned versions
- HF model: `hf download <id>` into the project
Never install a ⛔ repo. A ⚠️ repo needs the user to say yes again after reading the warning. Never pipe a remote script into a shell; download it, show it, then run it.
Afterwards record it in `~/.claude/repo-scout-seen.md` as `- owner/repo — installed — <date>`.
