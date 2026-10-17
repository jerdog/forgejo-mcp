# forgejo-mcp

An [MCP](https://modelcontextprotocol.io) server for Gitea and Forgejo — manage repositories, files, branches, issues, pull requests, releases and CI from Claude, much like the GitHub MCP server does for GitHub. It speaks the `/api/v1` REST API shared by Forgejo and Gitea (including Codeberg).

It runs two ways from the same tool core:

- **Local (stdio)** — for Claude Code / Claude Desktop; your token stays on your machine.
- **Remote (Cloudflare Worker)** — a hosted Streamable HTTP endpoint at `/mcp`.

## Configuration

| Variable | Description |
| --- | --- |
| `FORGEJO_URL` | Base URL of the instance, e.g. `https://codeberg.org` (required) |
| `FORGEJO_TOKEN` | Personal access token (Settings → Applications). Needed for private repos and any write |
| `FORGEJO_READ_ONLY` | `true` hides every write tool |

Suggested token scopes: `read:repository`, `read:issue`, `read:user`; add `write:repository`, `write:issue` for write tools.

## Local use

```bash
npm install && npm run build
```

Claude Code:

```bash
claude mcp add forgejo -e FORGEJO_URL=https://codeberg.org -e FORGEJO_TOKEN=xxx -- node /path/to/forgejo-mcp/dist/stdio.js
```

Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "forgejo": {
      "command": "node",
      "args": ["/path/to/forgejo-mcp/dist/stdio.js"],
      "env": { "FORGEJO_URL": "https://codeberg.org", "FORGEJO_TOKEN": "xxx" }
    }
  }
}
```

## Cloudflare Worker

```bash
# edit FORGEJO_URL in wrangler.toml, then:
npx wrangler secret put FORGEJO_TOKEN
npx wrangler secret put MCP_AUTH_TOKEN   # protects the endpoint; required if FORGEJO_TOKEN is set
npm run deploy
```

Endpoint: `https://<worker>.workers.dev/mcp`. Clients send `Authorization: Bearer <MCP_AUTH_TOKEN>`. Alternatively a client can send its own Forgejo token in `X-Forgejo-Token`, so a shared deployment needs no stored token. Local dev: `npm run dev:worker` (put vars in `.dev.vars`).

## Tools

- **Users/orgs**: `get_me`, `search_users`, `list_organizations`
- **Repos**: `search_repositories`, `get_repository`, `list_repositories`, `create_repository`, `fork_repository`
- **Files**: `get_file_contents`, `create_or_update_file`, `delete_file`, `push_files`
- **Branches/commits**: `list_branches`, `create_branch`, `delete_branch`, `list_commits`, `get_commit`, `list_tags`
- **Issues**: `list_issues`, `search_issues`, `get_issue`, `create_issue`, `update_issue`, `list_issue_comments`, `add_issue_comment`, `list_labels`, `create_label`, `add_issue_labels`, `remove_issue_label`, `list_milestones`
- **Pull requests**: `list_pull_requests`, `get_pull_request`, `create_pull_request`, `update_pull_request`, `merge_pull_request`, `get_pull_request_diff`, `list_pull_request_files`, `list_pull_request_reviews`, `list_pull_request_review_comments`, `create_pull_request_review`, `request_pull_request_reviewers`
- **Releases**: `list_releases`, `get_latest_release`, `get_release_by_tag`, `create_release`
- **CI**: `list_action_tasks`, `get_commit_status`, `list_workflows`, `dispatch_workflow` (Actions endpoints depend on instance version)

Write tools carry `readOnlyHint: false`; deletes and merges set `destructiveHint`.

## Development

```bash
npm run typecheck && npm test
npx @modelcontextprotocol/inspector node dist/stdio.js
```
