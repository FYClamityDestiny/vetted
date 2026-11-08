---
name: digest
description: Periodic "what's new and worth it" scan across GitHub, Hugging Face, npm, PyPI, Docker Hub, VS Code/Open VSX, MCP registries and the Roblox Creator Store for the user's interests, skipping anything already reviewed, and flagging new releases of things already installed. Good as a weekly scheduled task. Use for "what's new", "weekly digest", "scout tools", /vetted:digest [topic].
---

# Digest

Read `${CLAUDE_PLUGIN_ROOT}/references/sources.md` first.

## 1. Interests
Read `~/.claude/vetted-interests.md` (one `topic | sources` per line). If it's missing, infer 4-6 topics from the user's recent projects and memory, write the file, and tell them they can edit it. A topic passed as an argument replaces the list for this run.

## 2. Search
For each topic, search its sources for things created in the last 30 days and for established projects that shipped a notable release. Skip anything already in `~/.claude/vetted-log.md` or `~/.claude/vetted-seen.md`, anything archived or deprecated, anything unlicensed, and likely typosquats. Keep at most 8 overall.

## 3. Installed updates
For each entry in `vetted-log.md`, check for a newer version. List the updates and offer `/vetted:report` on them. A new version is new code, so it needs vetting again.

## 4. Report
Table: Name | Source | What | Topic | Why now (new / big release / fast rising) | Verdict (Adopt / Try / Skip). The digest does **not** scan. Point to `/vetted:report` or `/vetted:find` before anything gets installed. Append every reviewed row to `vetted-seen.md` as `- <source>:<name> — verdict — <date>`.
