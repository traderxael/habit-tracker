import { useEffect, useState, type FormEvent } from "react";
import { api, financeApi } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { IconPicker } from "../components/IconPicker";
import { AmountInput } from "../components/AmountInput";
import { formatMoney, parseAmountToCents } from "../lib/money";
import type { Goal, GoalContribution, Habit } from "../types";

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🎯");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [contributeTo, setContributeTo] = useState<number | null>(null);
  const [contributeAmount, setContributeAmount] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editTarget, setEditTarget] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [openContribs, setOpenContribs] = useState<number | null>(null);
  const [contribs, setContribs] = useState<GoalContribution[]>([]);

  const load = async () => {
    const g = await financeApi.listGoals();
    setGoals(g.goals);
  };

  useEffect(() => {
    load()
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
    api
      .get<{ habits: Habit[] }>("/habits")
      .then((r) => setHabits(r.habits))
      .catch(() => undefined);
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const cents = parseAmountToCents(target);
    if (!cents) {
      setError("Importe inválido (ej. 10000)");
      return;
    }
    try {
      await financeApi.createGoal({ name, icon: icon || undefined, target_cents: cents, deadline: deadline || null });
      setName("");
      setTarget("");
      setDeadline("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la meta");
    }
  }

  async function onContribute(e: FormEvent, goal: Goal) {
    e.preventDefault();
    setError(null);
    const cents = parseAmountToCents(contributeAmount);
    if (!cents) {
      setError("Importe inválido");
      return;
    }
    try {
      await financeApi.contribute(goal.id, { amount_cents: cents });
      setContributeTo(null);
      setContributeAmount("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al aportar");
    }
  }

  function startEdit(g: Goal) {
    setEditingId(g.id);
    setEditName(g.name);
    setEditTarget(String(g.targetCents / 100));
    setEditDeadline(g.deadline ?? "");
    setContributeTo(null);
  }

  async function onSaveEdit(e: FormEvent, g: Goal) {
    e.preventDefault();
    setError(null);
    const cents = parseAmountToCents(editTarget);
    if (!cents) {
      setError("Importe inválido");
      return;
    }
    try {
      await financeApi.updateGoal(g.id, { name: editName, target_cents: cents, deadline: editDeadline || null });
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar la meta");
    }
  }

  async function toggleContribs(g: Goal) {
    setError(null);
    if (openContribs === g.id) {
      setOpenContribs(null);
      return;
    }
    try {
      const r = await financeApi.listContributions(g.id);
      setContribs(r.contributions);
      setOpenContribs(g.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar aportes");
    }
  }

  async function onDeleteContribution(g: Goal, c: GoalContribution) {
    if (!window.confirm(`¿Eliminar aporte de ${formatMoney(c.amountCents)}?`)) return;
    try {
      await financeApi.deleteContribution(g.id, c.id);
      const [, r] = await Promise.all([load(), financeApi.listContributions(g.id)]);
      setContribs(r.contributions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al borrar el aporte");
    }
  }

  async function onDelete(goal: Goal) {
    if (!window.confirm(`¿Eliminar la meta "${goal.name}"?`)) return;
    await financeApi.deleteGoal(goal.id);
    await load();
  }

  if (loading) return <p className="muted">Cargando…</p>;

  return (
    <section>
      <h2>Metas de ahorro</h2>
      {error && <p className="error">{error}</p>}

      <form onSubmit={onCreate} className="form card">
        <h3>Nueva meta</h3>
        <label>
          Nombre
          <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ej. Fondo de emergencia" />
        </label>
        <div className="field-block">
          <span className="field-label">Icono</span>
          <IconPicker value={icon} onChange={setIcon} />
        </div>
        <div className="row">
          <label>
            Objetivo
            <AmountInput id="goal-target" value={target} onChange={setTarget} />
          </label>
          <label>
            Fecha límite (opcional)
            <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </label>
        </div>
        <button type="submit" className="btn-primary">
          Crear meta
        </button>
      </form>

      {goals.length === 0 ? (
        <EmptyState
          title="Sin metas todavía"
          hint="Crea una meta de ahorro y vincúlala a un hábito para aportar en automático al completarlo."
        />
      ) : (
        <ul className="habit-list">
          {goals.map((g) => {
            const pct = Math.min(100, Math.round((g.savedCents / g.targetCents) * 100));
            const linked = habits.filter((h) => h.goalId === g.id);
            return (
              <li key={g.id} className="card goal-card">
                <div className="goal-head">
                  <strong>
                    {g.icon ? `${g.icon} ` : ""}
                    {g.name}
                  </strong>
                  {pct >= 100 && <span className="badge">¡Lograda!</span>}
                  {linked.length > 0 && (
                    <span className="badge" title={linked.map((h) => h.name).join(", ")}>
                      🔗 {linked.length} hábito{linked.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="progress">
                  <span style={{ width: `${pct}%` }} />
                </div>
                <div className="goal-meta">
                  <span>
                    {formatMoney(g.savedCents)} / {formatMoney(g.targetCents)}
                  </span>
                  <span>{pct}%</span>
                  {g.deadline && <span>Límite: {g.deadline}</span>}
                </div>
                <div className="goal-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setContributeTo(contributeTo === g.id ? null : g.id);
                      setContributeAmount("");
                    }}
                  >
                    Aportar
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => startEdit(g)}>
                    Editar
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => toggleContribs(g)}>
                    Aportes
                  </button>
                  <button type="button" className="btn-link" onClick={() => onDelete(g)}>
                    Eliminar
                  </button>
                </div>
                {editingId === g.id && (
                  <form onSubmit={(e) => onSaveEdit(e, g)} className="row">
                    <label>
                      Nombre
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} required />
                    </label>
                    <label>
                      Objetivo
                      <AmountInput id={`edit-target-${g.id}`} value={editTarget} onChange={setEditTarget} />
                    </label>
                    <label>
                      Fecha límite
                      <input type="date" value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} />
                    </label>
                    <button type="submit" className="btn-primary">
                      Guardar
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setEditingId(null)}>
                      Cancelar
                    </button>
                  </form>
                )}
                {openContribs === g.id && (
                  <ul className="goal-card">
                    {contribs.length === 0 && <li className="muted">Sin aportes registrados.</li>}
                    {contribs.map((c) => (
                      <li key={c.id} className="mov-item">
                        <span className="mov-cat">
                          {c.date}
                          <span className="mov-note">{c.habitId ? "automático" : "manual"}</span>
                        </span>
                        <span className="mov-amount">{formatMoney(c.amountCents)}</span>
                        <button type="button" className="btn-link" onClick={() => onDeleteContribution(g, c)}>
                          Borrar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {contributeTo === g.id && (
                  <form onSubmit={(e) => onContribute(e, g)} className="row">
                    <label>
                      Importe
                      <AmountInput id={`contrib-${g.id}`} value={contributeAmount} onChange={setContributeAmount} />
                    </label>
                    <button type="submit" className="btn-primary">
                      Aportar
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
