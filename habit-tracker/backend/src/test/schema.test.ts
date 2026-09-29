import "./helpers.js";
import { createCtx } from "./helpers.js";
import { describe, expect, it } from "vitest";
import { db } from "../db.js";

function tableExists(name: string): boolean {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
}

function columnExists(table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return cols.some((c) => c.name === column);
}

describe("schema finanzas", () => {
  it("crea las tablas nuevas", () => {
    for (const t of ["categories", "transactions", "debts", "goals", "goal_contributions"]) {
      expect(tableExists(t)).toBe(true);
    }
  });

  it("habits gana goal_id y goal_amount_cents", () => {
    expect(columnExists("habits", "goal_id")).toBe(true);
    expect(columnExists("habits", "goal_amount_cents")).toBe(true);
  });

  it("amount_cents no acepta valores <= 0", async () => {
    await createCtx();
    const user = db.prepare("SELECT id FROM users ORDER BY id LIMIT 1").get() as { id: number };
    expect(user.id).toBeGreaterThan(0);
    expect(() =>
      db
        .prepare("INSERT INTO transactions (user_id, type, amount_cents, date) VALUES (?, 'expense', 0, '2026-09-01')")
        .run(user.id),
    ).toThrow(/CHECK/i);
  });
});
