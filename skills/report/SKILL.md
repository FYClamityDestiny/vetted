---
name: report
description: Produce a short fact sheet on one GitHub repo or Hugging Face model (author, license, contents, activity, safety). Use for "tell me about <repo>", "is <repo> any good", "report on <url>", /repo-scout:report <owner/repo|url>.
---

# Repo report

Input: `owner/repo`, a GitHub URL, or a Hugging Face id/URL. If only a name is given, `gh search repos "<name>" --limit 5` and confirm which one.

## Gather (GitHub)
- `gh repo view <repo> --json name,owner,description,url,homepageUrl,licenseInfo,stargazerCount,forkCount,createdAt,pushedAt,isArchived,primaryLanguage,languages,repositoryTopics,latestRelease`
- `gh api repos/<repo>/contributors?per_page=5`, `gh api users/<owner>` (account age, followers, public repos)
- `gh issue list -R <repo> --limit 1 --json number` counts via `gh api search/issues?q=repo:<repo>+is:issue+is:open`
- README: `gh repo view <repo>` (skim)
- Tree: `gh api repos/<repo>/git/trees/HEAD?recursive=1` → top-level folders, file counts by type
- Quick safety pass: the step-3 checklist in the `find` skill, run against the tree and the files it flags (fetch only those files with `gh api .../contents/<path>`; no clone needed unless something looks off).

For Hugging Face use `https://huggingface.co/api/models/<id>` (author, license, downloads, likes, lastModified, siblings = files, tags) and the model card.

## Output (keep it to one screen)
**<name>** — one-line description
| | |
|---|---|
| Author | owner, account age, followers, notable other repos |
| License | SPDX + plain meaning (e.g. "AGPL: if you host a modified version you must publish source") |
| Activity | created, last push, latest release, stars, forks, open issues, top contributors |
| Stack | languages, main deps, how it runs (CLI / docker / library / app) |
| Contents | top-level folders and what each holds |
| Install | the one command or steps from the README |
| Safety | ✅/⚠️/⛔ with the reasons |

Then **Fit**: 2-3 lines on whether it fits the user's current projects and what it would replace.
