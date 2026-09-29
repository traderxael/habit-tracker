import "./helpers.js";
import { createCtx } from "./helpers.js";
import { describe, expect, it } from "vitest";
import { db } from "../db.js";

async function tableExists(name: string): Promise<boolean> {
  return !!(await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const cols = (await db.prepare(`PRAGMA table_info(${table})`).all()) as { name: string }[];
  return cols.some((c) => c.name === column);
}

describe("schema finanzas", () => {
  it("crea las tablas nuevas", async () => {
    for (const t of ["categories", "transactions", "debts", "goals", "goal_contributions"]) {
      expect(await tableExists(t)).toBe(true);
    }
  });

  it("habits gana goal_id y goal_amount_cents", async () => {
    expect(await columnExists("habits", "goal_id")).toBe(true);
    expect(await columnExists("habits", "goal_amount_cents")).toBe(true);
  });

  it("amount_cents no acepta valores <= 0", async () => {
    await createCtx();
    const user = (await db.prepare("SELECT id FROM users ORDER BY id LIMIT 1").get()) as { id: number };
    expect(user.id).toBeGreaterThan(0);
    await expect(
      db
        .prepare("INSERT INTO transactions (user_id, type, amount_cents, date) VALUES (?, 'expense', 0, '2026-09-01')")
        .run(user.id),
    ).rejects.toThrow(/CHECK/i);
  });
});
