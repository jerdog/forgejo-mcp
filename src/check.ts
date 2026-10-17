import { ForgejoClient, ForgejoError } from "./forgejo/client.js";

type Status = "PASS" | "FAIL" | "SKIP";
export interface CheckResult {
  name: string;
  status: Status;
  detail: string;
}

interface Probe {
  name: string;
  path: string;
  query?: Record<string, string | number>;
  /** Scope that is likely missing when the probe returns 401/403. */
  scope: string;
  /** A 404 means the endpoint is unsupported on this version, not a failure. */
  optional?: boolean;
  summarize?: (data: any) => string;
}

function explain(e: unknown, probe: Probe): CheckResult {
  if (e instanceof ForgejoError) {
    if (e.status === 401) return { name: probe.name, status: "FAIL", detail: "401 unauthorized: token missing, invalid or expired" };
    if (e.status === 403) return { name: probe.name, status: "FAIL", detail: `403 forbidden: token probably lacks scope ${probe.scope}` };
    if (e.status === 404 && probe.optional) return { name: probe.name, status: "SKIP", detail: "404: not supported on this instance version" };
    return { name: probe.name, status: "FAIL", detail: e.message };
  }
  const msg = e instanceof Error ? `${e.message}${(e as any).cause ? ` (${(e as any).cause.message ?? (e as any).cause})` : ""}` : String(e);
  return { name: probe.name, status: "FAIL", detail: `connection error: ${msg}` };
}

async function run(client: ForgejoClient, probe: Probe): Promise<CheckResult> {
  try {
    const data = await client.get(probe.path, probe.query);
    return { name: probe.name, status: "PASS", detail: probe.summarize?.(data) ?? "ok" };
  } catch (e) {
    return explain(e, probe);
  }
}

const count = (label: string) => (d: any) => `${Array.isArray(d) ? d.length : (d?.data?.length ?? d?.workflow_runs?.length ?? "?")} ${label}`;

/** Read-only self-test: connectivity, auth, scopes, and (optionally) one repository. Never prints the token. */
export async function runChecks(client: ForgejoClient, repo?: string): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  results.push(
    await run(client, {
      name: "reach /version",
      path: "/version",
      scope: "(none)",
      summarize: (d) => `server version ${d?.version ?? "unknown"}`,
    }),
  );
  if (results[0].status === "FAIL") return results; // no point continuing without a connection

  const baseProbes: Probe[] = [
    { name: "authenticate (get_me)", path: "/user", scope: "read:user", summarize: (d) => `logged in as ${d?.login}` },
    { name: "list organizations", path: "/user/orgs", scope: "read:organization", summarize: count("orgs") },
    { name: "search repositories", path: "/repos/search", query: { limit: 1 }, scope: "read:repository", summarize: count("repos (page 1)") },
  ];
  for (const p of baseProbes) results.push(await run(client, p));

  if (repo) {
    const [o, r] = repo.split("/");
    if (!o || !r) {
      results.push({ name: "repo probes", status: "FAIL", detail: `--repo must be owner/name, got "${repo}"` });
      return results;
    }
    const base = `/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}`;
    const repoProbes: Probe[] = [
      { name: "get repository", path: base, scope: "read:repository", summarize: (d) => `${d?.full_name} (${d?.private ? "private" : "public"}, default ${d?.default_branch})` },
      { name: "read root contents", path: `${base}/contents`, scope: "read:repository", summarize: count("entries") },
      { name: "list branches", path: `${base}/branches`, query: { limit: 5 }, scope: "read:repository", summarize: count("branches") },
      { name: "list commits", path: `${base}/commits`, query: { limit: 1, stat: "false", verification: "false", files: "false" }, scope: "read:repository", summarize: count("commits") },
      { name: "list issues", path: `${base}/issues`, query: { type: "issues", limit: 5 }, scope: "read:issue", summarize: count("issues") },
      { name: "list pull requests", path: `${base}/pulls`, query: { limit: 5 }, scope: "read:repository", summarize: count("pull requests") },
      { name: "list labels", path: `${base}/labels`, query: { limit: 5 }, scope: "read:issue", summarize: count("labels") },
      { name: "list releases", path: `${base}/releases`, query: { limit: 5 }, scope: "read:repository", summarize: count("releases") },
      { name: "list Actions tasks", path: `${base}/actions/tasks`, query: { limit: 5 }, scope: "read:repository", optional: true, summarize: count("tasks") },
    ];
    for (const p of repoProbes) results.push(await run(client, p));
  }
  return results;
}

export function formatResults(results: CheckResult[]): string {
  return results.map((r) => `${r.status.padEnd(4)}  ${r.name.padEnd(26)} ${r.detail}`).join("\n");
}

export async function check(url: string, token: string | undefined, repo?: string): Promise<number> {
  const client = new ForgejoClient({ url, token, readOnly: true });
  console.log(`Checking ${client.baseUrl} (${token ? "with token" : "NO TOKEN - anonymous"})`);
  const results = await runChecks(client, repo);
  console.log(formatResults(results));
  const failed = results.filter((r) => r.status === "FAIL").length;
  console.log(failed ? `\n${failed} check(s) failed.` : "\nAll checks passed.");
  return failed ? 1 : 0;
}
