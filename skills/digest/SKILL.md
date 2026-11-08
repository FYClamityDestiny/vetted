---
name: digest
description: Periodic "what's new and worth it" scan of GitHub and Hugging Face across the user's interests, skipping anything already reviewed. Good as a weekly scheduled task. Use for "scout repos", "what's new on GitHub", "weekly digest", /repo-scout:digest [topic].
---

# Digest

## 1. Interests
Read `~/.claude/repo-scout-interests.md` (one topic per line). If missing, infer 4-6 topics from the user's recent projects and memory, write the file, and tell the user they can edit it. A topic passed as an argument replaces the list for this run.

## 2. Search (per topic)
`gh search repos "<topic>" --sort=stars --created=">$(date -d '-30 days' +%F)" --limit 10 --json fullName,description,stargazersCount,license,url`
plus the same with `--updated` for established repos that shipped something notable. For ML topics also query `https://huggingface.co/api/models?search=<topic>&sort=trending&limit=10`.

## 3. Filter
Skip anything in `~/.claude/repo-scout-seen.md`, already installed, archived, or unlicensed. Keep at most 8 overall.

## 4. Report
Table: Repo | What | Topic | Why now (new / big release / fast rising) | Verdict (Adopt / Try / Skip). Offer `/repo-scout:report` or `/repo-scout:find` on any row. Append all reviewed rows to `repo-scout-seen.md` as `- owner/repo — verdict — <date>`.
