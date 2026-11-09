#!/usr/bin/env bash
# Vetted scanner. Inspects a downloaded target folder. NEVER executes anything from it.
# usage: scan.sh <dir> [ecosystem]   ecosystem: github|npm|pypi|docker|vsix|mcp|roblox|hf
# exit: 0 clean, 1 warnings, 2 BLOCK, 3 unverified (no real malware scanner ran)
# VETTED_NO_TOOLS=1 skips external scanners (used by tests).
set -u
dir=${1:?usage: scan.sh <dir> [ecosystem]}
eco=${2:-github}
[ -d "$dir" ] || { echo "not a directory: $dir"; exit 2; }
block=0 warn=0 ran=0 unreadable=0

hit() { # level label regex
  local out
  out=$(grep -rIEin --exclude-dir=.git -e "$3" "$dir" 2>/dev/null | cut -c1-220 | head -5)
  [ -n "$out" ] || return 0
  echo "[$1] $2"; echo "$out" | sed 's/^/    /'
  if [ "$1" = BLOCK ]; then block=1; else warn=1; fi
}
files() { # level label find-args...
  local lvl=$1 label=$2; shift 2
  local out; out=$(find "$dir" -path '*/.git' -prune -o -type f \( "$@" \) -print 2>/dev/null | head -5)
  [ -n "$out" ] || return 0
  echo "[$lvl] $label"; echo "$out" | sed 's/^/    /'
  if [ "$lvl" = BLOCK ]; then block=1; else warn=1; fi
}

echo "== pattern checks ($eco) =="
# Remote code pulled and run
hit BLOCK "downloads a script and runs it" '(curl|wget)[^|#]*\|[[:space:]]*(sudo[[:space:]]+)?(ba|z|da)?sh\b|(iwr|irm|Invoke-WebRequest|Invoke-RestMethod|DownloadString)[^#]*\|[[:space:]]*iex|IEX[[:space:]]*\(|Invoke-Expression'
hit BLOCK "decodes hidden data and runs it" '(eval|exec|Function)[[:space:]]*\([^)]*(atob|b64decode|Buffer\.from\([^)]*base64|FromBase64String|unhexlify)|base64[[:space:]]+(-d|--decode)[^;]*\|[[:space:]]*(ba)?sh'
# Credential and data theft
hit BLOCK "reads saved passwords, keys or wallets" '\.ssh/id_(rsa|ed25519)|\.aws/credentials|Login Data|Local State|Cookies\.sqlite|wallet\.dat|Exodus|Electrum|\.config/solana|\.claude\.json|\.git-credentials|Local Storage/leveldb'
hit BLOCK "sends data to a chat webhook (common exfil)" 'discord(app)?\.com/api/webhooks|api\.telegram\.org/bot|hooks\.slack\.com/services'
hit BLOCK "reverse shell" '/dev/tcp/[0-9]|nc[[:space:]]+-e[[:space:]]|socket\.socket.*connect.*(subprocess|pty\.spawn)|New-Object[[:space:]]+System\.Net\.Sockets\.TCPClient'
hit BLOCK "persistence / disabling defenses" 'CurrentVersion\\\\Run|schtasks[[:space:]]+/create|Set-MpPreference|Add-MpPreference|crontab[[:space:]]+-|LaunchAgents'
hit BLOCK "crypto miner" 'stratum\+tcp|xmrig|coinhive|cryptonight'
# Risky but often legitimate
hit WARN "install-time scripts run automatically" '"(pre|post)?install"[[:space:]]*:|"prepare"[[:space:]]*:|cmdclass[[:space:]]*=|setup_requires|build-backend'
hit WARN "runs dynamic code or shell commands" '\beval[[:space:]]*\(|new Function[[:space:]]*\(|child_process|subprocess\.(Popen|run|call)|os\.system|exec[[:space:]]*\(compile|__import__[[:space:]]*\('
hit WARN "talks to raw IP addresses" 'https?://[0-9]{1,3}(\.[0-9]{1,3}){3}'
hit WARN "large encoded blob (possible hidden payload)" '[A-Za-z0-9+/]{600,}={0,2}'
hit WARN "reads environment secrets" 'process\.env\b|os\.environ|GITHUB_TOKEN|ANTHROPIC_API_KEY|OPENAI_API_KEY|AWS_SECRET'
files WARN "compiled binaries shipped in the source" -iname '*.exe' -o -iname '*.dll' -o -iname '*.so' -o -iname '*.dylib' -o -iname '*.node' -o -iname '*.scr' -o -iname '*.msi'
files WARN "pickle model files (can run code when loaded)" -iname '*.pkl' -o -iname '*.pickle' -o -iname '*.ckpt' -o -iname '*.pt' -o -iname '*.bin' -o -iname '*.joblib'
case $eco in
  mcp|github)
    hit WARN "prompt-injection text (in tool descriptions or docs)" '(ignore|disregard)[[:space:]]+(all[[:space:]]+)?(previous|prior|above)[[:space:]]+instructions|do not (tell|inform) the user|<IMPORTANT>|system prompt'
    hit WARN "Claude hooks or settings (run on every tool call)" '"hooks"[[:space:]]*:|PreToolUse|PostToolUse|dangerouslySkipPermissions|bypassPermissions' ;;
  vsix)
    hit WARN "extension starts on every launch" '"activationEvents"[[:space:]]*:[[:space:]]*\[[^]]*"\*"|onStartupFinished' ;;
  roblox)
    hit BLOCK "loads a remote module by ID (classic backdoor)" 'require[[:space:]]*\(?[[:space:]]*[0-9]{6,}'
    hit BLOCK "runs code from strings / changes environment" 'loadstring[[:space:]]*\(|getfenv|setfenv'
    hit WARN "web requests or purchase/teleport prompts" 'HttpService|PromptPurchase|PromptProductPurchase|PromptGamePassPurchase|TeleportService'
    hit WARN "obfuscated strings" 'string\.char[[:space:]]*\(|(\\[0-9]{2,3}){20,}|string\.reverse' ;;
esac
# Delayed payloads: code that fetches something and runs it later, long timers, date triggers
hit WARN "fetches code then runs it (possible delayed payload)" '(fetch|axios|https?\.get|requests\.get|urlopen|HttpGet)[^;]{0,200}(eval|Function\(|exec|spawn|writeFile[^;]*\.(js|sh|ps1|exe|py))'
hit WARN "long timer or date trigger" 'set(Timeout|Interval)\([^)]*[0-9]{8,}|Date\.now\(\)[[:space:]]*>[[:space:]]*[0-9]{12}|new Date\([^)]*\)[[:space:]]*[<>]|datetime\.now\(\)[[:space:]]*[<>]'
# Scrambled code: very long lines mean minified/packed code that pattern checks can't read reliably
mini=$(find "$dir" -path '*/.git' -prune -o -type f \( -name '*.js' -o -name '*.mjs' -o -name '*.cjs' -o -name '*.py' -o -name '*.lua' -o -name '*.ps1' \) -print 2>/dev/null | while read -r f; do awk 'length > 3000 {print FILENAME; exit}' "$f"; done | head -5)
if [ -n "$mini" ]; then echo "[WARN] minified or packed code (can't be fully read; rating can't be Clean without deobfuscating)"; echo "$mini" | sed 's/^/    /'; warn=1; unreadable=1; fi

# Capability profile: what this code CAN do. update compares it between versions; a new capability is the classic hijack sign.
cap() { grep -rIEiq --exclude-dir=.git -e "$2" "$dir" 2>/dev/null && caps="$caps $1"; }
caps=""
cap network 'fetch\(|axios|https?\.(get|request)|XMLHttpRequest|WebSocket|requests\.|urllib|socket\.|HttpService|net\.Dial|reqwest'
cap exec 'child_process|subprocess|os\.system|exec\(|spawn\(|Start-Process|Runtime\.getRuntime'
cap filesystem 'fs\.(write|unlink|rm)|writeFile|open\([^)]*["'"'"']w|shutil\.(rmtree|copy)|Remove-Item'
cap env 'process\.env|os\.environ|getenv|\$env:'
cap install-hook '"(pre|post)?install"[[:space:]]*:|cmdclass|setup_requires'
cap dynamic-code 'eval\(|new Function|loadstring|exec\(compile'
echo "CAPS:${caps:- none}"

echo "== malware scanners =="
if [ "${VETTED_NO_TOOLS:-0}" != 1 ]; then
  mp="/c/Program Files/Windows Defender/MpCmdRun.exe"
  if [ -x "$mp" ]; then
    win=$(cygpath -w "$dir" 2>/dev/null || echo "$dir")
    out=$("$mp" -Scan -ScanType 3 -File "$win" -DisableRemediation 2>&1)
    if echo "$out" | grep -qi "found no threats"; then ran=1; echo "[ok] Windows Defender: no threats"
    elif echo "$out" | grep -qiE "threat|found [1-9]"; then ran=1; echo "[BLOCK] Windows Defender:"; echo "$out" | tail -8 | sed 's/^/    /'; block=1
    else echo "[--] Windows Defender could not scan (turned off, or another antivirus is active)"; fi
  fi
  if command -v clamscan >/dev/null; then
    ran=1
    if clamscan -r -i --no-summary "$dir"; then echo "[ok] ClamAV: clean"; else echo "[BLOCK] ClamAV found something"; block=1; fi
  fi
  if command -v guarddog >/dev/null && { [ "$eco" = npm ] || [ "$eco" = pypi ]; }; then
    ran=1; out=$(guarddog "$eco" scan "$dir" 2>&1)
    echo "$out" | tail -15 | sed 's/^/    /'
    echo "$out" | grep -qiE "found [1-9][0-9]* potentially malicious" && { echo "[BLOCK] GuardDog flagged it"; block=1; }
  fi
  if command -v osv-scanner >/dev/null; then
    osv-scanner scan source -r "$dir" >/dev/null 2>&1 || { echo "[WARN] osv-scanner: known vulnerable dependencies (run it for details)"; warn=1; }
  fi
  if [ "$eco" = hf ] && command -v modelscan >/dev/null; then
    ran=1; modelscan -p "$dir" >/dev/null 2>&1 || { echo "[BLOCK] modelscan flagged unsafe model files"; block=1; }
  fi
fi
[ $ran = 1 ] || echo "[!] No malware scanner ran. Install one (Windows Defender, ClamAV, GuardDog) before trusting a Clean result."

echo "== result =="
if   [ $block = 1 ]; then echo "BLOCK"; exit 2
elif [ $warn = 1 ];  then [ $ran = 1 ] && echo "WARN" || echo "WARN (and UNVERIFIED: no malware scanner ran)"; exit 1
elif [ $ran = 0 ];   then echo "UNVERIFIED"; exit 3
elif [ $unreadable = 1 ]; then echo "UNVERIFIED (unreadable code)"; exit 3
else echo "CLEAN"; exit 0; fi
