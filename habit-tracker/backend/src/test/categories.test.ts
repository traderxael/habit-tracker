import { describe, expect, it } from "vitest";
import request from "supertest";
import { createCtx, type Ctx } from "./helpers.js";

export async function firstCategoryId(ctx: Ctx, type: "income" | "expense"): Promise<number> {
  const res = await request(ctx.app).get("/api/categories").set("Authorization", ctx.auth);
  return res.body.categories.find((c: { type: string }) => c.type === type).id as number;
}

describe("categories", () => {
  it("siembra categorías por defecto al registrarse", async () => {
    const ctx = await createCtx();
    const res = await request(ctx.app).get("/api/categories").set("Authorization", ctx.auth);
    expect(res.status).toBe(200);
    expect(res.body.categories.length).toBeGreaterThanOrEqual(9);
    expect(res.body.categories.some((c: { type: string }) => c.type === "income")).toBe(true);
  });

  it("crea y borra una categoría propia", async () => {
    const ctx = await createCtx();
    const created = await request(ctx.app)
      .post("/api/categories")
      .set("Authorization", ctx.auth)
      .send({ name: "Mascotas", icon: "🐕", type: "expense", color: "#a16207" });
    expect(created.status).toBe(201);
    expect(created.body.category.icon).toBe("🐕");
    const del = await request(ctx.app)
      .delete(`/api/categories/${created.body.category.id}`)
      .set("Authorization", ctx.auth);
    expect(del.status).toBe(204);
  });

  it("400 con nombre vacío, tipo inválido o color inválido", async () => {
    const ctx = await createCtx();
    const r1 = await request(ctx.app).post("/api/categories").set("Authorization", ctx.auth).send({ name: "   ", type: "expense" });
    expect(r1.status).toBe(400);
    const r2 = await request(ctx.app).post("/api/categories").set("Authorization", ctx.auth).send({ name: "X", type: "otro" });
    expect(r2.status).toBe(400);
    const r3 = await request(ctx.app).post("/api/categories").set("Authorization", ctx.auth).send({ name: "X", type: "expense", color: "rojo" });
    expect(r3.status).toBe(400);
  });

  it("404 al borrar una categoría de otro usuario", async () => {
    const a = await createCtx();
    const b = await createCtx();
    const created = await request(a.app).post("/api/categories").set("Authorization", a.auth).send({ name: "Privada", type: "expense" });
    const del = await request(b.app)
      .delete(`/api/categories/${created.body.category.id}`)
      .set("Authorization", b.auth);
    expect(del.status).toBe(404);
  });
});
