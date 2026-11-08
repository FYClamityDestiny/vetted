---
name: uninstall
description: Cleanly remove something installed through Vetted (or anything else the user names) and what it left behind — plugin, skill, MCP server, package, Docker image/container, VS Code extension, cloned repo, Roblox asset. Use for "uninstall X", "remove X", "get rid of X", /vetted:uninstall <name>.
---

# Uninstall

1. **Find it.** Look it up in `~/.claude/vetted-log.md`, which records the remove command. If it isn't there, work out how it was installed from where it lives (plugin list, `~/.claude/skills`, `claude mcp list`, package files, `docker ps -a`/`docker images`, `code --list-extensions`).
2. **Show the plan, then wait for a yes.** List exactly what will be removed: the package or plugin, its config entries (MCP config, hooks in `settings.json`), the files it created, its Docker containers, images and **volumes** (volumes hold data, so name them separately and ask), and any environment variables or API keys it asked for (remind the user to revoke those keys).
3. **Remove** with the matching command:
   - plugin: `claude plugin uninstall <name>`
   - skill: delete its folder
   - MCP server: `claude mcp remove <name>`
   - npm/pip: uninstall it and remove it from the manifest
   - VS Code: `code --uninstall-extension <id>`
   - Docker: `docker rm`, then `docker rmi`
   - cloned repo: move it to the trash (not a permanent delete) unless the user says otherwise
   - Roblox asset: list the instances to delete in Studio
4. **Verify** it's gone (run the same list commands again), then mark the log entry `removed <date>`.
5. **If it was rated ⛔ or ⚠️**, also suggest checking for anything it may have left running: scheduled tasks, startup entries, unknown processes. And rotate any keys it could read.
