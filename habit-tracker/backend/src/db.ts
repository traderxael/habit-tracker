import type { Client } from "@libsql/client";
import { DATABASE_URL, TURSO_AUTH_TOKEN } from "./config.js";
import { DDL } from "./schema.js";

// Driver según la URL:
//  - Turso remoto (libsql:// | http(s)://) → cliente HTTP puro-JS (@libsql/client/http),
//    que NO carga el binding nativo `libsql`. Así el despliegue en Vercel (Linux) no
//    depende de que el binario nativo coincida con la plataforma del runtime.
//  - Local/Docker/tests (file: | :memory:) → driver embebido (@libsql/client), sí nativo.
const isRemote = DATABASE_URL.startsWith("libsql://") || /^https?:\/\//.test(DATABASE_URL);
const { createClient } = isRemote
  ? await import("@libsql/client/http")
  : await import("@libsql/client");

export const client: Client = createClient({
  url: DATABASE_URL,
  authToken: TURSO_AUTH_TOKEN || undefined,
});

interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

// Wrapper que imita la API de better-sqlite3 pero asíncrona, para que cada ruta
// solo cambie a `await db.prepare(...).get/all/run(...)`. Las filas devueltas por
// libSQL ya permiten acceso por nombre de columna (row.user_id, etc.).
// `args` se tipifica como any[] para aceptar el rango de InValue de libSQL sin
// fricción en los ~30 call sites de las rutas (los valores ya se validan arriba).
export const db = {
  prepare(sql: string) {
    return {
      async get(...args: any[]): Promise<any> {
        const r = await client.execute({ sql, args });
        return r.rows.length ? r.rows[0] : undefined;
      },
      async all(...args: any[]): Promise<any[]> {
        const r = await client.execute({ sql, args });
        return r.rows as any[];
      },
      async run(...args: any[]): Promise<RunResult> {
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
