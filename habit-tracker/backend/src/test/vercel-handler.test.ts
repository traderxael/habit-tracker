import { describe, it, expect } from "vitest";
import type { Request } from "express";
import { resolveUrl } from "../http.js";

// Construye un pseudo-Request mínimo: resolveUrl solo lee req.url y req.headers.
function req(url: string, headers: Record<string, string | string[]> = {}): Request {
  return { url, headers } as unknown as Request;
}

describe("resolveUrl (enrutado de la función de Vercel)", () => {
  it("deja intacta una ruta que ya empieza por /api", () => {
    expect(resolveUrl(req("/api/categories"))).toBe("/api/categories");
  });

  it("re-antepone /api cuando la plataforma recorto el prefijo", () => {
    expect(resolveUrl(req("/habits"))).toBe("/api/habits");
  });

  it("recupera la ruta desde x-matched-path cuando la rewrite colapsó a /api", () => {
    expect(resolveUrl(req("/api", { "x-matched-path": "/api/debts/3" }))).toBe("/api/debts/3");
  });

  it("usa x-invoke-path como alternativa si no viene x-matched-path", () => {
    expect(resolveUrl(req("/", { "x-invoke-path": "/api/goals" }))).toBe("/api/goals");
  });

  it("cae a /api si la cabecera no apunta a /api (evita rutas fuera de la API)", () => {
    expect(resolveUrl(req("/api", { "x-matched-path": "/index.html" }))).toBe("/api");
  });

  it("conserva la query string", () => {
    expect(resolveUrl(req("/movements?month=2026-09"))).toBe("/api/movements?month=2026-09");
  });

  it("conserva la query al recuperar desde la cabecera", () => {
    expect(resolveUrl(req("/api", { "x-matched-path": "/api/goals?id=7" }))).toBe("/api/goals");
  });

  it("resuelve la raíz sin cabeceras a /api (health, etc.)", () => {
    expect(resolveUrl(req("/"))).toBe("/api");
  });
});
