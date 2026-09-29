import { describe, expect, it } from "vitest";
import request from "supertest";
import { createCtx } from "./helpers.js";

describe("habit-goal link", () => {
  it("marcar aporta a la meta y desmarcar revierte el aporte", async () => {
    const ctx = await createCtx();
    const goalRes = await request(ctx.app).post("/api/goals").set("Authorization", ctx.auth)
      .send({ name: "Ahorro", target_cents: 100000 });
    const goalId = goalRes.body.goal.id;

    const habitRes = await request(ctx.app).post("/api/habits").set("Authorization", ctx.auth)
      .send({ name: "Ahorrar diario", goal_id: goalId, goal_amount_cents: 2000 });
    expect(habitRes.status).toBe(201);
    const habitId = habitRes.body.habit.id;
    expect(habitRes.body.habit.goalId).toBe(goalId);
    expect(habitRes.body.habit.goalAmountCents).toBe(2000);

    const on = await request(ctx.app).post("/api/completions/toggle").set("Authorization", ctx.auth)
      .send({ habitId, date: "2026-09-20" });
    expect(on.body.completed).toBe(true);
    let goals = await request(ctx.app).get("/api/goals").set("Authorization", ctx.auth);
    expect(goals.body.goals[0].savedCents).toBe(2000);

    const off = await request(ctx.app).post("/api/completions/toggle").set("Authorization", ctx.auth)
      .send({ habitId, date: "2026-09-20" });
    expect(off.body.completed).toBe(false);
    goals = await request(ctx.app).get("/api/goals").set("Authorization", ctx.auth);
    expect(goals.body.goals[0].savedCents).toBe(0);
  });

  it("un hábito sin meta no genera aportes", async () => {
    const ctx = await createCtx();
    const habitRes = await request(ctx.app).post("/api/habits").set("Authorization", ctx.auth).send({ name: "Leer" });
    await request(ctx.app).post("/api/completions/toggle").set("Authorization", ctx.auth)
      .send({ habitId: habitRes.body.habit.id, date: "2026-09-20" });
    const goals = await request(ctx.app).get("/api/goals").set("Authorization", ctx.auth);
    expect(goals.body.goals).toHaveLength(0);
  });

  it("400 con goal_id de otro usuario", async () => {
    const a = await createCtx();
    const b = await createCtx();
    const goalA = await request(a.app).post("/api/goals").set("Authorization", a.auth)
      .send({ name: "Ajena", target_cents: 1000 });
    const res = await request(b.app).post("/api/habits").set("Authorization", b.auth)
      .send({ name: "Malo", goal_id: goalA.body.goal.id, goal_amount_cents: 100 });
    expect(res.status).toBe(400);
  });

  it("PUT actualiza el importe y permite desvincular", async () => {
    const ctx = await createCtx();
    const goalRes = await request(ctx.app).post("/api/goals").set("Authorization", ctx.auth)
      .send({ name: "A", target_cents: 1000 });
    const habitRes = await request(ctx.app).post("/api/habits").set("Authorization", ctx.auth)
      .send({ name: "H", goal_id: goalRes.body.goal.id, goal_amount_cents: 500 });
    const linked = await request(ctx.app).put(`/api/habits/${habitRes.body.habit.id}`)
      .set("Authorization", ctx.auth).send({ goal_amount_cents: 700 });
    expect(linked.body.habit.goalAmountCents).toBe(700);
    const unlinked = await request(ctx.app).put(`/api/habits/${habitRes.body.habit.id}`)
      .set("Authorization", ctx.auth).send({ goal_id: null, goal_amount_cents: null });
    expect(unlinked.body.habit.goalId).toBeNull();
    expect(unlinked.body.habit.goalAmountCents).toBeNull();
  });

  it("400 al actualizar goal_amount_cents a un valor inválido", async () => {
    const ctx = await createCtx();
    const goalRes = await request(ctx.app).post("/api/goals").set("Authorization", ctx.auth)
      .send({ name: "Meta", target_cents: 10000 });
    const habitRes = await request(ctx.app).post("/api/habits").set("Authorization", ctx.auth)
      .send({ name: "Hábito", goal_id: goalRes.body.goal.id, goal_amount_cents: 300 });
    expect(habitRes.status).toBe(201);
    const res = await request(ctx.app).put(`/api/habits/${habitRes.body.habit.id}`)
      .set("Authorization", ctx.auth).send({ goal_amount_cents: -100 });
    expect(res.status).toBe(400);
  });
});
