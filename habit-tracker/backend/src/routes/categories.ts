import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

export const categoriesRouter = Router();
categoriesRouter.use(requireAuth);

interface CategoryRow {
  id: number;
  user_id: number;
  name: string;
  icon: string | null;
  type: "income" | "expense";
  color: string | null;
  created_at: string;
}

export function serializeCategory(row: CategoryRow) {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    type: row.type,
    color: row.color,
    createdAt: row.created_at,
  };
}

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

// GET /api/categories
categoriesRouter.get("/", (req, res) => {
  const rows = db
    .prepare("SELECT * FROM categories WHERE user_id = ? ORDER BY type ASC, name ASC")
    .all(req.userId!) as CategoryRow[];
  res.json({ categories: rows.map(serializeCategory) });
});

// POST /api/categories
categoriesRouter.post("/", (req, res) => {
  const { name, icon, type, color } = req.body ?? {};
  if (typeof name !== "string" || name.trim().length === 0) {
    res.status(400).json({ error: "El nombre es obligatorio" });
    return;
  }
  if (type !== "income" && type !== "expense") {
    res.status(400).json({ error: "El tipo debe ser 'income' o 'expense'" });
    return;
  }
  if (color !== undefined && color !== null && (typeof color !== "string" || !COLOR_RE.test(color))) {
    res.status(400).json({ error: "Color inválido (usa #rrggbb)" });
    return;
  }
  const info = db
    .prepare("INSERT INTO categories (user_id, name, icon, type, color) VALUES (?, ?, ?, ?, ?)")
    .run(
      req.userId!,
      name.trim(),
      typeof icon === "string" && icon ? icon : null,
      type,
      typeof color === "string" ? color : null,
    );
  const row = db
    .prepare("SELECT * FROM categories WHERE id = ?")
    .get(Number(info.lastInsertRowid)) as CategoryRow;
  res.status(201).json({ category: serializeCategory(row) });
});

// DELETE /api/categories/:id
categoriesRouter.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const row = db
    .prepare("SELECT id FROM categories WHERE id = ? AND user_id = ?")
    .get(id, req.userId!) as { id: number } | undefined;
  if (!row) {
    res.status(404).json({ error: "Categoría no encontrada" });
    return;
  }
  const used = db
    .prepare("SELECT COUNT(*) AS n FROM transactions WHERE category_id = ?")
    .get(id) as { n: number };
  if (used.n > 0) {
    res.status(409).json({ error: "La categoría tiene movimientos asociados y no puede borrarse" });
    return;
  }
  db.prepare("DELETE FROM categories WHERE id = ?").run(id);
  res.status(204).end();
});
