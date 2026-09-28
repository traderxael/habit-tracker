import { describe, expect, it } from "vitest";
import request from "supertest";
import { createCtx } from "./helpers.js";

describe("goals", () => {
  it("crea meta, aporta y calcula el progreso", async () => {
    const ctx = await createCtx();
    const created = await request(ctx.app).post("/api/goals").set("Authorization", ctx.auth)
      .send({ name: "Fondo de emergencia", icon: "🛟", target_cents: 100000, deadline: "2026-12-31" });
    expect(created.status).toBe(201);
    const id = created.body.goal.id;

    const c1 = await request(ctx.app).post(`/api/goals/${id}/contributions`).set("Authorization", ctx.auth)
      .send({ amount_cents: 25000, date: "2026-09-10" });
    expect(c1.status).toBe(201);
    expect(c1.body.contribution.date).toBe("2026-09-10");
    const c2 = await request(ctx.app).post(`/api/goals/${id}/contributions`).set("Authorization", ctx.auth)
      .send({ amount_cents: 5000 });
    expect(c2.status).toBe(201);

    const list = await request(ctx.app).get("/api/goals").set("Authorization", ctx.auth);
    expect(list.body.goals[0].savedCents).toBe(30000);

    const del = await request(ctx.app)
      .delete(`/api/goals/${id}/contributions/${c1.body.contribution.id}`)
      .set("Authorization", ctx.auth);
    expect(del.status).toBe(204);
    const list2 = await request(ctx.app).get("/api/goals").set("Authorization", ctx.auth);
    expect(list2.body.goals[0].savedCents).toBe(5000);
  });

  it("400 con objetivo o aporte inválidos", async () => {
    const ctx = await createCtx();
    const r1 = await request(ctx.app).post("/api/goals").set("Authorization", ctx.auth).send({ name: "X", target_cents: 0 });
    expect(r1.status).toBe(400);
    const ok = await request(ctx.app).post("/api/goals").set("Authorization", ctx.auth).send({ name: "X", target_cents: 1000 });
    const r2 = await request(ctx.app).post(`/api/goals/${ok.body.goal.id}/contributions`)
      .set("Authorization", ctx.auth).send({ amount_cents: -1 });
    expect(r2.status).toBe(400);
    const r3 = await request(ctx.app).post(`/api/goals/${ok.body.goal.id}/contributions`)
      .set("Authorization", ctx.auth).send({ amount_cents: 100, date: "10-09-2026" });
    expect(r3.status).toBe(400);
  });

  it("404 sobre metas de otro usuario", async () => {
    const a = await createCtx();
    const b = await createCtx();
    const created = await request(a.app).post("/api/goals").set("Authorization", a.auth).send({ name: "Mía", target_cents: 1000 });
    const res = await request(b.app).put(`/api/goals/${created.body.goal.id}`)
      .set("Authorization", b.auth).send({ name: "Hack" });
    expect(res.status).toBe(404);
  });
});
