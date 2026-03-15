import type { MiddlewareHandler } from "hono";

/**
 * Bearer token auth middleware.
 * Behind Tailscale this is a secondary layer; the token prevents
 * accidental access from other devices on the mesh.
 */
export function authMiddleware(token: string): MiddlewareHandler {
  return async (c, next) => {
    // Allow WebSocket upgrade requests to auth via query param
    const wsToken = new URL(c.req.url).searchParams.get("token");
    const authHeader = c.req.header("Authorization");

    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    const providedToken = bearerToken || wsToken;

    if (providedToken !== token) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    await next();
  };
}
