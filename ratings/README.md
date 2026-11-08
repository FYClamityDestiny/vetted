# Shared ratings

One file per scanned version: `ratings/<source>/<name>@<version>.json`. Use `__` in place of `/` in names (for example `github/knadh__listmonk@v5.1.0.json`).

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

Shared ratings are hints. They can lower a local rating but never raise one. `human_reviewed: true` is set only by maintainers, for paid reviews.
