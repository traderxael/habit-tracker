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
