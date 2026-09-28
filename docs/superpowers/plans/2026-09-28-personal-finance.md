# Personal Finance Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a personal-finance module (income/expenses with categories, debts, savings goals, month summary on Today, habit↔goal auto-contributions) to the existing habit-tracker app.

**Architecture:** Extend the current monolith (approach A from the spec): new tables in the same better-sqlite3 database, new Express routers mounted beside `habits`/`completions`, new React pages/tabs reusing the existing design-token system. All money amounts are integer cents. Single currency: peso, formatted with `Intl.NumberFormat("es-MX", { currency: "MXN" })` → `$1,234.56`.

**Tech Stack:** Node + Express 4 + TypeScript (ESM, `.js` import extensions), better-sqlite3, vitest + supertest (new, backend), React 18 + Vite 5 + TS, vitest (new, frontend unit tests for pure helpers).

**Spec:** `docs/superpowers/specs/2026-09-28-personal-finance-design.md`

## Global Constraints

- All monetary values are **integer cents** (`amount_cents`, `total_cents`, `target_cents`, `goal_amount_cents`). Never floats.
- Dates are `YYYY-MM-DD` strings; months are `YYYY-MM`. Validate with `/^\d{4}-\d{2}(-\d{2})?$/`.
- Every new table has `user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE`; every route enforces ownership (`AND user_id = ?`) — same pattern as `routes/habits.ts`.
- All routes live behind `requireAuth` (`router.use(requireAuth)`), errors are `res.status(NNN).json({ error: "<mensaje en español>" })`.
- UI copy is Spanish. No raw hex/rgb in CSS or JSX — only `var(--token)` from `styles.css` `:root` (see `DESIGN.md` Do's and Don'ts). Dynamic widths via inline `style` are allowed for progress bars only.
- Frontend files ≤ 200 lines where practical; reuse `EmptyState`, `IconPicker`, `stat-card`, `progress`, `bar`, `btn-primary`, `btn-ghost`, `btn-link`, `form card`, `row` classes.
- Backend is ESM: relative imports MUST end in `.js` (e.g. `../lib/money.js`).
- Existing DB file must keep working: schema changes are `CREATE TABLE IF NOT EXISTS` + idempotent `ALTER TABLE ... ADD COLUMN` wrapped in try/catch.
- Commit after every task with the message given. Use `git -c user.name="traderxael" -c user.email="traderxael@users.noreply.github.com" commit` (no persistent git config exists).
- Typecheck gates: `npm run typecheck` in `habit-tracker/backend` and `habit-tracker/frontend` must pass at the end of every task that touches that package.
- Reference facts verified from the current code: `db` is exported from `backend/src/db.ts`; routers do `router.use(requireAuth)` and read `req.userId!`; `styles.css` `:root` defines `--danger: #e11d48`, `--success: #16a34a`, `--primary-soft`, `--pill`, `--r-sm/md/lg/xl`, `--grad-bar`; existing classes include `.stats-row`, `.stat-card` (children `.stat-name`, `.stat-nums`), `.progress > span`, `.bar > span`, `.form label`, `.form .row`, `.field-block`, `.field-label`, `.card`, `.muted`, `.error`, `.btn-primary/.btn-ghost/.btn-link`; `Calendar.tsx` uses `.stat-card > .stat-name + .stat-nums`; `api/client.ts` exports `api.get/post/put/del` and `ApiError`; `App.tsx` wraps protected routes in `<Protected>`.

---

### Task 1: Test harness + app/listen split (backend)

**Files:**
- Modify: `habit-tracker/backend/package.json` (add devDeps + test script)
- Modify: `habit-tracker/backend/src/index.ts` (reduce to listen only)
- Create: `habit-tracker/backend/src/app.ts`
- Create: `habit-tracker/backend/src/test/helpers.ts`
- Test: `habit-tracker/backend/src/test/health.test.ts`

**Interfaces:**
- Consumes: existing routers `authRouter`, `habitsRouter`, `completionsRouter`.
- Produces: `createApp(): express.Express`; `app: express.Express`; `createCtx(): Promise<{ app, token, auth }>` where `auth` is the full `Bearer <token>` header value. Used by every later test.

- [ ] **Step 1: Install test deps**

Run in `habit-tracker/backend`:
```bash
npm i -D vitest supertest @types/supertest
```
Add to `package.json` `"scripts"`: `"test": "vitest run"`.

- [ ] **Step 2: Split app from listen**

Replace the whole content of `src/index.ts` with:

```ts
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3001);
createApp().listen(port, () => {
  console.log(`Backend escuchando en http://localhost:${port} (${process.env.NODE_ENV ?? "development"})`);
});
```

Create `src/app.ts` (the old `index.ts` body wrapped in a factory; only the three existing routers for now):

```ts
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./db.js";
import { authRouter } from "./routes/auth.js";
import { habitsRouter } from "./routes/habits.js";
import { completionsRouter } from "./routes/completions.js";

export function createApp(): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    const row = db
      .prepare("SELECT COUNT(*) AS tables FROM sqlite_master WHERE type = 'table'")
      .get() as { tables: number };
    res.json({ status: "ok", tables: row.tables });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/habits", habitsRouter);
  app.use("/api/completions", completionsRouter);

  // 404 en JSON para cualquier ruta /api no definida.
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Recurso no encontrado" });
  });

  // En producción, servir el frontend compilado y hacer fallback de SPA.
  const here = path.dirname(fileURLToPath(import.meta.url));
  if (process.env.NODE_ENV === "production") {
    const clientDir = path.join(here, "..", "..", "frontend", "dist");
    app.use(express.static(clientDir));
    app.use((req, res, next) => {
      if (req.method === "GET" && !req.path.startsWith("/api")) {
        res.sendFile(path.join(clientDir, "index.html"));
        return;
      }
      next();
    });
  }

  // Manejador global de errores.
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    if (res.headersSent) return;
    res.status(500).json({ error: "Error interno del servidor" });
  });

  return app;
}
```

Create `src/test/helpers.ts` — sets `DB_PATH` to a temp file BEFORE importing `app.js`, boots one ephemeral server, and registers a user per call:

```ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";

process.env.DB_PATH = path.join(mkdtempSync(path.join(tmpdir(), "ht-test-")), "test.sqlite");
process.env.NODE_ENV = "test";

const { createApp } = await import("../app.js");

export const app = createApp();

const server = app.listen(0);
await new Promise<void>((resolve) => server.once("listening", () => resolve()));
server.unref();
const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

export interface Ctx {
  app: ReturnType<typeof createApp>;
  token: string;
  auth: string;
}

let seq = 0;

export async function createCtx(): Promise<Ctx> {
  const email = `t${Date.now()}_${seq++}@example.com`;
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "secret123" }),
  });
  if (!res.ok) throw new Error(`register falló: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { token: string };
  return { app, token: data.token, auth: `Bearer ${data.token}` };
}
```

- [ ] **Step 3: Write the smoke test**

Create `src/test/health.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import request from "supertest";
import { app, createCtx } from "./helpers.js";

describe("health", () => {
  it("devuelve ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("register devuelve token", async () => {
    const ctx = await createCtx();
    expect(ctx.token.length).toBeGreaterThan(10);
    expect(ctx.auth.startsWith("Bearer ")).toBe(true);
  });
});
```

- [ ] **Step 4: Run tests + typecheck**

Run in `habit-tracker/backend`: `npm test` → both tests PASS. `npm run typecheck` → clean. `npm run dev` still boots (Ctrl+C after the log line).

- [ ] **Step 5: Commit**

```bash
git add habit-tracker/backend
git -c user.name="traderxael" -c user.email="traderxael@users.noreply.github.com" commit -m "test: backend test harness with vitest+supertest, split app from listen"
```

---

### Task 2: Shared money lib + finance schema + habit goal columns

**Files:**
- Create: `habit-tracker/backend/src/lib/money.ts`
- Modify: `habit-tracker/backend/src/db.ts` (append after the existing `db.exec`)
- Modify: `habit-tracker/backend/src/routes/auth.ts` (seed categories on register)
- Test: `habit-tracker/backend/src/test/money.test.ts`, `habit-tracker/backend/src/test/schema.test.ts`

**Interfaces:**
- Consumes: `db` from `../db.js`.
- Produces (used by Tasks 3–7): from `lib/money.js` — `DATE_RE`, `MONTH_RE`, `validAmountCents(v: unknown): v is number`, `isoDay(d: Date): string`, `monthRange(month: string): { from: string; to: string }`, `DEFAULT_CATEGORIES: DefaultCategory[]`, `DefaultCategory { name; icon; type: "income"|"expense"; color }`. New tables `categories`, `transactions`, `debts`, `goals`, `goal_contributions`; new columns `habits.goal_id`, `habits.goal_amount_cents`. `seedCategories(userId: number): void` exported from `routes/auth.js` is NOT required by other tasks (it is internal to auth).

- [ ] **Step 1: Write failing tests**

Create `src/test/money.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES, isoDay, monthRange, validAmountCents } from "../lib/money.js";

describe("money lib", () => {
  it("validAmountCents acepta solo enteros positivos", () => {
    expect(validAmountCents(100)).toBe(true);
    expect(validAmountCents(0)).toBe(false);
    expect(validAmountCents(-5)).toBe(false);
    expect(validAmountCents(1.5)).toBe(false);
    expect(validAmountCents("100")).toBe(false);
  });

  it("isoDay devuelve YYYY-MM-DD en hora local", () => {
    expect(isoDay(new Date(2026, 8, 28))).toBe("2026-09-28");
    expect(isoDay(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("monthRange expande el mes incluyendo bisiestos", () => {
    expect(monthRange("2026-09")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(monthRange("2024-02")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
    expect(monthRange("2026-12")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });

  it("DEFAULT_CATEGORIES cubre ingresos y gastos con color hex", () => {
    expect(DEFAULT_CATEGORIES.some((c) => c.type === "income")).toBe(true);
    expect(DEFAULT_CATEGORIES.some((c) => c.type === "expense")).toBe(true);
    for (const c of DEFAULT_CATEGORIES) expect(/^#[0-9a-f]{6}$/i.test(c.color)).toBe(true);
  });
});
```

Create `src/test/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { db } from "../db.js";

function tableExists(name: string): boolean {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
}

function columnExists(table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return cols.some((c) => c.name === column);
}

describe("schema finanzas", () => {
  it("crea las tablas nuevas", () => {
    for (const t of ["categories", "transactions", "debts", "goals", "goal_contributions"]) {
      expect(tableExists(t)).toBe(true);
    }
  });

  it("habits gana goal_id y goal_amount_cents", () => {
    expect(columnExists("habits", "goal_id")).toBe(true);
    expect(columnExists("habits", "goal_amount_cents")).toBe(true);
  });

  it("amount_cents no acepta valores <= 0", () => {
    expect(() =>
      db
        .prepare("INSERT INTO transactions (user_id, type, amount_cents, date) VALUES (1, 'expense', 0, '2026-09-01')")
        .run(),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test` → FAIL (`Cannot find module '../lib/money.js'`, `no such table: categories`).

- [ ] **Step 3: Implement money lib**

Create `src/lib/money.ts`:

```ts
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MONTH_RE = /^\d{4}-\d{2}$/;

export function validAmountCents(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v > 0;
}

export function isoDay(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export interface DefaultCategory {
  name: string;
  icon: string;
  type: "income" | "expense";
  color: string;
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: "Comida", icon: "🍔", type: "expense", color: "#f97316" },
  { name: "Transporte", icon: "🚌", type: "expense", color: "#0ea5e9" },
  { name: "Hogar", icon: "🏠", type: "expense", color: "#8b5cf6" },
  { name: "Salud", icon: "💊", type: "expense", color: "#ef4444" },
  { name: "Ocio", icon: "🎮", type: "expense", color: "#ec4899" },
  { name: "Otros", icon: "📦", type: "expense", color: "#64748b" },
  { name: "Nómina", icon: "💼", type: "income", color: "#22c55e" },
  { name: "Freelance", icon: "💻", type: "income", color: "#14b8a6" },
  { name: "Inversiones", icon: "📈", type: "income", color: "#eab308" },
];
```

- [ ] **Step 4: Extend schema in `src/db.ts`**

Append after the existing `db.exec(\`...\`)` call (keep it intact):

```ts
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    color TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS debts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    total_cents INTEGER NOT NULL CHECK (total_cents > 0),
    due_date TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    debt_id INTEGER REFERENCES debts(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    note TEXT,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT,
    target_cents INTEGER NOT NULL CHECK (target_cents > 0),
    deadline TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS goal_contributions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    habit_id INTEGER REFERENCES habits(id) ON DELETE SET NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    date TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migración idempotente: vínculo hábito↔meta.
for (const ddl of [
  "ALTER TABLE habits ADD COLUMN goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL",
  "ALTER TABLE habits ADD COLUMN goal_amount_cents INTEGER",
]) {
  try {
    db.exec(ddl);
  } catch {
    // La columna ya existe: no hacer nada.
  }
}
```

Note `debts` is created BEFORE `transactions` because `transactions.debt_id` references it.

- [ ] **Step 5: Seed default categories on register**

In `src/routes/auth.ts` add the import and helper above `authRouter.post("/register", ...)`:

```ts
import { DEFAULT_CATEGORIES } from "../lib/money.js";

function seedCategories(userId: number): void {
  const insert = db.prepare(
    "INSERT INTO categories (user_id, name, icon, type, color) VALUES (?, ?, ?, ?, ?)",
  );
  for (const c of DEFAULT_CATEGORIES) insert.run(userId, c.name, c.icon, c.type, c.color);
}
```

Then inside the register handler, right after `const user = { id: Number(info.lastInsertRowid), email: normalized };` and before the `res.status(201)` line, add:

```ts
  seedCategories(user.id);
```

- [ ] **Step 6: Run tests**

`npm test` → money + schema + health all pass. `npm run typecheck` → clean.

- [ ] **Step 7: Commit**

```bash
git add habit-tracker/backend
git -c user.name="traderxael" -c user.email="traderxael@users.noreply.github.com" commit -m "feat(backend): finance schema, shared money lib and default category seeding"
```

---

### Task 3: Categories router

**Files:**
- Create: `habit-tracker/backend/src/routes/categories.ts`
- Modify: `habit-tracker/backend/src/app.ts` (import + mount)
- Test: `habit-tracker/backend/src/test/categories.test.ts`

**Interfaces:**
- Consumes: `createCtx`, `requireAuth`, `db`, `categories` table.
- Produces: `categoriesRouter`; `serializeCategory(row)` (exported for reuse in tests of later tasks if needed). Endpoints `GET /api/categories` → `{ categories: Category[] }`, `POST /api/categories` → `201 { category }`, `DELETE /api/categories/:id` → `204` / `404` / `409`. Category JSON: `{ id, name, icon, type, color, createdAt }`.

- [ ] **Step 1: Write failing test**

Create `src/test/categories.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createCtx, type Ctx } from "./helpers.js";

export async function firstCategoryId(ctx: Ctx, type: "income" | "expense"): Promise<number> {
  const res = await request(ctx.app).get("/api/categories").set("Authorization", ctx.auth);
  return res.body.categories.find((c: { type: string }) => c.type === type).id as number;
}

describe("categories", () => {
  it("siembra categorías por defecto al registrarse", async () => {
    const ctx = await createCtx();
    const res = await request(ctx.app).get("/api/categories").set("Authorization", ctx.auth);
    expect(res.status).toBe(200);
    expect(res.body.categories.length).toBeGreaterThanOrEqual(9);
    expect(res.body.categories.some((c: { type: string }) => c.type === "income")).toBe(true);
  });

  it("crea y borra una categoría propia", async () => {
    const ctx = await createCtx();
    const created = await request(ctx.app)
      .post("/api/categories")
      .set("Authorization", ctx.auth)
      .send({ name: "Mascotas", icon: "🐕", type: "expense", color: "#a16207" });
    expect(created.status).toBe(201);
    expect(created.body.category.icon).toBe("🐕");
    const del = await request(ctx.app)
      .delete(`/api/categories/${created.body.category.id}`)
      .set("Authorization", ctx.auth);
    expect(del.status).toBe(204);
  });

  it("400 con nombre vacío, tipo inválido o color inválido", async () => {
    const ctx = await createCtx();
    const r1 = await request(ctx.app).post("/api/categories").set("Authorization", ctx.auth).send({ name: "   ", type: "expense" });
    expect(r1.status).toBe(400);
    const r2 = await request(ctx.app).post("/api/categories").set("Authorization", ctx.auth).send({ name: "X", type: "otro" });
    expect(r2.status).toBe(400);
    const r3 = await request(ctx.app).post("/api/categories").set("Authorization", ctx.auth).send({ name: "X", type: "expense", color: "rojo" });
    expect(r3.status).toBe(400);
  });

  it("404 al borrar una categoría de otro usuario", async () => {
    const a = await createCtx();
    const b = await createCtx();
    const created = await request(a.app).post("/api/categories").set("Authorization", a.auth).send({ name: "Privada", type: "expense" });
    const del = await request(b.app)
      .delete(`/api/categories/${created.body.category.id}`)
      .set("Authorization", b.auth);
    expect(del.status).toBe(404);
  });
});
```

The 409-in-use case is covered in Task 4's test file (it needs `POST /api/transactions`), so it is not written here.

- [ ] **Step 2: Run test to verify it fails**

`npm test` → categories tests FAIL with 404 (router not mounted).

- [ ] **Step 3: Implement**

Create `src/routes/categories.ts`:

```ts
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
```

In `src/app.ts` add the import next to the others and mount it after `completions`:

```ts
import { categoriesRouter } from "./routes/categories.js";
// ...
app.use("/api/categories", categoriesRouter);
```

- [ ] **Step 4: Run tests**

`npm test` → all pass. `npm run typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add habit-tracker/backend
git -c user.name="traderxael" -c user.email="traderxael@users.noreply.github.com" commit -m "feat(backend): categories router with in-use delete guard"
```

---

### Task 4: Transactions router + monthly summary

**Files:**
- Create: `habit-tracker/backend/src/routes/transactions.ts`
- Create: `habit-tracker/backend/src/routes/finance.ts`
- Modify: `habit-tracker/backend/src/app.ts` (mount both)
- Test: `habit-tracker/backend/src/test/transactions.test.ts`, `habit-tracker/backend/src/test/summary.test.ts`

**Interfaces:**
- Consumes: `createCtx`, `firstCategoryId` (from `./categories.test.js` — re-declare locally instead if cross-test imports are awkward; the code below re-declares), money lib validators, `categories`/`transactions` tables.
- Produces: `transactionsRouter`, `financeRouter`, `serializeTx(row)`. Endpoints: `GET /api/transactions?month=YYYY-MM` → `{ transactions: Tx[] }`; `POST /api/transactions` → `201 { transaction }`; `PUT /api/transactions/:id` → `{ transaction }`; `DELETE /api/transactions/:id` → `204`; `GET /api/finance/summary?month=YYYY-MM` → `{ income, expense, balance, byCategory: [{ categoryId, name, icon, color, total }] }`. Tx JSON: `{ id, type, amountCents, note, date, categoryId, categoryName, categoryIcon, categoryColor, debtId, createdAt }`.

- [ ] **Step 1: Write failing tests**

Create `src/test/transactions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createCtx, type Ctx } from "./helpers.js";

async function firstCategoryId(ctx: Ctx, type: "income" | "expense"): Promise<number> {
  const res = await request(ctx.app).get("/api/categories").set("Authorization", ctx.auth);
  return res.body.categories.find((c: { type: string }) => c.type === type).id as number;
}

describe("transactions", () => {
  it("crea, filtra por mes, edita y borra", async () => {
    const ctx = await createCtx();
    const cat = await firstCategoryId(ctx, "expense");
    const created = await request(ctx.app)
      .post("/api/transactions")
      .set("Authorization", ctx.auth)
      .send({ type: "expense", amount_cents: 1234, date: "2026-09-15", category_id: cat, note: "Café" });
    expect(created.status).toBe(201);
    expect(created.body.transaction.amountCents).toBe(1234);
    expect(created.body.transaction.categoryName).toBeTruthy();

    const sep = await request(ctx.app).get("/api/transactions?month=2026-09").set("Authorization", ctx.auth);
    expect(sep.body.transactions).toHaveLength(1);
    const oct = await request(ctx.app).get("/api/transactions?month=2026-10").set("Authorization", ctx.auth);
    expect(oct.body.transactions).toHaveLength(0);

    const put = await request(ctx.app)
      .put(`/api/transactions/${created.body.transaction.id}`)
      .set("Authorization", ctx.auth)
      .send({ amount_cents: 2000 });
    expect(put.body.transaction.amountCents).toBe(2000);

    const del = await request(ctx.app)
      .delete(`/api/transactions/${created.body.transaction.id}`)
      .set("Authorization", ctx.auth);
    expect(del.status).toBe(204);
  });

  it("400 con importe o fecha inválidos", async () => {
    const ctx = await createCtx();
    const cat = await firstCategoryId(ctx, "expense");
    const r1 = await request(ctx.app).post("/api/transactions").set("Authorization", ctx.auth)
      .send({ type: "expense", amount_cents: 0, date: "2026-09-15", category_id: cat });
    expect(r1.status).toBe(400);
    const r2 = await request(ctx.app).post("/api/transactions").set("Authorization", ctx.auth)
      .send({ type: "expense", amount_cents: 100, date: "15/09/2026", category_id: cat });
    expect(r2.status).toBe(400);
  });

  it("400 si la categoría no es del usuario o no corresponde al tipo", async () => {
    const a = await createCtx();
    const b = await createCtx();
    const catA = await firstCategoryId(a, "expense");
    const r1 = await request(b.app).post("/api/transactions").set("Authorization", b.auth)
      .send({ type: "expense", amount_cents: 100, date: "2026-09-15", category_id: catA });
    expect(r1.status).toBe(400);
    const incomeCat = await firstCategoryId(a, "income");
    const r2 = await request(a.app).post("/api/transactions").set("Authorization", a.auth)
      .send({ type: "expense", amount_cents: 100, date: "2026-09-15", category_id: incomeCat });
    expect(r2.status).toBe(400);
  });

  it("409 al borrar una categoría con movimientos", async () => {
    const ctx = await createCtx();
    const cat = await firstCategoryId(ctx, "expense");
    await request(ctx.app).post("/api/transactions").set("Authorization", ctx.auth)
      .send({ type: "expense", amount_cents: 500, date: "2026-09-01", category_id: cat });
    const del = await request(ctx.app).delete(`/api/categories/${cat}`).set("Authorization", ctx.auth);
    expect(del.status).toBe(409);
  });
});
```

Create `src/test/summary.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createCtx } from "./helpers.js";

describe("finance summary", () => {
  it("suma ingresos, gastos y balance por mes y categoría", async () => {
    const ctx = await createCtx();
    const cats = await request(ctx.app).get("/api/categories").set("Authorization", ctx.auth);
    const food = cats.body.categories.find((c: { name: string }) => c.name === "Comida");
    const salary = cats.body.categories.find((c: { name: string }) => c.name === "Nómina");

    await request(ctx.app).post("/api/transactions").set("Authorization", ctx.auth)
      .send({ type: "income", amount_cents: 100000, date: "2026-09-01", category_id: salary.id });
    await request(ctx.app).post("/api/transactions").set("Authorization", ctx.auth)
      .send({ type: "expense", amount_cents: 30000, date: "2026-09-02", category_id: food.id });
    await request(ctx.app).post("/api/transactions").set("Authorization", ctx.auth)
      .send({ type: "expense", amount_cents: 5000, date: "2026-10-02", category_id: food.id });

    const res = await request(ctx.app).get("/api/finance/summary?month=2026-09").set("Authorization", ctx.auth);
    expect(res.status).toBe(200);
    expect(res.body.income).toBe(100000);
    expect(res.body.expense).toBe(30000);
    expect(res.body.balance).toBe(70000);
    const foodRow = res.body.byCategory.find((r: { name: string }) => r.name === "Comida");
    expect(foodRow.total).toBe(30000);
  });

  it("400 sin month válido", async () => {
    const ctx = await createCtx();
    const res = await request(ctx.app).get("/api/finance/summary").set("Authorization", ctx.auth);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

`npm test` → new tests FAIL with 404.

- [ ] **Step 3: Implement transactions router**

Create `src/routes/transactions.ts`:

```ts
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
```

- [ ] **Step 4: Implement summary router**

Create `src/routes/finance.ts`:

```ts
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
```

In `src/app.ts`:

```ts
import { transactionsRouter } from "./routes/transactions.js";
import { financeRouter } from "./routes/finance.js";
// ...
app.use("/api/transactions", transactionsRouter);
app.use("/api/finance", financeRouter);
```

- [ ] **Step 5: Run tests**

`npm test` → ALL pass. `npm run typecheck` → clean.

- [ ] **Step 6: Commit**

```bash
git add habit-tracker/backend
git -c user.name="traderxael" -c user.email="traderxael@users.noreply.github.com" commit -m "feat(backend): transactions CRUD and monthly finance summary"
```

---

### Task 5: Debts router with payments

**Files:**
- Create: `habit-tracker/backend/src/routes/debts.ts`
- Modify: `habit-tracker/backend/src/app.ts` (mount `/api/debts`)
- Test: `habit-tracker/backend/src/test/debts.test.ts`

**Interfaces:**
- Consumes: `createCtx`, money lib validators, `debts`/`transactions` tables.
- Produces: `debtsRouter`, `serializeDebt(row)`. Endpoints `GET/POST /api/debts`, `PUT/DELETE /api/debts/:id`, `POST /api/debts/:id/payments` → `201 { debt, transactionId }`. Debt JSON: `{ id, name, totalCents, paidCents, remainingCents, dueDate, createdAt }`.

- [ ] **Step 1: Write failing test**

Create `src/test/debts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createCtx } from "./helpers.js";

describe("debts", () => {
  it("crea deuda, registra pagos y calcula el saldo", async () => {
    const ctx = await createCtx();
    const created = await request(ctx.app).post("/api/debts").set("Authorization", ctx.auth)
      .send({ name: "Préstamo coche", total_cents: 500000, due_date: "2027-01-01" });
    expect(created.status).toBe(201);
    const id = created.body.debt.id;
    expect(created.body.debt.remainingCents).toBe(500000);

    const pay = await request(ctx.app).post(`/api/debts/${id}/payments`).set("Authorization", ctx.auth)
      .send({ amount_cents: 200000, date: "2026-09-10" });
    expect(pay.status).toBe(201);
    expect(pay.body.transactionId).toBeGreaterThan(0);

    const list = await request(ctx.app).get("/api/debts").set("Authorization", ctx.auth);
    const debt = list.body.debts.find((d: { id: number }) => d.id === id);
    expect(debt.paidCents).toBe(200000);
    expect(debt.remainingCents).toBe(300000);
  });

  it("400 si el pago excede el saldo pendiente", async () => {
    const ctx = await createCtx();
    const created = await request(ctx.app).post("/api/debts").set("Authorization", ctx.auth)
      .send({ name: "Tarjeta", total_cents: 10000 });
    const pay = await request(ctx.app).post(`/api/debts/${created.body.debt.id}/payments`)
      .set("Authorization", ctx.auth).send({ amount_cents: 10001, date: "2026-09-10" });
    expect(pay.status).toBe(400);
  });

  it("borrar la deuda elimina también sus pagos", async () => {
    const ctx = await createCtx();
    const created = await request(ctx.app).post("/api/debts").set("Authorization", ctx.auth)
      .send({ name: "Temporal", total_cents: 5000 });
    const id = created.body.debt.id;
    await request(ctx.app).post(`/api/debts/${id}/payments`).set("Authorization", ctx.auth)
      .send({ amount_cents: 1000, date: "2026-09-01" });
    const del = await request(ctx.app).delete(`/api/debts/${id}`).set("Authorization", ctx.auth);
    expect(del.status).toBe(204);
    const sep = await request(ctx.app).get("/api/transactions?month=2026-09").set("Authorization", ctx.auth);
    expect(sep.body.transactions.filter((t: { debtId: number | null }) => t.debtId === id)).toHaveLength(0);
  });

  it("400 con total inválido y 404 en deuda ajena", async () => {
    const ctx = await createCtx();
    const bad = await request(ctx.app).post("/api/debts").set("Authorization", ctx.auth).send({ name: "X", total_cents: 0 });
    expect(bad.status).toBe(400);

    const other = await createCtx();
    const created = await request(ctx.app).post("/api/debts").set("Authorization", ctx.auth).send({ name: "Mía", total_cents: 1000 });
    const res = await request(other.app).put(`/api/debts/${created.body.debt.id}`)
      .set("Authorization", other.auth).send({ name: "Hack" });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

`npm test` → debts tests FAIL with 404.

- [ ] **Step 3: Implement**

Create `src/routes/debts.ts`:

```ts
import { Router } from "express";
import { db } from "../db.js";
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
  return {
    id: row.id,
    name: row.name,
    totalCents: row.total_cents,
    paidCents: row.paid_cents,
    remainingCents: row.total_cents - row.paid_cents,
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
debtsRouter.get("/", (req, res) => {
  const rows = db
    .prepare(`${SELECT_DEBT} WHERE d.user_id = ? ORDER BY d.created_at ASC`)
    .all(req.userId!) as DebtRow[];
  res.json({ debts: rows.map(serializeDebt) });
});

// POST /api/debts
debtsRouter.post("/", (req, res) => {
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
  const info = db
    .prepare("INSERT INTO debts (user_id, name, total_cents, due_date) VALUES (?, ?, ?, ?)")
    .run(req.userId!, name.trim(), total_cents, due_date ?? null);
  const row = db.prepare(`${SELECT_DEBT} WHERE d.id = ?`).get(Number(info.lastInsertRowid)) as DebtRow;
  res.status(201).json({ debt: serializeDebt(row) });
});

// PUT /api/debts/:id
debtsRouter.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT id FROM debts WHERE id = ? AND user_id = ?").get(id, req.userId!);
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
  db.prepare(
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
  const row = db.prepare(`${SELECT_DEBT} WHERE d.id = ?`).get(id) as DebtRow;
  res.json({ debt: serializeDebt(row) });
});

// DELETE /api/debts/:id
debtsRouter.delete("/:id", (req, res) => {
  const id = Number(req.params.id);
  const info = db.prepare("DELETE FROM debts WHERE id = ? AND user_id = ?").run(id, req.userId!);
  if (info.changes === 0) {
    res.status(404).json({ error: "Deuda no encontrada" });
    return;
  }
  db.prepare("DELETE FROM transactions WHERE debt_id = ?").run(id);
  res.status(204).end();
});

// POST /api/debts/:id/payments
debtsRouter.post("/:id/payments", (req, res) => {
  const id = Number(req.params.id);
  const debt = db
    .prepare(`${SELECT_DEBT} WHERE d.id = ? AND d.user_id = ?`)
    .get(id, req.userId!) as DebtRow | undefined;
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
  if (amount_cents > debt.total_cents - debt.paid_cents) {
    res.status(400).json({ error: "El pago excede el saldo pendiente" });
    return;
  }
  const info = db
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
  const row = db.prepare(`${SELECT_DEBT} WHERE d.id = ?`).get(id) as DebtRow;
  res.status(201).json({ debt: serializeDebt(row), transactionId: Number(info.lastInsertRowid) });
});
```

In `src/app.ts`:

```ts
import { debtsRouter } from "./routes/debts.js";
// ...
app.use("/api/debts", debtsRouter);
```

- [ ] **Step 4: Run tests**

`npm test` → ALL pass. `npm run typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add habit-tracker/backend
git -c user.name="traderxael" -c user.email="traderxael@users.noreply.github.com" commit -m "feat(backend): debts CRUD with payments and computed balance"
```

---

### Task 6: Goals router with contributions

**Files:**
- Create: `habit-tracker/backend/src/routes/goals.ts`
- Modify: `habit-tracker/backend/src/app.ts` (mount `/api/goals`)
- Test: `habit-tracker/backend/src/test/goals.test.ts`

**Interfaces:**
- Consumes: `createCtx`, money lib validators, `goals`/`goal_contributions` tables.
- Produces: `goalsRouter`, `serializeGoal(row)`. Endpoints `GET/POST /api/goals`, `PUT/DELETE /api/goals/:id`, `POST /api/goals/:id/contributions` → `201 { contribution }`, `DELETE /api/goals/:id/contributions/:cid` → `204`. Goal JSON: `{ id, name, icon, targetCents, savedCents, deadline, createdAt }`. Contribution JSON: `{ id, goalId, amountCents, habitId, date, createdAt }`.

- [ ] **Step 1: Write failing test**

Create `src/test/goals.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createCtx } from "./helpers.js";

describe("goals", () => {
  it("crea meta, aporta y calcula el progreso", async () => {
    const ctx = await createCtx();
    const created = await request(ctx.app).post("/api/goals").set("Authorization", ctx.auth)
      .send({ name: "Fondo de emergencia", icon: "🛟", target_cents: 100000, deadline: "2026-12-31" });
    expect(created.status).toBe(201);
    const id = created.body.goal.id;

    const c1 = await request(ctx.app).post(`/api/goals/${id}/contributions`).set("Authorization", ctx.auth)
      .send({ amount_cents: 25000, date: "2026-09-10" });
    expect(c1.status).toBe(201);
    expect(c1.body.contribution.date).toBe("2026-09-10");
    const c2 = await request(ctx.app).post(`/api/goals/${id}/contributions`).set("Authorization", ctx.auth)
      .send({ amount_cents: 5000 });
    expect(c2.status).toBe(201);

    const list = await request(ctx.app).get("/api/goals").set("Authorization", ctx.auth);
    expect(list.body.goals[0].savedCents).toBe(30000);

    const del = await request(ctx.app)
      .delete(`/api/goals/${id}/contributions/${c1.body.contribution.id}`)
      .set("Authorization", ctx.auth);
    expect(del.status).toBe(204);
    const list2 = await request(ctx.app).get("/api/goals").set("Authorization", ctx.auth);
    expect(list2.body.goals[0].savedCents).toBe(5000);
  });

  it("400 con objetivo o aporte inválidos", async () => {
    const ctx = await createCtx();
    const r1 = await request(ctx.app).post("/api/goals").set("Authorization", ctx.auth).send({ name: "X", target_cents: 0 });
    expect(r1.status).toBe(400);
    const ok = await request(ctx.app).post("/api/goals").set("Authorization", ctx.auth).send({ name: "X", target_cents: 1000 });
    const r2 = await request(ctx.app).post(`/api/goals/${ok.body.goal.id}/contributions`)
      .set("Authorization", ctx.auth).send({ amount_cents: -1 });
    expect(r2.status).toBe(400);
    const r3 = await request(ctx.app).post(`/api/goals/${ok.body.goal.id}/contributions`)
      .set("Authorization", ctx.auth).send({ amount_cents: 100, date: "10-09-2026" });
    expect(r3.status).toBe(400);
  });

  it("404 sobre metas de otro usuario", async () => {
    const a = await createCtx();
    const b = await createCtx();
    const created = await request(a.app).post("/api/goals").set("Authorization", a.auth).send({ name: "Mía", target_cents: 1000 });
    const res = await request(b.app).put(`/api/goals/${created.body.goal.id}`)
      .set("Authorization", b.auth).send({ name: "Hack" });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

`npm test` → goals tests FAIL with 404.

- [ ] **Step 3: Implement**

Create `src/routes/goals.ts`:

```ts
import { Router } from "express";
import { db } from "../db.js";
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
    targetCents: row.target_cents,
    savedCents: row.saved_cents,
    deadline: row.deadline,
    createdAt: row.created_at,
  };
}

function serializeContribution(row: ContributionRow) {
  return {
    id: row.id,
    goalId: row.goal_id,
    amountCents: row.amount_cents,
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
goalsRouter.get("/", (req, res) => {
  const rows = db
    .prepare(`${SELECT_GOAL} WHERE g.user_id = ? ORDER BY g.created_at ASC`)
    .all(req.userId!) as GoalRow[];
  res.json({ goals: rows.map(serializeGoal) });
});

// POST /api/goals
goalsRouter.post("/", (req, res) => {
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
  const info = db
    .prepare("INSERT INTO goals (user_id, name, icon, target_cents, deadline) VALUES (?, ?, ?, ?, ?)")
    .run(
      req.userId!,
      name.trim(),
      typeof icon === "string" && icon ? icon : null,
      target_cents,
      deadline ?? null,
    );
  const row = db.prepare(`${SELECT_GOAL} WHERE g.id = ?`).get(Number(info.lastInsertRowid)) as GoalRow;
  res.status(201).json({ goal: serializeGoal(row) });
});

// PUT /api/goals/:id
goalsRouter.put("/:id", (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare("SELECT id FROM goals WHERE id = ? AND user_id = ?").get(id, req.userId!);
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
  db.prepare(
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
  const row = db.prepare(`${SELECT_GOAL} WHERE g.id = ?`).get(id) as GoalRow;
  res.json({ goal: serializeGoal(row) });
});

// DELETE /api/goals/:id
goalsRouter.delete("/:id", (req, res) => {
  const info = db
    .prepare("DELETE FROM goals WHERE id = ? AND user_id = ?")
    .run(Number(req.params.id), req.userId!);
  if (info.changes === 0) {
    res.status(404).json({ error: "Meta no encontrada" });
    return;
  }
  res.status(204).end();
});

// POST /api/goals/:id/contributions
goalsRouter.post("/:id/contributions", (req, res) => {
  const id = Number(req.params.id);
  const goal = db.prepare("SELECT id FROM goals WHERE id = ? AND user_id = ?").get(id, req.userId!);
  if (!goal) {
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
  const info = db
    .prepare("INSERT INTO goal_contributions (user_id, goal_id, amount_cents, date) VALUES (?, ?, ?, ?)")
    .run(req.userId!, id, amount_cents, typeof date === "string" ? date : isoDay(new Date()));
  const row = db
    .prepare("SELECT * FROM goal_contributions WHERE id = ?")
    .get(Number(info.lastInsertRowid)) as ContributionRow;
  res.status(201).json({ contribution: serializeContribution(row) });
});

// DELETE /api/goals/:id/contributions/:cid
goalsRouter.delete("/:id/contributions/:cid", (req, res) => {
  const info = db
    .prepare("DELETE FROM goal_contributions WHERE id = ? AND goal_id = ? AND user_id = ?")
    .run(Number(req.params.cid), Number(req.params.id), req.userId!);
  if (info.changes === 0) {
    res.status(404).json({ error: "Aporte no encontrado" });
    return;
  }
  res.status(204).end();
});
```

In `src/app.ts`:

```ts
import { goalsRouter } from "./routes/goals.js";
// ...
app.use("/api/goals", goalsRouter);
```

- [ ] **Step 4: Run tests**

`npm test` → ALL pass. `npm run typecheck` → clean.

- [ ] **Step 5: Commit**

```bash
git add habit-tracker/backend
git -c user.name="traderxael" -c user.email="traderxael@users.noreply.github.com" commit -m "feat(backend): goals CRUD with manual contributions"
```

---

### Task 7: Habit↔goal link (auto-contribution on toggle + habit fields)

**Files:**
- Modify: `habit-tracker/backend/src/routes/completions.ts` (toggle gains contribution logic inside one SQL transaction)
- Modify: `habit-tracker/backend/src/routes/habits.ts` (accept + serialize `goal_id`, `goal_amount_cents`)
- Test: `habit-tracker/backend/src/test/habit-goal.test.ts`

**Interfaces:**
- Consumes: `habits.goal_id` / `habits.goal_amount_cents`, `goal_contributions`, existing `POST /api/completions/toggle`.
- Produces: toggling a linked habit ON inserts a `goal_contributions` row with `habit_id` + the completion date; toggling OFF deletes exactly that row. `Habit` JSON gains `goalId: number | null` and `goalAmountCents: number | null`. `POST/PUT /api/habits` accept `goal_id` and `goal_amount_cents` (null to unlink).

- [ ] **Step 1: Write failing test**

Create `src/test/habit-goal.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createCtx } from "./helpers.js";

describe("habit-goal link", () => {
  it("marcar aporta a la meta y desmarcar revierte el aporte", async () => {
    const ctx = await createCtx();
    const goalRes = await request(ctx.app).post("/api/goals").set("Authorization", ctx.auth)
      .send({ name: "Ahorro", target_cents: 100000 });
    const goalId = goalRes.body.goal.id;

    const habitRes = await request(ctx.app).post("/api/habits").set("Authorization", ctx.auth)
      .send({ name: "Ahorrar diario", goal_id: goalId, goal_amount_cents: 2000 });
    expect(habitRes.status).toBe(201);
    const habitId = habitRes.body.habit.id;
    expect(habitRes.body.habit.goalId).toBe(goalId);
    expect(habitRes.body.habit.goalAmountCents).toBe(2000);

    const on = await request(ctx.app).post("/api/completions/toggle").set("Authorization", ctx.auth)
      .send({ habitId, date: "2026-09-20" });
    expect(on.body.completed).toBe(true);
    let goals = await request(ctx.app).get("/api/goals").set("Authorization", ctx.auth);
    expect(goals.body.goals[0].savedCents).toBe(2000);

    const off = await request(ctx.app).post("/api/completions/toggle").set("Authorization", ctx.auth)
      .send({ habitId, date: "2026-09-20" });
    expect(off.body.completed).toBe(false);
    goals = await request(ctx.app).get("/api/goals").set("Authorization", ctx.auth);
    expect(goals.body.goals[0].savedCents).toBe(0);
  });

  it("un hábito sin meta no genera aportes", async () => {
    const ctx = await createCtx();
    const habitRes = await request(ctx.app).post("/api/habits").set("Authorization", ctx.auth).send({ name: "Leer" });
    await request(ctx.app).post("/api/completions/toggle").set("Authorization", ctx.auth)
      .send({ habitId: habitRes.body.habit.id, date: "2026-09-20" });
    const goals = await request(ctx.app).get("/api/goals").set("Authorization", ctx.auth);
    expect(goals.body.goals).toHaveLength(0);
  });

  it("400 con goal_id de otro usuario", async () => {
    const a = await createCtx();
    const b = await createCtx();
    const goalA = await request(a.app).post("/api/goals").set("Authorization", a.auth)
      .send({ name: "Ajena", target_cents: 1000 });
    const res = await request(b.app).post("/api/habits").set("Authorization", b.auth)
      .send({ name: "Malo", goal_id: goalA.body.goal.id, goal_amount_cents: 100 });
    expect(res.status).toBe(400);
  });

  it("PUT actualiza el importe y permite desvincular", async () => {
    const ctx = await createCtx();
    const goalRes = await request(ctx.app).post("/api/goals").set("Authorization", ctx.auth)
      .send({ name: "A", target_cents: 1000 });
    const habitRes = await request(ctx.app).post("/api/habits").set("Authorization", ctx.auth)
      .send({ name: "H", goal_id: goalRes.body.goal.id, goal_amount_cents: 500 });
    const linked = await request(ctx.app).put(`/api/habits/${habitRes.body.habit.id}`)
      .set("Authorization", ctx.auth).send({ goal_amount_cents: 700 });
    expect(linked.body.habit.goalAmountCents).toBe(700);
    const unlinked = await request(ctx.app).put(`/api/habits/${habitRes.body.habit.id}`)
      .set("Authorization", ctx.auth).send({ goal_id: null, goal_amount_cents: null });
    expect(unlinked.body.habit.goalId).toBeNull();
    expect(unlinked.body.habit.goalAmountCents).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

`npm test` → FAIL (`goalId` undefined; `savedCents` stays 0 after toggle).

- [ ] **Step 3: Implement toggle contribution**

In `src/routes/completions.ts`, replace everything inside `completionsRouter.post("/toggle", ...)` FROM the line `const habit = db` THROUGH the final `res.json({ completed: true, habitId: id, date });` with:

```ts
  const habit = db
    .prepare("SELECT id, goal_id, goal_amount_cents FROM habits WHERE id = ? AND user_id = ?")
    .get(id, userId) as
    | { id: number; goal_id: number | null; goal_amount_cents: number | null }
    | undefined;
  if (!habit) {
    res.status(404).json({ error: "Hábito no encontrado" });
    return;
  }
  const existing = db
    .prepare("SELECT id FROM completions WHERE habit_id = ? AND date = ?")
    .get(id, date) as { id: number } | undefined;

  const applyToggle = db.transaction((): boolean => {
    if (existing) {
      db.prepare("DELETE FROM completions WHERE id = ?").run(existing.id);
      if (habit.goal_id && habit.goal_amount_cents) {
        db.prepare("DELETE FROM goal_contributions WHERE habit_id = ? AND date = ?").run(id, date);
      }
      return false;
    }
    db.prepare("INSERT INTO completions (habit_id, date) VALUES (?, ?)").run(id, date);
    if (habit.goal_id && habit.goal_amount_cents) {
      db.prepare(
        "INSERT INTO goal_contributions (user_id, goal_id, habit_id, amount_cents, date) VALUES (?, ?, ?, ?, ?)",
      ).run(userId, habit.goal_id, id, habit.goal_amount_cents, date);
    }
    return true;
  });

  const completed = applyToggle();
  res.json({ completed, habitId: id, date });
```

The validation block above it (`habitId`/`date` checks) stays unchanged.

- [ ] **Step 4: Implement habit goal fields**

In `src/routes/habits.ts`:

1. Extend `HabitRow` with two fields (after `archived`):

```ts
  goal_id: number | null;
  goal_amount_cents: number | null;
```

2. In `serialize`, add (after `archived`):

```ts
    goalId: row.goal_id,
    goalAmountCents: row.goal_amount_cents,
```

3. Add this helper above `habitsRouter.get("/")`:

```ts
function validGoalLink(userId: number, goalId: unknown, amountCents: unknown): string | null {
  if (goalId === undefined || goalId === null) return null;
  const gid = Number(goalId);
  if (!Number.isInteger(gid)) return "goal_id inválido";
  const goal = db.prepare("SELECT id FROM goals WHERE id = ? AND user_id = ?").get(gid, userId);
  if (!goal) return "Meta no encontrada";
  if (amountCents === undefined || amountCents === null) return null;
  if (!Number.isInteger(amountCents) || (amountCents as number) <= 0) {
    return "goal_amount_cents debe ser un entero mayor que 0";
  }
  return null;
}
```

4. In `POST /`, after the existing name validation and before the INSERT, add:

```ts
  const { goal_id, goal_amount_cents } = req.body ?? {};
  const goalError = validGoalLink(userId, goal_id, goal_amount_cents);
  if (goalError) {
    res.status(400).json({ error: goalError });
    return;
  }
```

and replace the INSERT with:

```ts
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
```

5. In `PUT /:id`, after the existing 404 check and before the UPDATE, add:

```ts
  const { goal_id, goal_amount_cents } = req.body ?? {};
  const goalError = validGoalLink(userId, goal_id, goal_amount_cents);
  if (goalError) {
    res.status(400).json({ error: goalError });
    return;
  }
```

and extend the UPDATE — add these two lines to the SET clause (before `WHERE id = ?`):

```sql
       goal_id = CASE WHEN ? THEN ? ELSE goal_id END,
       goal_amount_cents = CASE WHEN ? THEN ? ELSE goal_amount_cents END
```

and these four args to `.run(...)`, immediately before the trailing `id`:

```ts
    goal_id !== undefined ? 1 : 0,
    goal_id !== undefined && goal_id !== null ? Number(goal_id) : null,
    goal_amount_cents !== undefined ? 1 : 0,
    goal_amount_cents !== undefined && goal_amount_cents !== null ? Number(goal_amount_cents) : null,
```

- [ ] **Step 5: Run tests**

`npm test` → ALL pass (existing habits/completions tests included). `npm run typecheck` → clean.

- [ ] **Step 6: Commit**

```bash
git add habit-tracker/backend
git -c user.name="traderxael" -c user.email="traderxael@users.noreply.github.com" commit -m "feat(backend): habit-goal link with automatic contributions on toggle"
```

---

### Task 8: Frontend money lib (TDD) + types + API surface

**Files:**
- Modify: `habit-tracker/frontend/package.json` (vitest devDep + test script)
- Create: `habit-tracker/frontend/src/lib/money.ts`
- Modify: `habit-tracker/frontend/src/types.ts`
- Modify: `habit-tracker/frontend/src/api/client.ts`
- Test: `habit-tracker/frontend/src/lib/money.test.ts`

**Interfaces:**
- Consumes: existing `api.get/post/put/del` from `client.ts`.
- Produces (used by Tasks 9–13): `formatMoney(cents: number): string`, `parseAmountToCents(input: string): number | null`, `monthKey(d: Date): string`, `addMonths(month: string, delta: number): string`, `monthLabelES(month: string): string`; types `Category`, `Transaction`, `CategorySummary`, `FinanceSummary`, `Debt`, `Goal`, `GoalContribution`; `Habit` gains `goalId`/`goalAmountCents`; `financeApi` with `listCategories, createCategory, deleteCategory, listTransactions, createTransaction, updateTransaction, deleteTransaction, summary, listDebts, createDebt, updateDebt, deleteDebt, payDebt, listGoals, createGoal, updateGoal, deleteGoal, contribute, deleteContribution`.

- [ ] **Step 1: Install vitest and write the failing test**

Run in `habit-tracker/frontend`: `npm i -D vitest`; add `"test": "vitest run"` to `scripts`.

Create `src/lib/money.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { addMonths, formatMoney, monthKey, monthLabelES, parseAmountToCents } from "./money";

describe("money", () => {
  it("formatMoney usa el formato peso", () => {
    expect(formatMoney(123456)).toBe("$1,234.56");
    expect(formatMoney(0)).toBe("$0.00");
    expect(formatMoney(50)).toBe("$0.50");
  });

  it("parseAmountToCents convierte decimales y rechaza inválidos", () => {
    expect(parseAmountToCents("12.34")).toBe(1234);
    expect(parseAmountToCents("12")).toBe(1200);
    expect(parseAmountToCents("0.05")).toBe(5);
    expect(parseAmountToCents("1,234.56")).toBe(123456);
    expect(parseAmountToCents("12.345")).toBeNull();
    expect(parseAmountToCents("abc")).toBeNull();
    expect(parseAmountToCents("0")).toBeNull();
    expect(parseAmountToCents("-3")).toBeNull();
    expect(parseAmountToCents("   ")).toBeNull();
  });

  it("monthKey y addMonths cruzan años", () => {
    expect(monthKey(new Date(2026, 8, 28))).toBe("2026-09");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
  });

  it("monthLabelES formatea en español", () => {
    expect(monthLabelES("2026-09")).toBe("septiembre de 2026");
  });
});
```

If the `monthLabelES` assertion fails because the local ICU renders a different variant (e.g. `"septiembre de 2026"` vs `"septiembre 2026"`), adjust the expected string to the actual Node output — do NOT weaken the other assertions.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test` → FAIL (cannot find module `./money`).

- [ ] **Step 3: Implement**

Create `src/lib/money.ts`:

```ts
const formatter = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export function formatMoney(cents: number): string {
  return formatter.format(cents / 100);
}

export function parseAmountToCents(input: string): number | null {
  const clean = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const cents = Math.round(Number(clean) * 100);
  return cents > 0 ? cents : null;
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}

export function monthLabelES(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
}
```

Append to `src/types.ts`:

```ts
export interface Category {
  id: number;
  name: string;
  icon: string | null;
  type: "income" | "expense";
  color: string | null;
  createdAt: string;
}

export interface Transaction {
  id: number;
  type: "income" | "expense";
  amountCents: number;
  note: string | null;
  date: string;
  categoryId: number | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  debtId: number | null;
  createdAt: string;
}

export interface CategorySummary {
  categoryId: number;
  name: string;
  icon: string | null;
  color: string | null;
  total: number;
}

export interface FinanceSummary {
  income: number;
  expense: number;
  balance: number;
  byCategory: CategorySummary[];
}

export interface Debt {
  id: number;
  name: string;
  totalCents: number;
  paidCents: number;
  remainingCents: number;
  dueDate: string | null;
  createdAt: string;
}

export interface Goal {
  id: number;
  name: string;
  icon: string | null;
  targetCents: number;
  savedCents: number;
  deadline: string | null;
  createdAt: string;
}

export interface GoalContribution {
  id: number;
  goalId: number;
  amountCents: number;
  habitId: number | null;
  date: string;
  createdAt: string;
}
```

In the existing `Habit` interface in `types.ts`, add after `archived: boolean;`:

```ts
  goalId: number | null;
  goalAmountCents: number | null;
```

Append to `src/api/client.ts` (the file already exports `api`; add the import of types at the top of the appended block):

```ts
import type { Category, Debt, FinanceSummary, Goal, GoalContribution, Transaction } from "../types";

export const financeApi = {
  listCategories: () => api.get<{ categories: Category[] }>("/categories"),
  createCategory: (body: { name: string; icon?: string; type: "income" | "expense"; color?: string }) =>
    api.post<{ category: Category }>("/categories", body),
  deleteCategory: (id: number) => api.del<void>(`/categories/${id}`),

  listTransactions: (month: string) => api.get<{ transactions: Transaction[] }>(`/transactions?month=${month}`),
  createTransaction: (body: {
    type: "income" | "expense";
    amount_cents: number;
    date: string;
    category_id?: number | null;
    note?: string;
  }) => api.post<{ transaction: Transaction }>("/transactions", body),
  updateTransaction: (id: number, body: { amount_cents?: number; note?: string; date?: string }) =>
    api.put<{ transaction: Transaction }>(`/transactions/${id}`, body),
  deleteTransaction: (id: number) => api.del<void>(`/transactions/${id}`),
  summary: (month: string) => api.get<FinanceSummary>(`/finance/summary?month=${month}`),

  listDebts: () => api.get<{ debts: Debt[] }>("/debts"),
  createDebt: (body: { name: string; total_cents: number; due_date?: string | null }) =>
    api.post<{ debt: Debt }>("/debts", body),
  updateDebt: (id: number, body: { name?: string; total_cents?: number; due_date?: string | null }) =>
    api.put<{ debt: Debt }>(`/debts/${id}`, body),
  deleteDebt: (id: number) => api.del<void>(`/debts/${id}`),
  payDebt: (id: number, body: { amount_cents: number; date?: string; note?: string }) =>
    api.post<{ debt: Debt; transactionId: number }>(`/debts/${id}/payments`, body),

  listGoals: () => api.get<{ goals: Goal[] }>("/goals"),
  createGoal: (body: { name: string; icon?: string; target_cents: number; deadline?: string | null }) =>
    api.post<{ goal: Goal }>("/goals", body),
  updateGoal: (
    id: number,
    body: { name?: string; icon?: string | null; target_cents?: number; deadline?: string | null },
  ) => api.put<{ goal: Goal }>(`/goals/${id}`, body),
  deleteGoal: (id: number) => api.del<void>(`/goals/${id}`),
  contribute: (goalId: number, body: { amount_cents: number; date?: string }) =>
    api.post<{ contribution: GoalContribution }>(`/goals/${goalId}/contributions`, body),
  deleteContribution: (goalId: number, contributionId: number) =>
    api.del<void>(`/goals/${goalId}/contributions/${contributionId}`),
};
```

Note: the `import type { ... } from "../types";` line must be placed with the other top-of-file imports, not mid-file — move it above `const TOKEN_KEY` if your editor keeps imports at the top.

- [ ] **Step 4: Run tests**

`npm test` → money tests pass. `npm run typecheck` → clean (if existing files break because `Habit` gained required fields, that only happens where a `Habit` object literal is constructed in code — grep for `: Habit` and fix by adding `goalId: null, goalAmountCents: null`; API responses are unaffected).

- [ ] **Step 5: Commit**

```bash
git add habit-tracker/frontend
git -c user.name="traderxael" -c user.email="traderxael@users.noreply.github.com" commit -m "feat(frontend): money utils, finance types and API surface"
```

---

### Task 9: Shared components (MonthNav, AmountInput) + finance CSS

**Files:**
- Create: `habit-tracker/frontend/src/components/MonthNav.tsx`
- Create: `habit-tracker/frontend/src/components/AmountInput.tsx`
- Modify: `habit-tracker/frontend/src/styles.css` (append a "Finanzas" block at the end)

**Interfaces:**
- Consumes: `addMonths`, `monthLabelES` from `../lib/money`; existing tokens in `styles.css`.
- Produces (used by Tasks 10–13): `<MonthNav month={string} onChange={(month: string) => void} />`; `<AmountInput id={string} value={string} onChange={(value: string) => void} />` (a text input with a `$` prefix; the parent converts with `parseAmountToCents`). New CSS classes: `.month-nav`, `.amount-input`, `.mov-day`, `.mov-item`, `.mov-cat`, `.mov-note`, `.mov-amount`, `.amount-pos`, `.amount-neg`, `.by-cat-row`, `.by-cat-total`, `.goal-card`, `.goal-head`, `.goal-meta`, `.goal-actions`, `.today-finance`, `.today-finance-row`, `.mini-goal`.
- IMPORTANT: `.badge` and `.progress` already exist in `styles.css` (lines ~784 and ~694) — reuse them, do NOT redefine.

- [ ] **Step 1: Implement MonthNav**

Create `src/components/MonthNav.tsx`:

```tsx
import { addMonths, monthLabelES } from "../lib/money";

interface Props {
  month: string;
  onChange: (month: string) => void;
}

export function MonthNav({ month, onChange }: Props) {
  return (
    <div className="month-nav">
      <button type="button" className="btn-ghost" aria-label="Mes anterior" onClick={() => onChange(addMonths(month, -1))}>
        ‹
      </button>
      <strong>{monthLabelES(month)}</strong>
      <button type="button" className="btn-ghost" aria-label="Mes siguiente" onClick={() => onChange(addMonths(month, 1))}>
        ›
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Implement AmountInput**

Create `src/components/AmountInput.tsx`:

```tsx
interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
}

export function AmountInput({ id, value, onChange }: Props) {
  return (
    <span className="amount-input">
      <span aria-hidden="true">$</span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </span>
  );
}
```

- [ ] **Step 3: Append CSS (tokens only, no raw colors)**

Append to the end of `src/styles.css`:

```css
/* ===== Finanzas ===== */

.month-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  margin-block-end: 1rem;
}

.month-nav strong {
  text-transform: capitalize;
}

.amount-input {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--r-sm);
  background: var(--surface-2);
  padding-inline: 0.6rem;
}

.amount-input:focus-within {
  border-color: var(--primary);
  box-shadow: var(--ring);
}

.amount-input input {
  inline-size: 7rem;
  border: none;
  background: transparent;
  color: var(--text);
  font: inherit;
  padding-block: 0.55rem;
}

.amount-input input:focus {
  outline: none;
}

.mov-day {
  margin-block-start: 1rem;
}

.mov-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-block: 0.55rem;
}

.mov-item + .mov-item {
  border-block-start: 1px solid var(--border);
}

.mov-cat {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-inline-size: 0;
}

.mov-note {
  overflow: hidden;
  color: var(--muted);
  font-size: 0.85rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mov-amount {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.amount-pos {
  color: var(--success);
}

.amount-neg {
  color: var(--danger);
}

.by-cat-row {
  margin-block-end: 0.7rem;
}

.by-cat-total {
  color: var(--muted);
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
}

.goal-card {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.goal-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.goal-head strong {
  flex: 1;
}

.goal-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.9rem;
  color: var(--muted);
  font-size: 0.85rem;
}

.goal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.today-finance-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1.2rem;
}

.mini-goal {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-block-start: 0.5rem;
}

.mini-goal .progress {
  flex: 1;
}
```

- [ ] **Step 4: Verify**

`npm run typecheck` → clean. `npm run build` → succeeds (CSS parses). Visual confirmation of the new classes happens in Tasks 10–13.

- [ ] **Step 5: Commit**

```bash
git add habit-tracker/frontend
git -c user.name="traderxael" -c user.email="traderxael@users.noreply.github.com" commit -m "feat(frontend): MonthNav, AmountInput and finance styles"
```

---

### Task 10: Finance page (/finance)

**Files:**
- Create: `habit-tracker/frontend/src/pages/Finance.tsx`
- Create: `habit-tracker/frontend/src/components/CategoryForm.tsx` (keeps `Finance.tsx` under the size limit)
- Modify: `habit-tracker/frontend/src/App.tsx` (import + NavLink + Route)

**Interfaces:**
- Consumes: `financeApi`, `formatMoney`, `parseAmountToCents`, `monthKey`, `MonthNav`, `AmountInput`, `EmptyState`, types `Category`, `Transaction`, `FinanceSummary`.
- Produces: `default export FinancePage` mounted at `/finance`; `<CategoryForm onCreated={() => void} />`.

- [ ] **Step 1: Implement CategoryForm**

Create `src/components/CategoryForm.tsx`:

```tsx
import { useState, type FormEvent } from "react";
import { financeApi } from "../api/client";

interface Props {
  onCreated: () => void;
}

export function CategoryForm({ onCreated }: Props) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await financeApi.createCategory({ name, icon: icon || undefined, type });
      setName("");
      setIcon("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la categoría");
    }
  }

  return (
    <form onSubmit={onSubmit} className="form card">
      <h3>Nueva categoría</h3>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <label>
          Nombre
          <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ej. Mascotas" />
        </label>
        <label>
          Icono
          <input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} placeholder="🐕" />
        </label>
        <label>
          Tipo
          <select value={type} onChange={(e) => setType(e.target.value as "income" | "expense")}>
            <option value="expense">Gasto</option>
            <option value="income">Ingreso</option>
          </select>
        </label>
      </div>
      <button type="submit" className="btn-ghost">
        Crear categoría
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Implement Finance page**

Create `src/pages/Finance.tsx`:

```tsx
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { financeApi } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { MonthNav } from "../components/MonthNav";
import { AmountInput } from "../components/AmountInput";
import { CategoryForm } from "../components/CategoryForm";
import { formatMoney, monthKey, parseAmountToCents } from "../lib/money";
import type { Category, FinanceSummary, Transaction } from "../types";

export default function FinancePage() {
  const [month, setMonth] = useState(monthKey(new Date()));
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [type, setType] = useState<"income" | "expense">("expense");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(monthKey(new Date()) + "-01");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, tx, sum] = await Promise.all([
        financeApi.listCategories(),
        financeApi.listTransactions(month),
        financeApi.summary(month),
      ]);
      setCategories(cats.categories);
      setTransactions(tx.transactions);
      setSummary(sum);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const byDay = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const list = byDay.get(t.date) ?? [];
    list.push(t);
    byDay.set(t.date, list);
  }
  const expenseMax = summary?.byCategory.length ? summary.byCategory[0].total : 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const cents = parseAmountToCents(amount);
    if (!cents) {
      setError("Importe inválido (ej. 12.50)");
      return;
    }
    try {
      await financeApi.createTransaction({
        type,
        amount_cents: cents,
        date,
        category_id: categoryId ? Number(categoryId) : null,
        note: note.trim() || undefined,
      });
      setAmount("");
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  async function onDelete(id: number) {
    if (!window.confirm("¿Eliminar este movimiento?")) return;
    await financeApi.deleteTransaction(id);
    await load();
  }

  return (
    <section>
      <h2>Finanzas</h2>
      <MonthNav month={month} onChange={setMonth} />
      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="muted">Cargando…</p>
      ) : (
        <>
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-name">Ingresos</div>
              <div className="stat-nums amount-pos">{formatMoney(summary?.income ?? 0)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-name">Gastos</div>
              <div className="stat-nums amount-neg">{formatMoney(summary?.expense ?? 0)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-name">Balance</div>
              <div className="stat-nums">{formatMoney(summary?.balance ?? 0)}</div>
            </div>
          </div>

          <form onSubmit={onSubmit} className="form card">
            <h3>Nuevo movimiento</h3>
            <fieldset>
              <legend>Tipo</legend>
              <label className="inline">
                <input type="radio" checked={type === "expense"} onChange={() => setType("expense")} /> Gasto
              </label>
              <label className="inline">
                <input type="radio" checked={type === "income"} onChange={() => setType("income")} /> Ingreso
              </label>
            </fieldset>
            <div className="row">
              <label>
                Importe
                <AmountInput id="tx-amount" value={amount} onChange={setAmount} />
              </label>
              <label>
                Fecha
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </label>
            </div>
            <div className="row">
              <label>
                Categoría
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Sin categoría</option>
                  {categories
                    .filter((c) => c.type === type)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon ? `${c.icon} ` : ""}
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Nota
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" />
              </label>
            </div>
            <button type="submit" className="btn-primary">
              Añadir movimiento
            </button>
          </form>

          {summary && summary.byCategory.length > 0 && (
            <div className="card">
              <h3>Por categoría</h3>
              {summary.byCategory.map((c) => (
                <div key={c.categoryId} className="by-cat-row">
                  <div>
                    {c.icon ? `${c.icon} ` : ""}
                    {c.name} <span className="by-cat-total">{formatMoney(c.total)}</span>
                  </div>
                  <div className="bar">
                    <span style={{ width: `${expenseMax ? Math.round((c.total / expenseMax) * 100) : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <h3>Movimientos</h3>
            {transactions.length === 0 ? (
              <EmptyState title="Sin movimientos este mes" hint="Añade tu primer ingreso o gasto con el formulario." />
            ) : (
              [...byDay.entries()].map(([day, items]) => (
                <div key={day} className="mov-day">
                  <h4>{day}</h4>
                  {items.map((t) => (
                    <div key={t.id} className="mov-item">
                      <span className="mov-cat">
                        <span aria-hidden="true">{t.categoryIcon ?? "•"}</span>
                        <span>{t.categoryName ?? "Sin categoría"}</span>
                        {t.note && <span className="mov-note">{t.note}</span>}
                      </span>
                      <span className={"mov-amount " + (t.type === "income" ? "amount-pos" : "amount-neg")}>
                        {t.type === "income" ? "+" : "−"}
                        {formatMoney(t.amountCents)}
                      </span>
                      <button type="button" className="btn-link" onClick={() => onDelete(t.id)}>
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          <CategoryForm onCreated={() => void load()} />
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Wire route and nav**

In `src/App.tsx`: add `import FinancePage from "./pages/Finance";` with the other page imports; add `<NavLink to="/finance">Finanzas</NavLink>` after the Hábitos link; add the route after `/habits`:

```tsx
            <Route
              path="/finance"
              element={
                <Protected>
                  <FinancePage />
                </Protected>
              }
            />
```

- [ ] **Step 4: Verify**

`npm run typecheck` → clean. With both dev servers running, open `/finance`: stats render `$0.00`, empty state shows, create a $12.50 expense with a category → stats update to Gastos `$12.50` and Balance `-$12.50`, movement appears grouped by day, "Por categoría" bar appears. Use take_snapshot + evaluate_script if driving the hidden browser surface.

- [ ] **Step 5: Commit**

```bash
git add habit-tracker/frontend
git -c user.name="traderxael" -c user.email="traderxael@users.noreply.github.com" commit -m "feat(frontend): finance page with month nav, stats, movements and categories"
```

---

### Task 11: Debts page (/debts)

**Files:**
- Create: `habit-tracker/frontend/src/pages/Debts.tsx`
- Modify: `habit-tracker/frontend/src/App.tsx` (import + NavLink + Route)

**Interfaces:**
- Consumes: `financeApi.listDebts/createDebt/deleteDebt/payDebt`, `formatMoney`, `parseAmountToCents`, `AmountInput`, `EmptyState`, type `Debt`.
- Produces: `default export DebtsPage` mounted at `/debts`.

- [ ] **Step 1: Implement page**

Create `src/pages/Debts.tsx`:

```tsx
import { useEffect, useState, type FormEvent } from "react";
import { financeApi } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { AmountInput } from "../components/AmountInput";
import { formatMoney, parseAmountToCents } from "../lib/money";
import type { Debt } from "../types";

export default function DebtsPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [total, setTotal] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [payFor, setPayFor] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState("");

  const load = async () => {
    const d = await financeApi.listDebts();
    setDebts(d.debts);
  };

  useEffect(() => {
    load()
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const cents = parseAmountToCents(total);
    if (!cents) {
      setError("Importe inválido (ej. 5000)");
      return;
    }
    try {
      await financeApi.createDebt({ name, total_cents: cents, due_date: dueDate || null });
      setName("");
      setTotal("");
      setDueDate("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la deuda");
    }
  }

  async function onPay(e: FormEvent, debt: Debt) {
    e.preventDefault();
    setError(null);
    const cents = parseAmountToCents(payAmount);
    if (!cents) {
      setError("Importe inválido");
      return;
    }
    try {
      await financeApi.payDebt(debt.id, { amount_cents: cents });
      setPayFor(null);
      setPayAmount("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar el pago");
    }
  }

  async function onDelete(debt: Debt) {
    if (!window.confirm(`¿Eliminar "${debt.name}" y sus pagos?`)) return;
    await financeApi.deleteDebt(debt.id);
    await load();
  }

  if (loading) return <p className="muted">Cargando…</p>;

  return (
    <section>
      <h2>Deudas</h2>
      {error && <p className="error">{error}</p>}

      <form onSubmit={onCreate} className="form card">
        <h3>Nueva deuda</h3>
        <div className="row">
          <label>
            Nombre
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ej. Préstamo coche" />
          </label>
          <label>
            Importe total
            <AmountInput id="debt-total" value={total} onChange={setTotal} />
          </label>
          <label>
            Vencimiento (opcional)
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
        </div>
        <button type="submit" className="btn-primary">
          Añadir deuda
        </button>
      </form>

      {debts.length === 0 ? (
        <EmptyState title="Sin deudas" hint="Aquí puedes registrar préstamos o tarjetas y seguir su pago." />
      ) : (
        <ul className="habit-list">
          {debts.map((d) => {
            const pct = Math.min(100, Math.round((d.paidCents / d.totalCents) * 100));
            return (
              <li key={d.id} className="card goal-card">
                <div className="goal-head">
                  <strong>💳 {d.name}</strong>
                  <span className="muted">
                    {formatMoney(d.paidCents)} / {formatMoney(d.totalCents)}
                  </span>
                </div>
                <div className="progress">
                  <span style={{ width: `${pct}%` }} />
                </div>
                <div className="goal-meta">
                  <span>Pendiente: {formatMoney(d.remainingCents)}</span>
                  {d.dueDate && <span>Vence: {d.dueDate}</span>}
                  <span>{pct}%</span>
                </div>
                <div className="goal-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setPayFor(payFor === d.id ? null : d.id);
                      setPayAmount("");
                    }}
                  >
                    Registrar pago
                  </button>
                  <button type="button" className="btn-link" onClick={() => onDelete(d)}>
                    Eliminar
                  </button>
                </div>
                {payFor === d.id && (
                  <form onSubmit={(e) => onPay(e, d)} className="row">
                    <label>
                      Importe del pago
                      <AmountInput id={`pay-${d.id}`} value={payAmount} onChange={setPayAmount} />
                    </label>
                    <button type="submit" className="btn-primary">
                      Pagar
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Wire route and nav**

In `src/App.tsx`: `import DebtsPage from "./pages/Debts";`, `<NavLink to="/debts">Deudas</NavLink>` after Finanzas, and the `/debts` route wrapped in `Protected` (same shape as Task 10 Step 3).

- [ ] **Step 3: Verify**

`npm run typecheck` → clean. Browser: create a $5,000 debt → progress 0%; pay $2,000 → progress 40% and pendiente `$3,000.00`; try paying $10,000 → the 400 message "El pago excede el saldo pendiente" appears; delete → card disappears.

- [ ] **Step 4: Commit**

```bash
git add habit-tracker/frontend
git -c user.name="traderxael" -c user.email="traderxael@users.noreply.github.com" commit -m "feat(frontend): debts page with payments and progress"
```

---

### Task 12: Goals page (/goals)

**Files:**
- Create: `habit-tracker/frontend/src/pages/Goals.tsx`
- Modify: `habit-tracker/frontend/src/App.tsx` (import + NavLink + Route)

**Interfaces:**
- Consumes: `financeApi.listGoals/createGoal/deleteGoal/contribute`, `formatMoney`, `parseAmountToCents`, `AmountInput`, `IconPicker`, `EmptyState`, type `Goal`.
- Produces: `default export GoalsPage` mounted at `/goals`.

- [ ] **Step 1: Implement page**

Create `src/pages/Goals.tsx`:

```tsx
import { useEffect, useState, type FormEvent } from "react";
import { financeApi } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { IconPicker } from "../components/IconPicker";
import { AmountInput } from "../components/AmountInput";
import { formatMoney, parseAmountToCents } from "../lib/money";
import type { Goal } from "../types";

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🎯");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [contributeTo, setContributeTo] = useState<number | null>(null);
  const [contributeAmount, setContributeAmount] = useState("");

  const load = async () => {
    const g = await financeApi.listGoals();
    setGoals(g.goals);
  };

  useEffect(() => {
    load()
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const cents = parseAmountToCents(target);
    if (!cents) {
      setError("Importe inválido (ej. 10000)");
      return;
    }
    try {
      await financeApi.createGoal({ name, icon: icon || undefined, target_cents: cents, deadline: deadline || null });
      setName("");
      setTarget("");
      setDeadline("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la meta");
    }
  }

  async function onContribute(e: FormEvent, goal: Goal) {
    e.preventDefault();
    setError(null);
    const cents = parseAmountToCents(contributeAmount);
    if (!cents) {
      setError("Importe inválido");
      return;
    }
    try {
      await financeApi.contribute(goal.id, { amount_cents: cents });
      setContributeTo(null);
      setContributeAmount("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al aportar");
    }
  }

  async function onDelete(goal: Goal) {
    if (!window.confirm(`¿Eliminar la meta "${goal.name}"?`)) return;
    await financeApi.deleteGoal(goal.id);
    await load();
  }

  if (loading) return <p className="muted">Cargando…</p>;

  return (
    <section>
      <h2>Metas de ahorro</h2>
      {error && <p className="error">{error}</p>}

      <form onSubmit={onCreate} className="form card">
        <h3>Nueva meta</h3>
        <label>
          Nombre
          <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ej. Fondo de emergencia" />
        </label>
        <div className="field-block">
          <span className="field-label">Icono</span>
          <IconPicker value={icon} onChange={setIcon} />
        </div>
        <div className="row">
          <label>
            Objetivo
            <AmountInput id="goal-target" value={target} onChange={setTarget} />
          </label>
          <label>
            Fecha límite (opcional)
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </label>
        </div>
        <button type="submit" className="btn-primary">
          Crear meta
        </button>
      </form>

      {goals.length === 0 ? (
        <EmptyState
          title="Sin metas todavía"
          hint="Crea una meta de ahorro y vincúlala a un hábito para aportar en automático al completarlo."
        />
      ) : (
        <ul className="habit-list">
          {goals.map((g) => {
            const pct = Math.min(100, Math.round((g.savedCents / g.targetCents) * 100));
            return (
              <li key={g.id} className="card goal-card">
                <div className="goal-head">
                  <strong>
                    {g.icon ? `${g.icon} ` : ""}
                    {g.name}
                  </strong>
                  {pct >= 100 && <span className="badge">¡Lograda!</span>}
                </div>
                <div className="progress">
                  <span style={{ width: `${pct}%` }} />
                </div>
                <div className="goal-meta">
                  <span>
                    {formatMoney(g.savedCents)} / {formatMoney(g.targetCents)}
                  </span>
                  <span>{pct}%</span>
                  {g.deadline && <span>Límite: {g.deadline}</span>}
                </div>
                <div className="goal-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setContributeTo(contributeTo === g.id ? null : g.id);
                      setContributeAmount("");
                    }}
                  >
                    Aportar
                  </button>
                  <button type="button" className="btn-link" onClick={() => onDelete(g)}>
                    Eliminar
                  </button>
                </div>
                {contributeTo === g.id && (
                  <form onSubmit={(e) => onContribute(e, g)} className="row">
                    <label>
                      Importe
                      <AmountInput id={`contrib-${g.id}`} value={contributeAmount} onChange={setContributeAmount} />
                    </label>
                    <button type="submit" className="btn-primary">
                      Aportar
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Wire route and nav**

In `src/App.tsx`: `import GoalsPage from "./pages/Goals";`, `<NavLink to="/goals">Metas</NavLink>` after Deudas, and the `/goals` route wrapped in `Protected`.

- [ ] **Step 3: Verify**

`npm run typecheck` → clean. Browser: create a $1,000 goal picking an icon → card shows icon, 0%; contribute $1,000 → 100% and the "¡Lograda!" badge appears; delete → card disappears.

- [ ] **Step 4: Commit**

```bash
git add habit-tracker/frontend
git -c user.name="traderxael" -c user.email="traderxael@users.noreply.github.com" commit -m "feat(frontend): savings goals page with contributions"
```

---

### Task 13: Habits↔goals UI link + month summary on Today + final nav order

**Files:**
- Modify: `habit-tracker/frontend/src/pages/Habits.tsx` (goal link fields in the form)
- Modify: `habit-tracker/frontend/src/pages/Today.tsx` (month finance card + mini goals)
- Modify: `habit-tracker/frontend/src/App.tsx` (final nav order)

**Interfaces:**
- Consumes: `financeApi.listGoals/summary`, `Habit.goalId/goalAmountCents`, `formatMoney`, `parseAmountToCents`, `monthKey`, `AmountInput`, types `FinanceSummary`, `Goal`; `Link` (already imported in `Today.tsx`).
- Produces: the user-facing habit↔goal linking and the Hoy month summary — the last piece of the spec's integration requirement.

- [ ] **Step 1: Habits form goal link**

In `src/pages/Habits.tsx`:

1. Add imports:

```tsx
import { financeApi } from "../api/client";
import { AmountInput } from "../components/AmountInput";
import { parseAmountToCents } from "../lib/money";
import type { Goal } from "../types";
```

2. Add state next to the existing form state (`name`, `icon`, `color`, …):

```tsx
const [goals, setGoals] = useState<Goal[]>([]);
const [goalId, setGoalId] = useState("");
const [goalAmount, setGoalAmount] = useState("");
```

3. Load goals once on mount (add a `useEffect`; keep the existing one intact):

```tsx
useEffect(() => {
  financeApi
    .listGoals()
    .then((g) => setGoals(g.goals))
    .catch(() => undefined);
}, []);
```

4. In the submit handler, add these two properties to the body object sent to `api.post("/habits", …)` AND to the one sent to `api.put(\`/habits/${editingId}\`, …)`:

```ts
goal_id: goalId ? Number(goalId) : null,
goal_amount_cents: goalId && goalAmount ? parseAmountToCents(goalAmount) : null,
```

5. In `resetForm`, add `setGoalId(""); setGoalAmount("");`. In the edit path (where the form fields are populated from the habit being edited), add:

```ts
setGoalId(h.goalId ? String(h.goalId) : "");
setGoalAmount(h.goalAmountCents ? String(h.goalAmountCents / 100) : "");
```

6. In the JSX, after the `Frecuencia` `fieldset` and before the submit `.row`, insert:

```tsx
        <label>
          Vincular a meta (opcional)
          <select value={goalId} onChange={(e) => setGoalId(e.target.value)}>
            <option value="">Sin meta</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.icon ? `${g.icon} ` : ""}
                {g.name}
              </option>
            ))}
          </select>
        </label>
        {goalId && (
          <label>
            Aporte al completarlo
            <AmountInput id="habit-goal-amount" value={goalAmount} onChange={setGoalAmount} />
          </label>
        )}
```

- [ ] **Step 2: Today month summary**

In `src/pages/Today.tsx`:

1. Add imports:

```tsx
import { financeApi } from "../api/client";
import { formatMoney, monthKey } from "../lib/money";
import type { FinanceSummary, Goal } from "../types";
```

2. Add state next to the existing `habits`/`doneToday` state:

```tsx
const [summary, setSummary] = useState<FinanceSummary | null>(null);
const [goals, setGoals] = useState<Goal[]>([]);
```

3. Add a `useEffect` that runs on mount:

```tsx
useEffect(() => {
  const month = monthKey(new Date());
  financeApi
    .summary(month)
    .then(setSummary)
    .catch(() => undefined);
  financeApi
    .listGoals()
    .then((g) => setGoals(g.goals.filter((x) => x.savedCents < x.targetCents)))
    .catch(() => undefined);
}, []);
```

4. In the JSX, immediately after the existing `today-summary` block, insert:

```tsx
          {summary && (
            <div className="card today-finance">
              <h3>Este mes</h3>
              <div className="today-finance-row">
                <span>
                  Ingresos <strong className="amount-pos">{formatMoney(summary.income)}</strong>
                </span>
                <span>
                  Gastos <strong className="amount-neg">{formatMoney(summary.expense)}</strong>
                </span>
                <span>
                  Balance <strong>{formatMoney(summary.balance)}</strong>
                </span>
                <Link to="/finance" className="btn-link">
                  Ver movimientos
                </Link>
              </div>
              {goals.slice(0, 3).map((g) => {
                const pct = Math.min(100, Math.round((g.savedCents / g.targetCents) * 100));
                return (
                  <div key={g.id} className="mini-goal">
                    <span aria-hidden="true">{g.icon ?? "🎯"}</span>
                    <span>{g.name}</span>
                    <div className="progress">
                      <span style={{ width: `${pct}%` }} />
                    </div>
                    <span className="muted">{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
```

- [ ] **Step 3: Final nav order**

In `src/App.tsx`, confirm the nav reads exactly: Hoy (`/` with `end`), Hábitos (`/habits`), Finanzas (`/finance`), Deudas (`/debts`), Metas (`/goals`), Calendario (`/calendar`), then the existing user/email/Salir block.

- [ ] **Step 4: Verify (end-to-end link)**

`npm run typecheck` → clean. Browser E2E via take_snapshot + evaluate_script:
1. On `/goals` create meta "Ahorro" with target `$1,000.00`.
2. On `/habits` create habit "Ahorrar diario" → select the meta → set aporte `20` → save.
3. On `/` (Hoy) toggle the habit → the "Este mes" card shows the mini-goal at 2%.
4. Toggle it off → the mini-goal returns to 0% (the auto contribution was revoked).
5. Confirm the movement/summary values use `$1,234.56` formatting everywhere (no raw numbers with a hand-written `$`).

- [ ] **Step 5: Commit**

```bash
git add habit-tracker/frontend
git -c user.name="traderxael" -c user.email="traderxael@users.noreply.github.com" commit -m "feat(frontend): habit-goal linking and month finance summary on Today"
```

---

### Task 14: DESIGN.md + README + full verification gates

**Files:**
- Modify: `habit-tracker/DESIGN.md` (frontmatter components + `## Components` prose)
- Modify: `habit-tracker/README.md` (features, endpoints, test commands)

**Interfaces:**
- Consumes: everything from Tasks 1–13.
- Produces: updated docs and the final green gates (tests, typecheck, builds, production smoke).

- [ ] **Step 1: Read the current frontmatter**

Read `habit-tracker/DESIGN.md` and note the exact existing keys under `colors`, `typography`, `rounded`. Do not invent token names — reuse what is there. If `colors.success` / `colors.danger` are missing from the frontmatter, add them with the values from `styles.css` `:root`: `success: "#16a34a"` and `danger: "#e11d48"`.

- [ ] **Step 2: Add component entries to the frontmatter**

Append to the `components:` map (only official sub-tokens: `backgroundColor`, `textColor`, `typography`, `rounded`, `padding`, `size`, `height`, `width`), adjusting `{typography.*}`/`{rounded.*}` names to the real keys found in Step 1:

```yaml
  month-nav:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
  amount-input:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.text}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: 0.55rem 0.6rem
  movement-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body-md}"
  movement-amount-income:
    textColor: "{colors.success}"
    typography: "{typography.body-md}"
  movement-amount-expense:
    textColor: "{colors.danger}"
    typography: "{typography.body-md}"
  goal-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: 1rem 1.1rem
  badge-goal-complete:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: 0.15rem 0.6rem
  finance-summary-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body-md}"
    rounded: "{rounded.lg}"
    padding: 1rem 1.1rem
```

- [ ] **Step 3: Add the prose subsection**

In `## Components`, add a "Finanzas" subsection covering: `month-nav` (ghost chevrons + capitalized month label via `monthLabelES`), `amount-input` (`$` prefix, `--surface-2` background, `--ring` on `:focus-within`), movement rows (`.mov-item` with `+`/`−` sign AND `--success`/`--danger` color so meaning is never color-alone), by-category bars (reuse `.bar` + `--grad-bar`), goal/debt cards (`.goal-card` with `.progress`), the completion `.badge`, and the Today finance card. State the rule explicitly: money is always rendered through `formatMoney` — never a hardcoded `$` plus a raw number in JSX.

- [ ] **Step 4: Update README**

Add to the features list: Finanzas (ingresos y gastos por categoría con resumen mensual), Deudas con pagos y saldo calculado, Metas de ahorro con aportes manuales y automáticos al completar hábitos vinculados. Add the new endpoints to the API table: `/api/categories`, `/api/transactions`, `/api/finance/summary`, `/api/debts` (+ `/:id/payments`), `/api/goals` (+ `/:id/contributions`). Add `npm test` to the backend and frontend command tables and mention vitest + supertest as dev dependencies.

- [ ] **Step 5: Full verification gates**

```bash
cd habit-tracker/backend && npm test && npm run typecheck && npm run build
cd ../frontend && npm test && npm run typecheck && npm run build
```

All six commands must exit 0. Then production smoke test:

```bash
cd habit-tracker/backend && NODE_ENV=production node dist/index.js
```

Open http://localhost:3001, register a fresh user and confirm: 9 default categories present on `/finance`; empty state renders; a new movement updates the three stat cards and the by-category bars; `/debts` accepts a debt and a payment and updates progress; `/goals` accepts a goal, an icon and a contribution; on `/habits` linking a goal with an amount and toggling it on `/` moves the mini-goal progress and reverts on toggle-off. Stop the server afterwards.

- [ ] **Step 6: Commit**

```bash
git add habit-tracker/DESIGN.md habit-tracker/README.md
git -c user.name="traderxael" -c user.email="traderxael@users.noreply.github.com" commit -m "docs: document finance module in DESIGN.md and README"
```

---

## Self-review notes

**Spec coverage** — every spec requirement maps to a task:

| Spec item | Task |
| --- | --- |
| Integer cents, schema for 5 tables, idempotent `ALTER TABLE habits` | 2 |
| Default category seeding on register | 2, 3 |
| Categories CRUD + 409 when in use | 3, 4 (409 test) |
| Transactions CRUD + `?month=` filter | 4 |
| `GET /api/finance/summary` with `byCategory` | 4 |
| Debts CRUD + payments + computed balance + overpay rejection | 5 |
| Goals CRUD + contributions (manual add/delete) | 6 |
| Habit↔goal link, auto contribution on toggle, revoke on untoggle, single SQL transaction | 7 |
| Ownership validation on every referenced id | 3, 4, 5, 6, 7 |
| `formatMoney` / `parseAmountToCents` single source of money formatting | 8 |
| Frontend types + `financeApi` | 8 |
| `MonthNav`, `AmountInput`, finance CSS with tokens only | 9 |
| `/finance` page (month nav, 3 stat cards, by-category bars, grouped movements, empty state, category form) | 10 |
| `/debts` page | 11 |
| `/goals` page with `IconPicker` | 12 |
| Habits form goal link + Hoy month summary card + mini goals | 13 |
| Nav order Hoy · Hábitos · Finanzas · Deudas · Metas · Calendario | 13 |
| DESIGN.md + README updates | 14 |
| Verification: tests, typecheck, builds, production smoke, E2E | 14 |
| Out of scope (budgets, multi-currency, CSV, recurrence, multi-month charts) | intentionally absent |

**Placeholder scan** — no "TBD"/"add error handling"/"similar to Task N"; every code step carries full literal code, every test step carries real assertions, every task ends with an explicit commit command.

**Type consistency** — verified across tasks: `serializeCategory`/`Category` ↔ `{ id, name, icon, type, color, createdAt }`; `serializeTx`/`Transaction` ↔ `amountCents`, `categoryName`, `categoryIcon`, `debtId`; `serializeDebt`/`Debt` ↔ `totalCents`, `paidCents`, `remainingCents`, `dueDate`; `serializeGoal`/`Goal` ↔ `targetCents`, `savedCents`, `deadline`; `serializeContribution`/`GoalContribution` ↔ `goalId`, `amountCents`, `habitId`. Backend accepts snake_case bodies (`amount_cents`, `total_cents`, `target_cents`, `goal_id`, `goal_amount_cents`, `category_id`, `debt_id`, `due_date`) and returns camelCase — `financeApi` in Task 8 sends exactly those snake_case keys and consumes exactly those camelCase shapes. `Habit` gains `goalId`/`goalAmountCents` in Task 8 and `habits.ts` serializes them in Task 7. Money helpers keep the same names in every consumer (`formatMoney`, `parseAmountToCents`, `monthKey`, `addMonths`, `monthLabelES`). Test helper contract (`app`, `token`, `auth`) is defined in Task 1 and used unchanged in Tasks 3–7.

**Two deliberate ordering notes** — (1) `debts` is created before `transactions` in the schema because `transactions.debt_id` references it; (2) the category-deletion 409 test lives in Task 4's file, not Task 3's, because it needs `POST /api/transactions` to exist.
