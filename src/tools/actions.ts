import { z } from "zod";
import { Ctx, defineTool, owner, repo, page, limit, repoPath } from "./helpers.js";

/**
 * Forgejo/Gitea Actions endpoints are newer and vary between versions; these
 * tools surface a clear error when the instance does not support them.
 */
export function register(ctx: Ctx) {
  const { client } = ctx;

  defineTool(ctx, "list_action_tasks", {
    title: "List Actions runs",
    description: "List recent Actions (CI) task runs for a repository.",
    inputSchema: { owner, repo, page, limit },
    handler: ({ owner, repo, page, limit }) => client.get(`${repoPath(owner, repo)}/actions/tasks`, { page, limit }),
  });

  defineTool(ctx, "get_commit_status", {
    title: "Get combined commit status",
    description: "Get the combined CI status (and individual statuses) for a ref/SHA.",
    inputSchema: { owner, repo, ref: z.string().describe("Branch, tag or commit SHA") },
    handler: ({ owner, repo, ref }) => client.get(`${repoPath(owner, repo)}/commits/${encodeURIComponent(ref)}/status`),
  });

  defineTool(ctx, "list_workflows", {
    title: "List workflows",
    description: "List Actions workflows defined in a repository (Forgejo 11+/Gitea 1.24+).",
    inputSchema: { owner, repo },
    handler: ({ owner, repo }) => client.get(`${repoPath(owner, repo)}/actions/workflows`),
  });

  defineTool(ctx, "dispatch_workflow", {
    title: "Dispatch workflow",
    description: "Trigger a workflow_dispatch run (Forgejo 11+/Gitea 1.24+).",
    inputSchema: { owner, repo, workflow: z.string().describe("Workflow file name, e.g. ci.yml"), ref: z.string(), inputs: z.record(z.string(), z.string()).optional() },
    write: true,
    handler: async ({ owner, repo, workflow, ref, inputs }) => {
      await client.post(`${repoPath(owner, repo)}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`, { ref, inputs });
      return `Dispatched ${workflow} on ${ref}`;
    },
  });
}
