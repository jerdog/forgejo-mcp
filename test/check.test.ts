import { describe, expect, it } from "vitest";
import { ForgejoClient } from "../src/forgejo/client.js";
import { runChecks } from "../src/check.js";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });

function client(handler: (path: string) => Response) {
  const f = async (url: string) => handler(new URL(url).pathname.replace("/api/v1", ""));
  return new ForgejoClient({ url: "https://git.example.com", token: "secret", fetch: f as never });
}

describe("runChecks", () => {
  it("passes when everything responds", async () => {
    const c = client((p) => (p === "/version" ? json({ version: "11.0.0" }) : p === "/user" ? json({ login: "me" }) : json([])));
    const res = await runChecks(c, "o/r");
    expect(res.every((r) => r.status === "PASS")).toBe(true);
    expect(res.find((r) => r.name.startsWith("authenticate"))?.detail).toContain("me");
  });

  it("maps 403 to the missing scope and never leaks the token", async () => {
    const c = client((p) => (p === "/version" ? json({ version: "1" }) : p === "/user/orgs" ? json({ message: "no" }, 403) : json({ login: "x" })));
    const res = await runChecks(c);
    const orgs = res.find((r) => r.name === "list organizations")!;
    expect(orgs.status).toBe("FAIL");
    expect(orgs.detail).toContain("read:organization");
    expect(JSON.stringify(res)).not.toContain("secret");
  });

  it("reports 401 and skips unsupported Actions", async () => {
    const c = client((p) => (p === "/version" ? json({ version: "1" }) : p === "/user" ? json({}, 401) : p.endsWith("/actions/tasks") ? json({}, 404) : json([])));
    const res = await runChecks(c, "o/r");
    expect(res.find((r) => r.name.startsWith("authenticate"))?.detail).toContain("401");
    expect(res.find((r) => r.name === "list Actions tasks")?.status).toBe("SKIP");
  });

  it("stops early when the server is unreachable", async () => {
    const c = new ForgejoClient({ url: "https://nope.invalid", fetch: (async () => { throw new TypeError("fetch failed"); }) as never });
    const res = await runChecks(c, "o/r");
    expect(res).toHaveLength(1);
    expect(res[0].detail).toContain("connection error");
  });
});
