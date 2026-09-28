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
