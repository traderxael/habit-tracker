# syntax=docker/dockerfile:1

# ---- Etapa 1: compilar el frontend ----
FROM node:22-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Etapa 2: compilar el backend (y dejar solo deps de producción) ----
FROM node:22-slim AS backend-build
WORKDIR /app/backend
# @libsql/client trae binarios precompilados para Debian x64/arm64; ya no se
# necesitan python3/make/g++ (desapareció better-sqlite3).
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build
RUN npm prune --omit=dev

# ---- Etapa 3: runtime ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_URL=file:/data/data.sqlite
WORKDIR /app

# Código del backend + dependencias de producción
COPY --from=backend-build /app/backend/node_modules ./backend/node_modules
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=backend-build /app/backend/package.json ./backend/package.json
# Frontend compilado; el backend lo sirve desde ../frontend/dist
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Directorio persistente para SQLite + usuario sin privilegios
RUN mkdir -p /data && chown -R node:node /data /app
USER node

EXPOSE 3001
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

WORKDIR /app/backend
CMD ["node", "dist/index.js"]
