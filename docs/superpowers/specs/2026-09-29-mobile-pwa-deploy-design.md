# Diseño: App personal instalable (PWA) desplegada en Vercel + Turso

Fecha: 2026-09-29
Estado: aprobado por el usuario en chat (brainstorming, ruta arquitectónica)
Proyecto: habit-tracker + módulo de finanzas (React 18 + Vite 5 + TS / Node + Express 4 + TS ESM / better-sqlite3)

## Objetivo

Convertir la app actual (hábitos + finanzas) en una **app personal instalable en el
móvil**, alojada **gratis y sin tarjeta de crédito**, reutilizando la lógica de
negocio existente. Dos entregables combinados en esta iteración:

1. **Despliegue + PWA**: publicar el frontend estático y el backend en Vercel
   (plan Hobby, gratis), con la base de datos en Turso (libSQL, gratis, sin
   tarjeta), y añadir la capa PWA para "Añadir a pantalla de inicio" en el móvil.
2. **Cerrar las 2 desviaciones de spec** detectadas en la revisión final del
   módulo de finanzas (edición de deudas/metas + badge de hábito vinculado +
   borrado de aporte; y el no-op silencioso al vincular un hábito sin importe),
   más actualización de documentación.

Moneda y formato sin cambios (peso, `$1,234.56`, Intl `es-MX`/`MXN`).

## Por qué Vercel + Turso (y no el backend actual tal cual)

Hecho verificado en la KB oficial de Vercel: **Vercel no soporta SQLite
persistente** — el filesystem de las funciones serverless es efímero y las
instancias no comparten almacenamiento. Por tanto el archivo `data.sqlite` de
`better-sqlite3` **no persiste** en Vercel. La única vía gratuita y sin tarjeta
que conserva la lógica SQL es mover los datos a **Turso (libSQL)**, que es
compatible con SQLite (mismo dialecto: `CREATE TABLE`, `COALESCE`, `CASE WHEN`,
subconsultas, `SUM`, `AUTOINCREMENT`, `sqlite_master`) y ofrece transacciones.

Turso free (verificado en su pricing): 100 bases de datos, 5 GB, 500 M filas
leídas / 10 M escritas al mes, **sin tarjeta de crédito**. Holgado para uso
personal de un solo usuario.

Alternativas descartadas: **Qoder Sites** (exige reescribir el backend a Deno
Edge Functions + Supabase/Postgres, pierde la atomicidad SQL y cambia el modelo
de auth — esfuerzo/riesgo mucho mayor); **Fly.io** (corre el Dockerfile sin
cambios pero pide tarjeta de crédito); **Render/Railway free** (filesystem
efímero o disco persistente de pago → mismos problemas que Vercel con SQLite).

## Arquitectura

Cuatro piezas, mismo origen (un solo dominio de Vercel):

- **Frontend estático** — build de Vite (`frontend/dist`) servido por la CDN de
  Vercel. SPA con React Router; Vercel hace fallback de todas las rutas no-API a
  `/index.html`.
- **Backend como función serverless** — la app Express actual (solo la parte
  API) exportada como función Node de Vercel en `/api/*`. Mismo `createApp()`,
  mismas rutas, mismo middleware `requireAuth`, mismos validadores.
- **Base de datos** — Turso (libSQL remoto) vía `@libsql/client`. Sustituye a
  `better-sqlite3`. El dialecto SQL y las consultas se conservan; cambia la API
  de acceso (de síncrona a asíncrona).
- **Capa PWA** — `vite-plugin-pwa`: manifest + iconos + service worker. Permite
  instalar la app en el móvil y arrancar el shell sin conexión.

El `Dockerfile` actual se **conserva** intacto para ejecución local y para otros
hosts de contenedor; la ruta Vercel es adicional, no sustitutiva.

### Flujo de datos

`móvil (PWA instalada) → CDN Vercel (shell estático) → /api/* (función Express)
→ @libsql/client → Turso`. Las llamadas del frontend siguen siendo same-origin
`/api/...` (`API_BASE = ""` en `client.ts` no cambia). Auth sin cambios:
`bcryptjs` + `jsonwebtoken` dentro de la función; `JWT_SECRET` como variable de
entorno de Vercel; token en `localStorage["ht_token"]`.

## Port de la capa de datos (better-sqlite3 → @libsql/client)

Alcance real (verificado en el código): 8 ficheros de rutas
(`auth, categories, completions, debts, finance, goals, habits, transactions`),
`db.ts`, `app.ts` (endpoint `/api/health`) y `lib/streaks.ts`. Aprox. 29 sitios
`db.prepare(...).get/all/run`, 1 `db.transaction` (toggle de hábito con aporte) y
el bootstrap de esquema (`db.exec` + `db.pragma`).

Reglas del port:

- **Todo handler pasa a `async`**; cada `.get/.all/.run` se convierte en
  `await client.execute({ sql, args })`. `execute` devuelve
  `{ rows, rowsAffected, lastInsertRowid }`.
- **`lastInsertRowid` es `bigint`** en libSQL → envolver en `Number(...)` donde
  hoy se usa `Number(info.lastInsertRowid)`.
- **Filas como objetos**: usar `rowMode` objeto (o mapear) para que
  `row.user_id` etc. sigan funcionando como hoy con better-sqlite3.
- **`.get()` (una fila)** → `execute(...).then(r => r.rows[0] ?? undefined)`;
  **`.all()`** → `r.rows`; **`.run()`** → usar `r.rowsAffected` /
  `r.lastInsertRowid` en lugar de `info.changes` / `info.lastInsertRowid`.
- **Atomicidad**: el toggle de hábito (completion + aporte/revocación) usa hoy
  `db.transaction()`. En libSQL se preserva con `client.transaction("write", async tx => {...})`
  (o `client.batch([...], "write")`, que es atómico). **Requisito**: la garantía
  de atomicidad de la spec se mantiene; no dividir en llamadas sueltas.
- **Parámetros posicionales `?`**: libSQL acepta `args` como array (posicional) —
  las consultas con `?` y su orden no cambian.
- **`SELECT COUNT(*) FROM sqlite_master`** (health): libSQL expone
  `sqlite_master`; la consulta sigue siendo válida (async). El recuento esperado
  en Turso puede diferir (sin `sqlite_sequence` si no hay AUTOINCREMENT material)
  → el health ya no debe afirmar un número fijo en README; ver nota de docs.

### Riesgo clave: foreign keys en Turso

El esquema depende de `PRAGMA foreign_keys = ON` para `ON DELETE CASCADE`
(users→hábitos/completions/categorías/deudas/transacciones/metas;
goals→contributions) y `ON DELETE SET NULL` (transactions.category_id/debt_id;
habits.goal_id; goal_contributions.habit_id). En better-sqlite3 se activa por
conexión en `db.ts`. **En Turso/libSQL remoto hay que verificar que las FK se
cumplan por conexión**; las conexiones son por-request en serverless.

- **Requisito**: el implementador debe verificar empíricamente el enforcement de
  FK en Turso. Si no es fiable por-conexión, **las acciones referenciales se
  garantizan en código de aplicación**: p. ej. al borrar una meta, borrar sus
  `goal_contributions` y limpiar `habits.goal_id`/`goal_amount_cents` del usuario
  antes/del DELETE; al borrar una deuda, ya se borran primero sus pagos
  (existente). Esto se cubre con tests de aislamiento por recurso.
- No publicar sin confirmar que el borrado en cascada funciona (test E2E de
  borrado de meta con aportes y hábitos vinculados).

### Bootstrap de esquema

Hoy `db.ts` ejecuta `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ADD COLUMN`
(idempotente) en el arranque del proceso. En serverless eso se ejecutaría en
cada cold start (overhead + posibles carreras). **Decisión**: extraer el DDL a un
script de migración único `backend/scripts/init-db.ts` que se ejecuta **una vez**
contra Turso (documentado en el README/DEPLOY). El runtime de la función queda
sin DDL: solo `createClient({ url, authToken })`. El DDL sigue siendo idempotente
para poder re-ejecutarse sin daño.

### Configuración / entorno

- `config.ts` añade `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`; `JWT_SECRET` ya
  existe. **Validación en producción**: si falta alguna en `NODE_ENV=production`,
  arrancar/lanzar error claro (no usar el fallback `dev-secret-change-me` ni
  SQLite local en prod).
- `db.ts` exporta un `client` libSQL singleton creado desde esas vars. En tests y
  en local sigue pudiendo apuntar a un archivo libSQL (`file:...`) o `:memory:`.

## Adaptación serverless (Vercel)

- **Refactor de `app.ts`**: `createApp()` devuelve **solo la API** (cors, json,
  `/api/health`, routers, 404 de `/api`, manejador de errores). El serving de
  estáticos + fallback SPA (bloque `if NODE_ENV==="production"`) se **mueve a
  `index.ts`** (el servidor de larga duración del Docker). Así la función de
  Vercel importa `createApp()` API-only y el contenedor sigue sirviendo la SPA.
- **Función de Vercel**: `api/index.ts` (Node runtime) que `export default
  createApp()`. Enrutado de `/api/*` a la función y fallback SPA del resto a
  `/index.html` mediante `vercel.json` (`rewrites`). El patrón exacto
  (catch-all `api/[...].ts` vs rewrite) se fija en el plan contra la docs actual
  del runtime Node de Vercel.
- **`vercel.json`** en la raíz del repo: proyecto con `outputDirectory`
  `frontend/dist`, build del frontend (Vite), función en `api/`, y rewrites
  `/api/:path*` → función + `/:path*` → `/index.html` (SPA). `installCommand` /
  `buildCommand` que instalen y compilen frontend (y backend si la función lo
  necesita compilado o vía ts).
- **Frontend**: `API_BASE=""` sigue valiendo (same-origin). Solo se añaden PWA y
  meta móvil. Sin cambios en `client.ts` salvo lo indicado.

## Capa PWA (instalable en el móvil)

- **`vite-plugin-pwa`** en `frontend`: genera manifest + service worker en el
  build.
- **Manifest**: `name` "Gestor de hábitos y finanzas", `short_name` "Hábitos",
  `start_url` `/`, `display` `standalone`, `theme_color`/`background_color`
  tomados de los tokens de DESIGN.md (indigo `#4f46e5` / canvas), `icons` 192 y
  512 (+ maskable).
- **Iconos**: PNG 192/512/maskable generados a partir de la marca existente
  (círculo indigo→violeta con check blanco del favicon SVG). También
  `apple-touch-icon` para iOS.
- **Service worker**: precachea el **app shell** (arranque offline). Para
  `/api/*`: **network-first sin servir datos financieros rancios** — las
  mutaciones siempre a red; como mucho fallback de error claro sin conexión. No
  se cachean respuestas de datos sensibles.
- **Meta móvil** en `index.html`: `theme-color`, `apple-mobile-web-app-capable`,
  `apple-mobile-web-app-status-bar-style`, `apple-touch-icon`.
- **Install**: la PWA estándar permite "Añadir a pantalla de inicio" en Android
  (Chrome) y iOS (Safari). No se fuerza un prompt custom salvo que aporte valor.

## Cierre de las 2 desviaciones de spec (módulo de finanzas)

Los endpoints backend ya existen y están testeados; el trabajo es de frontend.

1. **Edición + badge + borrado de aporte**
   - `pages/Debts.tsx`: añadir **edición** de deuda (nombre, importe total,
     vencimiento) usando `financeApi.updateDebt` (patrón `startEdit` de
     Habits.tsx).
   - `pages/Goals.tsx`: añadir **edición** de meta (`updateGoal`), **badge de
     hábito vinculado** (qué hábitos alimentan la meta: obtener hábitos y
     filtrar `goalId === g.id`) y **borrado de aporte manual**
     (`deleteContribution`, listando los aportes de la meta con botón de borrar).
   - Respetar DESIGN.md (clases/tokens existentes; sin hex crudos).
2. **No-op silencioso del vínculo hábito→meta**
   - `pages/Habits.tsx`: si `goalId` está elegido pero `goal_amount_cents` falta o
     es inválido, **bloquear el envío y mostrar error** (no enviar `null` en
     silencio). Mensaje claro en español junto al campo.

**Hardening barato opcional** (recomendado por la revisión final, incluir si es de
bajo riesgo): guardas `Number.isInteger(:id)` uniformes; reset de `categoryId` al
cambiar tipo en Finance.tsx; `try/catch` en los `onDelete` de Debts/Goals/Finance;
cota superior en `validAmountCents`; `db.transaction`/batch en delete-de-debt y
register-seed; corrección del "Known Gaps" obsoleto de DESIGN.md
(`--shadow-lg`/`--r-xl` sí se usan en auth-split). El resto de Minors queda como
follow-up documentado.

## Documentación

- **README**: nueva sección "Desplegar en Vercel + Turso" (crear BD Turso,
  `init-db`, variables de entorno, `vercel --prod`), nota de que el health ya no
  afirma un número fijo de tablas, y sección PWA (cómo instalar en el móvil).
- **DESIGN.md**: componentes PWA/instalables si procede (iconos, theme-color) y
  corrección del Known Gaps obsoleto.
- **DEPLOY.md** (o sección equivalente): guía paso a paso copiable, incluidos los
  comandos de Turso y Vercel y dónde obtener cada variable.

## Entrega y límites (importante)

- **No puedo crear tus cuentas ni autenticarme en ellas.** Vercel y Turso
  requieren tu login (ambos gratis, Turso sin tarjeta). Mi entregable es: todo el
  código (port, serverless, PWA, fixes, docs) commiteado, el script `init-db`, y
  una guía de despliegue exacta copiable. El `vercel --prod` final y la creación
  de la BD Turso los ejecutas tú con tu cuenta (o yo conduzco la CLI de Vercel si
  ya tienes sesión iniciada en local, confirmándolo antes).
- **GitHub**: el módulo de finanzas está en `feature/personal-finance` (sin
  fusionar en `master`). "Descargarlo desde GitHub" implica: fusionar los fixes
  en esa rama → fusionar `feature/personal-finance` en `master` → **push a GitHub
  (acción externa y visible: se confirma antes)** → conectar el repo a Vercel
  (Git integration) para que despliegue en cada push. El trabajo de PWA/despliegue
  va en una rama nueva (`feature/mobile-pwa-deploy`) sobre `master`.

## Estrategia de pruebas

- **Backend (33 tests)**: actualizar el harness (`src/test/helpers.ts`) para usar
  `@libsql/client` contra un archivo libSQL temporal o `:memory:` (rápido, sin
  red). Los handlers ya async; supertest funciona igual. Mantener la cobertura de
  validación, ownership/aislamiento entre usuarios, atomicidad del toggle+aporte y
  cascadas de borrado.
- **Frontend**: los 4 tests de `money.ts` no cambian. Añadir verificación de que
  `vite build` genera manifest + service worker.
- **E2E**: en local con `vercel dev` (o el servidor Docker + un Turso de pruebas)
  recorrer: registro → 9 categorías → movimiento → resumen mensual → deuda+pago →
  meta+aporte+edición+borrado de aporte → vínculo hábito-meta con importe (toggle
  ON/OFF mueve/reverte el aporte) → **vínculo sin importe muestra error** (fix #2).
  Verificación de instalación PWA en móvil real la hace el usuario (yo verifico
  manifest/SW/icons y el "Añadir a pantalla de inicio" en navegador).
- **Puertas deterministas**: `tsc --noEmit` limpio en frontend y backend; build de
  producción de ambos; tests verdes.

## Fuera de alcance (YAGNI)

Apps nativas de tiendas (Play Store/App Store), sincronización offline de
mutaciones (solo el shell arranca offline), multi-región/escalado de pago,
multi-moneda, presupuestos mensuales, y cualquier reescritura a Deno/Supabase.

## Criterios de éxito

1. La app publicada en una URL de Vercel funciona igual que en local (hábitos +
   finanzas), con datos persistentes en Turso entre peticiones y redespliegues.
2. Desde el móvil se puede "Añadir a pantalla de inicio" y se lanza a pantalla
   completa con icono propio; el shell carga sin conexión.
3. Las 2 desviaciones de spec están cerradas y cubiertas (edición de deudas/metas,
   badge de hábito vinculado, borrado de aporte, error al vincular sin importe).
4. `tsc --noEmit` y builds limpios; 33 tests backend + 4 frontend verdes; E2E
   recorre los flujos clave incluida la atomicidad del aporte y las cascadas.
5. README/DEPLOY permiten a un tercero (o al usuario) desplegar de cero con sus
   cuentas gratuitas sin pasos ocultos.
