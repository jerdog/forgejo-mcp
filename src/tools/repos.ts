import { z } from "zod";
import { Ctx, defineTool, owner, repo, page, limit, repoPath } from "./helpers.js";

export function register(ctx: Ctx) {
  const { client } = ctx;

  defineTool(ctx, "search_repositories", {
    title: "Search repositories",
    description: "Search repositories on the Forgejo/Gitea instance by keyword.",
    inputSchema: { query: z.string(), topic: z.boolean().optional().describe("Match topics only"), page, limit },
    handler: ({ query, topic, page, limit }) => client.get("/repos/search", { q: query, topic, page, limit }),
  });

  defineTool(ctx, "get_repository", {
    title: "Get repository",
    description: "Get details of a repository.",
    inputSchema: { owner, repo },
    handler: ({ owner, repo }) => client.get(repoPath(owner, repo)),
  });

  defineTool(ctx, "list_repositories", {
    title: "List repositories",
    description: "List repositories owned by a user or organization. Omit owner to list the authenticated user's repositories.",
    inputSchema: { owner: owner.optional(), is_org: z.boolean().optional().describe("Owner is an organization"), page, limit },
    handler: ({ owner, is_org, page, limit }) => {
      const path = !owner ? "/user/repos" : is_org ? `/orgs/${encodeURIComponent(owner)}/repos` : `/users/${encodeURIComponent(owner)}/repos`;
      return client.get(path, { page, limit });
    },
  });

  defineTool(ctx, "create_repository", {
    title: "Create repository",
    description: "Create a repository for the authenticated user, or for an organization if `org` is given.",
    inputSchema: {
      name: z.string(),
      description: z.string().optional(),
      private: z.boolean().optional(),
      auto_init: z.boolean().optional().describe("Initialize with a README"),
      default_branch: z.string().optional(),
      org: z.string().optional().describe("Create under this organization instead of the user"),
    },
    write: true,
    handler: ({ org, ...body }) => client.post(org ? `/orgs/${encodeURIComponent(org)}/repos` : "/user/repos", body),
  });

  defineTool(ctx, "fork_repository", {
    title: "Fork repository",
    description: "Fork a repository to the authenticated user or a given organization.",
    inputSchema: { owner, repo, organization: z.string().optional(), name: z.string().optional().describe("Name for the fork") },
    write: true,
    handler: ({ owner, repo, ...body }) => client.post(`${repoPath(owner, repo)}/forks`, body),
  });
}
