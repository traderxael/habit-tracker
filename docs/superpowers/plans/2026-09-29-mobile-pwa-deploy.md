# Mobile PWA Deploy (Vercel + Turso + PWA) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar habit-tracker + finanzas como app personal instalable (PWA) en una URL de Vercel, con datos persistentes en Turso, y cerrar las 2 desviaciones de spec del módulo de finanzas.

**Architecture:** Frontend Vite estático servido por la CDN de Vercel; la app Express actual (solo API) exportada como una única función serverless Node en `/api/*`; la capa de datos migra de `better-sqlite3` (sync) a `@libsql/client` (async) apuntando a Turso en producción y a un archivo/memoria en local/tests; capa PWA con `vite-plugin-pwa` (manifest + iconos + service worker).

**Tech Stack:** React 18, Vite 5, TypeScript, `vite-plugin-pwa`, Node + Express 4 (TS ESM), `@libsql/client`, Vercel (Node runtime), Turso (libSQL), Vitest + supertest.

**Spec:** `docs/superpowers/specs/2026-09-29-mobile-pwa-deploy-design.md`

## Global Constraints

- Dinero SIEMPRE en centavos enteros; nunca floats. Cuerpos de petición en `snake_case` (`amount_cents`, `total_cents`, `target_cents`, `goal_id`, `goal_amount_cents`, `category_id`, `debt_id`, `due_date`); respuestas en `camelCase` (`amountCents`, …).
- Toda la copy de cara al usuario en español.
- Una única capa de datos: `@libsql/client`. Se **elimina** `better-sqlite3` y `@types/better-sqlite3` de `backend/package.json`.
- El wrapper `db` de `backend/src/db.ts` conserva la forma de llamada de better-sqlite3 (`.prepare(sql).get/all/run(...)`) pero **asíncrona**; `.run()` devuelve `{ changes: number; lastInsertRowid: number }`. Esto hace que el port de cada ruta sea: marcar el handler `async` y anteponer `await` a cada `db.prepare(...)`.
- `initSchema()` **NO** se ejecuta en la función de Vercel (runtime sin estado). Se ejecuta en: `backend/scripts/init-db.ts` (Turso, una vez), `backend/src/index.ts` (arranque dev/Docker) y `backend/src/test/helpers.ts` (tests). El DDL es idempotente (`CREATE TABLE IF NOT EXISTS`).
- Las **cascadas referenciales se garantizan en código de aplicación** (borrado por lotes atómico con `client.batch([...], "write")`), no dependiendo del enforcement de FK de Turso. Las FK se declaran igual como defensa.
- En `NODE_ENV=production` se exigen `JWT_SECRET`, `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`; si falta alguna, `config.ts` lanza un error claro (sin fallback `dev-secret-change-me` ni SQLite local).
- No usar `express.static` en la función de Vercel (la plataforma lo ignora): el SPA se sirve vía `vercel.json` (static `frontend/dist` + rewrite de fallback). `API_BASE` del frontend se mantiene `""` (mismo origen).
- No hard-codear hex/rgb en CSS/JSX de features: usar tokens de `DESIGN.md`/`styles.css`. (La única excepción permitida: valores literales de `theme_color`/`background_color` dentro del `manifest` JSON de la PWA, que no es CSS.)
- Git: NUNCA actualizar git config; usar identidad inline `-c user.name="traderxael" -c user.email="traderxael@users.noreply.github.com"` en cada commit. Commits nuevos (no `--amend`). No commitear `.env` ni `*.sqlite`/`*.db` ni secretos reales. Stagear ficheros concretos, no `git add -A`.
- El trabajo de despliegue/PWA/fixes va en una rama nueva **`feature/mobile-pwa-deploy`** creada desde `master`.
- Ningún paso de este plan hace `git push` ni publica a Vercel/Turso: el push y el despliegue final requieren cuentas del usuario y se confirman aparte (Task 9 deja el repo listo y la guía para que el usuario ejecute `vercel --prod`).

---

## File Structure

- `backend/package.json` — deps: quitar `better-sqlite3`/`@types/better-sqlite3`, añadir `@libsql/client`. Añadir script `db:init`.
- `backend/src/config.ts` — resolver `DATABASE_URL` + `TURSO_AUTH_TOKEN`; validación en producción.
- `backend/src/schema.ts` — (nuevo) `DDL: string[]` con el esquema completo (las 8 tablas + columnas de habits). Fuente única de DDL.
- `backend/src/db.ts` — reescrito: `client` libSQL singleton, wrapper `db` async, `initSchema()`.
- `backend/scripts/init-db.ts` — (nuevo) ejecuta `initSchema()` una vez contra la URL de entorno.
- `backend/src/app.ts` — `/api/health` async; se divide en Task 2 (solo API).
- `backend/src/lib/streaks.ts`, `backend/src/routes/{auth,categories,completions,debts,finance,goals,habits,transactions}.ts` — port async + cascadas app-level.
- `backend/src/test/helpers.ts` — harness libSQL (`:memory:` + `initSchema`).
- `backend/src/test/{schema,db}.test.ts` — async; CHECK vía `rejects.toThrow`.
- `frontend/vite.config.ts` — plugin PWA.
- `frontend/package.json` — `vite-plugin-pwa`, `sharp` (dev), script `icons`.
- `frontend/public/icon.svg`, `pwa-192x192.png`, `pwa-512x512.png`, `pwa-maskable-512.png`, `apple-touch-icon.png` — marca.
- `frontend/scripts/gen-icons.mjs` — (nuevo) rasteriza iconos PNG desde `icon.svg`.
- `frontend/index.html` — título + meta móvil.
- `frontend/src/pages/{Debts,Goals,Habits}.tsx` — cierres de spec.
- `frontend/src/api/client.ts` — `listContributions`.
- `frontend/src/types.ts` — `Goal.contributions?` no; se añade helper para aporte con id.
- `api/index.ts` (raíz) — función Vercel.
- `vercel.json`, `package.json` (raíz) — despliegue.
- `Dockerfile`, `README.md`, `DESIGN.md`, `DEPLOY.md` — adaptación y docs.

---

## Task 1: Capa de datos a libSQL (async) + schema + init-db + tests

**Files:**
- Modify: `habit-tracker/backend/package.json`
- Modify: `habit-tracker/backend/src/config.ts`
- Create: `habit-tracker/backend/src/schema.ts`
- Modify: `habit-tracker/backend/src/db.ts`
- Create: `habit-tracker/backend/scripts/init-db.ts`
- Modify: `habit-tracker/backend/src/app.ts` (`/api/health` solo; sin tocar el bloque estático todavía)
- Modify: `habit-tracker/backend/src/lib/streaks.ts`
- Modify: `habit-tracker/backend/src/routes/auth.ts`
- Modify: `habit-tracker/backend/src/routes/categories.ts`
- Modify: `habit-tracker/backend/src/routes/completions.ts`
- Modify: `habit-tracker/backend/src/routes/debts.ts`
- Modify: `habit-tracker/backend/src/routes/finance.ts`
- Modify: `habit-tracker/backend/src/routes/goals.ts`
- Modify: `habit-tracker/backend/src/routes/habits.ts`
- Modify: `habit-tracker/backend/src/routes/transactions.ts`
- Modify: `habit-tracker/backend/src/test/helpers.ts`
- Modify: `habit-tracker/backend/src/test/schema.test.ts`
- Create: `habit-tracker/backend/src/test/db.test.ts`

**Interfaces:**
- Produces: `db.prepare(sql).get/all/run` async (`.run` → `{changes,lastInsertRowid}`); `client` (libSQL `Client`) con `client.batch(stmts,"write")`; `initSchema(): Promise<void>`; `DATABASE_URL` y `TURSO_AUTH_TOKEN` desde `config.js`. `habitStats` pasa a `Promise<HabitStats>`.
- Consumes: nada previo; este es el primer task.

- [ ] **Step 1: Cambiar dependencias**

En `habit-tracker/backend/`, quitar better-sqlite3 e instalar libSQL (npm resuelve la última versión):

```bash
cd habit-tracker/backend
npm uninstall better-sqlite3 @types/better-sqlite3
npm install @libsql/client@latest
```

Luego en `habit-tracker/backend/package.json` eliminar la entrada `better-sqlite3` del bloque `allowScripts` (si queda) y añadir al `scripts`: `"db:init": "tsx scripts/init-db.ts"`.

- [ ] **Step 2: Verificar install**

Run: `cd habit-tracker/backend && node -e "import('@libsql/client').then(m=>console.log(typeof m.createClient))"`
Expected: imprime `function` (el paquete está instalado y exportable). `better-sqlite3` ya no debe estar en `node_modules`.

- [ ] **Step 3: config.ts con validación en producción**

Reemplazar `habit-tracker/backend/src/config.ts` por:

```ts
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name} (obligatoria en producción)`);
  return v;
}

const isProd = process.env.NODE_ENV === "production";

export const JWT_SECRET = isProd ? required("JWT_SECRET") : (process.env.JWT_SECRET ?? "dev-secret-change-me");
export const TOKEN_TTL = process.env.TOKEN_TTL ?? "7d";

// URL de la base: Turso remoto (libsql://…) o local (:memory: / file:...).
export const TURSO_AUTH_TOKEN = isProd ? required("TURSO_AUTH_TOKEN") : (process.env.TURSO_AUTH_TOKEN ?? "");

export const DATABASE_URL = (() => {
  const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL;
  if (isProd) return url ?? required("TURSO_DATABASE_URL");
  return url ?? "file:./data.sqlite";
})();
```

- [ ] **Step 4: schema.ts con el DDL idempotente**

Crear `habit-tracker/backend/src/schema.ts` con las 8 tablas y las 2 columnas de habits, en el mismo orden que el `db.ts` actual:

```ts
// DDL idempotente. Fuente única de esquema para init-db, index.ts (dev/Docker) y tests.
export const DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     email TEXT NOT NULL UNIQUE,
     password_hash TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   )`,
  `CREATE TABLE IF NOT EXISTS habits (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     name TEXT NOT NULL,
     icon TEXT,
     color TEXT,
     schedule_json TEXT NOT NULL DEFAULT '{}',
     archived INTEGER NOT NULL DEFAULT 0,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   )`,
  `CREATE TABLE IF NOT EXISTS completions (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
     date TEXT NOT NULL,
     UNIQUE(habit_id, date)
   )`,
  `CREATE TABLE IF NOT EXISTS categories (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     name TEXT NOT NULL,
     icon TEXT,
     type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
     color TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   )`,
  `CREATE TABLE IF NOT EXISTS debts (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     name TEXT NOT NULL,
     total_cents INTEGER NOT NULL CHECK (total_cents > 0),
     due_date TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   )`,
  `CREATE TABLE IF NOT EXISTS transactions (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
     debt_id INTEGER REFERENCES debts(id) ON DELETE SET NULL,
     type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
     amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
     note TEXT,
     date TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   )`,
  `CREATE TABLE IF NOT EXISTS goals (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     name TEXT NOT NULL,
     icon TEXT,
     target_cents INTEGER NOT NULL CHECK (target_cents > 0),
     deadline TEXT,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   )`,
  `CREATE TABLE IF NOT EXISTS goal_contributions (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
     habit_id INTEGER REFERENCES habits(id) ON DELETE SET NULL,
     amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
     date TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (datetime('now'))
   )`,
  "ALTER TABLE habits ADD COLUMN goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL",
  "ALTER TABLE habits ADD COLUMN goal_amount_cents INTEGER",
];
```

- [ ] **Step 5: db.ts reescrito (client + wrapper async + initSchema)**

Reemplazar `habit-tracker/backend/src/db.ts` por:

```ts
import { createClient, type Client } from "@libsql/client";
import { DATABASE_URL, TURSO_AUTH_TOKEN } from "./config.js";
import { DDL } from "./schema.js";

export const client: Client = createClient({
  url: DATABASE_URL,
  authToken: TURSO_AUTH_TOKEN || undefined,
});

interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

// Wrapper que imita la API de better-sqlite3 pero asíncrona, para que cada ruta
// solo cambie a `await db.prepare(...).get/all/run(...)`.
export const db = {
  prepare(sql: string) {
    return {
      async get(...args: unknown[]): Promise<any> {
        const r = await client.execute({ sql, args });
        return r.rows.length ? r.rows[0] : undefined;
      },
      async all(...args: unknown[]): Promise<any[]> {
        const r = await client.execute({ sql, args });
        return r.rows as any[];
      },
      async run(...args: unknown[]): Promise<RunResult> {
        const r = await client.execute({ sql, args });
        return { changes: r.rowsAffected, lastInsertRowid: Number(r.lastInsertRowid ?? 0) };
      },
    };
  },
};

// Idempotente: ignora "duplicate column name" en los ALTER (columnas ya presentes).
export async function initSchema(): Promise<void> {
  for (const sql of DDL) {
    try {
      await client.execute(sql);
    } catch (err) {
      if (!/duplicate column name/i.test(String(err))) throw err;
    }
  }
}
```

- [ ] **Step 6: init-db.ts**

Crear `habit-tracker/backend/scripts/init-db.ts`:

```ts
import { initSchema } from "../src/db.js";
import { DATABASE_URL } from "../src/config.js";

async function main() {
  console.log(`Inicializando esquema en ${DATABASE_URL.startsWith("libsql") ? "Turso" : DATABASE_URL}`);
  await initSchema();
  console.log("Esquema listo.");
  process.exit(0);
}

main().catch((err) => {
  console.error("init-db falló:", err);
  process.exit(1);
});
```

- [ ] **Step 7: app.ts `/api/health` async**

En `habit-tracker/backend/src/app.ts`, cambiar el handler de health (NO tocar el bloque estático de producción en este task; eso es Task 2):

```ts
  app.get("/api/health", async (_req, res) => {
    const row = await db
      .prepare("SELECT COUNT(*) AS tables FROM sqlite_master WHERE type = 'table'")
      .get() as { tables: number };
    res.json({ status: "ok", tables: Number(row.tables) });
  });
```

- [ ] **Step 8: streaks.ts async**

En `habit-tracker/backend/src/lib/streaks.ts`, cambiar la firma y la lectura:

```ts
export async function habitStats(habitId: number, schedule: Schedule): Promise<HabitStats> {
  const rows = (await db.prepare("SELECT date FROM completions WHERE habit_id = ?").all(habitId)) as {
    date: string;
  }[];
```

(El resto del cuerpo queda igual; solo se cambió `function` → `async function`, el retorno de tipo a `Promise<HabitStats>`, y `db.prepare(...).all(...)` → `await ...`.)

- [ ] **Step 9: auth.ts (register/login async, seed por batch)**

Reemplazar `seedCategories` y los dos handlers en `habit-tracker/backend/src/routes/auth.ts`:

```ts
async function seedCategories(userId: number): Promise<void> {
  const stmts = DEFAULT_CATEGORIES.map((c) => ({
    sql: "INSERT INTO categories (user_id, name, icon, type, color) VALUES (?, ?, ?, ?, ?)",
    args: [userId, c.name, c.icon, c.type, c.color],
  }));
  await client.batch(stmts, "write");
}
```

```ts
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
```

Añadir a los imports de `auth.ts`: `import { db, client } from "../db.js";` (la importación actual es `import { db } from "../db.js";` → se añade `client`).

- [ ] **Step 10: categories.ts async**

En `habit-tracker/backend/src/routes/categories.ts`, marcar los 3 handlers `async` y añadir `await` delante de cada `db.prepare(...)` (GET `/`, POST `/`, DELETE `/:id` — en DELETE hay dos llamadas: `SELECT id` y `SELECT COUNT`). Ejemplo de los dos `get`/`all` y el `run`:

```ts
categoriesRouter.get("/", async (req, res) => {
  const rows = (await db
    .prepare("SELECT * FROM categories WHERE user_id = ? ORDER BY type ASC, name ASC")
    .all(req.userId!)) as CategoryRow[];
  res.json({ categories: rows.map(serializeCategory) });
});
```

En POST: `const info = await db.prepare("INSERT ...").run(...)` y luego `const row = await db.prepare("SELECT * FROM categories WHERE id = ?").get(info.lastInsertRowid) as CategoryRow;` (ya no hace falta `Number(...)` porque el wrapper devuelve número; `Number(...)` también es válido si se prefiere mantenerlo). En DELETE: `const row = await db.prepare(...).get(id, req.userId!)` y `const used = await db.prepare("SELECT COUNT(*) AS n ...").get(id) as { n: number };`.

- [ ] **Step 11: completions.ts (toggle con batch atómico)**

Reemplazar el bloque del toggle en `habit-tracker/backend/src/routes/completions.ts` (desde `completionsRouter.post("/toggle"` hasta el final). IMPORTA añadir `client` al import: `import { db, client } from "../db.js";`. La lectura previa queda fuera del lote (son SELECT); las escrituras van atómicas con `client.batch`:

```ts
// POST /api/completions/toggle { habitId, date }
completionsRouter.post("/toggle", async (req, res) => {
  const userId = req.userId!;
  const { habitId, date } = req.body ?? {};
  const id = Number(habitId);
  if (!Number.isInteger(id) || typeof date !== "string" || !DATE_RE.test(date)) {
    res.status(400).json({ error: "habitId (número) y date (YYYY-MM-DD) son obligatorios" });
    return;
  }
  const habit = (await db
    .prepare("SELECT id, goal_id, goal_amount_cents FROM habits WHERE id = ? AND user_id = ?")
    .get(id, userId)) as
    | { id: number; goal_id: number | null; goal_amount_cents: number | null }
    | undefined;
  if (!habit) {
    res.status(404).json({ error: "Hábito no encontrado" });
    return;
  }
  const existing = (await db
    .prepare("SELECT id FROM completions WHERE habit_id = ? AND date = ?")
    .get(id, date)) as { id: number } | undefined;

  const linked = !!habit.goal_id && !!habit.goal_amount_cents;
  const stmts: { sql: string; args: unknown[] }[] = [];
  let completed: boolean;
  if (existing) {
    completed = false;
    stmts.push({ sql: "DELETE FROM completions WHERE id = ?", args: [existing.id] });
    if (linked) stmts.push({ sql: "DELETE FROM goal_contributions WHERE habit_id = ? AND date = ?", args: [id, date] });
  } else {
    completed = true;
    stmts.push({ sql: "INSERT INTO completions (habit_id, date) VALUES (?, ?)", args: [id, date] });
    if (linked)
      stmts.push({
        sql: "INSERT INTO goal_contributions (user_id, goal_id, habit_id, amount_cents, date) VALUES (?, ?, ?, ?, ?)",
        args: [userId, habit.goal_id, id, habit.goal_amount_cents, date],
      });
  }
  await client.batch(stmts, "write");
  res.json({ completed, habitId: id, date });
});
```

- [ ] **Step 12: debts.ts async + DELETE y pago coherentes**

En `habit-tracker/backend/src/routes/debts.ts`: añadir `client` al import (`import { db, client } from "../db.js";`). Marcar los 5 handlers `async` y añadir `await` a cada `db.prepare(...)`. Cambiar el DELETE para borrar pagos+deuda en un lote atómico:

```ts
// DELETE /api/debts/:id
debtsRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const owner = req.userId!;
  const existing = await db.prepare("SELECT id FROM debts WHERE id = ? AND user_id = ?").get(id, owner);
  if (!existing) {
    res.status(404).json({ error: "Deuda no encontrada" });
    return;
  }
  await client.batch(
    [
      { sql: "DELETE FROM transactions WHERE debt_id = ? AND user_id = ?", args: [id, owner] },
      { sql: "DELETE FROM debts WHERE id = ? AND user_id = ?", args: [id, owner] },
    ],
    "write",
  );
  res.status(204).end();
});
```

En POST `/`: `const info = await db.prepare("INSERT INTO debts ...").run(...)`; `const row = await db.prepare(...).get(info.lastInsertRowid) as DebtRow;`. En PUT y POST `/:id/payments`, mismo patrón (`await` delante de cada llamada; `const row = await db.prepare(\`${SELECT_DEBT} WHERE d.id = ?\`).get(id) as DebtRow;`).

- [ ] **Step 13: finance.ts async**

En `habit-tracker/backend/src/routes/finance.ts`, marcar el handler `async` y anteponer `await`:

```ts
financeRouter.get("/summary", async (req, res) => {
  const month = String(req.query.month ?? "");
  if (!MONTH_RE.test(month)) {
    res.status(400).json({ error: "Parámetro month obligatorio (YYYY-MM)" });
    return;
  }
  const { from, to } = monthRange(month);
  const totals = (await db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'income' THEN amount_cents END), 0) AS income,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_cents END), 0) AS expense
       FROM transactions
       WHERE user_id = ? AND date >= ? AND date <= ?`,
    )
    .get(req.userId!, from, to)) as { income: number; expense: number };
  const byCategory = (await db
    .prepare(
      `SELECT c.id AS categoryId, c.name AS name, c.icon AS icon, c.color AS color,
              SUM(t.amount_cents) AS total
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = ? AND t.date >= ? AND t.date <= ?
       GROUP BY c.id
       ORDER BY total DESC`,
    )
    .all(req.userId!, from, to)) as {
    categoryId: number;
    name: string;
    icon: string | null;
    color: string | null;
    total: number;
  }[];
  res.json({
    income: Number(totals.income),
    expense: Number(totals.expense),
    balance: Number(totals.income) - Number(totals.expense),
    byCategory,
  });
});
```

(Se añade `Number(...)` a los totales por seguridad: libSQL puede devolver `bigint` en agregaciones; los valores están dentro del rango seguro.)

- [ ] **Step 14: goals.ts async + DELETE con cascada app-level + endpoint de aportes**

En `habit-tracker/backend/src/routes/goals.ts`: añadir `client` al import. Marcar los 5 handlers actuales `async` y añadir `await` a cada `db.prepare(...)`. Reemplazar el DELETE para hacer la cascada en código (no depender de FK) y en un lote atómico:

```ts
// DELETE /api/goals/:id
goalsRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const owner = req.userId!;
  const existing = await db.prepare("SELECT id FROM goals WHERE id = ? AND user_id = ?").get(id, owner);
  if (!existing) {
    res.status(404).json({ error: "Meta no encontrada" });
    return;
  }
  await client.batch(
    [
      { sql: "DELETE FROM goal_contributions WHERE goal_id = ?", args: [id] },
      { sql: "UPDATE habits SET goal_id = NULL, goal_amount_cents = NULL WHERE goal_id = ? AND user_id = ?", args: [id, owner] },
      { sql: "DELETE FROM goals WHERE id = ? AND user_id = ?", args: [id, owner] },
    ],
    "write",
  );
  res.status(204).end();
});
```

**Además, crear un endpoint para listar aportes de una meta** (lo consume el frontend en Task 6 para el borrado manual). Añadir al final de `goals.ts`, reutilizando `serializeContribution` que ya existe:

```ts
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
```

En POST `/:id/contributions`: `const info = await db.prepare(...).run(...)`; `const row = await db.prepare("SELECT * FROM goal_contributions WHERE id = ?").get(info.lastInsertRowid) as ContributionRow;`. En POST `/`: `const info = await db.prepare("INSERT INTO goals ...").run(...)`; `const row = await db.prepare(\`${SELECT_GOAL} WHERE g.id = ?\`).get(info.lastInsertRowid) as GoalRow;`. En PUT: `await` delante del UPDATE y del `SELECT_GOAL` final.

- [ ] **Step 15: habits.ts async + validGoalLink async + GET stats await + DELETE cascada**

En `habit-tracker/backend/src/routes/habits.ts`: añadir `client` al import. Convertir `validGoalLink` a async:

```ts
async function validGoalLink(userId: number, goalId: unknown, amountCents: unknown): Promise<string | null> {
  if (amountCents !== undefined && amountCents !== null) {
    if (!Number.isInteger(amountCents) || (amountCents as number) <= 0) {
      return "goal_amount_cents debe ser un entero mayor que 0";
    }
  }
  if (goalId === undefined || goalId === null) return null;
  const gid = Number(goalId);
  if (!Number.isInteger(gid)) return "goal_id inválido";
  const goal = await db.prepare("SELECT id FROM goals WHERE id = ? AND user_id = ?").get(gid, userId);
  if (!goal) return "Meta no encontrada";
  return null;
}
```

GET `/`: `const rows = (await db.prepare(...).all(userId)) as HabitRow[];`. En la rama `includeStats`, reemplazar el `.map((h) => ({...h, stats: habitStats(...)}))` (ahora devuelve Promise) por:

```ts
  if (req.query.includeStats === "1") {
    const withStats = await Promise.all(habits.map(async (h) => ({ ...h, stats: await habitStats(h.id, h.schedule) })));
    res.json({ habits: withStats });
    return;
  }
```

POST y PUT: `const goalError = await validGoalLink(userId, goal_id, goal_amount_cents);`, y `await` delante de INSERT/UPDATE/SELECT. En PUT el `Number(...)` sobre `info.lastInsertRowid` puede simplificarse a `info.lastInsertRowid` (ya number).

Reemplazar DELETE por cascada app-level atómica:

```ts
// DELETE /api/habits/:id
habitsRouter.delete("/:id", async (req, res) => {
  const userId = req.userId!;
  const id = Number(req.params.id);
  const existing = await db.prepare("SELECT id FROM habits WHERE id = ? AND user_id = ?").get(id, userId);
  if (!existing) {
    res.status(404).json({ error: "Hábito no encontrado" });
    return;
  }
  await client.batch(
    [
      { sql: "DELETE FROM completions WHERE habit_id = ?", args: [id] },
      { sql: "UPDATE goal_contributions SET habit_id = NULL WHERE habit_id = ?", args: [id] },
      { sql: "DELETE FROM habits WHERE id = ? AND user_id = ?", args: [id, userId] },
    ],
    "write",
  );
  res.status(204).end();
});
```

- [ ] **Step 16: transactions.ts async**

En `habit-tracker/backend/src/routes/transactions.ts`: convertir `validateBody` a `async` (contiene dos `db.prepare(...).get` → `await`), marcar los 4 handlers `async`, `const v = await validateBody(...)` en POST, y `await` delante de cada `db.prepare(...)` en GET/PUT/DELETE.

```ts
async function validateBody(body: any, userId: number): Promise<ValidBody | string> {
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
    const cat = (await db
      .prepare("SELECT id, type FROM categories WHERE id = ? AND user_id = ?")
      .get(cid, userId)) as { id: number; type: string } | undefined;
    if (!cat) return "Categoría no encontrada";
    if (cat.type !== type) return "La categoría no corresponde al tipo de movimiento";
    categoryId = cid;
  }
  let debtId: number | null = null;
  if (body.debt_id !== undefined && body.debt_id !== null) {
    if (type !== "expense") return "Solo los gastos pueden vincularse a una deuda";
    const did = Number(body.debt_id);
    const debt = await db.prepare("SELECT id FROM debts WHERE id = ? AND user_id = ?").get(did, userId);
    if (!debt) return "Deuda no encontrada";
    debtId = did;
  }
  return { type, amountCents: body.amount_cents, note, date: body.date, categoryId, debtId };
}
```

En GET: `const rows = (await db.prepare(\`${SELECT_TX} ...\`).all(req.userId!, from, to)) as TxRow[];`. POST: `const info = await db.prepare("INSERT ...").run(...)` y `const row = await db.prepare(...).get(info.lastInsertRowid) as TxRow;`. PUT: `const existing = await db.prepare(...).get(...)`, `await db.prepare("UPDATE ...").run(...)`, `const row = await db.prepare(...).get(id) as TxRow;`. DELETE: `const info = await db.prepare("DELETE ...").run(...)`; el `if (info.changes === 0)` sigue funcionando (el wrapper devuelve `changes`).

- [ ] **Step 17: helpers.ts harness a libSQL**

Reemplazar `habit-tracker/backend/src/test/helpers.ts` para que use un archivo temporal libSQL y ejecute el esquema (las rutas ya son async):

```ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";

const dir = mkdtempSync(path.join(tmpdir(), "ht-test-"));
process.env.DATABASE_URL = `file:${path.join(dir, "test.db")}`;
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";

const { createApp } = await import("../app.js");
const { initSchema } = await import("../db.js");
await initSchema();

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

- [ ] **Step 18: schema.test.ts async**

Reemplazar `habit-tracker/backend/src/test/schema.test.ts` (usa `db` directo, ahora async; el CHECK se comprueba con `rejects.toThrow`):

```ts
import "./helpers.js";
import { createCtx } from "./helpers.js";
import { describe, expect, it } from "vitest";
import { db } from "../db.js";

async function tableExists(name: string): Promise<boolean> {
  return !!(await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const cols = (await db.prepare(`PRAGMA table_info(${table})`).all()) as { name: string }[];
  return cols.some((c) => c.name === column);
}

describe("schema finanzas", () => {
  it("crea las tablas nuevas", async () => {
    for (const t of ["categories", "transactions", "debts", "goals", "goal_contributions"]) {
      expect(await tableExists(t)).toBe(true);
    }
  });

  it("habits gana goal_id y goal_amount_cents", async () => {
    expect(await columnExists("habits", "goal_id")).toBe(true);
    expect(await columnExists("habits", "goal_amount_cents")).toBe(true);
  });

  it("amount_cents no acepta valores <= 0", async () => {
    await createCtx();
    const user = (await db.prepare("SELECT id FROM users ORDER BY id LIMIT 1").get()) as { id: number };
    expect(user.id).toBeGreaterThan(0);
    await expect(
      db
        .prepare("INSERT INTO transactions (user_id, type, amount_cents, date) VALUES (?, 'expense', 0, '2026-09-01')")
        .run(user.id),
    ).rejects.toThrow(/CHECK/i);
  });
});
```

- [ ] **Step 19: db.test.ts (contrato del wrapper async)**

Crear `habit-tracker/backend/src/test/db.test.ts`:

```ts
import "./helpers.js";
import { describe, expect, it } from "vitest";
import { db } from "../db.js";

describe("wrapper db libSQL", () => {
  it("get devuelve undefined si no hay fila", async () => {
    const row = await db.prepare("SELECT id FROM users WHERE email = ?").get("no-existe@x.com");
    expect(row).toBeUndefined();
  });

  it("all devuelve array", async () => {
    const rows = await db.prepare("SELECT id FROM users").all();
    expect(Array.isArray(rows)).toBe(true);
  });

  it("run devuelve changes y lastInsertRowid numéricos", async () => {
    const email = `wrap-${Date.now()}@example.com`;
    const info = await db.prepare("INSERT INTO users (email, password_hash) VALUES (?, ?)").run(email, "hash");
    expect(typeof info.lastInsertRowid).toBe("number");
    expect(info.lastInsertRowid).toBeGreaterThan(0);
    expect(info.changes).toBe(1);
    const back = (await db.prepare("SELECT id FROM users WHERE email = ?").get(email)) as { id: number };
    expect(back.id).toBe(info.lastInsertRowid);
  });
});
```

- [ ] **Step 20: typecheck**

Run: `cd habit-tracker/backend && npm run typecheck`
Expected: PASS sin errores (si algún `as` de fila falla, ajustar con `as unknown as` manteniendo el tipo).

- [ ] **Step 21: tests**

Run: `cd habit-tracker/backend && npm test`
Expected: PASS todos los suites (auth, categories, transactions, summary, debts, goals, habit-goal, health, schema, db). Si `habit-goal.test.ts` o `debts.test.ts` asumen cascada por FK, pasan igualmente porque ahora la cascada está en código.

- [ ] **Step 22: init-db contra archivo local**

Run: `cd habit-tracker/backend && DATABASE_URL="file:./init-check.db" npm run db:init`
Expected: imprime "Esquema listo." y crea `init-check.db`. Borrarlo después: `rm -f init-check.db*`.

- [ ] **Step 23: Commit**

```bash
git add habit-tracker/backend/package.json habit-tracker/backend/package-lock.json \
  habit-tracker/backend/src/config.ts habit-tracker/backend/src/schema.ts habit-tracker/backend/src/db.ts \
  habit-tracker/backend/scripts/init-db.ts habit-tracker/backend/src/app.ts habit-tracker/backend/src/lib/streaks.ts \
  habit-tracker/backend/src/routes/ habit-tracker/backend/src/test/helpers.ts \
  habit-tracker/backend/src/test/schema.test.ts habit-tracker/backend/src/test/db.test.ts
git -c user.name="traderxael" -c user.email="traderxael@users.noreply.github.com" commit -m "feat(backend): port data layer from better-sqlite3 to libSQL (async) with app-level cascades"
```

---

## Task 2: Adaptación serverless (Vercel) + servidor local inalterado

**Files:**
- Modify: `habit-tracker/backend/src/app.ts` (crear `createApp()` solo-API)
- Modify: `habit-tracker/backend/src/index.ts` (initSchema + servir estáticos/SPA en producción)
- Create: `habit-tracker/api/index.ts` (función Vercel)
- Create: `habit-tracker/vercel.json`
- Create: `habit-tracker/package.json` (raíz, deps de runtime para la función)
- Modify: `habit-tracker/Dockerfile` (env `DATABASE_URL`, CMD con init; simplificar build al no haber mejor-sqlite3)

**Interfaces:**
- Consumes: `createApp()` de `backend/src/app.js` (Task 1 dejó `/api/health` async).
- Produces: `createApp()` expone SOLO la API; `index.ts` añade estáticos; `api/index.ts` default-exporta la app para Vercel.

- [ ] **Step 1: app.ts solo-API**

Reemplazar el bloque de producción (el `if (process.env.NODE_ENV === "production") { ... }` con `express.static` + fallback) de `habit-tracker/backend/src/app.ts`: **eliminarlo por completo** de `app.ts`. `createApp()` queda con: `cors()`, `express.json()`, `/api/health` async, los 8 `app.use("/api/...")`, el 404 de `/api`, y el manejador global de errores. Quitar el import `import path from "node:path"` e `import { fileURLToPath } from "node:url"` de `app.ts` si quedan sin uso.

- [ ] **Step 2: index.ts con initSchema + estáticos/SPA**

Reemplazar `habit-tracker/backend/src/index.ts`:

```ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { initSchema } from "./db.js";

async function main() {
  await initSchema();
  const app = createApp();

  if (process.env.NODE_ENV === "production") {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const clientDir = path.join(here, "..", "..", "frontend", "dist");
    // Express sirve el build de Vite + fallback SPA (solo en el servidor de larga duración / Docker).
    const { default: express } = await import("express");
    app.use(express.static(clientDir));
    app.use((req, res, next) => {
      if (req.method === "GET" && !req.path.startsWith("/api")) {
        res.sendFile(path.join(clientDir, "index.html"));
        return;
      }
      next();
    });
  }

  const port = Number(process.env.PORT ?? 3001);
  app.listen(port, () => {
    console.log(`Backend escuchando en http://localhost:${port} (${process.env.NODE_ENV ?? "development"})`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: package.json raíz para deps de la función**

Crear `habit-tracker/package.json`:

```json
{
  "name": "habit-tracker",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": "22.x" },
  "dependencies": {
    "@libsql/client": "^0.15.0",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "express": "^4.21.0",
    "jsonwebtoken": "^9.0.3"
  }
}
```

(Esto hace que Vercel instale en la raíz los paquetes que `backend/dist` necesita para la función; `api/index.ts` importa desde `backend/dist/app.js`.)

- [ ] **Step 4: función api/index.ts**

Crear `habit-tracker/api/index.ts`:

```ts
// @ts-nocheck — fichero de despliegue; el tipo del default-export de Express lo valida Vercel.
// Función serverless de Vercel: expone la API Express (solo-API) bajo /api/*.
// Vercel preserva req.url (ruta completa /api/...), así que los routers de createApp() coinciden.
import { createApp } from "../backend/dist/app.js";

export default createApp();
```

**Nota clave (la validará Step 7):** si en un despliegue real Vercel recorta el prefijo y `req.url` llega sin `/api`, el fix es `app.set("trust proxy", 1)` o montar un reenvío que re-anteponga `/api`. Se deja documentado en este comentario para no repetir el diagnóstico en el deploy.

- [ ] **Step 5: vercel.json**

Crear `habit-tracker/vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "installCommand": "npm install && npm --prefix backend ci && npm --prefix frontend ci",
  "buildCommand": "npm --prefix backend run build && npm --prefix frontend run build",
  "outputDirectory": "frontend/dist",
  "framework": "vite",
  "functions": {
    "api/index.ts": { "runtime": "nodejs22.x", "memory": 1024, "maxDuration": 15 }
  },
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

(El regex `source` con lookahead negativo manda todo lo que NO empiece por `/api/` al fallback de la SPA, dejando `/api/*` a la función.)

- [ ] **Step 6: Dockerfile actualizado**

En `habit-tracker/Dockerfile`: la etapa de backend ya no necesita `python3 make g++` (desaparece better-sqlite3); cambiar `apt-get install -y python3 make g++` por `apt-get install -y` vacío (o quitar el `apt-get install` de build nativo). Cambiar el env `DB_PATH=/data/data.sqlite` por `ENV DATABASE_URL="file:/data/data.sqlite"`. El `CMD` actual `node dist/index.js` basta (index.ts ya llama `initSchema()`). Conservar `NODE_ENV=production`, `PORT=3001`, volumen `/data`, `USER node`, `HEALTHCHECK` sobre `/api/health`.

- [ ] **Step 7: build de Vercel en local (sin cuenta)**

Run: `cd habit-tracker && npm i -g vercel@latest >/dev/null 2>&1 || npx vercel --version` y luego `npx vercel build --prod`
Expected: genera `.vercel/output` con la función `api` y los estáticos `frontend/dist`, SIN pedir login (build es local). Si `vercel build` no está disponible offline, al menos: `cd backend && npm run build && cd ../frontend && npm run build` (PASS) y documentar que el enrutado `/api` se confirma en el deploy real del usuario.

- [ ] **Step 8: correr servidor de larga duración local (regresión del modo Docker)**

Run: `cd habit-tracker/backend && npm run build && NODE_ENV=production DATABASE_URL="file:./tmp-prod.db" JWT_SECRET=local PORT=3101 node dist/index.js &` (con `frontend/dist` ya construido), luego `curl -s http://localhost:3101/api/health` y `curl -s http://localhost:3101/ | head -5`.
Expected: `/api/health` → `{"status":"ok","tables":...}`; `GET /` devuelve el `index.html` de la SPA. Matar el proceso y borrar `tmp-prod.db*`.

- [ ] **Step 9: Commit**

```bash
git add habit-tracker/backend/src/app.ts habit-tracker/backend/src/index.ts \
  habit-tracker/api/index.ts habit-tracker/vercel.json habit-tracker/package.json habit-tracker/Dockerfile
git -c user.name="traderxael" -c user.email="traderxael@users.noreply.github.com" commit -m "feat(deploy): Vercel serverless function + SPA serving; keep Docker path with libSQL file DB"
```

---

## Task 3: Endpoint de aportes en el cliente + tipo

**Files:**
- Modify: `habit-tracker/frontend/src/api/client.ts`
- Test (manual vía UI en Task 6): —

**Interfaces:**
- Consumes: `GET /api/goals/:id/contributions` (Task 1 Step 14).
- Produces: `financeApi.listContributions(goalId): Promise<{ contributions: GoalContribution[] }>`.

- [ ] **Step 1: añadir método al client**

En `habit-tracker/frontend/src/api/client.ts`, dentro del objeto `financeApi`, tras `contribute(...)`:

```ts
  listContributions: (goalId: number) =>
    api.get<{ contributions: GoalContribution[] }>(`/goals/${goalId}/contributions`),
```

- [ ] **Step 2: typecheck**

Run: `cd habit-tracker/frontend && npm run typecheck`
Expected: PASS (`GoalContribution` ya está en `../types`).

- [ ] **Step 3: Commit**

```bash
git add habit-tracker/frontend/src/api/client.ts
git -c user.name="traderxael" -c user.email="traderxael@users.noreply.github.com" commit -m "feat(frontend): financeApi.listContributions for goal contribution delete"
```

---

## Task 4: Capa PWA (manifest + iconos + service worker + meta móvil)

**Files:**
- Modify: `habit-tracker/frontend/package.json`
- Modify: `habit-tracker/frontend/vite.config.ts`
- Create: `habit-tracker/frontend/public/icon.svg`
- Create: `habit-tracker/frontend/scripts/gen-icons.mjs`
- Create (generados): `habit-tracker/frontend/public/pwa-192x192.png`, `pwa-512x512.png`, `pwa-maskable-512.png`, `apple-touch-icon.png`
- Modify: `habit-tracker/frontend/index.html`

**Interfaces:**
- Produces: build que emite `manifest.webmanifest` + `sw.js` (Workbox) y precache del shell; `/api` con `NetworkOnly`.

- [ ] **Step 1: dependencias**

En `habit-tracker/frontend/package.json`, añadir a `devDependencies`: `"vite-plugin-pwa": "^0.21.1"`, `"sharp": "^0.33.5"`. Añadir a `scripts`: `"icons": "node scripts/gen-icons.mjs"`.

- [ ] **Step 2: instalar**

Run: `cd habit-tracker/frontend && npm install`
Expected: instala `vite-plugin-pwa`, `sharp` y `workbox-*`.

- [ ] **Step 3: icon.svg (marca, color plano brand)**

Crear `habit-tracker/frontend/public/icon.svg` (256×256, círculo `#4f46e5` + check blanco; coincide con el favicon actual):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
  <rect width="256" height="256" fill="#4f46e5"/>
  <circle cx="128" cy="128" r="96" fill="#4f46e5"/>
  <path d="M76 132l34 34 70-72" stroke="white" stroke-width="20" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

- [ ] **Step 4: gen-icons.mjs**

Crear `habit-tracker/frontend/scripts/gen-icons.mjs`:

```js
import sharp from "sharp";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(here, "..", "public");
const svg = readFileSync(path.join(pub, "icon.svg"));

// Normal: relleno completo con la marca.
for (const [name, size] of [["pwa-192x192.png", 192], ["pwa-512x512.png", 512], ["apple-touch-icon.png", 180]]) {
  await sharp(svg).resize(size, size).png().toFile(path.join(pub, name));
}

// Maskable: marca al 60% sobre fondo brand (safe zone ~80%).
const mask = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
     <rect width="512" height="512" fill="#4f46e5"/>
     <g transform="translate(51.2 51.2) scale(1.6)">
       <path d="M76 132l34 34 70-72" stroke="white" stroke-width="20" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
     </g>
   </svg>`,
);
await sharp(mask).resize(512, 512).png().toFile(path.join(pub, "pwa-maskable-512.png"));
console.log("Iconos PWA generados en frontend/public/");
```

- [ ] **Step 5: generar iconos**

Run: `cd habit-tracker/frontend && npm run icons`
Expected: aparecen `public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/pwa-maskable-512.png`, `public/apple-touch-icon.png`. Si `sharp` falló al instalar, fallback: generar con ImageGen una marca 512×512 en `public/pwa-512x512.png` y recortar a mano; dejar constancia.

- [ ] **Step 6: vite.config.ts con el plugin PWA**

Reemplazar `habit-tracker/frontend/vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Gestor de hábitos y finanzas",
        short_name: "Hábitos",
        description: "App personal para seguir hábitos y finanzas.",
        start_url: "/",
        display: "standalone",
        background_color: "#eef2f7",
        theme_color: "#4f46e5",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            // Nunca servir datos financieros/cacheados de la API: siempre a red.
            urlPattern: ({ url }) => url.pathname.startsWith("/api"),
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:3001" },
  },
});
```

- [ ] **Step 7: meta móvil + título en index.html**

Reemplazar `habit-tracker/frontend/index.html`:

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#4f46e5" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Hábitos" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link
      rel="icon"
      href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='14' fill='%234f46e5'/%3E%3Cpath d='M10 16l4 4 8-8' stroke='white' stroke-width='3' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E"
    />
    <title>Gestor de hábitos y finanzas</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: build + verificación de artefactos PWA**

Run: `cd habit-tracker/frontend && npm run build`
Expected: build PASS y `dist/` contiene `manifest.webmanifest`, `sw.js` (o `workbox-*.js`), y `registerSW.js`. Comprobar: `ls dist | grep -E "manifest|sw.js|registerSW"`. Confirmar que `dist/manifest.webmanifest` lista los iconos y `theme_color`.

- [ ] **Step 9: Commit**

```bash
git add habit-tracker/frontend/package.json habit-tracker/frontend/package-lock.json \
  habit-tracker/frontend/vite.config.ts habit-tracker/frontend/index.html \
  habit-tracker/frontend/public/icon.svg habit-tracker/frontend/public/*.png habit-tracker/frontend/scripts/gen-icons.mjs
git -c user.name="traderxael" -c user.email="traderxael@users.noreply.github.com" commit -m "feat(frontend): PWA (manifest + icons + service worker network-only /api + mobile meta)"
```

---

## Task 5: Cierre spec #1a — edición de deudas en el frontend

**Files:**
- Modify: `habit-tracker/frontend/src/pages/Debts.tsx`

**Interfaces:**
- Consumes: `financeApi.updateDebt(id, { name?, total_cents?, due_date? })` (existe en `client.ts`).

- [ ] **Step 1: estado de edición**

En `habit-tracker/frontend/src/pages/Debts.tsx`, junto a los `useState` existentes, añadir:

```tsx
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editTotal, setEditTotal] = useState("");
  const [editDue, setEditDue] = useState("");
```

Añadir un handler tras `onDelete`:

```tsx
  function startEdit(d: Debt) {
    setEditingId(d.id);
    setEditName(d.name);
    setEditTotal(String(d.totalCents / 100));
    setEditDue(d.dueDate ?? "");
    setPayFor(null);
  }

  async function onSaveEdit(e: FormEvent, d: Debt) {
    e.preventDefault();
    setError(null);
    const cents = parseAmountToCents(editTotal);
    if (!cents) {
      setError("Importe inválido");
      return;
    }
    try {
      await financeApi.updateDebt(d.id, { name: editName, total_cents: cents, due_date: editDue || null });
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar la deuda");
    }
  }
```

- [ ] **Step 2: botón Editar + inline form**

En `Debts.tsx`, dentro de `.goal-actions` (el `<div className="goal-actions">`), añadir tras el botón "Registrar pago":

```tsx
                  <button type="button" className="btn-ghost" onClick={() => startEdit(d)}>
                    Editar
                  </button>
```

Justo antes del bloque `{payFor === d.id && (...)}`, añadir el formulario de edición inline (usa las mismas clases `form card`/`row` del resto):

```tsx
                {editingId === d.id && (
                  <form onSubmit={(e) => onSaveEdit(e, d)} className="row">
                    <label>
                      Nombre
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} required />
                    </label>
                    <label>
                      Importe total
                      <AmountInput id={`edit-total-${d.id}`} value={editTotal} onChange={setEditTotal} />
                    </label>
                    <label>
                      Vencimiento
                      <input type="date" value={editDue} onChange={(e) => setEditDue(e.target.value)} />
                    </label>
                    <button type="submit" className="btn-primary">Guardar</button>
                    <button type="button" className="btn-ghost" onClick={() => setEditingId(null)}>Cancelar</button>
                  </form>
                )}
```

- [ ] **Step 3: typecheck + build**

Run: `cd habit-tracker/frontend && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 4: commit**

```bash
git add habit-tracker/frontend/src/pages/Debts.tsx
git -c user.name="traderxael" -c user.email="traderxael@users.noreply.github.com" commit -m "feat(frontend): edit debts (updateDebt) on Debts page"
```

---

## Task 6: Cierre spec #1b — edición de metas, badge de hábito vinculado, borrado de aporte

**Files:**
- Modify: `habit-tracker/frontend/src/pages/Goals.tsx`

**Interfaces:**
- Consumes: `financeApi.updateGoal`, `financeApi.listContributions` (Task 3), `financeApi.deleteContribution` (existe), `api.get("/habits")`.

- [ ] **Step 1: estado y cargas adicionales**

En `habit-tracker/frontend/src/pages/Goals.tsx`, importar `api` junto a `financeApi`: `import { api, financeApi } from "../api/client";` e importar el tipo `Habit` y `GoalContribution`: `import type { Goal, GoalContribution, Habit } from "../types";`. Añadir estado:

```tsx
  const [habits, setHabits] = useState<Habit[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editTarget, setEditTarget] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [openContribs, setOpenContribs] = useState<number | null>(null);
  const [contribs, setContribs] = useState<GoalContribution[]>([]);
```

Cargar hábitos en el `useEffect` inicial (tras `load()`):

```tsx
    api.get<{ habits: Habit[] }>("/habits").then((r) => setHabits(r.habits)).catch(() => undefined);
```

- [ ] **Step 2: handlers**

Añadir tras `onDelete`:

```tsx
  function startEdit(g: Goal) {
    setEditingId(g.id);
    setEditName(g.name);
    setEditTarget(String(g.targetCents / 100));
    setEditDeadline(g.deadline ?? "");
    setContributeTo(null);
  }

  async function onSaveEdit(e: FormEvent, g: Goal) {
    e.preventDefault();
    setError(null);
    const cents = parseAmountToCents(editTarget);
    if (!cents) {
      setError("Importe inválido");
      return;
    }
    try {
      await financeApi.updateGoal(g.id, { name: editName, target_cents: cents, deadline: editDeadline || null });
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar la meta");
    }
  }

  async function toggleContribs(g: Goal) {
    setError(null);
    if (openContribs === g.id) {
      setOpenContribs(null);
      return;
    }
    try {
      const r = await financeApi.listContributions(g.id);
      setContribs(r.contributions);
      setOpenContribs(g.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar aportes");
    }
  }

  async function onDeleteContribution(g: Goal, c: GoalContribution) {
    if (!window.confirm(`¿Eliminar aporte de ${formatMoney(c.amountCents)}?`)) return;
    try {
      await financeApi.deleteContribution(g.id, c.id);
      await Promise.all([load(), financeApi.listContributions(g.id).then((r) => setContribs(r.contributions))]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al borrar el aporte");
    }
  }
```

- [ ] **Step 3: badge de hábito vinculado + botón Editar + lista de aportes**

En `Goals.tsx`, dentro del `.map((g) => ...)`, calcular los hábitos vinculados antes del `return`:

```tsx
            const linked = habits.filter((h) => h.goalId === g.id);
```

En el `<div className="goal-head">`, tras el `{pct >= 100 && <span className="badge">¡Lograda!</span>}`, añadir:

```tsx
                  {linked.length > 0 && (
                    <span className="badge badge-goal-complete" title={linked.map((h) => h.name).join(", ")}>
                      🔗 {linked.length} hábito{linked.length > 1 ? "s" : ""}
                    </span>
                  )}
```

En `.goal-actions`, añadir un botón Editar y uno "Ver aportes":

```tsx
                  <button type="button" className="btn-ghost" onClick={() => startEdit(g)}>
                    Editar
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => toggleContribs(g)}>
                    Aportes
                  </button>
```

Antes del bloque `{contributeTo === g.id && (...)}`, añadir el form de edición inline y la lista de aportes:

```tsx
                {editingId === g.id && (
                  <form onSubmit={(e) => onSaveEdit(e, g)} className="row">
                    <label>
                      Nombre
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} required />
                    </label>
                    <label>
                      Objetivo
                      <AmountInput id={`edit-target-${g.id}`} value={editTarget} onChange={setEditTarget} />
                    </label>
                    <label>
                      Fecha límite
                      <input type="date" value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} />
                    </label>
                    <button type="submit" className="btn-primary">Guardar</button>
                    <button type="button" className="btn-ghost" onClick={() => setEditingId(null)}>Cancelar</button>
                  </form>
                )}
                {openContribs === g.id && (
                  <ul className="habit-list">
                    {contribs.length === 0 && <li className="muted">Sin aportes registrados.</li>}
                    {contribs.map((c) => (
                      <li key={c.id} className="card movement-row">
                        <span>{c.date}</span>
                        {c.habitId ? <span className="muted small">automático</span> : <span className="muted small">manual</span>}
                        <span className="spacer" />
                        <strong>{formatMoney(c.amountCents)}</strong>
                        <button type="button" className="btn-link" onClick={() => onDeleteContribution(g, c)}>
                          Borrar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
```

- [ ] **Step 4: typecheck + build**

Run: `cd habit-tracker/frontend && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 5: commit**

```bash
git add habit-tracker/frontend/src/pages/Goals.tsx
git -c user.name="traderxael" -c user.email="traderxael@users.noreply.github.com" commit -m "feat(frontend): goal edit + linked-habit badge + contribution list & delete"
```

---

## Task 7: Cierre spec #2 — validar importe al vincular hábito→meta

**Files:**
- Modify: `habit-tracker/frontend/src/pages/Habits.tsx`

**Interfaces:**
- Consumes: nada nuevo; corrige el envío silencioso `goal_amount_cents: null`.

- [ ] **Step 1: reemplazar el cálculo del body en onSubmit**

En `habit-tracker/frontend/src/pages/Habits.tsx`, dentro de `onSubmit`, tras el chequeo de `freq === "weekdays"` y ANTES de construir `body`, insertar la validación explícita:

```tsx
    let goalCents: number | null = null;
    if (goalId) {
      if (!goalAmount.trim()) {
        setError("Introduce el importe del aporte para la meta vinculada.");
        return;
      }
      const cents = parseAmountToCents(goalAmount);
      if (!cents) {
        setError("Importe del aporte inválido (ej. 50).");
        return;
      }
      goalCents = cents;
    }
```

Y reemplazar las dos líneas de `goal_id`/`goal_amount_cents` en el objeto `body` por:

```tsx
      goal_id: goalId ? Number(goalId) : null,
      goal_amount_cents: goalCents,
```

(Así, si hay meta elegida pero el importe falta o es inválido, el submit se bloquea con error en español en vez de enviar `null` en silencio.)

- [ ] **Step 2: typecheck + build**

Run: `cd habit-tracker/frontend && npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 3: commit**

```bash
git add habit-tracker/frontend/src/pages/Habits.tsx
git -c user.name="traderxael" -c user.email="traderxael@users.noreply.github.com" commit -m "fix(frontend): block habit save when goal linked but amount empty/invalid"
```

---

## Task 8: Documentación (README, DEPLOY, DESIGN)

**Files:**
- Modify: `habit-tracker/README.md`
- Create: `habit-tracker/DEPLOY.md`
- Modify: `habit-tracker/DESIGN.md`
- Modify: `habit-tracker/backend/.env.example` (si existe)

- [ ] **Step 1: backend/.env.example**

Si existe `habit-tracker/backend/.env.example`, reemplazar `DB_PATH=...` por:

```
# Base de datos libSQL/Turso. En local puedes usar un archivo:
DATABASE_URL=file:./data.sqlite
# En producción (Vercel) define además:
# TURSO_DATABASE_URL=libsql://<tu-db>.turso.io
# TURSO_AUTH_TOKEN=<token>
JWT_SECRET=cambia-este-secreto
TOKEN_TTL=7d
```

- [ ] **Step 2: README — variables + health + PWA + enlace a DEPLOY**

En `habit-tracker/README.md`:
- Cambiar la fila `DB_PATH` de la tabla de variables por `DATABASE_URL` (defecto `file:./data.sqlite`), y añadir filas `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` ("solo producción").
- En el bullet del health check (línea ~30), quitar la afirmación de número fijo y sustituir por: `→ {"status":"ok","tables":N} (N = nº de tablas; puede variar según el backend SQLite/libSQL, no se afirma un número concreto)`.
- Reemplazar la nota de `better-sqlite3`/`npm install-scripts` por `@libsql/client` (no requiere compilación nativa).
- Añadir una sección `## Desplegar en Vercel + Turso` que remita a `DEPLOY.md` y resuma: crear DB en Turso, `npm run db:init` contra la URL, variables en Vercel, `vercel --prod`.
- Añadir una sección `## PWA (instalar en el móvil)`: abrir la URL, menú del navegador → "Añadir a pantalla de inicio" (Android/Chrome) o Compartir → "Añadir a pantalla de inicio" (iOS/Safari).
- En la estructura inicial, donde dice `SQLite (better-sqlite3)` actualizar a `SQLite/libSQL (Turso)`.

- [ ] **Step 3: DEPLOY.md (nuevo)**

Crear `habit-tracker/DEPLOY.md` con guía copiable, en español:
1. **Turso (gratis, sin tarjeta):** `npx turso@latest db create <nombre>`, `npx turso@latest db tokens create <nombre>`; anotar `URL` y `token`. Inicializar esquema: `cd backend && TURSO_DATABASE_URL=<URL> TURSO_AUTH_TOKEN=<token> npm run db:init`.
2. **Vercel (gratis):** `npm i -g vercel`, `cd habit-tracker && vercel login`, `vercel` (vincular repo/crear proyecto), ajustar framework detection. Definir env vars en el panel (o `vercel env add`): `JWT_SECRET` (secreto nuevo), `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `NODE_ENV` la pone Vercel. `vercel --prod`.
3. **Variables de Vercel** (tabla) y por qué `DATABASE_URL` no se usa en prod (se resuelve desde `TURSO_*` en `config.ts`).
4. **Git integration:** conectar el repo en Vercel para desplegar en cada push a `master`.
5. **Comprobar en el móvil:** abrir la URL publicada, registrar una cuenta, instalar la PWA.
6. **Rollback/notes:** la función es stateless; el esquema NO se auto-migra en runtime — tras un cambio de esquema volver a correr `npm run db:init`.

- [ ] **Step 4: DESIGN.md — PWA + Known Gaps obsoleto**

En `habit-tracker/DESIGN.md`:
- En la sección `## Known Gaps`, reemplazar el item obsoleto sobre `--shadow-lg`/`--r-xl` "defined but unused" por uno que reconozca que `.auth-split` ya usa `--shadow-lg` y `rounded.xl`; dejar constancia de que `--r-xl`/`--shadow-lg` tienen uso en auth y que un futuro dialog/toast puede reutilizarlos.
- Añadir una nota corta en `## Overview` o `## Components`: la app es **instalable (PWA)** con tema indigo (`#4f46e5`) para `theme_color`/`background_color` del manifest y una marca SVG → PNG; el color del manifest es el token `primary` (el manifest JSON no admite `var()`).

- [ ] **Step 5: verificación de docs**

Run: `cd habit-tracker && grep -n "better-sqlite3" README.md DESIGN.md DEPLOY.md 2>/dev/null || echo "no refs"`
Expected: "no refs" (o solo menciones históricas intencionadas en Dockerfile comentado). Revisar que DEPLOY.md no contiene secretos reales (placeholders `<...>`).

- [ ] **Step 6: commit**

```bash
git add habit-tracker/README.md habit-tracker/DEPLOY.md habit-tracker/DESIGN.md habit-tracker/backend/.env.example
git -c user.name="traderxael" -c user.email="traderxael@users.noreply.github.com" commit -m "docs: Vercel+Turso deploy guide, PWA install, env table, DESIGN known-gaps fix"
```

---

## Task 9: Verificación completa y mano de despliegue

**Files:** none (solo ejecución/comprobación).

- [ ] **Step 1: typechecks**

Run: `cd habit-tracker/backend && npm run typecheck` → PASS. `cd ../frontend && npm run typecheck` → PASS.

- [ ] **Step 2: builds**

Run: `cd habit-tracker/backend && npm run build` → PASS (`dist/`). `cd ../frontend && npm run build` → PASS (`dist/` con manifest + sw). 

- [ ] **Step 3: tests**

Run: `cd habit-tracker/backend && npm test` → PASS (todos). `cd ../frontend && npm test` → PASS (money 4 suites).

- [ ] **Step 4: E2E local (servidor de larga duración + DB file)**

Arrancar backend prod con `DATABASE_URL=file:./e2e.db` y `frontend/dist` servido (Task 2 Step 8). Recorrer con `curl` o el navegador:
- register → 200 token.
- 9 categorías por defecto presentes (`GET /api/categories`).
- POST movimiento → `GET /api/finance/summary?month=<mes>` refleja el importe.
- POST deuda + pago → `GET /api/debts` saldo correcto; pago que excede → 400.
- POST meta + aporte + `GET /api/goals/:id/contributions` lista el aporte; `DELETE` de aporte lo quita.
- crear hábito con meta + importe; toggle ON crea aporte automático; toggle OFF lo revierte (`habit-goal.test.ts` ya lo cubre).
- **DELETE meta con hábito vinculado y aportes** → la meta desaparece, sus aportes desaparecen, el hábito queda con `goal_id=null` (cascada app-level). Comprobar `GET /api/habits`.
- **DELETE hábito** → sus `completions` desaparecen; aportes previos automáticos sobreviven con `habit_id=null`.

- [ ] **Step 5: verificación PWA en navegador**

Con `cd habit-tracker/frontend && npm run preview`, abrir la URL en el navegador y comprobar en DevTools → Application: manifest parseado con iconos, service worker activo, y que una petición a `/api/*` es `NetworkOnly` (no cacheada). No se sustituye el "Añadir a pantalla de inicio" en un móvil físico: eso lo hace el usuario sobre la URL publicada.

- [ ] **Step 6: registrar resultado y límites**

Documentar en el mensaje final al usuario: qué se verificó (tests/tsc/builds/E2LE local con libSQL file, artefactos PWA) y qué queda pendiente para el usuario (crear cuentas Turso/Vercel, `npm run db:init` contra Turso, `vercel --prod`, y confirmar enrutado `/api` en producción — el `vercel build` local ya validó la config estática).

- [ ] **Step 7: NO pushear**

Este plan no hace `git push` ni publica. La rama `feature/mobile-pwa-deploy` queda commiteada localmente; el push a GitHub y el `vercel --prod` los autoriza el usuario aparte.

---

## Self-Review (run after writing)

1. **Spec coverage:** port libSQL→Task 1; FK/app-cascades→Task 1 (Steps 11/14/15); serverless→Task 2; init-db→Task 1/2; PWA→Task 4; fix #1a→Task 5; fix #1b→Task 6 (+Task 3 endpoint); fix #2→Task 7; docs→Task 8; tests/E2E→Tasks 1/9. Todas las secciones del spec tienen task.
2. **Placeholders:** ninguno ("TBD"/"similar a Task N") — cada paso con código o lista de call-sites.
3. **Type consistency:** `db.prepare().run()` → `{changes,lastInsertRowid:number}` usado igual en todas las rutas; `client.batch([...],"write")` usado en seedCategories/toggle/debts/goals/habits; `listContributions` (Task 3) = nombre usado en Task 6; `Goal.contributions` no se añade (se listan aparte). `updateGoal`/`updateDebt`/`deleteContribution` existen ya en `client.ts`.
