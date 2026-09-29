import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createApp } from "./app.js";
import { initSchema } from "./db.js";

async function main() {
  await initSchema();
  const app = createApp();

  // En producción (Docker / servidor de larga duración), servir el frontend
  // compilado con fallback de SPA. En Vercel esto no aplica: la plataforma sirve
  // los estáticos y express.static() se ignora dentro de la función.
  if (process.env.NODE_ENV === "production") {
    const here = path.dirname(fileURLToPath(import.meta.url));
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

  const port = Number(process.env.PORT ?? 3001);
  app.listen(port, () => {
    console.log(
      `Backend escuchando en http://localhost:${port} (${process.env.NODE_ENV ?? "development"})`,
    );
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
