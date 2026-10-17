import { z } from "zod";
import { Ctx, defineTool, owner, repo, page, limit, repoPath } from "./helpers.js";

export function register(ctx: Ctx) {
  const { client } = ctx;

  defineTool(ctx, "list_branches", {
    title: "List branches",
    description: "List branches of a repository.",
    inputSchema: { owner, repo, page, limit },
    handler: ({ owner, repo, page, limit }) => client.get(`${repoPath(owner, repo)}/branches`, { page, limit }),
  });

  defineTool(ctx, "create_branch", {
    title: "Create branch",
    description: "Create a branch from an existing branch (default: the repo's default branch).",
    inputSchema: { owner, repo, branch: z.string().describe("New branch name"), from_branch: z.string().optional() },
    write: true,
    handler: ({ owner, repo, branch, from_branch }) =>
      client.post(`${repoPath(owner, repo)}/branches`, { new_branch_name: branch, old_branch_name: from_branch }),
  });

  defineTool(ctx, "delete_branch", {
    title: "Delete branch",
    description: "Delete a branch.",
    inputSchema: { owner, repo, branch: z.string() },
    write: true,
    destructive: true,
    handler: async ({ owner, repo, branch }) => {
      await client.delete(`${repoPath(owner, repo)}/branches/${encodeURIComponent(branch)}`);
      return `Deleted branch ${branch}`;
    },
  });

  defineTool(ctx, "list_commits", {
    title: "List commits",
    description: "List commits on a branch/ref, optionally limited to a file path.",
    inputSchema: { owner, repo, sha: z.string().optional().describe("Branch, tag or SHA"), path: z.string().optional(), page, limit },
    handler: ({ owner, repo, sha, path, page, limit }) =>
      client.get(`${repoPath(owner, repo)}/commits`, { sha, path, page, limit, stat: false, verification: false, files: false }),
  });

  defineTool(ctx, "get_commit", {
    title: "Get commit",
    description: "Get a single commit by SHA, including changed files.",
    inputSchema: { owner, repo, sha: z.string() },
    handler: ({ owner, repo, sha }) => client.get(`${repoPath(owner, repo)}/git/commits/${encodeURIComponent(sha)}`),
  });

  defineTool(ctx, "list_tags", {
    title: "List tags",
    description: "List tags of a repository.",
    inputSchema: { owner, repo, page, limit },
    handler: ({ owner, repo, page, limit }) => client.get(`${repoPath(owner, repo)}/tags`, { page, limit }),
  });
}
