import { describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";

type Call = { url: URL; init: RequestInit };

async function setup(opts: { readOnly?: boolean; respond?: (c: Call) => Response } = {}) {
  const calls: Call[] = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    const call = { url: new URL(url), init };
    calls.push(call);
    return opts.respond?.(call) ?? new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
  const server = createServer({ url: "https://git.example.com/", token: "t0k", readOnly: opts.readOnly, fetch: fetchMock as never });
  const client = new Client({ name: "test", version: "0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return { client, calls };
}

const text = (r: any) => r.content[0].text as string;

describe("forgejo-mcp", () => {
  it("registers tools and sends auth + API path", async () => {
    const { client, calls } = await setup();
    const names = (await client.listTools()).tools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(["get_me", "get_file_contents", "create_pull_request", "merge_pull_request", "list_issues"]));

    await client.callTool({ name: "get_repository", arguments: { owner: "a", repo: "b c" } });
    expect(calls[0].url.toString()).toBe("https://git.example.com/api/v1/repos/a/b%20c");
    expect((calls[0].init.headers as any).Authorization).toBe("token t0k");
  });

  it("decodes base64 file content", async () => {
    const { client } = await setup({
      respond: () => new Response(JSON.stringify({ type: "file", encoding: "base64", content: Buffer.from("héllo").toString("base64"), sha: "abc" })),
    });
    const r = await client.callTool({ name: "get_file_contents", arguments: { owner: "a", repo: "b", path: "dir/x.txt", ref: "main" } });
    expect(JSON.parse(text(r))).toMatchObject({ content: "héllo", sha: "abc" });
  });

  it("creates files with POST and updates with PUT when sha is given", async () => {
    const { client, calls } = await setup();
    await client.callTool({ name: "create_or_update_file", arguments: { owner: "a", repo: "b", path: "n.md", content: "hi", message: "m" } });
    await client.callTool({ name: "create_or_update_file", arguments: { owner: "a", repo: "b", path: "n.md", content: "hi2", message: "m", sha: "s1" } });
    expect(calls.map((c) => c.init.method)).toEqual(["POST", "PUT"]);
    expect(JSON.parse(calls[0].init.body as string).content).toBe(Buffer.from("hi").toString("base64"));
  });

  it("maps merge options to the Forgejo payload", async () => {
    const { client, calls } = await setup({ respond: () => new Response(null, { status: 200 }) });
    const r = await client.callTool({ name: "merge_pull_request", arguments: { owner: "a", repo: "b", index: 3, method: "squash" } });
    expect(JSON.parse(calls[0].init.body as string)).toMatchObject({ Do: "squash" });
    expect(text(r)).toContain("Merged pull request #3");
  });

  it("returns readable errors", async () => {
    const { client } = await setup({ respond: () => new Response(JSON.stringify({ message: "repo not found" }), { status: 404 }) });
    const r = await client.callTool({ name: "get_repository", arguments: { owner: "a", repo: "nope" } });
    expect(r.isError).toBe(true);
    expect(text(r)).toContain("404 repo not found");
  });

  it("hides write tools in read-only mode", async () => {
    const { client } = await setup({ readOnly: true });
    const tools = await client.listTools();
    const names = tools.tools.map((t) => t.name);
    expect(names).toContain("get_issue");
    expect(names).not.toContain("create_issue");
    expect(names).not.toContain("merge_pull_request");
    expect(tools.tools.every((t) => t.annotations?.readOnlyHint)).toBe(true);
  });
});
