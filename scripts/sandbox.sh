#!/usr/bin/env bash
# Optional behavior check: actually install the package inside a throwaway Docker container with NO network,
# then report what it tried to do. Catches install-time payloads the code read missed.
# usage: sandbox.sh npm <pkg>@<version> | sandbox.sh pypi <pkg>==<version>
# exit: 0 nothing suspicious, 1 suspicious behavior, 3 skipped (no Docker)
set -u
eco=${1:?usage: sandbox.sh npm|pypi <pkg@version>}; pkg=${2:?package}
command -v docker >/dev/null && docker info >/dev/null 2>&1 || { echo "SKIPPED: Docker not available. Install Docker Desktop to enable sandbox runs."; exit 3; }
vol=vetted-sbx-$$; name=$vol
case $eco in
  npm)  img=node:22-slim
        fetch="cd /w && npm init -y >/dev/null && npm install --ignore-scripts $pkg"            # step 1: download only, no scripts run
        run="cd /w && npm rebuild --foreground-scripts 2>&1; node -e \"require('${pkg%@*}')\" 2>&1" ;;  # step 2: run install scripts + import, offline
  pypi) img=python:3.12-slim
        fetch="pip download -d /w --only-binary :all: $pkg"                                       # wheels only: nothing executes
        run="pip install --no-index -f /w $pkg 2>&1; python -c \"import importlib;importlib.import_module('${pkg%%=*}'.replace('-','_'))\" 2>&1" ;;
  *) echo "sandbox supports npm and pypi"; exit 64 ;;
esac
cleanup() { docker rm -f "$name" >/dev/null 2>&1; docker volume rm "$vol" >/dev/null 2>&1; }; trap cleanup EXIT
docker run --rm -v "$vol":/w --cap-drop ALL --security-opt no-new-privileges "$img" sh -c "$fetch" >/dev/null 2>&1 || { echo "SKIPPED: download step failed"; exit 3; }
# step 2: no network, no extra privileges, capped resources
log=$(docker run --name "$name" -v "$vol":/w --network none --cap-drop ALL --security-opt no-new-privileges --memory 1g --pids-limit 256 "$img" sh -c "$run" 2>&1)
changes=$(docker diff "$name" 2>/dev/null | grep -vE ' /(w|tmp|root/\.npm|root/\.cache|usr/local/lib/python3[^/]*/site-packages|usr/local/bin)' | head -20)
sus=0
echo "$log" | grep -iE 'ENOTFOUND|EAI_AGAIN|getaddrinfo|Network is unreachable|Temporary failure in name resolution|ECONNREFUSED' | grep -viE 'registry|pypi|files.pythonhosted' | head -5 | sed 's/^/[network attempt] /' | grep . && sus=1
[ -n "$changes" ] && { echo "[files changed outside the package folder]"; echo "$changes" | sed 's/^/    /'; sus=1; }
echo "$log" | grep -iE 'crontab|/etc/profile|\.bashrc|authorized_keys|LaunchAgents' | head -3 | sed 's/^/[persistence] /' | grep . && sus=1
[ $sus = 0 ] && echo "SANDBOX: nothing suspicious during install and import" || echo "SANDBOX: SUSPICIOUS"
exit $sus
