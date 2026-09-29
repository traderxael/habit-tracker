function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name} (obligatoria en producción)`);
  return v;
}

const isProd = process.env.NODE_ENV === "production";

export const JWT_SECRET = isProd ? required("JWT_SECRET") : (process.env.JWT_SECRET ?? "dev-secret-change-me");
export const TOKEN_TTL = process.env.TOKEN_TTL ?? "7d";

// Token de autenticación de Turso. Obligatorio en producción; vacío en local.
export const TURSO_AUTH_TOKEN = isProd ? required("TURSO_AUTH_TOKEN") : (process.env.TURSO_AUTH_TOKEN ?? "");

// URL de la base: Turso remoto (libsql://…) o local (file:... / :memory:).
export const DATABASE_URL = (() => {
  const url = process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL;
  if (isProd) return url ?? required("TURSO_DATABASE_URL");
  return url ?? "file:./data.sqlite";
})();
