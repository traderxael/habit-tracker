# Habit Tracker

> Axael Contreras · Full-stack

Rastreador de hábitos full-stack: frontend **React + Vite + TypeScript**, backend
**Node + Express + SQLite** (better-sqlite3), con **auth JWT**, **rachas (streaks)**
y **vista de calendario**.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React · Vite · TypeScript |
| Backend | Node · Express · SQLite (better-sqlite3) |
| Auth | JWT |
| Features | Rachas (streaks) · vista de calendario |

## Estructura

```
habit-tracker/
├── frontend/      # React + Vite + TS
│   ├── index.html
│   └── package.json
├── backend/       # Node + Express + SQLite
│   ├── .env.example
│   └── package.json
├── package.json   # scripts raíz
└── Dockerfile
```

## Instalación

```bash
# 1) Dependencias raíz
npm install

# 2) Backend — configura el entorno
cd backend
cp .env.example .env    # y completa los valores

# 3) Frontend
cd ../frontend
npm install
npm run dev
```

Variables que espera el backend (ver [`backend/.env.example`](habit-tracker/backend/.env.example)):

- `PORT` — puerto del servidor
- `JWT_SECRET` — clave para firmar los tokens (usa una larga y aleatoria)
- `DATABASE_URL` — ruta del archivo SQLite

> 🔒 Nunca subas tu `.env` al repo: ya está en `.gitignore`.

## Variables de entorno

El repo trae [`backend/.env.example`](habit-tracker/backend/.env.example) como plantilla.
Cópialo a `.env` y rellénalo. El `.gitignore` ya excluye los `.env` reales.

## Docker

Incluye [`Dockerfile`](habit-tracker/Dockerfile) para desplegar el servicio como contenedor.

```bash
docker build -t habit-tracker .
docker run -p 3000:3000 --env-file backend/.env habit-tracker
```

## Documentación del proyecto

- [`idea-proyecto.md`](idea-proyecto.md) — la idea original
- [`plan-proyecto.md`](plan-proyecto.md) — el plan de trabajo
- [`docs/`](docs/) — documentación adicional

## Licencia

MIT — ver [LICENSE](LICENSE).
