# Gestor de hábitos

App web para registrar hábitos diarios y ver rachas y estadísticas. **MVP funcional**: registro/entrada de usuarios, CRUD de hábitos (diarios o por días concretos), marcado diario, rachas y calendario con estadísticas.

## Estructura

```
habit-tracker/
├── backend/    # API REST — Node + Express + TypeScript + SQLite (better-sqlite3)
└── frontend/   # UI — React + Vite + TypeScript + React Router
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

- Health check: http://localhost:3001/api/health → `{"status":"ok","tables":4}`
- Crea automáticamente `backend/data.sqlite` con las tablas `users`, `habits`, `completions`.

**Frontend** (puerto 5173):

```bash
cd frontend
npm install
npm run dev
```

- Abre http://localhost:5173/
- El frontend proxyea `/api/*` al backend (configurado en `frontend/vite.config.ts`).

> Nota: este entorno bloquea por defecto los *install scripts*. Tras `npm install`, si `esbuild` o `better-sqlite3` quedaron sin compilar, apruébalos con:
> `npm install-scripts approve esbuild better-sqlite3`

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
| `DB_PATH` | `./data.sqlite` | Ruta del archivo SQLite |
| `JWT_SECRET` | `dev-secret-change-me` | **Cambiar en producción** |
| `TOKEN_TTL` | `7d` | Duración de la sesión |

**Frontend** (solo en build, prefijo `VITE_`):

| Variable | Por defecto | Descripción |
|---|---|---|
| `VITE_API_BASE` | vacío (mismo origen) | URL base de la API si el backend va en otro dominio |

## Features (MVP)

- Registro e inicio de sesión (email + contraseña, JWT, bcrypt).
- Rutas protegidas: sin sesión se redirige a `/login`.
- Hábitos: crear, editar, eliminar; icono, color y frecuencia (diario o días concretos).
- Marcado diario con actualización optimista.
- Rachas: actual y mejor; cumplimiento de los últimos 30 días.
- Calendario mensual con filtro por hábito.

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

Variables en el contenedor: `PORT` (3001), `DB_PATH` (/data/data.sqlite), `JWT_SECRET` (**cambiar**), `TOKEN_TTL` (7d). El contenedor corre con usuario sin privilegios e incluye `HEALTHCHECK` sobre `/api/health`.

Esta imagen es portable a cualquier host que ejecute Docker/OCI (Render, Railway, Fly.io, un VPS, etc.). Si en algún momento separas el backend en otro dominio, compila el frontend con `VITE_API_BASE` apuntando a la API.


## Scripts

| Comando | Backend | Frontend |
|---|---|---|
| `npm run dev` | servidor con recarga (tsx watch) | Vite dev server |
| `npm run build` | compila TS a `dist/` | build de producción a `dist/` |
| `npm run typecheck` | `tsc --noEmit` | `tsc --noEmit` |

Ver el plan completo en `../plan-proyecto.md` y el alcance en `../idea-proyecto.md`.
