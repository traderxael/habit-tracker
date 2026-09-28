import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { DATE_RE, MONTH_RE, monthRange, validAmountCents } from "../lib/money.js";

export const transactionsRouter = Router();
transactionsRouter.use(requireAuth);

interface TxRow {
  id: number;
  user_id: number;
  category_id: number | null;
  debt_id: number | null;
  type: "income" | "expense";
  amount_cents: number;
  note: string | null;
  date: string;
  created_at: string;
  cat_name: string | null;
  cat_icon: string | null;
  cat_color: string | null;
}

export function serializeTx(row: TxRow) {
  return {
    id: row.id,
    type: row.type,
    amountCents: row.amount_cents,
    note: row.note,
    date: row.date,
    categoryId: row.category_id,
    categoryName: row.cat_name,
    categoryIcon: row.cat_icon,
    categoryColor: row.cat_color,
    debtId: row.debt_id,
    createdAt: row.created_at,
  };
}

const SELECT_TX = `
  SELECT t.*, c.name AS cat_name, c.icon AS cat_icon, c.color AS cat_color
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id`;

interface ValidBody {
  type: "income" | "expense";
  amountCents: number;
  note: string | null;
  date: string;
  categoryId: number | null;
  debtId: number | null;
}

function validateBody(body: any, userId: number): ValidBody | string {
  const type = body.type;
  if (type !== "income" && type !== "expense") return "El tipo debe ser 'income' o 'expense'";
  if (!validAmountCents(body.amount_cents)) return "amount_cents debe ser un entero mayor que 0";
  if (typeof body.date !== "string" || !DATE_RE.test(body.date)) return "Fecha inválida (YYYY-MM-DD)";
  let note: string | null = null;
  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== "string" || body.note.length > 200) return "Nota demasiado larga (máx. 200 caracteres)";
    note = body.note;
  }
  let categoryId: number | null = null;
  if (body.category_id !== undefined && body.category_id !== null) {
    const cid = Number(body.category_id);
    const cat = db
      .prepare("SELECT id, type FROM categories WHERE id = ? AND user_id = ?")
      .get(cid, userId) as { id: number; type: string } | undefined;
    if (!cat) return "Categoría no encontrada";
    if (cat.type !== type) return "La categoría no corresponde al tipo de movimiento";
    categoryId = cid;
  }
  let debtId: number | null = null;
  if (body.debt_id !== undefined && body.debt_id !== null) {
    if (type !== "expense") return "Solo los gastos pueden vincularse a una deuda";
    const did = Number(body.debt_id);
    const debt = db.prepare("SELECT id FROM debts WHERE id = ? AND user_id = ?").get(did, userId);
    if (!debt) return "Deuda no encontrada";
    debtId = did;
  }
  return { type, amountCents: body.amount_cents, note, date: body.date, categoryId, debtId };
}

// GET /api/transactions?month=YYYY-MM
transactionsRouter.get("/", (req, res) => {
  const month = String(req.query.month ?? "");
  if (!MONTH_RE.test(month)) {
    res.status(400).json({ error: "Parámetro month obligatorio (YYYY-MM)" });
    return;
  }
  const { from, to } = monthRange(month);
  const rows = db
    .prepare(`${SELECT_TX} WHERE t.user_id = ? AND t.date >= ? AND t.date <= ? ORDER BY t.date DESC, t.id DESC`)
    .all(req.userId!, from, to) as TxRow[];
  res.json({ transactions: rows.map(serializeTx) });
});

// POST /api/transactions
transactionsRouter.post("/", (req, res) => {
  const v = validateBody(req.body ?? {}, req.userId!);
  if (typeof v === "string") {
    res.status(400).json({ error: v });
    return;
  }
  const info = db
    .prepare(
      "INSERT INTO transactions (user_id, category_id, debt_id, type, amount_cents, note, date) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(req.userId!, v.categoryId, v.debtId, v.type, v.amountCents, v.note, v.date);
  const row = db.prepare(`${SELECT_TX} WHERE t.id = ?`).get(Number(info.lastInsertRowid)) as TxRow;
  res.status(201).json({ transaction: serializeTx(row) });
});

// PUT /api/transactions/:id
transactionsRouter.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = db
    .prepare("SELECT type FROM transactions WHERE id = ? AND user_id = ?")
    .get(id, req.userId!) as { type: string } | undefined;
  if (!existing) {
    res.status(404).json({ error: "Movimiento no encontrado" });
    return;
  }
  const body = req.body ?? {};
  if (body.type !== undefined && body.type !== existing.type) {
    res.status(400).json({ error: "No se puede cambiar el tipo de un movimiento; elimínalo y crea uno nuevo" });
    return;
  }
  const type = body.type !== undefined ? body.type : existing.type;
  if (type !== "income" && type !== "expense") {
    res.status(400).json({ error: "El tipo debe ser 'income' o 'expense'" });
    return;
  }
  if (body.amount_cents !== undefined && !validAmountCents(body.amount_cents)) {
    res.status(400).json({ error: "amount_cents debe ser un entero mayor que 0" });
    return;
  }
  if (body.date !== undefined && (typeof body.date !== "string" || !DATE_RE.test(body.date))) {
    res.status(400).json({ error: "Fecha inválida (YYYY-MM-DD)" });
    return;
  }
  if (body.note !== undefined && body.note !== null && (typeof body.note !== "string" || body.note.length > 200)) {
    res.status(400).json({ error: "Nota demasiado larga (máx. 200 caracteres)" });
    return;
  }
  db.prepare(
    `UPDATE transactions SET
       type = ?,
       amount_cents = COALESCE(?, amount_cents),
       note = CASE WHEN ? THEN ? ELSE note END,
       date = COALESCE(?, date)
     WHERE id = ?`,
  ).run(
    type,
    body.amount_cents ?? null,
    body.note !== undefined ? 1 : 0,
    body.note === undefined || body.note === null ? null : String(body.note),
    body.date ?? null,
    id,
  );
  const row = db.prepare(`${SELECT_TX} WHERE t.id = ?`).get(id) as TxRow;
  res.json({ transaction: serializeTx(row) });
});

// DELETE /api/transactions/:id
transactionsRouter.delete("/:id", (req, res) => {
  const info = db
    .prepare("DELETE FROM transactions WHERE id = ? AND user_id = ?")
    .run(Number(req.params.id), req.userId!);
  if (info.changes === 0) {
    res.status(404).json({ error: "Movimiento no encontrado" });
    return;
  }
  res.status(204).end();
});
