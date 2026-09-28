import { describe, expect, it } from "vitest";
import request from "supertest";
import { createCtx } from "./helpers.js";

describe("finance summary", () => {
  it("suma ingresos, gastos y balance por mes y categoría", async () => {
    const ctx = await createCtx();
    const cats = await request(ctx.app).get("/api/categories").set("Authorization", ctx.auth);
    const food = cats.body.categories.find((c: { name: string }) => c.name === "Comida");
    const salary = cats.body.categories.find((c: { name: string }) => c.name === "Nómina");

    await request(ctx.app).post("/api/transactions").set("Authorization", ctx.auth)
      .send({ type: "income", amount_cents: 100000, date: "2026-09-01", category_id: salary.id });
    await request(ctx.app).post("/api/transactions").set("Authorization", ctx.auth)
      .send({ type: "expense", amount_cents: 30000, date: "2026-09-02", category_id: food.id });
    await request(ctx.app).post("/api/transactions").set("Authorization", ctx.auth)
      .send({ type: "expense", amount_cents: 5000, date: "2026-10-02", category_id: food.id });

    const res = await request(ctx.app).get("/api/finance/summary?month=2026-09").set("Authorization", ctx.auth);
    expect(res.status).toBe(200);
    expect(res.body.income).toBe(100000);
    expect(res.body.expense).toBe(30000);
    expect(res.body.balance).toBe(70000);
    const foodRow = res.body.byCategory.find((r: { name: string }) => r.name === "Comida");
    expect(foodRow.total).toBe(30000);
  });

  it("400 sin month válido", async () => {
    const ctx = await createCtx();
    const res = await request(ctx.app).get("/api/finance/summary").set("Authorization", ctx.auth);
    expect(res.status).toBe(400);
  });
});
