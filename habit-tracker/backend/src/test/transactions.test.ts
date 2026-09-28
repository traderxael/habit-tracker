import { describe, expect, it } from "vitest";
import request from "supertest";
import { createCtx, type Ctx } from "./helpers.js";

async function firstCategoryId(ctx: Ctx, type: "income" | "expense"): Promise<number> {
  const res = await request(ctx.app).get("/api/categories").set("Authorization", ctx.auth);
  return res.body.categories.find((c: { type: string }) => c.type === type).id as number;
}

describe("transactions", () => {
  it("crea, filtra por mes, edita y borra", async () => {
    const ctx = await createCtx();
    const cat = await firstCategoryId(ctx, "expense");
    const created = await request(ctx.app)
      .post("/api/transactions")
      .set("Authorization", ctx.auth)
      .send({ type: "expense", amount_cents: 1234, date: "2026-09-15", category_id: cat, note: "Café" });
    expect(created.status).toBe(201);
    expect(created.body.transaction.amountCents).toBe(1234);
    expect(created.body.transaction.categoryName).toBeTruthy();

    const sep = await request(ctx.app).get("/api/transactions?month=2026-09").set("Authorization", ctx.auth);
    expect(sep.body.transactions).toHaveLength(1);
    const oct = await request(ctx.app).get("/api/transactions?month=2026-10").set("Authorization", ctx.auth);
    expect(oct.body.transactions).toHaveLength(0);

    const put = await request(ctx.app)
      .put(`/api/transactions/${created.body.transaction.id}`)
      .set("Authorization", ctx.auth)
      .send({ amount_cents: 2000 });
    expect(put.body.transaction.amountCents).toBe(2000);

    const del = await request(ctx.app)
      .delete(`/api/transactions/${created.body.transaction.id}`)
      .set("Authorization", ctx.auth);
    expect(del.status).toBe(204);
  });

  it("400 con importe o fecha inválidos", async () => {
    const ctx = await createCtx();
    const cat = await firstCategoryId(ctx, "expense");
    const r1 = await request(ctx.app).post("/api/transactions").set("Authorization", ctx.auth)
      .send({ type: "expense", amount_cents: 0, date: "2026-09-15", category_id: cat });
    expect(r1.status).toBe(400);
    const r2 = await request(ctx.app).post("/api/transactions").set("Authorization", ctx.auth)
      .send({ type: "expense", amount_cents: 100, date: "15/09/2026", category_id: cat });
    expect(r2.status).toBe(400);
  });

  it("400 si la categoría no es del usuario o no corresponde al tipo", async () => {
    const a = await createCtx();
    const b = await createCtx();
    const catA = await firstCategoryId(a, "expense");
    const r1 = await request(b.app).post("/api/transactions").set("Authorization", b.auth)
      .send({ type: "expense", amount_cents: 100, date: "2026-09-15", category_id: catA });
    expect(r1.status).toBe(400);
    const incomeCat = await firstCategoryId(a, "income");
    const r2 = await request(a.app).post("/api/transactions").set("Authorization", a.auth)
      .send({ type: "expense", amount_cents: 100, date: "2026-09-15", category_id: incomeCat });
    expect(r2.status).toBe(400);
  });

  it("409 al borrar una categoría con movimientos", async () => {
    const ctx = await createCtx();
    const cat = await firstCategoryId(ctx, "expense");
    await request(ctx.app).post("/api/transactions").set("Authorization", ctx.auth)
      .send({ type: "expense", amount_cents: 500, date: "2026-09-01", category_id: cat });
    const del = await request(ctx.app).delete(`/api/categories/${cat}`).set("Authorization", ctx.auth);
    expect(del.status).toBe(409);
  });

  it("400 al intentar cambiar el tipo en PUT y el tipo almacenado no cambia", async () => {
    const ctx = await createCtx();
    const cat = await firstCategoryId(ctx, "expense");
    const created = await request(ctx.app)
      .post("/api/transactions")
      .set("Authorization", ctx.auth)
      .send({ type: "expense", amount_cents: 900, date: "2026-09-10", category_id: cat });
    expect(created.status).toBe(201);
    const id = created.body.transaction.id;

    const put = await request(ctx.app)
      .put(`/api/transactions/${id}`)
      .set("Authorization", ctx.auth)
      .send({ type: "income" });
    expect(put.status).toBe(400);
    expect(put.body.error).toMatch(/tipo/i);

    const get = await request(ctx.app).get("/api/transactions?month=2026-09").set("Authorization", ctx.auth);
    const stored = get.body.transactions.find((t: { id: number }) => t.id === id);
    expect(stored.type).toBe("expense");
    expect(stored.amountCents).toBe(900);
  });

  it("PUT con el mismo tipo y cambios legítimos devuelve 200 y persiste", async () => {
    const ctx = await createCtx();
    const cat = await firstCategoryId(ctx, "expense");
    const created = await request(ctx.app)
      .post("/api/transactions")
      .set("Authorization", ctx.auth)
      .send({ type: "expense", amount_cents: 700, date: "2026-09-12", category_id: cat, note: "Original" });
    expect(created.status).toBe(201);
    const id = created.body.transaction.id;

    const put = await request(ctx.app)
      .put(`/api/transactions/${id}`)
      .set("Authorization", ctx.auth)
      .send({ type: "expense", amount_cents: 1500, note: "Actualizada", date: "2026-09-13" });
    expect(put.status).toBe(200);
    expect(put.body.transaction.type).toBe("expense");
    expect(put.body.transaction.amountCents).toBe(1500);
    expect(put.body.transaction.note).toBe("Actualizada");
    expect(put.body.transaction.date).toBe("2026-09-13");
  });
});
