#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { check } from "./check.js";
import { createServer, parseBool } from "./server.js";

const args = process.argv.slice(2);
const url = process.env.FORGEJO_URL;
if (!url) {
  console.error("FORGEJO_URL is required (e.g. https://git.example.com). Set FORGEJO_TOKEN for authenticated access.");
  process.exit(1);
}

if (args.includes("--check")) {
  const i = args.indexOf("--repo");
  process.exit(await check(url, process.env.FORGEJO_TOKEN, i >= 0 ? args[i + 1] : undefined));
}

const server = createServer({
  url,
  token: process.env.FORGEJO_TOKEN,
  readOnly: parseBool(process.env.FORGEJO_READ_ONLY),
});
await server.connect(new StdioServerTransport());
console.error(`forgejo-mcp connected to ${url}`);
