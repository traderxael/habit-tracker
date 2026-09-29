import { describe, expect, it } from "vitest";
import request from "supertest";
import { app, createCtx } from "./helpers.js";

describe("health", () => {
  it("devuelve ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("register devuelve token", async () => {
    const ctx = await createCtx();
    expect(ctx.token.length).toBeGreaterThan(10);
    expect(ctx.auth.startsWith("Bearer ")).toBe(true);
  });
});
