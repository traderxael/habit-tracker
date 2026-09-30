import { Router } from "express";
import { db, batch } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { DATE_RE, isoDay, validAmountCents } from "../lib/money.js";

export const debtsRouter = Router();
debtsRouter.use(requireAuth);

interface DebtRow {
  id: number;
  user_id: number;
  name: string;
  total_cents: number;
  due_date: string | null;
  created_at: string;
  paid_cents: number;
}

export function serializeDebt(row: DebtRow) {
  const total = Number(row.total_cents);
  const paid = Number(row.paid_cents);
  return {
    id: row.id,
    name: row.name,
    totalCents: total,
    paidCents: paid,
    remainingCents: total - paid,
    dueDate: row.due_date,
    createdAt: row.created_at,
  };
}

const SELECT_DEBT = `
  SELECT d.*,
         COALESCE((SELECT SUM(t.amount_cents) FROM transactions t
                    WHERE t.debt_id = d.id AND t.type = 'expense'), 0) AS paid_cents
    FROM debts d`;

// GET /api/debts
debtsRouter.get("/", async (req, res) => {
  const rows = (await db
    .prepare(`${SELECT_DEBT} WHERE d.user_id = ? ORDER BY d.created_at ASC`)
    .all(req.userId!)) as DebtRow[];
  res.json({ debts: rows.map(serializeDebt) });
});

// POST /api/debts
debtsRouter.post("/", async (req, res) => {
  const { name, total_cents, due_date } = req.body ?? {};
  if (typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "El nombre es obligatorio" });
    return;
  }
  if (!validAmountCents(total_cents)) {
    res.status(400).json({ error: "total_cents debe ser un entero mayor que 0" });
    return;
  }
  if (due_date !== undefined && due_date !== null && (typeof due_date !== "string" || !DATE_RE.test(due_date))) {
    res.status(400).json({ error: "Fecha inválida (YYYY-MM-DD)" });
    return;
  }
  const info = await db
    .prepare("INSERT INTO debts (user_id, name, total_cents, due_date) VALUES (?, ?, ?, ?)")
    .run(req.userId!, name.trim(), total_cents, due_date ?? null);
  const row = (await db.prepare(`${SELECT_DEBT} WHERE d.id = ?`).get(info.lastInsertRowid)) as DebtRow;
  res.status(201).json({ debt: serializeDebt(row) });
});

// PUT /api/debts/:id
debtsRouter.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const existing = await db.prepare("SELECT id FROM debts WHERE id = ? AND user_id = ?").get(id, req.userId!);
  if (!existing) {
    res.status(404).json({ error: "Deuda no encontrada" });
    return;
  }
  const { name, total_cents, due_date } = req.body ?? {};
  if (total_cents !== undefined && !validAmountCents(total_cents)) {
    res.status(400).json({ error: "total_cents debe ser un entero mayor que 0" });
    return;
  }
  if (due_date !== undefined && due_date !== null && (typeof due_date !== "string" || !DATE_RE.test(due_date))) {
    res.status(400).json({ error: "Fecha inválida (YYYY-MM-DD)" });
    return;
  }
  await db.prepare(
    `UPDATE debts SET
       name = COALESCE(?, name),
       total_cents = COALESCE(?, total_cents),
       due_date = CASE WHEN ? THEN ? ELSE due_date END
     WHERE id = ?`,
  ).run(
    typeof name === "string" && name.trim() ? name.trim() : null,
    total_cents ?? null,
    due_date !== undefined ? 1 : 0,
    due_date ?? null,
    id,
  );
  const row = (await db.prepare(`${SELECT_DEBT} WHERE d.id = ?`).get(id)) as DebtRow;
  res.json({ debt: serializeDebt(row) });
});

// DELETE /api/debts/:id
debtsRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const owner = req.userId!;
  const existing = await db.prepare("SELECT id FROM debts WHERE id = ? AND user_id = ?").get(id, owner);
  if (!existing) {
    res.status(404).json({ error: "Deuda no encontrada" });
    return;
  }
  // Borrar los pagos ANTES que la deuda (lote atómico): el FK es ON DELETE SET
  // NULL y dejaría huérfanos los pagos si se borrara primero la deuda.
  await batch([
    { sql: "DELETE FROM transactions WHERE debt_id = ? AND user_id = ?", args: [id, owner] },
    { sql: "DELETE FROM debts WHERE id = ? AND user_id = ?", args: [id, owner] },
  ]);
  res.status(204).end();
});

// POST /api/debts/:id/payments
debtsRouter.post("/:id/payments", async (req, res) => {
  const id = Number(req.params.id);
  const debt = (await db
    .prepare(`${SELECT_DEBT} WHERE d.id = ? AND d.user_id = ?`)
    .get(id, req.userId!)) as DebtRow | undefined;
  if (!debt) {
    res.status(404).json({ error: "Deuda no encontrada" });
    return;
  }
  const { amount_cents, date, note } = req.body ?? {};
  if (!validAmountCents(amount_cents)) {
    res.status(400).json({ error: "amount_cents debe ser un entero mayor que 0" });
    return;
  }
  if (date !== undefined && (typeof date !== "string" || !DATE_RE.test(date))) {
    res.status(400).json({ error: "Fecha inválida (YYYY-MM-DD)" });
    return;
  }
  if (amount_cents > Number(debt.total_cents) - Number(debt.paid_cents)) {
    res.status(400).json({ error: "El pago excede el saldo pendiente" });
    return;
  }
  const info = await db
    .prepare(
      "INSERT INTO transactions (user_id, category_id, debt_id, type, amount_cents, note, date) VALUES (?, NULL, ?, 'expense', ?, ?, ?)",
    )
    .run(
      req.userId!,
      id,
      amount_cents,
      typeof note === "string" && note ? note : `Pago: ${debt.name}`,
      typeof date === "string" ? date : isoDay(new Date()),
    );
  const row = (await db.prepare(`${SELECT_DEBT} WHERE d.id = ?`).get(id)) as DebtRow;
  res.status(201).json({ debt: serializeDebt(row), transactionId: info.lastInsertRowid });
});
