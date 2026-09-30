// Función serverless de Vercel: expone la API Express (solo-API) bajo /api/*.
// vercel.json enruta /api/:path* aquí.
//
// Dos salvaguardas para que el despliegue sea robusto:
// 1) Normaliza req.url: Vercel suele conservar el prefijo /api, pero según la
//    versión puede recortarlo al despachar. Re-anteponemos /api para que los
//    routers de createApp() (montados en /api/...) coincidan en ambos casos.
// 2) Auto-inicializa el esquema UNA vez por arranque en frío (DDL idempotente,
//    CREATE IF NOT EXISTS). Así, aunque se olvide `npm run db:init`, la app no
//    queda bricked. db:init sigue siendo el camino recomendado (y más barato).
import type { Request, Response } from "express";
import { createApp } from "../backend/dist/app.js";
import { initSchema } from "../backend/dist/db.js";

const app = createApp();

let schemaReady: Promise<void> | null = null;

export default async function handler(req: Request, res: Response) {
  if (!schemaReady) schemaReady = initSchema();
  try {
    await schemaReady;
  } catch (err) {
    schemaReady = null; // permite reintentar en la siguiente petición
    res.status(500).json({ error: "No se pudo inicializar la base de datos" });
    return;
  }

  const url = req.url ?? "/";
  if (url === "/") {
    req.url = "/api";
  } else if (!url.startsWith("/api")) {
    req.url = "/api" + url;
  }
  return app(req, res);
}
