---
name: find
description: User describes what they need; search GitHub, Hugging Face, npm, PyPI, Docker Hub, VS Code/Open VSX, MCP registries (official, Smithery, Glama) or the Roblox Creator Store, malware-scan the best candidates, then install the chosen one after the user confirms. Use for "find me a tool/repo/package/model/extension/MCP server that...", "is there something for...", /vetted:find <need>.
---

# Find → vet → install

Read `${CLAUDE_PLUGIN_ROOT}/references/vetting.md` and `${CLAUDE_PLUGIN_ROOT}/references/sources.md` first, and follow them exactly.

## 1. Understand the need
Restate it in one line. Pick the sources that fit (a model → Hugging Face; a Roblox asset → Creator Store; an editor add-on → VS Code/Open VSX; a Claude tool → MCP registries + GitHub; a library → npm/PyPI + GitHub; a self-hosted app → GitHub + Docker Hub). Ask one question only if it's genuinely ambiguous. Check what's already installed (`~/.claude/skills`, `~/.claude/plugins`, `claude mcp list`, the project's package files) so you don't suggest duplicates.

## 2. Search
Use 2-4 phrasings per chosen source. Drop: archived or deprecated, nothing new in 6+ months, no license, very low adoption unless new and clearly rising, and likely typosquats. Keep the top 3-5 overall.

## 3. Vet each survivor
Run the full vetting steps from `vetting.md`. Several candidates → subagents (cheap model, one per candidate, in parallel), each returning its rating, findings and pinned version.

## 4. Present
Table: Name | Source | What it does | Adoption (stars/downloads) | License | Rating (✅ ⚠️ ❔ ⛔) | Install effort. Under the table: the reason for each non-✅ rating. Recommend one. Include the standard warning line from `vetting.md`.

## 5. Install (only after the user says yes to a specific one)
Show the exact pinned command first, then run it. ⛔ never installs. ⚠️ and ❔ need a second yes after the user reads the warning. After installing, record it in `~/.claude/vetted-log.md`: `- <source>:<name>@<pinned version> — <rating> — installed <date> — remove with: <command>`.
