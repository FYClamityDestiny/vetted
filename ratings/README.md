# Shared ratings

One file per person per scanned version: `ratings/<source>/<name>@<version>/<your-github-login>.json`. Use `__` in place of `/` in names (for example `ratings/github/knadh__listmonk@v5.1.0/octocat.json`). For GitHub repos, set `commit` to the full 40-character commit.

```json
{
  "source": "github",
  "name": "knadh/listmonk",
  "version": "v5.1.0",
  "commit": "<sha or digest>",
  "rating": "clean | review | unverified | block",
  "findings": [{ "file": "path", "line": 12, "reason": "postinstall runs node setup.js (builds assets, no network)" }],
  "scanners": ["clamav", "guarddog"],
  "scan_version": "0.3.0",
  "date": "2026-11-08",
  "human_reviewed": false
}
```

## What the bot checks on every pull request
- Your account is at least 30 days old, is a personal account, and has some public activity.
- You've opened 5 or fewer pull requests here in the last day, with at most 10 ratings in each.
- Only rating files changed, and each one is named after **you**.
- For GitHub, npm and PyPI, the bot downloads that exact version (checked against the registry's checksum), scans it, and checks known-malware lists. A rating less cautious than the bot's own result is rejected and the pull request is closed.
- A maintainer still decides what gets merged.

After merge, `docs/ratings.json` is rebuilt. For each version the most cautious rating wins, and it counts as **community** once 3 or more different accounts have rated it.

Shared ratings are hints. They can lower a local rating but never raise one. `human_reviewed: true` is set only by maintainers, for paid reviews.
