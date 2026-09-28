import { describe, expect, it } from "vitest";
import request from "supertest";
import { createCtx } from "./helpers.js";

describe("debts", () => {
  it("crea deuda, registra pagos y calcula el saldo", async () => {
    const ctx = await createCtx();
    const created = await request(ctx.app).post("/api/debts").set("Authorization", ctx.auth)
      .send({ name: "Préstamo coche", total_cents: 500000, due_date: "2027-01-01" });
    expect(created.status).toBe(201);
    const id = created.body.debt.id;
    expect(created.body.debt.remainingCents).toBe(500000);

    const pay = await request(ctx.app).post(`/api/debts/${id}/payments`).set("Authorization", ctx.auth)
      .send({ amount_cents: 200000, date: "2026-09-10" });
    expect(pay.status).toBe(201);
    expect(pay.body.transactionId).toBeGreaterThan(0);

    const list = await request(ctx.app).get("/api/debts").set("Authorization", ctx.auth);
    const debt = list.body.debts.find((d: { id: number }) => d.id === id);
    expect(debt.paidCents).toBe(200000);
    expect(debt.remainingCents).toBe(300000);
  });

  it("400 si el pago excede el saldo pendiente", async () => {
    const ctx = await createCtx();
    const created = await request(ctx.app).post("/api/debts").set("Authorization", ctx.auth)
      .send({ name: "Tarjeta", total_cents: 10000 });
    const pay = await request(ctx.app).post(`/api/debts/${created.body.debt.id}/payments`)
      .set("Authorization", ctx.auth).send({ amount_cents: 10001, date: "2026-09-10" });
    expect(pay.status).toBe(400);
  });

  it("borrar la deuda elimina también sus pagos", async () => {
    const ctx = await createCtx();
    const created = await request(ctx.app).post("/api/debts").set("Authorization", ctx.auth)
      .send({ name: "Temporal", total_cents: 5000 });
    const id = created.body.debt.id;
    await request(ctx.app).post(`/api/debts/${id}/payments`).set("Authorization", ctx.auth)
      .send({ amount_cents: 1000, date: "2026-09-01" });
    const del = await request(ctx.app).delete(`/api/debts/${id}`).set("Authorization", ctx.auth);
    expect(del.status).toBe(204);
    const sep = await request(ctx.app).get("/api/transactions?month=2026-09").set("Authorization", ctx.auth);
    expect(sep.body.transactions.filter((t: { debtId: number | null }) => t.debtId === id)).toHaveLength(0);
  });

  it("400 con total inválido y 404 en deuda ajena", async () => {
    const ctx = await createCtx();
    const bad = await request(ctx.app).post("/api/debts").set("Authorization", ctx.auth).send({ name: "X", total_cents: 0 });
    expect(bad.status).toBe(400);

    const other = await createCtx();
    const created = await request(ctx.app).post("/api/debts").set("Authorization", ctx.auth).send({ name: "Mía", total_cents: 1000 });
    const res = await request(other.app).put(`/api/debts/${created.body.debt.id}`)
      .set("Authorization", other.auth).send({ name: "Hack" });
    expect(res.status).toBe(404);
  });
});
