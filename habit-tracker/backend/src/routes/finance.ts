import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { MONTH_RE, monthRange } from "../lib/money.js";

export const financeRouter = Router();
financeRouter.use(requireAuth);

// GET /api/finance/summary?month=YYYY-MM
financeRouter.get("/summary", (req, res) => {
  const month = String(req.query.month ?? "");
  if (!MONTH_RE.test(month)) {
    res.status(400).json({ error: "Parámetro month obligatorio (YYYY-MM)" });
    return;
  }
  const { from, to } = monthRange(month);
  const totals = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'income' THEN amount_cents END), 0) AS income,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_cents END), 0) AS expense
       FROM transactions
       WHERE user_id = ? AND date >= ? AND date <= ?`,
    )
    .get(req.userId!, from, to) as { income: number; expense: number };
  const byCategory = db
    .prepare(
      `SELECT c.id AS categoryId, c.name AS name, c.icon AS icon, c.color AS color,
              SUM(t.amount_cents) AS total
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = ? AND t.date >= ? AND t.date <= ?
       GROUP BY c.id
       ORDER BY total DESC`,
    )
    .all(req.userId!, from, to) as {
    categoryId: number;
    name: string;
    icon: string | null;
    color: string | null;
    total: number;
  }[];
  res.json({
    income: totals.income,
    expense: totals.expense,
    balance: totals.income - totals.expense,
    byCategory,
  });
});
