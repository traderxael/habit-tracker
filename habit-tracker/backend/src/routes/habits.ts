import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { habitStats, type Schedule } from "../lib/streaks.js";

export const habitsRouter = Router();
habitsRouter.use(requireAuth);

interface HabitRow {
  id: number;
  user_id: number;
  name: string;
  icon: string | null;
  color: string | null;
  schedule_json: string;
  archived: number;
  created_at: string;
}

function serialize(row: HabitRow) {
  let schedule: Schedule = { type: "daily" };
  try {
    schedule = JSON.parse(row.schedule_json || "{}") as Schedule;
  } catch {
    schedule = { type: "daily" };
  }
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    schedule,
    archived: !!row.archived,
    createdAt: row.created_at,
  };
}

// GET /api/habits?includeStats=1
habitsRouter.get("/", (req, res) => {
  const userId = req.userId!;
  const rows = db
    .prepare(
      "SELECT * FROM habits WHERE user_id = ? AND archived = 0 ORDER BY created_at ASC, id ASC",
    )
    .all(userId) as HabitRow[];
  const habits = rows.map(serialize);
  if (req.query.includeStats === "1") {
    res.json({ habits: habits.map((h) => ({ ...h, stats: habitStats(h.id, h.schedule) })) });
    return;
  }
  res.json({ habits });
});

// POST /api/habits
habitsRouter.post("/", (req, res) => {
  const userId = req.userId!;
  const { name, icon, color, schedule } = req.body ?? {};
  if (typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "El nombre es obligatorio" });
    return;
  }
  const info = db
    .prepare(
      "INSERT INTO habits (user_id, name, icon, color, schedule_json) VALUES (?, ?, ?, ?, ?)",
    )
    .run(
      userId,
      name.trim(),
      typeof icon === "string" ? icon : null,
      typeof color === "string" ? color : null,
      JSON.stringify(schedule ?? { type: "daily" }),
    );
  const row = db.prepare("SELECT * FROM habits WHERE id = ?").get(Number(info.lastInsertRowid)) as HabitRow;
  res.status(201).json({ habit: serialize(row) });
});

// PUT /api/habits/:id
habitsRouter.put("/:id", (req, res) => {
  const userId = req.userId!;
  const id = Number(req.params.id);
  const row = db
    .prepare("SELECT * FROM habits WHERE id = ? AND user_id = ?")
    .get(id, userId) as HabitRow | undefined;
  if (!row) {
    res.status(404).json({ error: "Hábito no encontrado" });
    return;
  }
  const { name, icon, color, schedule, archived } = req.body ?? {};
  db.prepare(
    `UPDATE habits SET
       name = COALESCE(?, name),
       icon = COALESCE(?, icon),
       color = COALESCE(?, color),
       schedule_json = COALESCE(?, schedule_json),
       archived = COALESCE(?, archived)
     WHERE id = ?`,
  ).run(
    typeof name === "string" && name.trim() ? name.trim() : null,
    icon !== undefined ? (typeof icon === "string" ? icon : null) : null,
    color !== undefined ? (typeof color === "string" ? color : null) : null,
    schedule !== undefined ? JSON.stringify(schedule) : null,
    archived !== undefined ? (archived ? 1 : 0) : null,
    id,
  );
  const updated = db.prepare("SELECT * FROM habits WHERE id = ?").get(id) as HabitRow;
  res.json({ habit: serialize(updated) });
});

// DELETE /api/habits/:id
habitsRouter.delete("/:id", (req, res) => {
  const userId = req.userId!;
  const id = Number(req.params.id);
  const info = db.prepare("DELETE FROM habits WHERE id = ? AND user_id = ?").run(id, userId);
  if (info.changes === 0) {
    res.status(404).json({ error: "Hábito no encontrado" });
    return;
  }
  res.status(204).end();
});
