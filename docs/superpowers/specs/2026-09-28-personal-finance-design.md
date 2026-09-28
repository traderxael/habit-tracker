# Diseño: Módulo de Finanzas Personales

Fecha: 2026-09-28
Estado: aprobado por continuidad (brainstorming, enfoque A)
Proyecto: habit-tracker (React 18 + Vite 5 + TS / Node + Express 4 + TS ESM / better-sqlite3)

## Objetivo

Extender la app existente para gestionar finanzas personales del mismo usuario:
ingresos y gastos con categorías, deudas, metas de ahorro, resumen mensual en la
página Hoy, y vínculo hábitos↔metas (marcar un hábito aporta automáticamente a
su meta).

Moneda única: peso, formato `$1,234.56` (Intl `es-MX` / `MXN`). Sin presupuestos
mensuales (fuera de alcance, decidido por el usuario).

## Enfoque elegido

**A. Extender el monolito actual.** Mismo SQLite, mismo backend Express, mismo
frontend SPA con pestañas nuevas. Reutiliza auth JWT, ownership por `user_id`,
sistema de diseño (tokens, `EmptyState`, `IconPicker`) y despliegue de servidor
único. Descartados: B (app separada — duplica auth/BD y rompe la integración) y
C (frontend separado contra misma API — complejidad innecesaria).

## Modelo de datos

Cantidades siempre en **centavos (INTEGER)**. Mismo patrón que tablas actuales:
`user_id` FK a `users`, `created_at`. Creación con `CREATE TABLE IF NOT EXISTS`
en `db.ts`; columnas nuevas en `habits` con `ALTER TABLE ... ADD COLUMN`
envuelto en try/catch (idempotente).

- `categories`: `id, user_id, name, icon (emoji), type ('income'|'expense'), color, created_at`.
  Siembra de categorías por defecto al registrarse (Comida 🍔, Transporte 🚌,
  Hogar 🏠, Salud 💊, Ocio 🎮, Otros 📦 / Nómina 💼, Freelance 💻, Inversiones 📈).
- `transactions`: `id, user_id, category_id, type ('income'|'expense'), amount_cents, note, date (YYYY-MM-DD), debt_id (nullable), created_at`.
- `debts`: `id, user_id, name, total_cents, due_date (nullable), created_at`.
  Saldo pendiente = `total_cents` − suma de pagos (transactions de gasto con
  `debt_id`), calculado en consulta, nunca duplicado.
- `goals`: `id, user_id, name, icon, target_cents, deadline (nullable), created_at`.
- `goal_contributions`: `id, user_id, goal_id, amount_cents, habit_id (nullable), date (YYYY-MM-DD), created_at`.
- `habits` (columnas nuevas): `goal_id (nullable)`, `goal_amount_cents (nullable)`.

Invariante: todo `category_id`, `goal_id`, `debt_id`, `habit_id` referenciado
debe pertenecer al mismo `user_id` (se valida en las rutas).

## API

Rutas nuevas bajo el middleware `auth` existente, estilo REST idéntico a
`habits.ts`. Validación en frontera: importes enteros > 0 en centavos, fechas
`YYYY-MM-DD`, enums de tipo, ownership de IDs.

- `GET /api/categories` · `POST /api/categories` · `DELETE /api/categories/:id`
  (rechaza si tiene movimientos asociados; 409 con mensaje).
- `GET /api/transactions?month=YYYY-MM` · `POST /api/transactions` ·
  `PUT /api/transactions/:id` · `DELETE /api/transactions/:id`.
- `GET /api/finance/summary?month=YYYY-MM` →
  `{ income, expense, balance, byCategory: [{ categoryId, name, icon, color, total }] }`.
- `GET /api/debts` · `POST /api/debts` · `PUT /api/debts/:id` ·
  `DELETE /api/debts/:id` · `POST /api/debts/:id/payments` (body:
  `{ amount_cents, date, note? }`; crea transacción de gasto con `debt_id`;
  rechaza si excede el saldo pendiente).
- `GET /api/goals` · `POST /api/goals` · `PUT /api/goals/:id` ·
  `DELETE /api/goals/:id` · `POST /api/goals/:id/contributions` ·
  `DELETE /api/contributions/:id`.
- `POST /api/habits/:id/toggle` y `DELETE` (existentes) se amplían: si el hábito
  tiene `goal_id` + `goal_amount_cents`, al marcar crea un `goal_contributions`
  (con `habit_id` y fecha del marcado) y al desmarcar lo elimina — todo dentro
  de la misma transacción SQL de better-sqlite3.

Archivos: `backend/src/routes/{categories,transactions,debts,goals}.ts` nuevos;
`completions.ts` modificado para el toggle con aporte; `db.ts` con el esquema
ampliado; `auth.ts` añade la siembra de categorías por defecto en el registro.

## Frontend

Nav: **Hoy · Hábitos · Finanzas · Deudas · Metas · Calendario**.

- `lib/money.ts`: `formatMoney(cents)` con `Intl.NumberFormat("es-MX", { style:
  "currency", currency: "MXN" })`; `parseAmountToCents(input)` (texto decimal →
  centavos, rechaza NaN/≤0). Único punto de formateo monetario.
- `components/AmountInput.tsx`: input de importe (texto decimal) que expone
  centavos válidos; `components/MonthNav.tsx`: ‹ mes › (patrón de `Calendar.tsx`).
- `pages/Finance.tsx` (`/finanzas`): `MonthNav`; 3 `stat-card` (Ingresos,
  Gastos, Balance); desglose por categoría con barras `--grad-bar`; lista de
  movimientos agrupada por día (icono+categoría, nota, importe en verde/rojo
  semántico); formulario "Nuevo movimiento" (toggle ingreso/gasto, select de
  categoría, `AmountInput`, fecha, nota); `EmptyState` sin movimientos.
- `pages/Debts.tsx` (`/deudas`): tarjetas con `progress` pagado/total,
  "Registrar pago" inline (`AmountInput`), alta/edición/borrado.
- `pages/Goals.tsx` (`/metas`): tarjetas con icono, `progress`, deadline,
  "Aportar" manual, badge de hábito vinculado, alta/edición/borrado.
- `pages/Habits.tsx`: el formulario gana "Vincular a meta" (select de metas +
  `AmountInput` de aporte al completarlo, ambos opcionales).
- `pages/Today.tsx`: bajo el progreso de hábitos, `card` "Este mes" con
  Ingresos/Gastos/Balance y una línea por meta activa con progreso; enlace a
  `/finanzas`.
- `types.ts` y `api/client.ts` ampliados con las nuevas entidades y endpoints.
- Todo con clases/tokens del sistema de diseño; sin colores crudos ni estilos
  inline fuera de lo permitido por DESIGN.md (anchos dinámicos de barras).

## Errores y casos borde

- `ApiError` existente para 4xx; formularios muestran el mensaje del servidor.
- Borrar categoría con movimientos → 409, la UI sugiere editar en vez de borrar.
- Pago de deuda mayor que el saldo → 400.
- Hábito con meta borrada: `goal_id` se limpia (FK `ON DELETE SET NULL`).
- Aportes automáticos al desmarcar: solo se elimina el aporte de ese marcado
  (`habit_id` + fecha exacta del completion).

## Verificación

- `tsc --noEmit` limpio en frontend y backend; build de producción de ambos.
- E2E en navegador (patrón take_snapshot + evaluate_script por la restricción
  del surface oculto): categoría→movimiento→resumen mensual correcto; deuda→pago
  →saldo; meta→vínculo con hábito→marcar→aporte aparece→desmarcar→aporte se
  revierte; Hoy muestra el resumen del mes.
- Actualizar `DESIGN.md` (nuevos componentes: finance-card, debt-card, goal-card,
  amount-input, month-nav) y `README.md` (nuevas rutas y endpoints).

## Fuera de alcance (YAGNI)

Presupuestos mensuales, multi-moneda, cuentas bancarias/múltiples wallets,
importación CSV, recurrencia de movimientos, gráficos históricos multi-mes.
