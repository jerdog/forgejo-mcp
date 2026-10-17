import { z } from "zod";
import { Ctx, defineTool, owner, repo, page, limit, repoPath } from "./helpers.js";

const index = z.number().int().describe("Pull request number");

export function register(ctx: Ctx) {
  const { client } = ctx;

  defineTool(ctx, "list_pull_requests", {
    title: "List pull requests",
    description: "List pull requests in a repository.",
    inputSchema: {
      owner, repo,
      state: z.enum(["open", "closed", "all"]).optional(),
      sort: z.enum(["oldest", "recentupdate", "leastupdate", "mostcomment", "leastcomment", "priority"]).optional(),
      labels: z.array(z.number().int()).optional().describe("Label IDs"),
      page, limit,
    },
    handler: ({ owner, repo, labels, ...q }) => client.get(`${repoPath(owner, repo)}/pulls`, { ...q, labels: labels?.join(",") }),
  });

  defineTool(ctx, "get_pull_request", {
    title: "Get pull request",
    description: "Get a pull request, including mergeability.",
    inputSchema: { owner, repo, index },
    handler: ({ owner, repo, index }) => client.get(`${repoPath(owner, repo)}/pulls/${index}`),
  });

  defineTool(ctx, "create_pull_request", {
    title: "Create pull request",
    description: "Open a pull request from `head` into `base`. For cross-repo forks use head as `owner:branch`.",
    inputSchema: {
      owner, repo,
      title: z.string(),
      head: z.string(),
      base: z.string(),
      body: z.string().optional(),
      assignees: z.array(z.string()).optional(),
      labels: z.array(z.number().int()).optional(),
      milestone: z.number().int().optional(),
    },
    write: true,
    handler: ({ owner, repo, ...body }) => client.post(`${repoPath(owner, repo)}/pulls`, body),
  });

  defineTool(ctx, "update_pull_request", {
    title: "Update pull request",
    description: "Edit a pull request's title, body, base branch or state.",
    inputSchema: {
      owner, repo, index,
      title: z.string().optional(),
      body: z.string().optional(),
      base: z.string().optional(),
      state: z.enum(["open", "closed"]).optional(),
      assignees: z.array(z.string()).optional(),
    },
    write: true,
    handler: ({ owner, repo, index, ...body }) => client.patch(`${repoPath(owner, repo)}/pulls/${index}`, body),
  });

  defineTool(ctx, "merge_pull_request", {
    title: "Merge pull request",
    description: "Merge a pull request using the chosen strategy.",
    inputSchema: {
      owner, repo, index,
      method: z.enum(["merge", "rebase", "rebase-merge", "squash", "fast-forward-only", "manually-merged"]).default("merge"),
      title: z.string().optional().describe("Merge commit title"),
      message: z.string().optional().describe("Merge commit message"),
      delete_branch_after_merge: z.boolean().optional(),
    },
    write: true,
    destructive: true,
    handler: async ({ owner, repo, index, method, title, message, delete_branch_after_merge }) => {
      await client.post(`${repoPath(owner, repo)}/pulls/${index}/merge`, {
        Do: method,
        MergeTitleField: title,
        MergeMessageField: message,
        delete_branch_after_merge,
      });
      return `Merged pull request #${index} (${method})`;
    },
  });

  defineTool(ctx, "get_pull_request_diff", {
    title: "Get pull request diff",
    description: "Get the unified diff (or patch) of a pull request.",
    inputSchema: { owner, repo, index, format: z.enum(["diff", "patch"]).default("diff") },
    handler: ({ owner, repo, index, format }) =>
      client.request<string>("GET", `${repoPath(owner, repo)}/pulls/${index}.${format}`, { text: true, accept: "text/plain" }),
  });

  defineTool(ctx, "list_pull_request_files", {
    title: "List pull request files",
    description: "List files changed by a pull request.",
    inputSchema: { owner, repo, index, page, limit },
    handler: ({ owner, repo, index, page, limit }) => client.get(`${repoPath(owner, repo)}/pulls/${index}/files`, { page, limit }),
  });

  defineTool(ctx, "list_pull_request_reviews", {
    title: "List pull request reviews",
    description: "List reviews of a pull request.",
    inputSchema: { owner, repo, index, page, limit },
    handler: ({ owner, repo, index, page, limit }) => client.get(`${repoPath(owner, repo)}/pulls/${index}/reviews`, { page, limit }),
  });

  defineTool(ctx, "list_pull_request_review_comments", {
    title: "List review comments",
    description: "List inline comments of a specific review.",
    inputSchema: { owner, repo, index, review_id: z.number().int() },
    handler: ({ owner, repo, index, review_id }) => client.get(`${repoPath(owner, repo)}/pulls/${index}/reviews/${review_id}/comments`),
  });

  defineTool(ctx, "create_pull_request_review", {
    title: "Review pull request",
    description: "Submit a review on a pull request, optionally with inline comments. Omit `event` to leave the review pending.",
    inputSchema: {
      owner, repo, index,
      event: z.enum(["APPROVED", "REQUEST_CHANGES", "COMMENT"]).optional(),
      body: z.string().optional(),
      commit_id: z.string().optional(),
      comments: z.array(z.object({
        path: z.string(),
        body: z.string(),
        new_position: z.number().int().optional().describe("Line number in the new file"),
        old_position: z.number().int().optional().describe("Line number in the old file"),
      })).optional(),
    },
    write: true,
    handler: ({ owner, repo, index, ...body }) => client.post(`${repoPath(owner, repo)}/pulls/${index}/reviews`, body),
  });

  defineTool(ctx, "request_pull_request_reviewers", {
    title: "Request reviewers",
    description: "Request reviews from users on a pull request.",
    inputSchema: { owner, repo, index, reviewers: z.array(z.string()).min(1) },
    write: true,
    handler: async ({ owner, repo, index, reviewers }) => {
      await client.post(`${repoPath(owner, repo)}/pulls/${index}/requested_reviewers`, { reviewers });
      return `Requested review from ${reviewers.join(", ")}`;
    },
  });
}
