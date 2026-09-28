import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api/client";
import type { Habit, Schedule } from "../types";
import { DAY_LABELS } from "../lib/dates";
import { DEFAULT_COLOR } from "../lib/colors";
import { EmptyState } from "../components/EmptyState";
import { IconPicker } from "../components/IconPicker";

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

  function resetForm() {
    setEditingId(null);
    setName("");
    setIcon("");
    setColor(DEFAULT_COLOR);
    setFreq("daily");
    setDays(DEFAULT_DAYS);
  }

  function startEdit(h: Habit) {
    setEditingId(h.id);
    setName(h.name);
    setIcon(h.icon ?? "");
    setColor(h.color ?? DEFAULT_COLOR);
    const s = h.schedule ?? { type: "daily" };
    setFreq(s.type === "weekdays" ? "weekdays" : "daily");
    setDays(Array.isArray(s.days) && s.days.length ? s.days : DEFAULT_DAYS);
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
    const body = { name, icon: icon || null, color, schedule: buildSchedule() };
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
