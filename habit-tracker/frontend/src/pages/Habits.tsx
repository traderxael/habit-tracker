import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError, financeApi } from "../api/client";
import type { Goal, Habit, Schedule } from "../types";
import { DAY_LABELS } from "../lib/dates";
import { DEFAULT_COLOR } from "../lib/colors";
import { parseAmountToCents } from "../lib/money";
import { EmptyState } from "../components/EmptyState";
import { IconPicker } from "../components/IconPicker";
import { AmountInput } from "../components/AmountInput";

const DEFAULT_DAYS = [1, 2, 3, 4, 5];

export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [freq, setFreq] = useState<"daily" | "weekdays">("daily");
  const [days, setDays] = useState<number[]>(DEFAULT_DAYS);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalId, setGoalId] = useState("");
  const [goalAmount, setGoalAmount] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<{ habits: Habit[] }>("/habits");
      setHabits(res.habits);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    financeApi
      .listGoals()
      .then((g) => setGoals(g.goals))
      .catch(() => undefined);
  }, []);

  function resetForm() {
    setEditingId(null);
    setName("");
    setIcon("");
    setColor(DEFAULT_COLOR);
    setFreq("daily");
    setDays(DEFAULT_DAYS);
    setGoalId("");
    setGoalAmount("");
  }

  function startEdit(h: Habit) {
    setEditingId(h.id);
    setName(h.name);
    setIcon(h.icon ?? "");
    setColor(h.color ?? DEFAULT_COLOR);
    const s = h.schedule ?? { type: "daily" };
    setFreq(s.type === "weekdays" ? "weekdays" : "daily");
    setDays(Array.isArray(s.days) && s.days.length ? s.days : DEFAULT_DAYS);
    setGoalId(h.goalId ? String(h.goalId) : "");
    setGoalAmount(h.goalAmountCents ? String(h.goalAmountCents / 100) : "");
  }

  function buildSchedule(): Schedule {
    return freq === "weekdays"
      ? { type: "weekdays", days: [...days].sort((a, b) => a - b) }
      : { type: "daily" };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (freq === "weekdays" && days.length === 0) {
      setError("Selecciona al menos un día para la frecuencia semanal.");
      return;
    }
    let goalCents: number | null = null;
    if (goalId) {
      if (!goalAmount.trim()) {
        setError("Introduce el importe del aporte para la meta vinculada.");
        return;
      }
      const cents = parseAmountToCents(goalAmount);
      if (!cents) {
        setError("Importe del aporte inválido (ej. 50).");
        return;
      }
      goalCents = cents;
    }
    const body = {
      name,
      icon: icon || null,
      color,
      schedule: buildSchedule(),
      goal_id: goalId ? Number(goalId) : null,
      goal_amount_cents: goalCents,
    };
    try {
      if (editingId) await api.put(`/habits/${editingId}`, body);
      else await api.post("/habits", body);
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al guardar");
    }
  }

  async function onDelete(h: Habit) {
    if (!window.confirm(`¿Eliminar "${h.name}"? Se borrará también su historial.`)) return;
    try {
      await api.del(`/habits/${h.id}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al eliminar");
    }
  }

  function toggleDay(d: number) {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  if (loading) return <p className="muted">Cargando…</p>;

  return (
    <section>
      <h2>Hábitos</h2>
      {error && <p className="error">{error}</p>}

      <form onSubmit={onSubmit} className="form card">
        <h3>{editingId ? "Editar hábito" : "Nuevo hábito"}</h3>
        <label>
          Nombre
          <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ej. Leer 20 min" />
        </label>
        <div className="row">
          <label>
            Color
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </label>
        </div>
        <div className="field-block">
          <span className="field-label">Icono</span>
          <IconPicker value={icon} onChange={setIcon} />
        </div>
        <fieldset>
          <legend>Frecuencia</legend>
          <label className="inline">
            <input type="radio" checked={freq === "daily"} onChange={() => setFreq("daily")} /> Diario
          </label>
          <label className="inline">
            <input type="radio" checked={freq === "weekdays"} onChange={() => setFreq("weekdays")} /> Días concretos
          </label>
          {freq === "weekdays" && (
            <div className="days">
              {DAY_LABELS.map((lbl, i) => (
                <button
                  type="button"
                  key={i}
                  className={"day " + (days.includes(i) ? "on" : "")}
                  onClick={() => toggleDay(i)}
                >
                  {lbl}
                </button>
              ))}
            </div>
          )}
        </fieldset>
        <label>
          Vincular a meta (opcional)
          <select value={goalId} onChange={(e) => setGoalId(e.target.value)}>
            <option value="">Sin meta</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.icon ? `${g.icon} ` : ""}
                {g.name}
              </option>
            ))}
          </select>
        </label>
        {goalId && (
          <label>
            Aporte al completarlo
            <AmountInput id="habit-goal-amount" value={goalAmount} onChange={setGoalAmount} />
          </label>
        )}
        <div className="row">
          <button type="submit" className="btn-primary">
            {editingId ? "Guardar cambios" : "Crear hábito"}
          </button>
          {editingId && (
            <button type="button" className="btn-ghost" onClick={resetForm}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      <ul className="habit-list">
        {habits.map((h) => (
          <li key={h.id} className="habit-item">
            <span className="swatch" style={{ background: h.color ?? DEFAULT_COLOR }}>
              {h.icon ?? ""}
            </span>
            <span className="habit-name">{h.name}</span>
            <span className="muted small">
              {h.schedule?.type === "weekdays"
                ? (h.schedule.days ?? []).map((d) => DAY_LABELS[d]).join(" ")
                : "Diario"}
            </span>
            <span className="spacer" />
            <button type="button" className="btn-ghost" onClick={() => startEdit(h)}>
              Editar
            </button>
            <button type="button" className="btn-danger" onClick={() => void onDelete(h)}>
              Eliminar
            </button>
          </li>
        ))}
        {habits.length === 0 && (
          <li>
            <EmptyState
              title="Sin hábitos todavía"
              hint="Usa el formulario de arriba para añadir tu primer hábito."
            />
          </li>
        )}
      </ul>
    </section>
  );
}
