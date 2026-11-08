# Sources

For each source: how to search, what to read, how to download **without running anything**, and how to install the exact version that was scanned. APIs change; if an endpoint fails, check the source's current API docs or fall back to reading its search page. Never guess results.

Always download into a fresh empty temp folder, and never `cd` into it to run tools that load config from the current folder (npm, pip, python).

## GitHub
- Search: `gh search repos "<q>" --sort=stars --limit 15 --json fullName,description,stargazersCount,updatedAt,license,isArchived,url`
- Meta: `gh repo view <r> --json owner,licenseInfo,stargazerCount,forkCount,createdAt,pushedAt,isArchived,latestRelease`; owner: `gh api users/<owner>` (account age).
- Download: `git clone --depth 1 <url> <tmp>/src`; record `git -C <tmp>/src rev-parse HEAD`.
- Install pinned: clone and `git checkout <scanned sha>`. Claude plugins: `claude plugin marketplace add <owner/repo>` (warn the user it tracks the default branch, not the scanned commit).

## Hugging Face
- Search: `https://huggingface.co/api/models?search=<q>&sort=downloads&limit=15` (also `/api/datasets`, `/api/spaces`).
- Meta: `/api/models/<id>` (author, license, downloads, likes, lastModified, files in `siblings`, model card).
- Download: `hf download <id> --revision <sha> --local-dir <tmp>/src`.
- Checks: prefer `.safetensors`; pickle files (`.bin .pt .ckpt .pkl`) can run code when loaded; flag custom `.py` files and anything needing `trust_remote_code=True`. Use `modelscan` if installed.
- Install pinned: `hf download <id> --revision <scanned sha>`.

## npm
- Search: `https://registry.npmjs.org/-/v1/search?text=<q>&size=15` (includes popularity and maintenance scores).
- Meta: `https://registry.npmjs.org/<pkg>` (versions, maintainers, `time`, repository); downloads: `https://api.npmjs.org/downloads/point/last-month/<pkg>`.
- Download: take `versions[<v>].dist.tarball`, `curl -sL -o <tmp>/p.tgz <url>`, `tar -xzf <tmp>/p.tgz -C <tmp>/src`. Don't use `npm install` to inspect.
- Extra checks: typosquats (name 1-2 characters off a popular package, or a scope swap), package under 30 days old with few downloads, a maintainer added recently, published code that differs from the linked GitHub repo, dependency count.
- Scan with `scan.sh <dir> npm`. Install pinned: `npm install <pkg>@<exact version>`; add `--ignore-scripts` if the install scripts aren't needed.

## PyPI
- Search: PyPI has no search API. Use `https://pypi.org/search/?q=<q>` (read the page) or GitHub search, then confirm each name with the JSON API.
- Meta: `https://pypi.org/pypi/<pkg>/json` (versions, upload times, project URLs); downloads: `https://pypistats.org/api/packages/<pkg>/recent`.
- Download: take a file URL from `urls[]` in the JSON and `curl` it. **Never `pip download` an sdist**: building it runs `setup.py`. Unpack wheels with `unzip`, sdists with `tar`.
- Extra checks: the same typosquat and new-package checks as npm, plus `setup.py` doing network or file access, and `.pth` files (these run on every Python start).
- Scan with `scan.sh <dir> pypi`. Install pinned: `pip install <pkg>==<v> --only-binary :all:` where possible.

## Docker Hub
- Search: `https://hub.docker.com/v2/search/repositories/?query=<q>&page_size=15`.
- Meta: `https://hub.docker.com/v2/repositories/<ns>/<name>/` (pull count, last updated, official = `library/`, verified publisher); tags: `.../tags?page_size=10`, each with a `digest`.
- Inspect without running: `docker pull <img>@<digest>`, `docker image inspect` (entrypoint, env, exposed ports), `docker history --no-trunc` (build steps). `trivy image <img>@<digest>` if installed. Also scan the source repo's Dockerfile with `scan.sh`.
- Flags: no source repo linked, `latest` tag only, crypto-miner names, `--privileged`, mounting `docker.sock` or `/` in the README's run command.
- Install pinned: use the `@sha256:` digest in the run command or compose file.

## VS Code Marketplace / Open VSX
- Search: Open VSX `https://open-vsx.org/api/-/search?query=<q>&size=15`; Marketplace `POST https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery` (body: filterType 10 = search text, flags 914).
- Meta: publisher (verified?), install count, rating, last update, repository link.
- Download: the `.vsix` for the exact version (Open VSX: `https://open-vsx.org/api/<ns>/<name>/<version>`, field `files.download`), then `unzip` it into `<tmp>/src`.
- Checks: `scan.sh <dir> vsix`; `extension/package.json` `activationEvents` of `*` (runs on every launch), the `main` file, minified bundles with network calls, bundled binaries, and name or icon copying a popular extension.
- Install pinned: `code --install-extension <the scanned .vsix>`.

## MCP servers (official registry, Smithery, Glama)
- Search: the official registry `https://registry.modelcontextprotocol.io/v0/servers?search=<q>`; Smithery `https://registry.smithery.ai/servers?q=<q>` (may need an API key); Glama `https://glama.ai/api/mcp/v1/servers?query=<q>`. Merge results by repository URL.
- Most MCP servers are npm, PyPI or Docker packages. Find the package, then vet it with that ecosystem's steps above. Also scan the source repo with `scan.sh <dir> mcp`.
- MCP-specific checks: tool descriptions containing hidden instructions (prompt injection), tools that run shell commands or read any file, how many and which environment variables or API keys it wants, remote (hosted) or local (who sees your data?), and whether the server can change its tool list after install.
- Install pinned: `claude mcp add <name> -- npx -y <pkg>@<exact version>` (or the pinned PyPI or Docker form).

## Roblox Creator Store
- Search: `https://apis.roblox.com/toolbox-service/v1/marketplace/10?keyword=<q>&limit=30` (10 = models; 13 = plugins). Details: `https://apis.roblox.com/toolbox-service/v1/items/details?assetIds=<ids>` (creator, verified, votes, created/updated).
- Download: `https://assetdelivery.roblox.com/v1/asset/?id=<id>` usually needs authentication now. If it fails, use the Roblox Studio MCP, if connected: open a **blank place in edit mode** (never press Play), `insert_asset`, then read every Script, LocalScript and ModuleScript with `script_search` / `script_read`, and delete the place afterwards. Otherwise ask the user to save the model as `.rbxmx` (XML) and give the path, then `scan.sh <dir> roblox`. Binary `.rbxm` source can be compressed, so text search on it is unreliable: mark it UNVERIFIED.
- Checks: `require(<number>)` (loads remote code: the classic backdoor), `loadstring`, `getfenv`/`setfenv`, scripts hidden deep inside parts or with blank or look-alike names, `HttpService` calls, purchase and teleport prompts, `string.char` or `\ddd` obfuscation, scripts in a "model" that only needed to be a mesh.
- Install: insert the exact asset ID that was reviewed. Re-check after the creator updates it, because the same ID can change.
