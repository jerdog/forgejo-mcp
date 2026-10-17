import { z } from "zod";
import { Ctx, defineTool, owner, repo, page, limit, repoPath } from "./helpers.js";

export function register(ctx: Ctx) {
  const { client } = ctx;

  defineTool(ctx, "list_releases", {
    title: "List releases",
    description: "List releases of a repository.",
    inputSchema: { owner, repo, draft: z.boolean().optional(), pre_release: z.boolean().optional(), page, limit },
    handler: ({ owner, repo, ...q }) => client.get(`${repoPath(owner, repo)}/releases`, q),
  });

  defineTool(ctx, "get_latest_release", {
    title: "Get latest release",
    description: "Get the latest published release.",
    inputSchema: { owner, repo },
    handler: ({ owner, repo }) => client.get(`${repoPath(owner, repo)}/releases/latest`),
  });

  defineTool(ctx, "get_release_by_tag", {
    title: "Get release by tag",
    description: "Get the release for a tag name.",
    inputSchema: { owner, repo, tag: z.string() },
    handler: ({ owner, repo, tag }) => client.get(`${repoPath(owner, repo)}/releases/tags/${encodeURIComponent(tag)}`),
  });

  defineTool(ctx, "create_release", {
    title: "Create release",
    description: "Create a release (and its tag if it does not exist yet).",
    inputSchema: {
      owner, repo,
      tag_name: z.string(),
      name: z.string().optional(),
      body: z.string().optional(),
      target_commitish: z.string().optional().describe("Branch or commit to tag if the tag is new"),
      draft: z.boolean().optional(),
      prerelease: z.boolean().optional(),
    },
    write: true,
    handler: ({ owner, repo, ...body }) => client.post(`${repoPath(owner, repo)}/releases`, body),
  });
}
