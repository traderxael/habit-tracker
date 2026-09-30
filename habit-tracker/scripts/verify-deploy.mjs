#!/usr/bin/env node
// Smoke-test de la app DESPLEGADA. Verifica end-to-end contra una URL real de
// Vercel (frontend + /api + Turso remoto), cubriendo lo que no se puede probar
// en local: conexión remota libsql:// y el enrutado /api en producción.
//
// Uso:
//   node scripts/verify-deploy.mjs https://<tu-app>.vercel.app
//   # o con credenciales propias:
//   BASE_URL=https://<app>.vercel.app node scripts/verify-deploy.mjs
//
// Crea un usuario de prueba efímero; no toca tus datos. Lee y escribe en Turso,
// así que confirma persistencia real entre peticiones.
const BASE = process.argv[2] || process.env.BASE_URL || "";
if (!BASE) {
  console.error("Falta la URL. Uso: node scripts/verify-deploy.mjs https://<app>.vercel.app");
  process.exit(2);
}
const base = BASE.replace(/\/$/, "");

let fails = 0;
const ok = (cond, label) => {
  console.log(`${cond ? "PASS" : "FAIL"} · ${label}`);
  if (!cond) fails++;
};

async function call(path, opts = {}, token) {
  const res = await fetch(`${base}${path}`, {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* HTML u otro */ }
  return { status: res.status, data, text };
}

async function main() {
  console.log(`Verificando despliegue en ${base}\n`);

  // 0) salud
  const health = await call("/api/health");
  ok(health.status === 200 && health.data && health.data.status === "ok", "/api/health responde ok (función /api enrutada)");

  // 1) registro -> token (escribe en Turso remoto)
  const email = `verify_${Date.now()}@smoke.test`;
  const reg = await call("/api/auth/register", { method: "POST", body: { email, password: "secret123" } });
  ok(reg.status === 201 && reg.data && reg.data.token, "registro (escritura en Turso remoto)");
  if (!(reg.data && reg.data.token)) {
    console.log(`  cuerpo: ${reg.text.slice(0, 200)}`);
    console.log("\nNo se pudo registrar; el resto depende de esto.");
    process.exit(1);
  }
  const T = reg.data.token;

  // 2) persistencia: leer lo que se creó tras el registro (categorías por defecto)
  const cats = await call("/api/categories", {}, T);
  ok(cats.status === 200 && Array.isArray(cats.data.categories) && cats.data.categories.length === 9, "lectura desde Turso: 9 categorías por defecto");

  // 3) un movimiento + resumen
  const tx = await call("/api/transactions", { method: "POST", body: { type: "expense", amount_cents: 12345, date: "2026-01-15" } }, T);
  ok(tx.status === 201, "crear movimiento");
  const sum = await call("/api/finance/summary?month=2026-01", {}, T);
  ok(sum.status === 200 && sum.data && sum.data.expense === 12345, "resumen mensual coincide (agregación SQL remota)");

  // 4) meta + aporte + listar aportes (endpoint) + borrar aporte
  const goal = await call("/api/goals", { method: "POST", body: { name: "Verificación", target_cents: 100000 } }, T);
  const gid = goal.data && goal.data.goal && goal.data.goal.id;
  ok(goal.status === 201 && gid, "crear meta");
  await call(`/api/goals/${gid}/contributions`, { method: "POST", body: { amount_cents: 5000 } }, T);
  const contribs = await call(`/api/goals/${gid}/contributions`, {}, T);
  ok(contribs.status === 200 && contribs.data.contributions.length === 1, "GET aportes de la meta");
  const delC = await call(`/api/goals/${gid}/contributions/${contribs.data.contributions[0].id}`, { method: "DELETE" }, T);
  ok(delC.status === 204, "borrar aporte");

  // 5) hábito vinculado a meta + toggle (aporte automático, batch atómico)
  const habit = await call("/api/habits", { method: "POST", body: { name: "Verif hábito", goal_id: gid, goal_amount_cents: 2000 } }, T);
  const hid = habit.data && habit.data.habit && habit.data.habit.id;
  ok(habit.status === 201 && hid, "crear hábito vinculado a meta");
  await call("/api/completions/toggle", { method: "POST", body: { habitId: hid, date: "2026-01-20" } }, T);
  const goalAfter = await call("/api/goals", {}, T);
  const saved = goalAfter.data.goals.find((g) => g.id === gid).savedCents;
  ok(saved === 2000, "toggle ON crea aporte automático (transacción)");

  // 6) cascada app-level: borrar la meta desvincula el hábito
  const delG = await call(`/api/goals/${gid}`, { method: "DELETE" }, T);
  ok(delG.status === 204, "borrar meta");
  const habitsAfter = await call("/api/habits", {}, T);
  const h = habitsAfter.data.habits.find((x) => x.id === hid);
  ok(h && h.goalId === null && h.goalAmountCents === null, "cascada: hábito queda sin meta tras borrarla");

  // 7) limpiar el hábito de prueba
  await call(`/api/habits/${hid}`, { method: "DELETE" }, T);

  console.log(fails === 0 ? "\nDespliegue OK: frontend + /api + Turso remoto funcionan." : `\n${fails} fallo(s). Revisa DEPLOY.md → Solución de problemas.`);
  process.exit(fails === 0 ? 0 : 1);
}

main().catch((e) => { console.error("Error ejecutando la verificación:", e.message); process.exit(1); });
