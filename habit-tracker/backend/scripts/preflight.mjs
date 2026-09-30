#!/usr/bin/env node
// Pre-flight de despliegue: valida ANTES de subir a Vercel que el backend
// arrancaría correctamente. Cross-platform.
//
// Uso con tus credenciales reales (verifica contra tu Turso de verdad):
//   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... JWT_SECRET=... node scripts/preflight.mjs
// Sin credenciales: cae a una BD en memoria (verifica la lógica, no Turso) y avisa.
import { pathToFileURL, fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createServer } from "node:http";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = (...p) => path.join(here, "..", "dist", ...p);

const realUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "";
const usingTurso = /^libsql:\/\//.test(realUrl) || /^https?:\/\//.test(realUrl);

// Fija el destino de BD UNA vez, antes de importar config/db (módulo caché).
if (usingTurso) {
  process.env.NODE_ENV = "production";
} else {
  process.env.NODE_ENV = "production";
  process.env.DATABASE_URL = ":memory:"; // verificación local de la lógica
  delete process.env.TURSO_DATABASE_URL;
}
const hadJwt = !!process.env.JWT_SECRET;
if (!hadJwt) process.env.JWT_SECRET = "preflight-throwaway";

let pass = 0, warn = 0, fail = 0;
const ok = (c, label) => { c ? (pass++, console.log("  PASS " + label)) : (fail++, console.error("  FAIL " + label)); };
const note = (label) => { warn++; console.log("  AVISO " + label); };

(async () => {
  console.log("Pre-flight de despliegue" + (usingTurso ? " (contra Turso real)" : " (memoria local)"));
  console.log("");

  // 1) dist compilado (buildCommand de Vercel lo genera; compruébalo en local/prebuilt)
  ok(existsSync(dist("app.js")), "existe dist/app.js (compilado)");
  ok(existsSync(dist("db.js")), "existe dist/db.js");

  // 2) config en producción resuelve sin lanzar
  try {
    const cfg = await import(pathToFileURL(dist("config.js")).href);
    ok(typeof cfg.DATABASE_URL === "string" && cfg.DATABASE_URL.length > 0, "config resuelve DATABASE_URL");
    ok(typeof cfg.JWT_SECRET === "string" && cfg.JWT_SECRET.length > 0, "config resuelve JWT_SECRET");
  } catch (e) { fail++; console.error("  FAIL config producción lanzó: " + e.message); }

  if (!usingTurso) note("sin TURSO_DATABASE_URL real: se verificó en memoria (no contra Turso).");
  if (!hadJwt) note("sin JWT_SECRET: se usó uno de relleno. En Vercel define JWT_SECRET real.");

  // 3) esquema + arranque de la app de producción (idempotencia + health)
  try {
    const dbMod = await import(pathToFileURL(dist("db.js")).href);
    await dbMod.initSchema();
    await dbMod.initSchema();
    const row = await dbMod.db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table'").get();
    ok(Number(row.n) >= 8, `initSchema idempotente (${Number(row.n)} tablas)`);

    const { createApp } = await import(pathToFileURL(dist("app.js")).href);
    const srv = createServer(createApp()).listen(0);
    await new Promise((r) => srv.once("listening", r));
    const port = srv.address().port;
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    ok(res.status === 200, "GET /api/health responde 200 con la app de producción");
    srv.close();
  } catch (e) { fail++; console.error("  FAIL esquema/arranque: " + e.message); }

  // 4) vercel.json: orden de rewrites + declaración de la función
  try {
    const v = JSON.parse(readFileSync(path.join(here, "..", "..", "vercel.json"), "utf8"));
    const srcs = (v.rewrites || []).map((r) => r.source);
    const apiIdx = srcs.findIndex((s) => s.startsWith("/api"));
    const spaIdx = srcs.findIndex((s) => s.includes("?!api"));
    ok(v.outputDirectory === "frontend/dist", "vercel.json outputDirectory = frontend/dist");
    ok(apiIdx !== -1 && spaIdx !== -1 && apiIdx < spaIdx, "vercel.json: rewrite /api ANTES que el fallback SPA");
    ok(!!(v.functions && v.functions["api/index.ts"]), "vercel.json declara la función api/index.ts");
  } catch (e) { fail++; console.error("  FAIL vercel.json: " + e.message); }

  console.log(`\nResultado: ${pass} PASS, ${warn} AVISO, ${fail} FAIL`);
  process.exit(fail === 0 ? 0 : 1);
})();
