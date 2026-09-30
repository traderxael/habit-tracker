import type { Request } from "express";

// Reconstruye la URL que espera Express (rutas montadas en /api/...) a partir de lo
// que entrega Vercel, que varía según versión/config:
//  - "/api/habits"  → ruta original conservada (lo habitual con export default app)
//  - "/habits"      → prefijo /api recortado por la plataforma
//  - "/api" o "/"   → rewrite colapsó la URL; la ruta real está en x-matched-path / x-invoke-path
// Preserva la query string. Se comparte entre la función de Vercel (api/index.ts) y
// está cubierto por tests para que la lógica de enrutado desplegada no quede sin probar.
export function resolveUrl(req: Request): string {
  const raw = req.url ?? "/";
  const qIdx = raw.indexOf("?");
  const pathOnly = qIdx >= 0 ? raw.slice(0, qIdx) : raw;
  const query = qIdx >= 0 ? raw.slice(qIdx) : "";

  const hdr = req.headers["x-matched-path"] ?? req.headers["x-invoke-path"] ?? "";
  const fromHeader = Array.isArray(hdr) ? hdr[0] : hdr;

  let path = pathOnly;
  if (pathOnly === "/" || pathOnly === "/api") {
    const h = typeof fromHeader === "string" ? fromHeader.split("?")[0] : "";
    path = h && h.startsWith("/api") ? h : "/api";
  } else if (!pathOnly.startsWith("/api")) {
    path = "/api" + pathOnly;
  }
  return path + query;
}
