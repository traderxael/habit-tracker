// Función serverless de Vercel: expone la API Express (solo-API) bajo /api/*.
// vercel.json enruta /api/(.*) → /api (esta función) y manda el resto a index.html.
//
// Salvaguardas para que el despliegue sea robusto:
// 1) Resolución de ruta tolerante: según cómo Vercel reescriba, req.url puede
//    llegar como "/api/habits" (ruta original), como "/habits" (prefijo recortado)
//    o colapsada a "/api" (rewrite). Normalizamos a "/api/..." en los tres casos y,
//    si vino colapsada, recuperamos la ruta original desde las cabeceras de Vercel
//    (x-matched-path / x-invoke-path), preservando la query string.
// 2) Auto-inicializa el esquema UNA vez por arranque en frío (DDL idempotente),
//    así olvidar `db:init` no brickear la app.
import type { Request, Response } from "express";
import { createApp } from "../backend/dist/app.js";
import { initSchema } from "../backend/dist/db.js";
import { resolveUrl } from "../backend/dist/http.js";

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
  req.url = resolveUrl(req);
  return app(req, res);
}

