# Desplegar la app en Vercel + Turso (gratis, sin tarjeta)

Guía para publicar **Gestor de hábitos y finanzas** como app instalable (PWA) en tu
móvil. Usa dos servicios gratuitos:

- **Vercel** (plan Hobby): sirve el frontend estático y la API Express como una
  función serverless en `/api/*`.
- **Turso** (libSQL): base de datos compatible con SQLite. Plan gratuito sin
  tarjeta (100 BD, 5 GB, 500 M lecturas / 10 M escrituras al mes).

> **¿Por qué Turso?** Vercel no persiste un archivo SQLite: el disco de sus
> funciones es efímero y las instancias no lo comparten. Turso da SQLite en la
> nube y conserva el mismo dialecto SQL de la app. El `Dockerfile` sigue siendo
> válido para correr la app en local o en cualquier host de contenedores con un
> volumen persistente.

Necesitas **Node.js 20+** y una cuenta en GitHub con este repo
(`https://github.com/traderxael/habit-tracker`).

---

## 1. Turso: crear la base de datos

Instala la CLI e inicia sesión (abre el navegador para autenticarte):

```bash
npm install -g turso
turso auth login
```

Crea una base (elige un nombre único) y mira su URL:

```bash
turso db create <NOMBRE_DB>
turso db show <NOMBRE_DB> --url
```

Copia la URL: tiene la forma `libsql://<NOMBRE_DB>-<tuusuario>.turso.io`.

Crea un token de autenticación para la app:

```bash
turso db tokens create <NOMBRE_DB>
```

Copia el token (es una cadena larga). **Trata URL y token como secretos.**

### Inicializar el esquema (una sola vez)

Desde la carpeta `habit-tracker/backend`, ejecuta el script contra Turso:

```bash
cd habit-tracker/backend
npm install
TURSO_DATABASE_URL="libsql://<NOMBRE_DB>-<tuusuario>.turso.io" \
TURSO_AUTH_TOKEN="<token>" \
npm run db:init
```

Verás `Esquema listo.` Este paso es **recomendado pero opcional**: la función de
Vercel auto-crea el esquema (DDL idempotente) en su primer arranque en frío, así que
aunque lo saltes la app funciona. Ejecutar `db:init` por tu cuenta evita el pequeño
coste de esa primera petición y es el camino preferido. Repítelo si cambias el
esquema en el futuro (las tablas existentes no se migran solas: `CREATE IF NOT EXISTS`
no altera columnas ya creadas).

---

## 2. Vercel: conectar y desplegar

Instala la CLI e inicia sesión con tu cuenta de GitHub:

```bash
npm install -g vercel
vercel login
```

### Opción A — Git integration (recomendada)

1. Entra en [vercel.com/new](https://vercel.com/new) e importa el repo
   `traderxael/habit-tracker`.
2. Vercel detecta el framework (Vite) y lee `vercel.json` de la raíz (enruta
   `/api/*` a la función y hace fallback de la SPA). Root directory: la carpeta
   `habit-tracker` si el repo tiene más cosas; si el repo es solo esta app, déjalo
   en la raíz.
3. Añade las **Environment Variables** en *Settings → Environment Variables*
   (Scope: Production, y también Preview si quieres):

   | Variable | Valor |
   |---|---|
   | `JWT_SECRET` | un secreto nuevo y fuerte (distinto del de desarrollo) |
   | `TURSO_DATABASE_URL` | tu `libsql://…` |
   | `TURSO_AUTH_TOKEN` | tu token de Turso |

   `NODE_ENV` lo fija Vercel automáticamente a `production`; `DATABASE_URL` **no**
   se define en producción (se resuelve desde `TURSO_DATABASE_URL`).
4. Despliega. Cada push a `master` vuelve a desplegar.

### Opción B — desde la CLI

```bash
cd habit-tracker
vercel            # primera vez: vincula/crea el proyecto (elige "Yes" para usar sobrecuota etc.)
vercel env add JWT_SECRET production          # pega el secreto
vercel env add TURSO_DATABASE_URL production   # pega la URL libsql://…
vercel env add TURSO_AUTH_TOKEN production     # pega el token
vercel --prod
```

La CLI imprime la URL final, p. ej. `https://habit-tracker-<algo>.vercel.app`.

### Antes de publicar (recomendado)

Comprueba que el backend de producción arrancaría bien y que `vercel.json` es
correcto, sin tocar Turso:

```bash
cd habit-tracker/backend && npm run build && npm run preflight
```

Debe terminar en `0 FAIL`. Con tus credenciales reales (`TURSO_DATABASE_URL`,
`TURSO_AUTH_TOKEN`, `JWT_SECRET`) el pre-flight valida además contra tu base de
Turso de verdad.

---

## 3. Probar y verificar en producción

- Abre la URL en el navegador. `/api/health` debe responder `{"status":"ok",...}`.
- Smoke-test automatizado (crea un usuario de prueba efímero; no toca tus datos):

  ```bash
  node scripts/verify-deploy.mjs https://<tu-app>.vercel.app
  ```

  Recorre registro → categorías → movimiento → resumen → deuda/meta → aportes →
  vínculo hábito-meta con toggle (aporte automático) → cascada de borrado. Todo en
  verde confirma que la función `/api`, Express y **Turso remoto** funcionan juntos.
- **Regístrate** con un email y contraseña; crea un hábito y márcalo; revisa el
  resumen mensual en Finanzas. Los datos persisten en Turso entre visitas y
  redespliegues.
- Si una llamada a `/api/*` devuelve 404 pero el frontend carga, revisa el
  enrutado `/api` de `vercel.json` (los routers Express usan prefijo `/api/...` y
  la función debe recibir la ruta original completa).

## 4. Instalar la PWA en el móvil

Abre la URL publicada **en el móvil** y:

- **Android (Chrome):** menú ⋮ → *Añadir a pantalla de inicio* (o el aviso
  *Instalar app*).
- **iOS (Safari):** botón Compartir → *Añadir a pantalla de inicio*.

Se abre a pantalla completa con su icono. El shell funciona sin conexión; los
datos financieros siempre se piden a la red (no se cachean).

---

## Variables de entorno (resumen)

| Variable | Dónde | Descripción |
|---|---|---|
| `JWT_SECRET` | Vercel | Firma de sesiones. **Cámbialo**, no uses el de ejemplo. |
| `TURSO_DATABASE_URL` | Vercel + script `db:init` | URL `libsql://…` de tu base. |
| `TURSO_AUTH_TOKEN` | Vercel + script `db:init` | Token de Turso. |
| `DATABASE_URL` | solo local/Docker | `file:./data.sqlite` o `file:/data/…`. |

## Solución de problemas

- **`Falta la variable de entorno …`**: en producción faltan `JWT_SECRET` o las de
  Turso. Defínelas en Vercel y redepliega.
- **La app carga pero las peticiones fallan con error de BD**: no ejecutaste
  `npm run db:init` contra Turso, o la URL/token son incorrectos.
- **Enrutado `/api` en producción** (lo único que solo se confirma con un despliegue
  real). `vercel.json` enruta `/api/:path*` a la función y hace el fallback SPA con el
  lookahead `/:path((?!api/).*)`; `api/index.ts` normaliza `req.url` para que Express
  coincida tanto si Vercel conserva el prefijo `/api` como si lo recorta. Aun así revisa:
  - **404 en `/api/...`**: el rewrite `/api/:path*` debe ir ANTES que el del fallback
    (el orden manda). Confirma que la función se montó en `/api`.
  - **405/500 "no such table"**: falta `npm run db:init` contra la misma
    `TURSO_DATABASE_URL` (la función es stateless y no crea el esquema).
  - **La API devuelve HTML en vez de JSON**: el lookahead no excluyó `/api`; revisa el
    orden de `rewrites` en `vercel.json`.
- **No aparece "Añadir a pantalla de inicio"**: la PWA necesita HTTPS (Vercel lo
  da) y que el `manifest`/service worker se sirvan; prueba en Chrome/Edge (iOS
  usa el menú Compartir).

## Notas de costo y seguridad

- Vercel Hobby y Turso gratuito no piden tarjeta; para uso personal de un solo
  usuario el límite gratuito es holgado.
- No comites `.env` ni tokens. El repo ya ignora `.env*`, `*.sqlite` y `*.db`.
- `JWT_SECRET` debe ser único y privado; rodar con `dev-secret-change-me` en
  producción no está permitido (la app lanza error).
