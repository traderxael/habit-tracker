// Función serverless de Vercel: expone la API Express (solo-API) bajo /api/*.
// vercel.json enruta /api/:path* aquí. Vercel, al despachar una app Express
// exportada como handler, suele preservar la URL original (/api/...), pero según
// la versión puede recortar el prefijo de montaje. Normalizamos req.url para que
// los routers de createApp(), montados en /api/..., coincidan en ambos casos.
import type { Request, Response } from "express";
import { createApp } from "../backend/dist/app.js";

const app = createApp();

export default function handler(req: Request, res: Response) {
  const url = req.url ?? "/";
  if (url === "/" ) {
    req.url = "/api";
  } else if (!url.startsWith("/api")) {
    req.url = "/api" + url;
  }
  return app(req, res);
}
