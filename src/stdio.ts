#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer, parseBool } from "./server.js";

const url = process.env.FORGEJO_URL;
if (!url) {
  console.error("FORGEJO_URL is required (e.g. https://codeberg.org). Set FORGEJO_TOKEN for authenticated access.");
  process.exit(1);
}

const server = createServer({
  url,
  token: process.env.FORGEJO_TOKEN,
  readOnly: parseBool(process.env.FORGEJO_READ_ONLY),
});
await server.connect(new StdioServerTransport());
console.error(`forgejo-mcp connected to ${url}`);
