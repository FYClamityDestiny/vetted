---
name: share
description: Contribute a Vetted scan result to the public shared-ratings list (opt-in) by opening a pull request, or look up existing shared ratings. Use for "share this rating", "submit to vetted ratings", "has anyone rated X", /vetted:share [name].
---

# Shared ratings

Ratings live in the public repo `FYClamityDestiny/vetted` under `ratings/<source>/<name>@<version>/<github-login>.json` (one file per person; the index is `docs/ratings.json`). The format is in `${CLAUDE_PLUGIN_ROOT}/ratings/README.md`.

## Look up
fetch `https://fyclamitydestiny.github.io/vetted/ratings.json` once (cached) and find the item; `community: true` means 3+ accounts agree. The other skills call this before scanning.
**A shared rating is a hint, not a verdict.** It can only *lower* the local rating (a shared ⛔ makes it at least ⚠️ until you've read the findings yourself). It never raises one: a ✅ from someone else never skips your own scan. Files can be faked or edited.

## Contribute (only when the user says so)
1. Build the JSON from the scan just done: source, name, exact version/commit/digest, rating, findings (file, line, one-line reason), which scanners ran, the scan.sh version, and the date. **No local paths, usernames, tokens or environment details.** Show the user the file before sending.
2. Name the file after the user's own GitHub login (`gh api user --jq .login`); the bot rejects anything else. For GitHub repos include the full `commit`. Fork and open a pull request: `gh repo fork FYClamityDestiny/vetted --clone=false`, then create the file through `gh api` on the fork's branch and run `gh pr create -R FYClamityDestiny/vetted`. A pull request is public, so get the user's yes first.
3. Maintainers merge only ratings they can reproduce with `scan.sh`.
