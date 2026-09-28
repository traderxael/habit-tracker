# Idea de proyecto — Gestor de hábitos

**Fecha de cierre:** 29 de septiembre de 2026
**Idea elegida:** A · Gestor de hábitos (tracker personal)

## Problema que resuelve

Mucha gente quiere construir hábitos (ejercicio, lectura, agua, estudio) pero no tiene una forma simple y constante de registrarlos y ver su progreso. Las apps existentes suelen ser pesadas o de pago. Esta app ofrece registro diario rápido y feedback visual de constancia (rachas).

## Usuarios

- Persona individual que gestiona sus propios hábitos.
- Usuario no técnico que quiere algo rápido: abrir, marcar el día, ver su racha.
- Un solo usuario por cuenta; sin colaboración ni equipos en el MVP.

## Features del MVP (dentro de alcance)

1. **Registro / inicio de sesión** de usuario (email + contraseña).
2. **CRUD de hábitos:** crear, editar, eliminar, listar. Cada hábito tiene nombre, icono/color opcional y frecuencia objetivo (diario o días concretos de la semana).
3. **Marcado diario:** marcar/desmarcar un hábito como completado en una fecha dada.
4. **Vista de hoy:** lista de hábitos del día con su estado.
5. **Rachas y estadísticas básicas:** racha actual y mejor racha por hábito; porcentaje de cumplimiento de los últimos 30 días.
6. **Vista de calendario / historial:** ver qué días se completó cada hábito.
7. **Persistencia** de todos los datos en base de datos por usuario.

## Fuera de alcance (backlog post-mes)

- Recordatorios / notificaciones push o por email.
- Compartir hábitos, amigos, retos o colaboración.
- App móvil nativa (se hace web responsive).
- Importar/exportar datos, integraciones externas.
- Metas avanzadas, notas por día, adjuntos.
- Múltiples perfiles o cuentas de equipo.

## Stack propuesto (elegido por el asistente)

- **Frontend:** React + Vite + TypeScript. UI responsive con CSS propio (sin framework pesado para mantener el alcance).
- **Backend:** Node.js + Express + TypeScript, API REST.
- **Base de datos:** SQLite (simple, sin servidor, ideal para 1 mes y fácil de migrar a Postgres si hace falta).
- **Auth:** sesiones o JWT con contraseña hasheada (bcrypt).
- **Despliegue:** Qoder Sites (backend + BD) u otro hosting Node; se decide en Fase 3.

**Justificación:** stack conocido y con mucho material, una sola BD embebida reduce fricción, y el despliegue es directo. Permite terminar el MVP holgado en las semanas 2–3.

## Modelo de datos (borrador)

- `users(id, email, password_hash, created_at)`
- `habits(id, user_id, name, icon, color, schedule_json, created_at, archived)`
- `completions(id, habit_id, date)` — única por (habit_id, date)

## Criterio de éxito del mes

El flujo principal funciona de punta a punta: un usuario se registra, crea un hábito, lo marca varios días y ve su racha y su calendario. Proyecto desplegado y usable por otra persona al 27 de octubre.
