// Read-only end-to-end smoke test: spawns dist/stdio.js and calls tools over real MCP stdio.
// Usage: FORGEJO_URL=... FORGEJO_TOKEN=... node scripts/smoke.mjs owner/repo
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const repo = process.argv[2];
if (!repo?.includes("/")) {
  console.error("usage: node scripts/smoke.mjs owner/repo");
  process.exit(2);
}
const [owner, name] = repo.split("/");

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/stdio.js"],
  env: { ...process.env, FORGEJO_READ_ONLY: "true" },
});
const client = new Client({ name: "smoke", version: "0" });
await client.connect(transport);

const tools = (await client.listTools()).tools;
console.log(`tools exposed in read-only mode: ${tools.length}`);

const calls = [
  ["get_me", {}],
  ["list_repositories", { limit: 5 }],
  ["get_repository", { owner, repo: name }],
  ["get_file_contents", { owner, repo: name, path: "" }],
  ["list_branches", { owner, repo: name, limit: 5 }],
  ["list_issues", { owner, repo: name, state: "all", limit: 5 }],
  ["list_pull_requests", { owner, repo: name, state: "all", limit: 5 }],
];
let failed = 0;
for (const [tool, args] of calls) {
  const r = await client.callTool({ name: tool, arguments: args });
  const text = r.content?.[0]?.text ?? "";
  if (r.isError) failed++;
  console.log(`${r.isError ? "FAIL" : "PASS"}  ${tool}  ${r.isError ? text : `${text.length} chars`}`);
}
await client.close();
process.exit(failed ? 1 : 0);
