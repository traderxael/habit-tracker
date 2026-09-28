import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../api/client";
import type { Completion, Habit } from "../types";
import { DAY_LABELS, localDateKey } from "../lib/dates";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export default function CalendarPage() {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [habits, setHabits] = useState<Habit[]>([]);
  const [selHabit, setSelHabit] = useState<number | "all">("all");
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  const from = `${y}-${pad(m + 1)}-01`;
  const to = `${y}-${pad(m + 1)}-${pad(lastDay)}`;

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [h, c] = await Promise.all([
          api.get<{ habits: Habit[] }>("/habits?includeStats=1"),
          api.get<{ completions: Completion[] }>(`/completions?from=${from}&to=${to}`),
        ]);
        if (!alive) return;
        setHabits(h.habits);
        setCompletions(c.completions);
      } catch (err) {
        if (alive) setError(err instanceof ApiError ? err.message : "Error al cargar");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [from, to]);

  const doneByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of completions) {
      if (selHabit !== "all" && c.habit_id !== selHabit) continue;
      map.set(c.date, (map.get(c.date) ?? 0) + 1);
    }
    return map;
  }, [completions, selHabit]);

  const cells = useMemo(() => {
    const firstDow = new Date(y, m, 1).getDay();
    const arr: (string | null)[] = [];
    for (let i = 0; i < firstDow; i++) arr.push(null);
    for (let d = 1; d <= lastDay; d++) arr.push(`${y}-${pad(m + 1)}-${pad(d)}`);
    return arr;
  }, [y, m, lastDay]);

  const visibleHabits = selHabit === "all" ? habits : habits.filter((h) => h.id === selHabit);
  const monthLabel = cursor.toLocaleDateString("es", { month: "long", year: "numeric" });
  const todayKey = localDateKey(0);

  function shift(n: number) {
    setCursor(new Date(y, m + n, 1));
  }

  return (
    <section>
      <div className="cal-header">
        <h2>Calendario</h2>
        <select
          value={selHabit}
          onChange={(e) => setSelHabit(e.target.value === "all" ? "all" : Number(e.target.value))}
        >
          <option value="all">Todos los hábitos</option>
          {habits.map((h) => (
            <option key={h.id} value={h.id}>
              {h.icon ? `${h.icon} ` : ""}
              {h.name}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="error">{error}</p>}

      <div className="stats-row">
        {visibleHabits.map(
          (h) =>
            h.stats && (
              <div key={h.id} className="stat-card">
                <div className="stat-name">
                  {h.icon ? `${h.icon} ` : ""}
                  {h.name}
                </div>
                <div className="stat-nums">
                  <span>🔥 {h.stats.currentStreak} actual</span>
                  <span>🏆 {h.stats.bestStreak} mejor</span>
                  <span>📊 {h.stats.last30Pct}% /30d</span>
                </div>
                <div className="bar">
                  <span style={{ width: `${h.stats.last30Pct}%` }} />
                </div>
              </div>
            ),
        )}
        {visibleHabits.length === 0 && <p className="muted">Sin hábitos.</p>}
      </div>

      <div className="cal-nav">
        <button type="button" className="btn-ghost" onClick={() => shift(-1)} aria-label="Mes anterior">
          ←
        </button>
        <strong>{monthLabel}</strong>
        <button type="button" className="btn-ghost" onClick={() => shift(1)} aria-label="Mes siguiente">
          →
        </button>
      </div>

      {loading ? (
        <p className="muted">Cargando…</p>
      ) : (
        <div className="cal-grid">
          {DAY_LABELS.map((d) => (
            <div key={d} className="cal-dow">
              {d}
            </div>
          ))}
          {cells.map((key, i) =>
            key === null ? (
              <div key={`empty-${i}`} className="cal-cell empty" />
            ) : (
              <div
                key={key}
                className={
                  "cal-cell" +
                  ((doneByDate.get(key) ?? 0) > 0 ? " done" : "") +
                  (key === todayKey ? " today" : "")
                }
              >
                <span className="cal-day">{Number(key.slice(-2))}</span>
                {(doneByDate.get(key) ?? 0) > 0 && <span className="cal-dot" title={`${doneByDate.get(key)} completado(s)`} />}
              </div>
            ),
          )}
        </div>
      )}
    </section>
  );
}
