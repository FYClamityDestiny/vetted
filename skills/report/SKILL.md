---
name: report
description: One-screen fact sheet on one or more GitHub repos, Hugging Face models, npm/PyPI packages, Docker images, VS Code extensions, MCP servers or Roblox assets — author, license, contents, activity, install, safety rating. Use for "tell me about <x>", "is <x> safe/any good", "report on <url>", /vetted:report <x>[, <y>...].
---

# Report

Read `${CLAUDE_PLUGIN_ROOT}/references/vetting.md` and `${CLAUDE_PLUGIN_ROOT}/references/sources.md` first.

Input: one or more names, URLs or IDs, comma- or newline-separated. Work out the source from the URL or prefix (`npm:`, `pypi:`, `docker:`, `vsx:`, `mcp:`, `roblox:`, `hf:`; default GitHub). For a bare name, search and pick the clear match (name match plus the most adoption). Anything unclear goes at the end as "couldn't resolve", with the top 2 candidates. Never guess.

**More than 3 targets:** split them across subagents (cheap model, about 5 each, in parallel). Print one summary table first (Name | Source | What | License | Adoption | Last update | Rating | Fit), then each fact sheet.

## Fact sheet
**<name>** (<source>): one-line description
| | |
|---|---|
| Author | owner, account age, verified?, notable other work |
| License | SPDX ID, plus what it means in plain words (e.g. "AGPL: if you host a modified version, you must publish your source code") |
| Activity | created, last update, latest version, stars or downloads, open issues, top contributors |
| Stack | languages, main dependencies, how it runs (CLI / Docker / library / app / extension / MCP) |
| Contents | top-level folders or files and what each holds |
| Install | the pinned command |
| Safety | ✅ ⚠️ ❔ ⛔ with the reasons (full vetting from `vetting.md`) |

Then **Fit**: 2-3 lines on whether it fits the user's current projects and what it would replace.
