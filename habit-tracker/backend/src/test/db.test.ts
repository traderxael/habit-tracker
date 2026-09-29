import "./helpers.js";
import { describe, expect, it } from "vitest";
import { db } from "../db.js";

describe("wrapper db libSQL", () => {
  it("get devuelve undefined si no hay fila", async () => {
    const row = await db.prepare("SELECT id FROM users WHERE email = ?").get("no-existe@x.com");
    expect(row).toBeUndefined();
  });

  it("all devuelve array", async () => {
    const rows = await db.prepare("SELECT id FROM users").all();
    expect(Array.isArray(rows)).toBe(true);
  });

  it("run devuelve changes y lastInsertRowid numéricos", async () => {
    const email = `wrap-${Date.now()}@example.com`;
    const info = await db.prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)").run(email, "hash");
    expect(typeof info.lastInsertRowid).toBe("number");
    expect(info.lastInsertRowid).toBeGreaterThan(0);
    expect(info.changes).toBe(1);
    const back = (await db.prepare("SELECT id FROM users WHERE email = ?").get(email)) as { id: number };
    expect(back.id).toBe(info.lastInsertRowid);
  });
});
