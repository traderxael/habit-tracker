import { useEffect, useState, type FormEvent } from "react";
import { financeApi } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { IconPicker } from "../components/IconPicker";
import { AmountInput } from "../components/AmountInput";
import { formatMoney, parseAmountToCents } from "../lib/money";
import type { Goal } from "../types";

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🎯");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [contributeTo, setContributeTo] = useState<number | null>(null);
  const [contributeAmount, setContributeAmount] = useState("");

  const load = async () => {
    const g = await financeApi.listGoals();
    setGoals(g.goals);
  };

  useEffect(() => {
    load()
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
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
            return (
              <li key={g.id} className="card goal-card">
                <div className="goal-head">
                  <strong>
                    {g.icon ? `${g.icon} ` : ""}
                    {g.name}
                  </strong>
                  {pct >= 100 && <span className="badge">¡Lograda!</span>}
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
                  <button type="button" className="btn-link" onClick={() => onDelete(g)}>
                    Eliminar
                  </button>
                </div>
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
