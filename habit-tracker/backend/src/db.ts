import type { Client } from "@libsql/client";
import { DATABASE_URL, TURSO_AUTH_TOKEN } from "./config.js";
import { DDL } from "./schema.js";

// Selección de driver SIN top-level await (evita problemas de bundling en
// @vercel/node con TLA en módulos trazados):
//  - Turso remoto (libsql:// | http(s)://) → cliente HTTP puro-JS (@libsql/client/http),
//    que NO carga el binding nativo `libsql` (evita fallos si el binario nativo no
//    coincide con la plataforma del runtime de Vercel).
//  - Local/Docker/tests (file: | :memory:) → driver embebido (@libsql/client), sí nativo.
const isRemote = DATABASE_URL.startsWith("libsql://") || /^https?:\/\//.test(DATABASE_URL);

let clientPromise: Promise<Client> | null = null;

// El cliente se crea de forma perezosa en la primera operación (el import dinámico
// vive aquí, dentro de una función async, no en el scope del módulo).
export function getClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const { createClient } = isRemote
        ? await import("@libsql/client/http")
        : await import("@libsql/client");
      return createClient({
        url: DATABASE_URL,
        authToken: TURSO_AUTH_TOKEN || undefined,
      });
    })();
  }
  return clientPromise;
}

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
        const c = await getClient();
        const r = await c.execute({ sql, args });
        return r.rows.length ? r.rows[0] : undefined;
      },
      async all(...args: any[]): Promise<any[]> {
        const c = await getClient();
        const r = await c.execute({ sql, args });
        return r.rows as any[];
      },
      async run(...args: any[]): Promise<RunResult> {
        const c = await getClient();
        const r = await c.execute({ sql, args });
        return { changes: r.rowsAffected, lastInsertRowid: Number(r.lastInsertRowid ?? 0) };
      },
    };
  },
};

// Lote atómico (write). Sustituye a `client.batch(...)` para que las rutas no
// necesiten el cliente crudo.
export async function batch(statements: { sql: string; args: any[] }[]): Promise<void> {
  const c = await getClient();
  await c.batch(statements, "write");
}

// Idempotente: ignora "duplicate column name" en los ALTER (columnas ya presentes).
export async function initSchema(): Promise<void> {
  const c = await getClient();
  for (const sql of DDL) {
    try {
      await c.execute(sql);
    } catch (err) {
      if (!/duplicate column name/i.test(String(err))) throw err;
    }
  }
}
