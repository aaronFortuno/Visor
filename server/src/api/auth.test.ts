import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { authMiddleware } from "./auth.ts";

function createApp(token: string) {
  const app = new Hono();
  app.use("*", authMiddleware(token));
  app.get("/test", (c) => c.json({ ok: true }));
  return app;
}

describe("authMiddleware", () => {
  const TOKEN = "test-secret-token";

  it("allows valid bearer token", async () => {
    const app = createApp(TOKEN);
    const res = await app.request("/test", {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it("rejects invalid bearer token with 401", async () => {
    const app = createApp(TOKEN);
    const res = await app.request("/test", {
      headers: { Authorization: "Bearer wrong-token" },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("rejects request with no token with 401", async () => {
    const app = createApp(TOKEN);
    const res = await app.request("/test");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("allows valid token via query param", async () => {
    const app = createApp(TOKEN);
    const res = await app.request(`/test?token=${TOKEN}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it("rejects invalid query param token with 401", async () => {
    const app = createApp(TOKEN);
    const res = await app.request("/test?token=wrong-token");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("rejects malformed Authorization header", async () => {
    const app = createApp(TOKEN);
    const res = await app.request("/test", {
      headers: { Authorization: TOKEN }, // missing "Bearer " prefix
    });
    expect(res.status).toBe(401);
  });

  it("prefers bearer token over query param", async () => {
    const app = createApp(TOKEN);
    // Valid bearer, invalid query — should succeed (bearer takes priority)
    const res = await app.request(`/test?token=wrong`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    expect(res.status).toBe(200);
  });
});
