import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ForgejoClient, ForgejoError } from "../forgejo/client.js";

export interface Ctx {
  server: McpServer;
  client: ForgejoClient;
}

export const owner = z.string().describe("Repository owner (user or organization)");
export const repo = z.string().describe("Repository name");
export const page = z.number().int().min(1).optional().describe("Page number (default 1)");
export const limit = z.number().int().min(1).max(100).optional().describe("Results per page (default 30, max 100)");

type Result = { content: { type: "text"; text: string }[]; isError?: boolean };

export const ok = (data: unknown): Result => ({
  content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }],
});

export const fail = (e: unknown): Result => ({
  content: [{ type: "text", text: e instanceof ForgejoError || e instanceof Error ? e.message : String(e) }],
  isError: true,
});

interface ToolDef<S extends z.ZodRawShape> {
  title: string;
  description: string;
  inputSchema: S;
  /** Write tools are skipped when FORGEJO_READ_ONLY is set. */
  write?: boolean;
  destructive?: boolean;
  handler: (args: z.infer<z.ZodObject<S>>) => Promise<unknown>;
}

/** Register a tool with uniform error handling, annotations, and read-only gating. */
export function defineTool<S extends z.ZodRawShape>(ctx: Ctx, name: string, def: ToolDef<S>) {
  if (def.write && ctx.client.readOnly) return;
  ctx.server.registerTool(
    name,
    {
      title: def.title,
      description: def.description,
      inputSchema: def.inputSchema,
      annotations: {
        readOnlyHint: !def.write,
        destructiveHint: def.destructive ?? false,
        openWorldHint: true,
      },
    },
    (async (args: z.infer<z.ZodObject<S>>) => {
      try {
        return ok(await def.handler(args));
      } catch (e) {
        return fail(e);
      }
    }) as never,
  );
}

export const repoPath = (o: string, r: string) => `/repos/${encodeURIComponent(o)}/${encodeURIComponent(r)}`;
