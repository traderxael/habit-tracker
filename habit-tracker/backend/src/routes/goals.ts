import { Router } from "express";
import { db, batch } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { DATE_RE, isoDay, validAmountCents } from "../lib/money.js";

export const goalsRouter = Router();
goalsRouter.use(requireAuth);

interface GoalRow {
  id: number;
  user_id: number;
  name: string;
  icon: string | null;
  target_cents: number;
  deadline: string | null;
  created_at: string;
  saved_cents: number;
}

interface ContributionRow {
  id: number;
  goal_id: number;
  amount_cents: number;
  habit_id: number | null;
  date: string;
  created_at: string;
}

export function serializeGoal(row: GoalRow) {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    targetCents: Number(row.target_cents),
    savedCents: Number(row.saved_cents),
    deadline: row.deadline,
    createdAt: row.created_at,
  };
}

function serializeContribution(row: ContributionRow) {
  return {
    id: row.id,
    goalId: row.goal_id,
    amountCents: Number(row.amount_cents),
    habitId: row.habit_id,
    date: row.date,
    createdAt: row.created_at,
  };
}

const SELECT_GOAL = `
  SELECT g.*,
         COALESCE((SELECT SUM(gc.amount_cents) FROM goal_contributions gc
                    WHERE gc.goal_id = g.id), 0) AS saved_cents
    FROM goals g`;

// GET /api/goals
goalsRouter.get("/", async (req, res) => {
  const rows = (await db
    .prepare(`${SELECT_GOAL} WHERE g.user_id = ? ORDER BY g.created_at ASC`)
    .all(req.userId!)) as GoalRow[];
  res.json({ goals: rows.map(serializeGoal) });
});

// POST /api/goals
goalsRouter.post("/", async (req, res) => {
  const { name, icon, target_cents, deadline } = req.body ?? {};
  if (typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "El nombre es obligatorio" });
    return;
  }
  if (!validAmountCents(target_cents)) {
    res.status(400).json({ error: "target_cents debe ser un entero mayor que 0" });
    return;
  }
  if (deadline !== undefined && deadline !== null && (typeof deadline !== "string" || !DATE_RE.test(deadline))) {
    res.status(400).json({ error: "Fecha inválida (YYYY-MM-DD)" });
    return;
  }
  const info = await db
    .prepare("INSERT INTO goals (user_id, name, icon, target_cents, deadline) VALUES (?, ?, ?, ?, ?)")
    .run(
      req.userId!,
      name.trim(),
      typeof icon === "string" && icon ? icon : null,
      target_cents,
      deadline ?? null,
    );
  const row = (await db.prepare(`${SELECT_GOAL} WHERE g.id = ?`).get(info.lastInsertRowid)) as GoalRow;
  res.status(201).json({ goal: serializeGoal(row) });
});

// PUT /api/goals/:id
goalsRouter.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const existing = await db.prepare("SELECT id FROM goals WHERE id = ? AND user_id = ?").get(id, req.userId!);
  if (!existing) {
    res.status(404).json({ error: "Meta no encontrada" });
    return;
  }
  const { name, icon, target_cents, deadline } = req.body ?? {};
  if (target_cents !== undefined && !validAmountCents(target_cents)) {
    res.status(400).json({ error: "target_cents debe ser un entero mayor que 0" });
    return;
  }
  if (deadline !== undefined && deadline !== null && (typeof deadline !== "string" || !DATE_RE.test(deadline))) {
    res.status(400).json({ error: "Fecha inválida (YYYY-MM-DD)" });
    return;
  }
  await db.prepare(
    `UPDATE goals SET
       name = COALESCE(?, name),
       icon = CASE WHEN ? THEN ? ELSE icon END,
       target_cents = COALESCE(?, target_cents),
       deadline = CASE WHEN ? THEN ? ELSE deadline END
     WHERE id = ?`,
  ).run(
    typeof name === "string" && name.trim() ? name.trim() : null,
    icon !== undefined ? 1 : 0,
    typeof icon === "string" && icon ? icon : null,
    target_cents ?? null,
    deadline !== undefined ? 1 : 0,
    deadline ?? null,
    id,
  );
  const row = (await db.prepare(`${SELECT_GOAL} WHERE g.id = ?`).get(id)) as GoalRow;
  res.json({ goal: serializeGoal(row) });
});

// DELETE /api/goals/:id
goalsRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const owner = req.userId!;
  const existing = await db.prepare("SELECT id FROM goals WHERE id = ? AND user_id = ?").get(id, owner);
  if (!existing) {
    res.status(404).json({ error: "Meta no encontrada" });
    return;
  }
  // Cascada garantizada en código (lote atómico), sin depender del enforcement de
  // FK de Turso: borrar aportes, desvincular hábitos y borrar la meta.
  await batch([
    { sql: "DELETE FROM goal_contributions WHERE goal_id = ?", args: [id] },
    {
      sql: "UPDATE habits SET goal_id = NULL, goal_amount_cents = NULL WHERE goal_id = ? AND user_id = ?",
      args: [id, owner],
    },
    { sql: "DELETE FROM goals WHERE id = ? AND user_id = ?", args: [id, owner] },
  ]);
  res.status(204).end();
});

// GET /api/goals/:id/contributions
goalsRouter.get("/:id/contributions", async (req, res) => {
  const id = Number(req.params.id);
  const goal = await db.prepare("SELECT id FROM goals WHERE id = ? AND user_id = ?").get(id, req.userId!);
  if (!goal) {
    res.status(404).json({ error: "Meta no encontrada" });
    return;
  }
  const rows = (await db
    .prepare("SELECT * FROM goal_contributions WHERE goal_id = ? AND user_id = ? ORDER BY date DESC, id DESC")
    .all(id, req.userId!)) as ContributionRow[];
  res.json({ contributions: rows.map(serializeContribution) });
});

// POST /api/goals/:id/contributions
goalsRouter.post("/:id/contributions", async (req, res) => {
  const id = Number(req.params.id);
  const goalRow = (await db
    .prepare("SELECT id FROM goals WHERE id = ? AND user_id = ?")
    .get(id, req.userId!)) as { id: number } | undefined;
  if (!goalRow) {
    res.status(404).json({ error: "Meta no encontrada" });
    return;
  }
  const { amount_cents, date } = req.body ?? {};
  if (!validAmountCents(amount_cents)) {
    res.status(400).json({ error: "amount_cents debe ser un entero mayor que 0" });
    return;
  }
  if (date !== undefined && (typeof date !== "string" || !DATE_RE.test(date))) {
    res.status(400).json({ error: "Fecha inválida (YYYY-MM-DD)" });
    return;
  }
  const info = await db
    .prepare("INSERT INTO goal_contributions (user_id, goal_id, amount_cents, date) VALUES (?, ?, ?, ?)")
    .run(req.userId!, id, amount_cents, typeof date === "string" ? date : isoDay(new Date()));
  const row = (await db
    .prepare("SELECT * FROM goal_contributions WHERE id = ?")
    .get(info.lastInsertRowid)) as ContributionRow;
  res.status(201).json({ contribution: serializeContribution(row) });
});

// DELETE /api/goals/:id/contributions/:cid
goalsRouter.delete("/:id/contributions/:cid", async (req, res) => {
  const info = await db
    .prepare("DELETE FROM goal_contributions WHERE id = ? AND goal_id = ? AND user_id = ?")
    .run(Number(req.params.cid), Number(req.params.id), req.userId!);
  if (info.changes === 0) {
    res.status(404).json({ error: "Aporte no encontrado" });
    return;
  }
  res.status(204).end();
});
