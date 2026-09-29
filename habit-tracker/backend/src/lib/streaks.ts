import { db } from "../db.js";

export interface Schedule {
  type?: "daily" | "weekdays";
  days?: number[]; // 0=domingo .. 6=sábado
}

export interface HabitStats {
  currentStreak: number;
  bestStreak: number;
  last30Pct: number;
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function isScheduled(schedule: Schedule, d: Date): boolean {
  if (schedule?.type === "weekdays" && Array.isArray(schedule.days) && schedule.days.length > 0) {
    return schedule.days.includes(d.getDay());
  }
  return true; // "daily" por defecto
}

export async function habitStats(habitId: number, schedule: Schedule): Promise<HabitStats> {
  const rows = (await db.prepare("SELECT date FROM completions WHERE habit_id = ?").all(habitId)) as {
    date: string;
  }[];
  const done = new Set(rows.map((r) => r.date));
  const today = startOfToday();

  // Todas las fechas se derivan de `today` por desplazamiento (addDays(today, -i)),
  // evitando acumular un Date día a día, que sufre deriva con cambios de horario (DST).

  // Racha actual: días programados consecutivos completados hasta hoy.
  // Si hoy está programado pero aún sin completar, no rompe la racha.
  let currentStreak = 0;
  for (let i = 0; i < 800; i++) {
    const d = addDays(today, -i);
    if (!isScheduled(schedule, d)) continue;
    if (done.has(toDateKey(d))) {
      currentStreak++;
    } else if (i === 0) {
      // hoy pendiente: seguir hacia atrás sin romper
      continue;
    } else {
      break;
    }
  }

  // Mejor racha de los últimos 365 días, sobre días programados.
  let bestStreak = 0;
  let run = 0;
  for (let i = 365; i >= 0; i--) {
    const d = addDays(today, -i);
    if (!isScheduled(schedule, d)) continue;
    if (done.has(toDateKey(d))) {
      run++;
      if (run > bestStreak) bestStreak = run;
    } else {
      run = 0;
    }
  }

  // Cumplimiento de los últimos 30 días (incluyendo hoy).
  let scheduled30 = 0;
  let done30 = 0;
  for (let i = 29; i >= 0; i--) {
    const d = addDays(today, -i);
    if (!isScheduled(schedule, d)) continue;
    scheduled30++;
    if (done.has(toDateKey(d))) done30++;
  }
  const last30Pct = scheduled30 === 0 ? 0 : Math.round((done30 / scheduled30) * 100);

  return { currentStreak, bestStreak, last30Pct };
}
