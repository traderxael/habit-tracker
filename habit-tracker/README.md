# Gestor de hábitos

App web para registrar hábitos diarios y ver rachas y estadísticas, con un módulo de **finanzas personales** (movimientos por categoría, deudas y metas de ahorro). Registro/entrada de usuarios, CRUD de hábitos (diarios o por días concretos), marcado diario, rachas y calendario con estadísticas.

## Estructura

```
habit-tracker/
├── backend/    # API REST — Node + Express + TypeScript + SQLite/libSQL (@libsql/client)
└── frontend/   # UI — React + Vite + TypeScript + React Router + PWA
```

## Requisitos

- Node.js 20+ (probado con Node 22)
- npm

## Cómo correrlo en local (desarrollo)

Abre dos terminales.

**Backend** (puerto 3001):

```bash
cd backend
npm install
npm run dev
```

- Health check: http://localhost:3001/api/health → `{"status":"ok","tables":N}` (N = número de tablas; puede variar según el backend SQLite/libSQL, no se afirma un número concreto).
- Crea automáticamente las tablas `users`, `habits`, `completions`, `categories`, `debts`, `transactions`, `goals`, `goal_contributions` en la base indicada por `DATABASE_URL` (por defecto `file:./data.sqlite`).

**Frontend** (puerto 5173):

```bash
cd frontend
npm install
npm run dev
```

- Abre http://localhost:5173/
- El frontend proxyea `/api/*` al backend (configurado en `frontend/vite.config.ts`).

> Nota: este entorno bloquea por defecto los *install scripts*. `@libsql/client` usa binarios precompilados, pero si `esbuild` o `libsql` quedaron sin preparar tras `npm install`, apruébalos con:
> `npm install-scripts approve esbuild libsql`

## Cómo correrlo en producción (un solo servidor)

El backend puede servir el frontend compilado, de modo que **un único proceso Node** expone la UI y la API en el mismo puerto (sin proxy ni CORS).

```bash
# 1) Compilar el frontend
cd frontend && npm install && npm run build      # genera frontend/dist

# 2) Compilar el backend
cd ../backend && npm install && npm run build     # genera backend/dist

# 3) Arrancar en modo producción
NODE_ENV=production PORT=3001 node dist/index.js
```

Abre http://localhost:3001/ — la app y la API se sirven juntas. Las rutas no-`/api` hacen fallback a `index.html` (SPA); las rutas `/api` desconocidas devuelven 404 en JSON.

## Variables de entorno

**Backend** (`backend/.env.example`):

| Variable | Por defecto | Descripción |
|---|---|---|
| `PORT` | `3001` | Puerto del servidor |
| `DATABASE_URL` | `file:./data.sqlite` | URL libSQL: archivo local (`file:...`), `:memory:` o Turso remoto (`libsql://…`) |
| `TURSO_DATABASE_URL` | — | Solo producción: URL de Turso (tiene prioridad sobre `DATABASE_URL`) |
| `TURSO_AUTH_TOKEN` | — | Solo producción con base `libsql://`: token de Turso |
| `JWT_SECRET` | `dev-secret-change-me` | **Cambiar en producción** |
| `TOKEN_TTL` | `7d` | Duración de la sesión |

**Frontend** (solo en build, prefijo `VITE_`):

| Variable | Por defecto | Descripción |
|---|---|---|
| `VITE_API_BASE` | vacío (mismo origen) | URL base de la API si el backend va en otro dominio |

## Features

- Registro e inicio de sesión (email + contraseña, JWT, bcrypt).
- Rutas protegidas: sin sesión se redirige a `/login`.
- Hábitos: crear, editar, eliminar; icono, color y frecuencia (diario o días concretos).
- Marcado diario con actualización optimista.
- Rachas: actual y mejor; cumplimiento de los últimos 30 días.
- Calendario mensual con filtro por hábito.
- Finanzas: ingresos y gastos por categoría con resumen mensual.
- Deudas con pagos y saldo calculado.
- Metas de ahorro con aportes manuales y automáticos al completar hábitos vinculados.

## API

Todas las rutas viven bajo `/api` y requieren sesión (header `Authorization: Bearer <token>`), salvo `/api/health` y las de autenticación. Las rutas preexistentes de auth, hábitos y marcado (`/api/auth`, `/api/habits`, `/api/completions`) no cambian con el módulo de finanzas.

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/categories` | Lista las categorías del usuario |
| `POST` | `/api/categories` | Crea una categoría |
| `DELETE` | `/api/categories/:id` | Borra una categoría (409 si tiene movimientos) |
| `GET` | `/api/transactions?month=YYYY-MM` | Lista los movimientos del mes indicado |
| `POST` | `/api/transactions` | Crea un movimiento (ingreso o gasto) |
| `PUT` | `/api/transactions/:id` | Edita un movimiento |
| `DELETE` | `/api/transactions/:id` | Borra un movimiento |
| `GET` | `/api/finance/summary?month=YYYY-MM` | Resumen mensual: ingresos, gastos, balance y totales por categoría |
| `GET` | `/api/debts` | Lista deudas con saldo calculado |
| `POST` | `/api/debts` | Crea una deuda |
| `PUT` | `/api/debts/:id` | Edita una deuda |
| `DELETE` | `/api/debts/:id` | Borra una deuda |
| `POST` | `/api/debts/:id/payments` | Registra un pago (rechaza pagos mayores al saldo) |
| `GET` | `/api/goals` | Lista metas con ahorrado/objetivo y aportes |
| `POST` | `/api/goals` | Crea una meta |
| `PUT` | `/api/goals/:id` | Edita una meta |
| `DELETE` | `/api/goals/:id` | Borra una meta |
| `POST` | `/api/goals/:id/contributions` | Aporte manual a una meta |
| `GET` | `/api/goals/:id/contributions` | Lista los aportes de una meta |
| `DELETE` | `/api/goals/:id/contributions/:cid` | Borra un aporte |

Los importes se manejan como **enteros en centavos** (`amount_cents`, `total_cents`, `target_cents`); las respuestas usan camelCase. Al completar un hábito vinculado a una meta, el backend registra automáticamente el aporte asociado (y lo revierte al desmarcar).

## Despliegue con Docker

La imagen (`Dockerfile` multi-stage) empaqueta el **servidor único**: el backend sirve el frontend compilado. No hace falta proxy ni CORS.

```bash
# desde la carpeta habit-tracker/
docker build -t habit-tracker .

# arranca: mapea el puerto y persiste la BD en un volumen
docker run --rm -p 3001:3001 \
  -e JWT_SECRET=cambia-este-secreto \
  -v habit-tracker-data:/data \
  habit-tracker
```

Abre http://localhost:3001/. La base de datos vive en el volumen `habit-tracker-data` (ruta interna `/data/data.sqlite`), de modo que sobrevive a recrear el contenedor.

Variables en el contenedor: `PORT` (3001), `DATABASE_URL` (`file:/data/data.sqlite`), `JWT_SECRET` (**cambiar**), `TOKEN_TTL` (7d). El contenedor corre con usuario sin privilegios e incluye `HEALTHCHECK` sobre `/api/health`. El esquema se crea solo al arrancar (idempotente).

Esta imagen es portable a cualquier host que ejecute Docker/OCI (Render, Railway, Fly.io, un VPS, etc.). Si en algún momento separas el backend en otro dominio, compila el frontend con `VITE_API_BASE` apuntando a la API.


## Desplegar en Vercel + Turso (app instalable en el móvil)

La ruta gratuita y sin tarjeta usa **Vercel** (frontend estático + la API Express como función serverless) y **Turso** (libSQL remoto, compatible con SQLite). El enrutado, el `init-db` de esquema y las variables de entorno están detallados en [`DEPLOY.md`](./DEPLOY.md). Resumen:

1. Crear una base en Turso y su token; inicializar el esquema una vez: `cd backend && TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… npm run db:init`.
2. Conectar el repo a Vercel (o `vercel`), definir `JWT_SECRET`, `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN` como variables de entorno, y `vercel --prod`.
3. Abrir la URL publicada en el móvil y **instalar la PWA**.

> Vercel **no** persiste un archivo SQLite (su filesystem es efímero), por eso la base vive en Turso. El modo local/Docker sigue usando un archivo `file:…`.

## PWA (instalar en el móvil)

La app es instalable: tras desplegarla, en Android (Chrome) usa el menú → *Añadir a pantalla de inicio*; en iOS (Safari) usa *Compartir* → *Añadir a pantalla de inicio*. Se abre a pantalla completa con su propio icono. El service worker precachea el shell (arranca sin conexión) pero **nunca cachea la API**: los datos financieros siempre se piden a red.

## Scripts

| Comando | Backend | Frontend |
|---|---|---|
| `npm run dev` | servidor con recarga (tsx watch) | Vite dev server |
| `npm run build` | compila TS a `dist/` | build de producción a `dist/` |
| `npm run typecheck` | `tsc --noEmit` | `tsc --noEmit` |
| `npm test` | `vitest run` (tests de API) | `vitest run` (tests unitarios) |

Los tests corren con [Vitest](https://vitest.dev) (dev dependency en ambos paquetes); el backend además usa `supertest` (solo backend) para ejercitar la API sobre `createApp` sin levantar servidor.

Ver el plan completo en `../plan-proyecto.md` y el alcance en `../idea-proyecto.md`.
