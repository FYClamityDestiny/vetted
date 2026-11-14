// SessionStart hook: hands the plugin's userConfig values to the Bash tool (where vetted.mjs runs).
// Names are VETTED_* so we never overwrite the user's own GITHUB_TOKEN.
import { appendFileSync } from 'node:fs';
const file = process.env.CLAUDE_ENV_FILE;
const map = { VETTED_GITHUB_TOKEN: 'CLAUDE_PLUGIN_OPTION_GITHUB_TOKEN', VETTED_VT_API_KEY: 'CLAUDE_PLUGIN_OPTION_VT_API_KEY' };
if (file) for (const [out, inp] of Object.entries(map)) {
  const v = process.env[inp];
  if (v) appendFileSync(file, `export ${out}='${v.replace(/'/g, "'\\''")}'\n`);
}
