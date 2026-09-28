import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const completionsRouter = Router();
completionsRouter.use(requireAuth);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/completions?from=YYYY-MM-DD&to=YYYY-MM-DD
completionsRouter.get("/", (req, res) => {
  const userId = req.userId!;
  const from = String(req.query.from ?? "");
  const to = String(req.query.to ?? "");
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    res.status(400).json({ error: "Rango inválido: usa from y to con formato YYYY-MM-DD" });
    return;
  }
  const rows = db
    .prepare(
      `SELECT c.habit_id, c.date
         FROM completions c
         JOIN habits h ON h.id = c.habit_id
        WHERE h.user_id = ? AND c.date >= ? AND c.date <= ?
        ORDER BY c.date ASC`,
    )
    .all(userId, from, to) as { habit_id: number; date: string }[];
  res.json({ completions: rows });
});

// POST /api/completions/toggle { habitId, date }
completionsRouter.post("/toggle", (req, res) => {
  const userId = req.userId!;
  const { habitId, date } = req.body ?? {};
  const id = Number(habitId);
  if (!Number.isInteger(id) || typeof date !== "string" || !DATE_RE.test(date)) {
    res.status(400).json({ error: "habitId (número) y date (YYYY-MM-DD) son obligatorios" });
    return;
  }
  const habit = db
    .prepare("SELECT id FROM habits WHERE id = ? AND user_id = ?")
    .get(id, userId) as { id: number } | undefined;
  if (!habit) {
    res.status(404).json({ error: "Hábito no encontrado" });
    return;
  }
  const existing = db
    .prepare("SELECT id FROM completions WHERE habit_id = ? AND date = ?")
    .get(id, date) as { id: number } | undefined;
  if (existing) {
    db.prepare("DELETE FROM completions WHERE id = ?").run(existing.id);
    res.json({ completed: false, habitId: id, date });
    return;
  }
  db.prepare("INSERT INTO completions (habit_id, date) VALUES (?, ?)").run(id, date);
  res.json({ completed: true, habitId: id, date });
});
