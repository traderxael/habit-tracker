import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, client } from "../db.js";
import { JWT_SECRET, TOKEN_TTL } from "../config.js";
import { requireAuth } from "../middleware/auth.js";
import { DEFAULT_CATEGORIES } from "../lib/money.js";

export const authRouter = Router();

async function seedCategories(userId: number): Promise<void> {
  const stmts = DEFAULT_CATEGORIES.map((c) => ({
    sql: "INSERT INTO categories (user_id, name, icon, type, color) VALUES (?, ?, ?, ?, ?)",
    args: [userId, c.name, c.icon, c.type, c.color],
  }));
  await client.batch(stmts, "write");
}

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  created_at: string;
}

function sign(user: { id: number; email: string }): string {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: TOKEN_TTL,
  } as jwt.SignOptions);
}

authRouter.post("/register", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email)) {
    res.status(400).json({ error: "Email inválido" });
    return;
  }
  if (typeof password !== "string" || password.length < 6) {
    res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    return;
  }
  const normalized = email.toLowerCase();
  const existing = await db.prepare("SELECT id FROM users WHERE email = ?").get(normalized);
  if (existing) {
    res.status(409).json({ error: "Ya existe una cuenta con ese email" });
    return;
  }
  const hash = bcrypt.hashSync(password, 10);
  const info = await db
    .prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)")
    .run(normalized, hash);
  const user = { id: info.lastInsertRowid, email: normalized };
  await seedCategories(user.id);
  res.status(201).json({ token: sign(user), user });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "Email y contraseña requeridos" });
    return;
  }
  const row = (await db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email.toLowerCase())) as UserRow | undefined;
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    res.status(401).json({ error: "Credenciales incorrectas" });
    return;
  }
  const user = { id: row.id, email: row.email };
  res.json({ token: sign(user), user });
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: { id: req.userId, email: req.userEmail } });
});
