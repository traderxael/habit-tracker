import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, financeApi } from "../api/client";
import type { Completion, FinanceSummary, Goal, Habit } from "../types";
import { localDateKey } from "../lib/dates";
import { formatMoney, monthKey } from "../lib/money";
import { DEFAULT_COLOR } from "../lib/colors";
import { EmptyState } from "../components/EmptyState";

export default function TodayPage() {
  const today = localDateKey(0);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [doneToday, setDoneToday] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [h, c] = await Promise.all([
        api.get<{ habits: Habit[] }>("/habits?includeStats=1"),
        api.get<{ completions: Completion[] }>(`/completions?from=${today}&to=${today}`),
      ]);
      setHabits(h.habits);
      setDoneToday(new Set(c.completions.map((x) => x.habit_id)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadFinance = useCallback(() => {
    const month = monthKey(new Date());
    financeApi
      .summary(month)
      .then(setSummary)
      .catch(() => undefined);
    financeApi
      .listGoals()
      .then((g) => setGoals(g.goals.filter((x) => x.savedCents < x.targetCents)))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadFinance();
  }, [loadFinance]);

  async function toggle(habit: Habit) {
    const next = new Set(doneToday);
    if (next.has(habit.id)) next.delete(habit.id);
    else next.add(habit.id);
    setDoneToday(next); // optimista
    try {
      await api.post("/completions/toggle", { habitId: habit.id, date: today });
      const refreshed = await api.get<{ habits: Habit[] }>("/habits?includeStats=1");
      setHabits(refreshed.habits);
      loadFinance();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al marcar");
      void load();
    }
  }

  if (loading) return <p className="muted">Cargando…</p>;

  const doneCount = habits.filter((h) => doneToday.has(h.id)).length;
  const pct = habits.length === 0 ? 0 : Math.round((doneCount / habits.length) * 100);

  return (
    <section>
      <h2>Hoy · {today}</h2>
      {error && <p className="error">{error}</p>}
      {habits.length === 0 ? (
        <EmptyState
          title="Aún no tienes hábitos"
          hint="Crea tu primer hábito y empieza a construir tu racha hoy mismo."
          action={
            <Link to="/habits" className="btn-primary">
              Crear mi primer hábito
            </Link>
          }
        />
      ) : (
        <>
          <div className="today-summary">
            <span>
              <strong>{doneCount}</strong> de {habits.length} completados hoy
            </span>
            <span className="muted">{pct}%</span>
            <div className="progress">
              <span style={{ width: `${pct}%` }} />
            </div>
          </div>
          {summary && (
            <div className="card today-finance">
              <h3>Este mes</h3>
              <div className="today-finance-row">
                <span>
                  Ingresos <strong className="amount-pos">{formatMoney(summary.income)}</strong>
                </span>
                <span>
                  Gastos <strong className="amount-neg">{formatMoney(summary.expense)}</strong>
                </span>
                <span>
                  Balance <strong>{formatMoney(summary.balance)}</strong>
                </span>
                <Link to="/finance" className="btn-link">
                  Ver movimientos
                </Link>
              </div>
              {goals.slice(0, 3).map((g) => {
                const pct = Math.min(100, Math.round((g.savedCents / g.targetCents) * 100));
                return (
                  <div key={g.id} className="mini-goal">
                    <span aria-hidden="true">{g.icon ?? "🎯"}</span>
                    <span>{g.name}</span>
                    <div className="progress">
                      <span style={{ width: `${pct}%` }} />
                    </div>
                    <span className="muted">{pct}%</span>
                  </div>
                );
              })}
            </div>
          )}
          <ul className="today-list">
          {habits.map((h) => {
            const done = doneToday.has(h.id);
            const color = h.color ?? DEFAULT_COLOR;
            return (
              <li key={h.id} className="today-item">
                <button
                  type="button"
                  className="check"
                  aria-pressed={done}
                  aria-label={`Marcar ${h.name}`}
                  onClick={() => void toggle(h)}
                >
                  <span
                    className={"dot" + (done ? " done" : "")}
                    style={{ "--dot": color } as CSSProperties}
                  >
                    {done ? "✓" : ""}
                  </span>
                </button>
                <span className={"today-name" + (done ? " done" : "")}>
                  {h.icon ? `${h.icon} ` : ""}
                  {h.name}
                </span>
                {h.stats && <span className="badge">🔥 {h.stats.currentStreak}</span>}
              </li>
            );
          })}
          </ul>
        </>
      )}
    </section>
  );
}
