import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createServer, parseBool } from "./server.js";

interface Env {
  FORGEJO_URL: string;
  FORGEJO_TOKEN?: string;
  FORGEJO_READ_ONLY?: string;
  /** If set, clients must send `Authorization: Bearer <MCP_AUTH_TOKEN>` unless they supply their own Forgejo token via X-Forgejo-Token. */
  MCP_AUTH_TOKEN?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/health") return new Response("ok");
    if (pathname !== "/mcp") return new Response("Not found", { status: 404 });

    // A caller may bring their own Forgejo token; otherwise the shared secret is used
    // and the endpoint itself must be protected by MCP_AUTH_TOKEN.
    const own = request.headers.get("X-Forgejo-Token") ?? undefined;
    if (!own && env.MCP_AUTH_TOKEN) {
      if (request.headers.get("Authorization") !== `Bearer ${env.MCP_AUTH_TOKEN}`) {
        return new Response("Unauthorized", { status: 401 });
      }
    }
    if (!own && !env.MCP_AUTH_TOKEN && env.FORGEJO_TOKEN) {
      return new Response("Refusing to expose the shared FORGEJO_TOKEN without MCP_AUTH_TOKEN set", { status: 500 });
    }

    const server = createServer({
      url: env.FORGEJO_URL,
      token: own ?? env.FORGEJO_TOKEN,
      readOnly: parseBool(env.FORGEJO_READ_ONLY),
    });
    // Stateless: fresh server + transport per request.
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    return transport.handleRequest(request);
  },
};
