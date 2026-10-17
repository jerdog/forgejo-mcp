export interface ForgejoConfig {
  /** Base URL of the instance, e.g. https://codeberg.org */
  url: string;
  token?: string;
  readOnly?: boolean;
  fetch?: typeof fetch;
}

export class ForgejoError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ForgejoError";
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

export interface RequestOptions {
  query?: Query;
  body?: unknown;
  /** Return raw text instead of parsing JSON (diffs, patches). */
  text?: boolean;
  accept?: string;
}

export class ForgejoClient {
  readonly baseUrl: string;
  readonly readOnly: boolean;
  private token?: string;
  private fetchImpl: typeof fetch;

  constructor(config: ForgejoConfig) {
    if (!config.url) throw new Error("FORGEJO_URL is required");
    this.baseUrl = config.url.replace(/\/+$/, "");
    this.token = config.token;
    this.readOnly = config.readOnly ?? false;
    this.fetchImpl = config.fetch ?? ((...a) => fetch(...a));
  }

  private buildUrl(path: string, query?: Query): string {
    const url = new URL(`${this.baseUrl}/api/v1${path}`);
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
    return url.toString();
  }

  async request<T = unknown>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = { Accept: opts.accept ?? "application/json" };
    if (this.token) headers.Authorization = `token ${this.token}`;
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";

    const res = await this.fetchImpl(this.buildUrl(path, opts.query), {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });

    if (!res.ok) {
      let detail = "";
      try {
        const raw = await res.text();
        try {
          detail = (JSON.parse(raw) as { message?: string }).message ?? raw;
        } catch {
          detail = raw;
        }
      } catch {
        /* ignore */
      }
      throw new ForgejoError(res.status, `Forgejo API ${method} ${path} failed: ${res.status} ${detail}`.trim());
    }
    if (res.status === 204) return undefined as T;
    if (opts.text) return (await res.text()) as T;
    const raw = await res.text();
    return (raw ? JSON.parse(raw) : undefined) as T;
  }

  get<T = unknown>(path: string, query?: Query) {
    return this.request<T>("GET", path, { query });
  }
  post<T = unknown>(path: string, body?: unknown, query?: Query) {
    return this.request<T>("POST", path, { body: body ?? {}, query });
  }
  put<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("PUT", path, { body: body ?? {} });
  }
  patch<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("PATCH", path, { body: body ?? {} });
  }
  delete<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("DELETE", path, { body });
  }
}

/** Encode a repo-relative file path while keeping `/` separators. */
export const encodePath = (p: string) => p.split("/").map(encodeURIComponent).join("/");

export const toBase64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
export const fromBase64 = (s: string) => Buffer.from(s, "base64").toString("utf8");
