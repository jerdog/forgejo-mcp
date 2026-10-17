import { z } from "zod";
import { Ctx, defineTool, page, limit } from "./helpers.js";

export function register(ctx: Ctx) {
  const { client } = ctx;

  defineTool(ctx, "get_me", {
    title: "Get authenticated user",
    description: "Get the user the configured token authenticates as. Call this first to verify the connection.",
    inputSchema: {},
    handler: () => client.get("/user"),
  });

  defineTool(ctx, "search_users", {
    title: "Search users",
    description: "Search users by name.",
    inputSchema: { query: z.string(), page, limit },
    handler: ({ query, page, limit }) => client.get("/users/search", { q: query, page, limit }),
  });

  defineTool(ctx, "list_organizations", {
    title: "List organizations",
    description: "List organizations the authenticated user belongs to.",
    inputSchema: { page, limit },
    handler: ({ page, limit }) => client.get("/user/orgs", { page, limit }),
  });
}
