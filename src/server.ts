import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ForgejoClient, ForgejoConfig } from "./forgejo/client.js";
import * as repos from "./tools/repos.js";
import * as files from "./tools/files.js";
import * as branches from "./tools/branches.js";
import * as issues from "./tools/issues.js";
import * as pulls from "./tools/pulls.js";
import * as releases from "./tools/releases.js";
import * as actions from "./tools/actions.js";
import * as users from "./tools/users.js";

export function createServer(config: ForgejoConfig): McpServer {
  const server = new McpServer({ name: "forgejo-mcp", version: "0.1.0" });
  const ctx = { server, client: new ForgejoClient(config) };
  for (const m of [users, repos, files, branches, issues, pulls, releases, actions]) m.register(ctx);
  return server;
}

export const parseBool = (v: string | undefined) => /^(1|true|yes)$/i.test(v ?? "");
