import { initSchema } from "../src/db.js";
import { DATABASE_URL } from "../src/config.js";

async function main() {
  console.log(
    `Inicializando esquema en ${DATABASE_URL.startsWith("libsql") ? "Turso" : DATABASE_URL}`,
  );
  await initSchema();
  console.log("Esquema listo.");
  process.exit(0);
}

main().catch((err) => {
  console.error("init-db falló:", err);
  process.exit(1);
});
