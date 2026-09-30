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

const app = createApp();

let schemaReady: Promise<void> | null = null;

function resolveUrl(req: Request): string {
  const raw = req.url ?? "/";
  const qIdx = raw.indexOf("?");
  const pathOnly = qIdx >= 0 ? raw.slice(0, qIdx) : raw;
  const query = qIdx >= 0 ? raw.slice(qIdx) : "";

  // Cabeceras de Vercel que conservan la ruta solicitada original.
  const fromHeader = (req.headers["x-matched-path"] || req.headers["x-invoke-path"] || "") as string;

  let path = pathOnly;
  if (pathOnly === "/" || pathOnly === "/api") {
    // rewrite colapsó la ruta; intenta recuperarla de la cabecera.
    const h = typeof fromHeader === "string" ? fromHeader.split("?")[0] : "";
    path = h && h.startsWith("/api") ? h : "/api";
  } else if (!pathOnly.startsWith("/api")) {
    // prefijo /api recortado por la plataforma → re-antepón.
    path = "/api" + pathOnly;
  }
  return path + query;
}

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

