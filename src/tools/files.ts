import { z } from "zod";
import { encodePath, fromBase64, toBase64 } from "../forgejo/client.js";
import { Ctx, defineTool, owner, repo, repoPath } from "./helpers.js";

interface ContentEntry {
  type: string;
  content?: string | null;
  encoding?: string | null;
  sha?: string;
  [k: string]: unknown;
}

const ref = z.string().optional().describe("Branch, tag or commit SHA (default: repo default branch)");

export function register(ctx: Ctx) {
  const { client } = ctx;
  const filePath = (o: string, r: string, p: string) => `${repoPath(o, r)}/contents/${encodePath(p)}`;

  defineTool(ctx, "get_file_contents", {
    title: "Get file or directory contents",
    description: "Read a file (decoded to text) or list a directory. Use path '' for the repository root. File results include the blob `sha` needed to update the file.",
    inputSchema: { owner, repo, path: z.string().default(""), ref },
    handler: async ({ owner, repo, path, ref }) => {
      const data = await client.get<ContentEntry | ContentEntry[]>(path ? filePath(owner, repo, path) : `${repoPath(owner, repo)}/contents`, { ref });
      if (Array.isArray(data)) return data.map(({ name, path, type, size, sha }: any) => ({ name, path, type, size, sha }));
      if (data.type === "file" && data.content && data.encoding === "base64") {
        return { ...data, content: fromBase64(data.content), encoding: "utf-8" };
      }
      return data;
    },
  });

  defineTool(ctx, "create_or_update_file", {
    title: "Create or update file",
    description: "Create a file, or update an existing one (then `sha` of the current blob is required). Creates a commit.",
    inputSchema: {
      owner, repo,
      path: z.string(),
      content: z.string().describe("New file content as text"),
      message: z.string().describe("Commit message"),
      branch: z.string().optional(),
      new_branch: z.string().optional().describe("Create this new branch for the commit"),
      sha: z.string().optional().describe("Blob SHA of the file being replaced (omit to create)"),
    },
    write: true,
    handler: ({ owner, repo, path, content, sha, ...rest }) =>
      sha
        ? client.put(filePath(owner, repo, path), { ...rest, content: toBase64(content), sha })
        : client.post(filePath(owner, repo, path), { ...rest, content: toBase64(content) }),
  });

  defineTool(ctx, "delete_file", {
    title: "Delete file",
    description: "Delete a file in a repository via a commit.",
    inputSchema: { owner, repo, path: z.string(), sha: z.string().describe("Blob SHA of the file"), message: z.string(), branch: z.string().optional() },
    write: true,
    destructive: true,
    handler: ({ owner, repo, path, ...body }) => client.delete(filePath(owner, repo, path), body),
  });

  defineTool(ctx, "push_files", {
    title: "Push multiple files",
    description: "Create, update or delete several files in a single commit.",
    inputSchema: {
      owner, repo,
      message: z.string(),
      branch: z.string().optional(),
      new_branch: z.string().optional(),
      files: z.array(z.object({
        operation: z.enum(["create", "update", "delete"]),
        path: z.string(),
        content: z.string().optional().describe("Text content (not needed for delete)"),
        sha: z.string().optional().describe("Blob SHA (required for update and delete)"),
      })).min(1),
    },
    write: true,
    destructive: true,
    handler: ({ owner, repo, files, ...rest }) =>
      client.post(`${repoPath(owner, repo)}/contents`, {
        ...rest,
        files: files.map((f) => ({ ...f, content: f.content !== undefined ? toBase64(f.content) : undefined })),
      }),
  });
}
