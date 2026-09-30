import "./helpers.js";
import { describe, expect, it } from "vitest";
import { initSchema, db } from "../db.js";

// Regresión crítica para el despliegue: tanto `npm run db:init` como el
// auto-init en el primer arranque en frío de la función de Vercel ejecutan
// initSchema(). Debe ser idempotente (CREATE IF NOT EXISTS + ALTER tolerado a
// "duplicate column name"); si dejara de serlo, la app queda bricked en prod.
describe("initSchema idempotencia (deploy-critical)", () => {
  async function tableCount(): Promise<number> {
    const row = (await db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'").get()) as {
      n: number;
    };
    return Number(row.n);
  }

  it("re-ejecutar initSchema no lanza y no duplica tablas", async () => {
    const before = await tableCount();
    await initSchema();
    await initSchema();
    const after = await tableCount();
    expect(after).toBe(before);
    expect(after).toBeGreaterThanOrEqual(8);
  });

  it("los ALTER duplicados se toleran (no relanzan)", async () => {
    await expect(initSchema()).resolves.toBeUndefined();
  });
});
