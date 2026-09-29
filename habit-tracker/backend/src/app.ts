import express from "express";
import cors from "cors";
import { db } from "./db.js";
import { authRouter } from "./routes/auth.js";
import { habitsRouter } from "./routes/habits.js";
import { completionsRouter } from "./routes/completions.js";
import { categoriesRouter } from "./routes/categories.js";
import { transactionsRouter } from "./routes/transactions.js";
import { financeRouter } from "./routes/finance.js";
import { debtsRouter } from "./routes/debts.js";
import { goalsRouter } from "./routes/goals.js";

export function createApp(): express.Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", async (_req, res) => {
    const row = (await db
      .prepare("SELECT COUNT(*) AS tables FROM sqlite_master WHERE type = 'table'")
      .get()) as { tables: number };
    res.json({ status: "ok", tables: Number(row.tables) });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/habits", habitsRouter);
  app.use("/api/completions", completionsRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/transactions", transactionsRouter);
  app.use("/api/finance", financeRouter);
  app.use("/api/debts", debtsRouter);
  app.use("/api/goals", goalsRouter);

  // 404 en JSON para cualquier ruta /api no definida.
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Recurso no encontrado" });
  });

  // createApp() expone SOLO la API. El servido de estáticos/SPA vive en index.ts
  // (servidor de larga duración / Docker); en Vercel lo hace la plataforma vía
  // vercel.json, porque express.static() se ignora en funciones serverless.

  // Manejador global de errores.
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    if (res.headersSent) return;
    res.status(500).json({ error: "Error interno del servidor" });
  });

  return app;
}
