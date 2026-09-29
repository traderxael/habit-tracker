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
  goal_id: number | null;
  goal_amount_cents: number | null;
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
    goalId: row.goal_id,
    goalAmountCents: row.goal_amount_cents,
    createdAt: row.created_at,
  };
}

function validGoalLink(userId: number, goalId: unknown, amountCents: unknown): string | null {
  if (amountCents !== undefined && amountCents !== null) {
    if (!Number.isInteger(amountCents) || (amountCents as number) <= 0) {
      return "goal_amount_cents debe ser un entero mayor que 0";
    }
  }
  if (goalId === undefined || goalId === null) return null;
  const gid = Number(goalId);
  if (!Number.isInteger(gid)) return "goal_id inválido";
  const goal = db.prepare("SELECT id FROM goals WHERE id = ? AND user_id = ?").get(gid, userId);
  if (!goal) return "Meta no encontrada";
  return null;
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
  const { goal_id, goal_amount_cents } = req.body ?? {};
  const goalError = validGoalLink(userId, goal_id, goal_amount_cents);
  if (goalError) {
    res.status(400).json({ error: goalError });
    return;
  }
  const info = db
    .prepare(
      "INSERT INTO habits (user_id, name, icon, color, schedule_json, goal_id, goal_amount_cents) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      userId,
      name.trim(),
      typeof icon === "string" ? icon : null,
      typeof color === "string" ? color : null,
      JSON.stringify(schedule ?? { type: "daily" }),
      goal_id !== undefined && goal_id !== null ? Number(goal_id) : null,
      goal_amount_cents !== undefined && goal_amount_cents !== null ? Number(goal_amount_cents) : null,
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
  const { goal_id, goal_amount_cents } = req.body ?? {};
  const goalError = validGoalLink(userId, goal_id, goal_amount_cents);
  if (goalError) {
    res.status(400).json({ error: goalError });
    return;
  }
  db.prepare(
    `UPDATE habits SET
       name = COALESCE(?, name),
       icon = COALESCE(?, icon),
       color = COALESCE(?, color),
       schedule_json = COALESCE(?, schedule_json),
       archived = COALESCE(?, archived),
       goal_id = CASE WHEN ? THEN ? ELSE goal_id END,
       goal_amount_cents = CASE WHEN ? THEN ? ELSE goal_amount_cents END
     WHERE id = ?`,
  ).run(
    typeof name === "string" && name.trim() ? name.trim() : null,
    icon !== undefined ? (typeof icon === "string" ? icon : null) : null,
    color !== undefined ? (typeof color === "string" ? color : null) : null,
    schedule !== undefined ? JSON.stringify(schedule) : null,
    archived !== undefined ? (archived ? 1 : 0) : null,
    goal_id !== undefined ? 1 : 0,
    goal_id !== undefined && goal_id !== null ? Number(goal_id) : null,
    goal_amount_cents !== undefined ? 1 : 0,
    goal_amount_cents !== undefined && goal_amount_cents !== null ? Number(goal_amount_cents) : null,
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
