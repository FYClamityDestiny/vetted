---
name: update
description: Update installed tools (Claude plugins, skills, MCP servers, npm/PyPI packages, Docker images, VS Code extensions, Roblox assets, cloned repos) to their current version, scanning only what changed and warning about bad news (archived, deprecated, ownership change, shutting down, license change). Use for "update my plugins", "is anything outdated", "check my installs", /vetted:update [name|all].
---

# Update

Read `${CLAUDE_PLUGIN_ROOT}/references/vetting.md` and `${CLAUDE_PLUGIN_ROOT}/references/sources.md` first.

## 1. Inventory
Use `~/.claude/vetted-log.md` plus what's actually installed: `claude plugin list`, `~/.claude/skills`, `claude mcp list`, and the current project's `package.json`, `requirements*.txt`/`pyproject.toml`, `docker-compose*.yml` and `code --list-extensions --show-versions`. Without an argument, check everything; with a name, only that.

## 2. For each item: what's new
Get the latest version and compare it with the installed one. Skip items that are up to date.

## 3. Bad-news check (even when there's no update)
- **Archived or deprecated:** the GitHub `isArchived` flag, npm `deprecated`, a PyPI yanked release, the VS Code "deprecated" tag, a Roblox asset taken down.
- **Shutting down:** search the README, the latest release notes and the 10 newest issues for: sunset, end of life, EOL, shutting down, no longer maintained, unmaintained, discontinued, moving to, acquired.
- **Ownership change:** a new repo owner or redirect, new npm/PyPI maintainers, or a different publisher since the logged install. This is the classic hijack setup.
- **License change:** compare the SPDX ID with the logged one (for example MIT changing to a non-commercial license).
- **Security:** GitHub advisories (`gh api repos/<r>/security-advisories`), osv.dev for the package (`https://api.osv.dev/v1/query`).

## 4. Scan only what changed
Download the old and new versions side by side (pinned, from `sources.md`). Diff them: `git diff <old>..<new>`, or `diff -r` on unpacked packages. Run `scan.sh` on the **new** version, then read every changed file that touches install scripts, entry points, network calls or hooks. Flag the classic hijack signs: a big new minified file, a new install script, a new dependency nobody asked for, or a patch release that adds network code.

## 5. Report and apply
Table: Name | Installed → Latest | Changes (one line) | Bad news | Rating. Then ask which to update. Apply only the approved ones, each pinned to the scanned version, and update `vetted-log.md` (new version, rating, date). Never auto-update a ⛔, and don't let an update quietly lower a rating without saying so.

## 6. Share
If an update was rated or showed bad news, suggest once: "`/vetted:share` would warn everyone else using this." Never share without their yes.
