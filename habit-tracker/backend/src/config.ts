function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name} (obligatoria en producción)`);
  return v;
}

const isProd = process.env.NODE_ENV === "production";

export const JWT_SECRET = isProd ? required("JWT_SECRET") : (process.env.JWT_SECRET ?? "dev-secret-change-me");
export const TOKEN_TTL = process.env.TOKEN_TTL ?? "7d";

// URL de la base: Turso remoto (libsql://…) o local (file:... / :memory:).
// En producción exige una URL explícita (sin fallback a SQLite local por defecto).
export const DATABASE_URL = (() => {
  const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL;
  if (isProd && !url) {
    throw new Error("Falta TURSO_DATABASE_URL o DATABASE_URL (obligatorio en producción)");
  }
  return url ?? "file:./data.sqlite";
})();

// El token de Turso solo aplica a bases remotas (libsql://). Para file:/memory:
// (Docker, local, tests) va vacío, incluso en producción.
export const TURSO_AUTH_TOKEN = (() => {
  const t = process.env.TURSO_AUTH_TOKEN ?? "";
  if (isProd && DATABASE_URL.startsWith("libsql") && !t) {
    throw new Error("Falta TURSO_AUTH_TOKEN (obligatorio con base libsql:// en producción)");
  }
  return t;
})();
