# forgejo-mcp

An [MCP](https://modelcontextprotocol.io) server for Gitea and Forgejo: manage repositories, files, branches, issues, pull requests, releases and CI from Claude, much like the GitHub MCP server does for GitHub. It speaks the `/api/v1` REST API shared by Forgejo and Gitea (including Codeberg and self-hosted/private instances).

**The default and recommended way to run it is locally over stdio.** Your token stays on your machine and is passed only to your Forgejo instance. A Cloudflare Worker entry point also exists for hosted use (see the end), but you don't need it.

## Quick start (local)

```bash
git clone https://github.com/jerdog/forgejo-mcp && cd forgejo-mcp
npm install        # also builds dist/ via the `prepare` script
```

Verify the connection and token permissions before wiring it into Claude:

```bash
export FORGEJO_URL=https://git.example.com
export FORGEJO_TOKEN=...            # see "Creating a Forgejo access token"
node dist/stdio.js --check --repo owner/name   # --repo is optional
```

`--check` is read-only. It reports PASS / FAIL / SKIP per probe (reachability, authentication, organizations, repository search, then repo, contents, branches, commits, issues, pull requests, labels, releases and Actions for the repo you name). A 403 names the scope that is probably missing. It never prints the token.

### Claude Code

```bash
claude mcp add forgejo \
  -e FORGEJO_URL=https://git.example.com \
  -e FORGEJO_TOKEN=... \
  -e FORGEJO_READ_ONLY=true \
  -- node /absolute/path/to/forgejo-mcp/dist/stdio.js
```

Or commit a project `.mcp.json` (see `.mcp.json.example`; it reads `FORGEJO_URL` / `FORGEJO_TOKEN` from your shell so no secret is committed).

### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "forgejo": {
      "command": "node",
      "args": ["/absolute/path/to/forgejo-mcp/dist/stdio.js"],
      "env": {
        "FORGEJO_URL": "https://git.example.com",
        "FORGEJO_TOKEN": "...",
        "FORGEJO_READ_ONLY": "true"
      }
    }
  }
}
```

## Claude Code cloud environments

To have the tools in every session of a Claude Code cloud (web) environment, register the server from the environment's setup script. That covers every repository opened in the environment, so nothing is added to those repos.

1. In the session title bar open the cloud environment menu, choose **Edit**, and paste this into **Setup script**:

   ```bash
   #!/bin/bash
   # Cloud environment "Setup script": installs forgejo-mcp and registers it with Claude Code.
   export FORGEJO_URL=https://git.ontheedgefarms.com
   REF=main                      # branch or tag of jerdog/forgejo-mcp to install
   REPO=jerdog/forgejo-mcp
   DIR=/opt/forgejo-mcp
   log() { echo "[forgejo-mcp] $*"; }

   fetch() {
     rm -rf "$DIR"
     log "try 1: git clone via github.com"
     git clone -q --depth 1 --branch "$REF" "https://github.com/$REPO" "$DIR" && { log "ok: git clone"; return 0; }
     rm -rf "$DIR"; mkdir -p "$DIR"
     log "try 2: tarball via api.github.com"
     curl -fsSL "https://api.github.com/repos/$REPO/tarball/$REF" | tar -xz --strip-components=1 -C "$DIR" \
       && [ -f "$DIR/package.json" ] && { log "ok: tarball"; return 0; }
     if [ -n "${FORGEJO_MCP_GH_TOKEN:-}" ]; then
       rm -rf "$DIR"
       log "try 3: git clone with FORGEJO_MCP_GH_TOKEN"
       git clone -q --depth 1 --branch "$REF" "https://x-access-token:${FORGEJO_MCP_GH_TOKEN}@github.com/$REPO" "$DIR" \
         && git -C "$DIR" remote set-url origin "https://github.com/$REPO" && { log "ok: token clone"; return 0; }
     fi
     return 1
   }

   fetch || { log "FAILED: could not fetch $REPO@$REF by any route"; exit 1; }
   bash "$DIR/scripts/cloud-setup.sh" || { log "FAILED: cloud-setup.sh exited $?"; exit 1; }
   log "done"
   ```

   **Private repo:** the setup phase has no session GitHub credentials. If you configured a network secret (Bearer) for GitHub, the proxy supplies auth and try 1 or 2 succeeds; list both `github.com` and `*.github.com` in its allowed domains, since a wildcard may not match the bare host. Otherwise add a fine-grained token (Contents: Read-only, this repo only) as environment variable `FORGEJO_MCP_GH_TOKEN` for try 3. Once the repo is public none of this is needed.

   [`scripts/cloud-setup.sh`](scripts/cloud-setup.sh) builds the server, runs `claude mcp add forgejo --scope user`, then runs `--check` as an informational self-test. A 401 there is expected when the environment injects credentials only inside sessions, so it only warns; confirm authentication from within a session.
2. Make sure **Network access** allows `github.com` (to clone) and your Forgejo host.
3. Start a **new session**. MCP servers are read at session start, so existing sessions don't pick it up.

Notes:

- **No token needed if the environment's proxy injects one.** If the environment has a credential configured for your Forgejo host (shown as "inject FORGEJO_TOKEN" in the session's proxy notes), the proxy adds the `Authorization` header to requests it sees, and you can leave `FORGEJO_TOKEN` unset.
- **`NODE_USE_ENV_PROXY=1` is required.** Node's `fetch` ignores `HTTPS_PROXY` by default (needs Node 22.21+ or 24+), so without it requests bypass the proxy, no credential is injected, and you get `401`. The script sets it on the server. Proxy CA trust (`NODE_EXTRA_CA_CERTS`) is already provided by the environment.
- If the proxy does not inject a token, set `FORGEJO_TOKEN` as an environment secret and export it before the `bash /opt/forgejo-mcp/scripts/cloud-setup.sh` line, or create a token as described above.
- Writes are off by default (`FORGEJO_READ_ONLY=true`). Export `FORGEJO_READ_ONLY=false` before that line to enable write tools.
- Verify in a new session with `/mcp`, or run `NODE_USE_ENV_PROXY=1 FORGEJO_URL=... node /opt/forgejo-mcp/dist/stdio.js --check --repo owner/name`.
- Alternatively commit a project `.mcp.json` to a repo (see `.mcp.json.example`, adding `"NODE_USE_ENV_PROXY": "1"` to `env`) if you only want the tools in that repo; you still need the setup script step to install the server.

## Configuration

| Variable | Description |
| --- | --- |
| `FORGEJO_URL` | Base URL of the instance, e.g. `https://git.example.com` (required) |
| `FORGEJO_TOKEN` | Personal access token. Required for private repos and any write |
| `FORGEJO_READ_ONLY` | `true` hides every write tool. Recommended until you trust your setup |

## Creating a Forgejo access token

In Forgejo/Gitea: **Settings → Applications → Manage Access Tokens → Generate Token**. Give it a name and select scopes (each category has *No access / Read / Read and Write*).

| To use these tools | Scope |
| --- | --- |
| Read repos, files, branches, commits, tags, releases, pull requests, Actions runs, commit status | `read:repository` |
| Create/update/delete files, branches, releases, pull requests; merge; fork/create repos; dispatch workflows | `write:repository` |
| Read issues, comments, labels, milestones | `read:issue` |
| Create/edit issues, comments, labels | `write:issue` |
| `get_me`, `search_users` | `read:user` |
| `list_organizations`, listing an organization's repos | `read:organization` |
| Create repos under an organization | `write:organization` (plus `write:repository`) |

Recommended first token: **`read:repository`, `read:issue`, `read:user`, `read:organization`** with `FORGEJO_READ_ONLY=true`. Add `write:*` scopes only when you want write tools, and drop `FORGEJO_READ_ONLY` at the same time.

Notes:
- Scopes don't grant access on their own: the token only sees repositories its owner can see (membership, team or collaborator access).
- Use `--check` to confirm the scopes are enough; a `403` result names the scope to add.
- Treat the token like a password: don't commit it, and revoke it in the same settings page if it leaks.

## Tools

- **Users/orgs**: `get_me`, `search_users`, `list_organizations`
- **Repos**: `search_repositories`, `get_repository`, `list_repositories`, `create_repository`, `fork_repository`
- **Files**: `get_file_contents`, `create_or_update_file`, `delete_file`, `push_files`
- **Branches/commits**: `list_branches`, `create_branch`, `delete_branch`, `list_commits`, `get_commit`, `list_tags`
- **Issues**: `list_issues`, `search_issues`, `get_issue`, `create_issue`, `update_issue`, `list_issue_comments`, `add_issue_comment`, `list_labels`, `create_label`, `add_issue_labels`, `remove_issue_label`, `list_milestones`
- **Pull requests**: `list_pull_requests`, `get_pull_request`, `create_pull_request`, `update_pull_request`, `merge_pull_request`, `get_pull_request_diff`, `list_pull_request_files`, `list_pull_request_reviews`, `list_pull_request_review_comments`, `create_pull_request_review`, `request_pull_request_reviewers`
- **Releases**: `list_releases`, `get_latest_release`, `get_release_by_tag`, `create_release`
- **CI**: `list_action_tasks`, `get_commit_status`, `list_workflows`, `dispatch_workflow` (Actions endpoints depend on the instance version)

Write tools carry `readOnlyHint: false`; deletes and merges set `destructiveHint`.

## Development

```bash
npm run typecheck && npm test
npm run smoke -- owner/name     # read-only end-to-end run over real MCP stdio (needs FORGEJO_URL/TOKEN)
npx @modelcontextprotocol/inspector node dist/stdio.js
```

## Optional: hosted on Cloudflare Workers

Only needed if you want a remote HTTP endpoint instead of a local process.

```bash
# edit FORGEJO_URL in wrangler.toml, then:
npx wrangler secret put FORGEJO_TOKEN
npx wrangler secret put MCP_AUTH_TOKEN   # protects the endpoint; required if FORGEJO_TOKEN is set
npm run deploy
```

Endpoint: `https://<worker>.workers.dev/mcp`. Clients send `Authorization: Bearer <MCP_AUTH_TOKEN>`, or bring their own Forgejo token in `X-Forgejo-Token`. The Worker must be able to reach your Forgejo URL over the public internet, so it is a poor fit for a private instance. Local dev: `npm run dev:worker` (vars in `.dev.vars`).
