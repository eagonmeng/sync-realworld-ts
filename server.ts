import "@std/dotenv/load";
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  API,
  concepts as _concepts,
  Sync as _Sync,
} from "./syncs/realworld.ts";
import { Logging } from "./engine/sync.ts";

// CORS middleware
function corsHeaders(): Headers {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return headers;
}

// Parse URL path and extract path parameters
function parsePathParams(
  path: string,
  pattern: string,
): Record<string, string> | null {
  const pathParts = path.split("/").filter((p) => p);
  const patternParts = pattern.split("/").filter((p) => p);

  if (pathParts.length !== patternParts.length) {
    return null;
  }

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":")) {
      const paramName = patternParts[i].substring(1);
      params[paramName] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }

  return params;
}

// Route patterns and their corresponding API paths
const routes = [
  { pattern: "/api/health", apiPath: "/api/health" },
  { pattern: "/api/tags", apiPath: "/api/tags" },
  { pattern: "/api/users", apiPath: "/api/users" },
  { pattern: "/api/users/login", apiPath: "/api/users/login" },
  { pattern: "/api/user", apiPath: "/api/user" },
  { pattern: "/api/profiles/:username", apiPath: "/api/profiles/:username" },
  {
    pattern: "/api/profiles/:username/follow",
    apiPath: "/api/profiles/:username/follow",
  },
  { pattern: "/api/articles", apiPath: "/api/articles" },
  { pattern: "/api/articles/feed", apiPath: "/api/articles/feed" },
  { pattern: "/api/articles/:slug", apiPath: "/api/articles/:slug" },
  {
    pattern: "/api/articles/:slug/comments",
    apiPath: "/api/articles/:slug/comments",
  },
  {
    pattern: "/api/articles/:slug/comments/:id",
    apiPath: "/api/articles/:slug/comments/:id",
  },
  {
    pattern: "/api/articles/:slug/favorite",
    apiPath: "/api/articles/:slug/favorite",
  },
];

// Find matching route
function findRoute(
  path: string,
): { apiPath: string; pathParams: Record<string, string> } | null {
  for (const route of routes) {
    const pathParams = parsePathParams(path, route.pattern);
    if (pathParams !== null) {
      return { apiPath: route.apiPath, pathParams };
    }
  }
  return null;
}

// Parse query string
function parseQuery(url: URL): Record<string, string> {
  const query: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) {
    query[key] = value;
  }
  return query;
}

function extractTokenFromHeaders(
  headers: Record<string, string>,
): string | null {
  const auth = headers["Authorization"] || headers["authorization"];
  if (auth && auth.startsWith("Token ")) return auth.substring(6);
  return null;
}

// Main request handler
async function handler(req: Request): Promise<Response> {
  const headers = corsHeaders();

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // Find matching route
    const route = findRoute(path);
    if (!route) {
      headers.set("Content-Type", "application/json");
      return new Response(
        JSON.stringify({ errors: { body: ["Not found"] } }),
        { status: 404, headers },
      );
    }

    // Parse request body
    let body: Record<string, unknown> = {};
    if (method !== "GET" && method !== "DELETE") {
      try {
        const text = await req.text();
        if (text) {
          body = JSON.parse(text);
        }
      } catch (_error) {
        headers.set("Content-Type", "application/json");
        return new Response(
          JSON.stringify({ errors: { body: ["Invalid JSON"] } }),
          { status: 400, headers },
        );
      }
    }

    // Extract headers
    const requestHeaders: Record<string, string> = {};
    for (const [key, value] of req.headers.entries()) {
      requestHeaders[key] = value;
    }

    // Create request ID
    const requestId = crypto.randomUUID();

    // Flattened parameters for API.request
    const query = parseQuery(url);
    const token = extractTokenFromHeaders(requestHeaders);
    const { slug, id, username } = route.pathParams;
    const parsedLimit = Number.parseInt(query.limit ?? "");
    const parsedOffset = Number.parseInt(query.offset ?? "");
    const limit = Number.isFinite(parsedLimit) ? parsedLimit : 0;
    const offset = Number.isFinite(parsedOffset) ? parsedOffset : 0;
    const tag = query.tag ?? "";
    const author = query.author ?? "";
    const favorited = query.favorited ?? "";

    // Body-derived convenience fields
    const article = (body.article as Record<string, unknown>) || {};
    const comment = (body.comment as Record<string, unknown>) || {};
    const user = (body.user as Record<string, unknown>) || {};

    // Derive high-level action for certain endpoints and flatten common body fields
    let action: string | undefined;
    let usernameFlat: unknown = undefined;
    let emailFlat: unknown = undefined;
    let passwordFlat: unknown = undefined;

    if (method === "POST" && route.apiPath === "/api/users") {
      action = "user_registration";
      usernameFlat = (user && (user as Record<string, unknown>).username) ??
        undefined;
      emailFlat = (user && (user as Record<string, unknown>).email) ??
        undefined;
      passwordFlat = (user && (user as Record<string, unknown>).password) ??
        undefined;
    } else if (method === "POST" && route.apiPath === "/api/users/login") {
      action = "user_login";
      emailFlat = (user && (user as Record<string, unknown>).email) ??
        undefined;
      passwordFlat = (user && (user as Record<string, unknown>).password) ??
        undefined;
    }

    await API.request({
      request: requestId,
      method,
      path: route.apiPath,
      // headers and full maps still included if needed
      headers: requestHeaders,
      // route params
      slug,
      id,
      username,
      // query convenience
      limit,
      offset,
      tag,
      author,
      favorited,
      // auth convenience
      token,
      // body convenience (original nested)
      article,
      comment,
      user,
      // convenience (flattened)
      ...(action ? { action } : {}),
      ...(usernameFlat !== undefined ? { username: usernameFlat } : {}),
      ...(emailFlat !== undefined ? { email: emailFlat } : {}),
      ...(passwordFlat !== undefined ? { password: passwordFlat } : {}),
      // update user convenience (PUT /api/user)
      ...(() => {
        if (method === "PUT" && route.apiPath === "/api/user") {
          const usr = (user as Record<string, unknown>) || {};
          const nu = usr.username as unknown;
          const ne = usr.email as unknown;
          const np = usr.password as unknown;
          const nb = usr.bio as unknown;
          const ni = usr.image as unknown;
          const out: Record<string, unknown> = {};
          if (nu !== undefined) out.newUsername = nu;
          if (ne !== undefined) out.newEmail = ne;
          if (np !== undefined) out.newPassword = np;
          if (nb !== undefined) out.newBio = nb;
          if (ni !== undefined) out.newImage = ni;
          return out;
        }
        return {};
      })(),
    });

    // Poll for response (in a real implementation, you might use websockets or server-sent events)
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds with 100ms intervals

    while (attempts < maxAttempts) {
      const responses = await API._get({ request: requestId });
      if (
        responses.length > 0 && (responses[0] as Record<string, unknown>).output
      ) {
        const responseObj = responses[0] as unknown as {
          output: { status?: number; body?: unknown };
        };
        const status = responseObj.output.status ?? 200;
        const responseBody = responseObj.output.body ?? {};

        headers.set("Content-Type", "application/json");
        return new Response(
          JSON.stringify(responseBody),
          { status, headers },
        );
      }

      // Wait 100ms before next attempt
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    // Timeout
    headers.set("Content-Type", "application/json");
    return new Response(
      JSON.stringify({ errors: { body: ["Request timeout"] } }),
      { status: 500, headers },
    );
  } catch (error) {
    console.error("Request handler error:", error);
    headers.set("Content-Type", "application/json");
    return new Response(
      JSON.stringify({ errors: { body: ["Internal server error"] } }),
      { status: 500, headers },
    );
  }
}

// Start server
const port = parseInt(Deno.env.get("PORT") || "3000");

console.log(`🚀 RealWorld API server starting on port ${port}`);
console.log(
  `📚 API documentation: https://realworld-docs.netlify.app/docs/specs/backend-specs/endpoints`,
);

// Enable TRACE logging for debugging
_Sync.logging = Logging.TRACE;

await serve(handler, { port });
