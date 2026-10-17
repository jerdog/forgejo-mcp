import { z } from "zod";
import { Ctx, defineTool, owner, repo, page, limit, repoPath } from "./helpers.js";

const index = z.number().int().describe("Issue number");

export function register(ctx: Ctx) {
  const { client } = ctx;

  defineTool(ctx, "list_issues", {
    title: "List issues",
    description: "List or search issues in a repository (pull requests excluded).",
    inputSchema: {
      owner, repo,
      state: z.enum(["open", "closed", "all"]).optional(),
      labels: z.string().optional().describe("Comma-separated label names"),
      milestones: z.string().optional().describe("Comma-separated milestone names or ids"),
      q: z.string().optional().describe("Search keyword"),
      assignee: z.string().optional(),
      created_by: z.string().optional(),
      page, limit,
    },
    handler: ({ owner, repo, ...q }) => client.get(`${repoPath(owner, repo)}/issues`, { ...q, type: "issues" }),
  });

  defineTool(ctx, "search_issues", {
    title: "Search issues and pull requests",
    description: "Search issues/PRs across all repositories visible to the token.",
    inputSchema: {
      q: z.string(),
      type: z.enum(["issues", "pulls"]).optional(),
      state: z.enum(["open", "closed"]).optional(),
      owner: z.string().optional().describe("Limit to repositories of this owner"),
      page, limit,
    },
    handler: (q) => client.get("/repos/issues/search", q),
  });

  defineTool(ctx, "get_issue", {
    title: "Get issue",
    description: "Get an issue by number.",
    inputSchema: { owner, repo, index },
    handler: ({ owner, repo, index }) => client.get(`${repoPath(owner, repo)}/issues/${index}`),
  });

  defineTool(ctx, "create_issue", {
    title: "Create issue",
    description: "Create an issue. Labels are given as numeric IDs (see list_labels).",
    inputSchema: {
      owner, repo,
      title: z.string(),
      body: z.string().optional(),
      assignees: z.array(z.string()).optional(),
      labels: z.array(z.number().int()).optional(),
      milestone: z.number().int().optional(),
      due_date: z.string().optional().describe("RFC3339 timestamp"),
    },
    write: true,
    handler: ({ owner, repo, ...body }) => client.post(`${repoPath(owner, repo)}/issues`, body),
  });

  defineTool(ctx, "update_issue", {
    title: "Update issue",
    description: "Edit an issue's title, body, state, assignees or milestone.",
    inputSchema: {
      owner, repo, index,
      title: z.string().optional(),
      body: z.string().optional(),
      state: z.enum(["open", "closed"]).optional(),
      assignees: z.array(z.string()).optional(),
      milestone: z.number().int().optional(),
    },
    write: true,
    handler: ({ owner, repo, index, ...body }) => client.patch(`${repoPath(owner, repo)}/issues/${index}`, body),
  });

  defineTool(ctx, "list_issue_comments", {
    title: "List issue comments",
    description: "List comments on an issue or pull request.",
    inputSchema: { owner, repo, index, page, limit },
    handler: ({ owner, repo, index, page, limit }) => client.get(`${repoPath(owner, repo)}/issues/${index}/comments`, { page, limit }),
  });

  defineTool(ctx, "add_issue_comment", {
    title: "Comment on issue or pull request",
    description: "Add a comment to an issue or pull request.",
    inputSchema: { owner, repo, index, body: z.string() },
    write: true,
    handler: ({ owner, repo, index, body }) => client.post(`${repoPath(owner, repo)}/issues/${index}/comments`, { body }),
  });

  defineTool(ctx, "list_labels", {
    title: "List labels",
    description: "List labels of a repository (returns the IDs needed to label issues).",
    inputSchema: { owner, repo, page, limit },
    handler: ({ owner, repo, page, limit }) => client.get(`${repoPath(owner, repo)}/labels`, { page, limit }),
  });

  defineTool(ctx, "create_label", {
    title: "Create label",
    description: "Create a label in a repository.",
    inputSchema: { owner, repo, name: z.string(), color: z.string().describe("Hex color, e.g. #00aabb"), description: z.string().optional() },
    write: true,
    handler: ({ owner, repo, ...body }) => client.post(`${repoPath(owner, repo)}/labels`, body),
  });

  defineTool(ctx, "add_issue_labels", {
    title: "Add labels to issue",
    description: "Add labels (by ID) to an issue or pull request.",
    inputSchema: { owner, repo, index, labels: z.array(z.number().int()).min(1) },
    write: true,
    handler: ({ owner, repo, index, labels }) => client.post(`${repoPath(owner, repo)}/issues/${index}/labels`, { labels }),
  });

  defineTool(ctx, "remove_issue_label", {
    title: "Remove label from issue",
    description: "Remove one label (by ID) from an issue or pull request.",
    inputSchema: { owner, repo, index, label_id: z.number().int() },
    write: true,
    handler: async ({ owner, repo, index, label_id }) => {
      await client.delete(`${repoPath(owner, repo)}/issues/${index}/labels/${label_id}`);
      return `Removed label ${label_id} from #${index}`;
    },
  });

  defineTool(ctx, "list_milestones", {
    title: "List milestones",
    description: "List milestones of a repository.",
    inputSchema: { owner, repo, state: z.enum(["open", "closed", "all"]).optional(), page, limit },
    handler: ({ owner, repo, ...q }) => client.get(`${repoPath(owner, repo)}/milestones`, q),
  });
}
