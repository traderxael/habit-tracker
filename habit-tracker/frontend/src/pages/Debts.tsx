import { useEffect, useState, type FormEvent } from "react";
import { financeApi } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { AmountInput } from "../components/AmountInput";
import { formatMoney, parseAmountToCents } from "../lib/money";
import type { Debt } from "../types";

export default function DebtsPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [total, setTotal] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [payFor, setPayFor] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState("");

  const load = async () => {
    const d = await financeApi.listDebts();
    setDebts(d.debts);
  };

  useEffect(() => {
    load()
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const cents = parseAmountToCents(total);
    if (!cents) {
      setError("Importe inválido (ej. 5000)");
      return;
    }
    try {
      await financeApi.createDebt({ name, total_cents: cents, due_date: dueDate || null });
      setName("");
      setTotal("");
      setDueDate("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la deuda");
    }
  }

  async function onPay(e: FormEvent, debt: Debt) {
    e.preventDefault();
    setError(null);
    const cents = parseAmountToCents(payAmount);
    if (!cents) {
      setError("Importe inválido");
      return;
    }
    try {
      await financeApi.payDebt(debt.id, { amount_cents: cents });
      setPayFor(null);
      setPayAmount("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar el pago");
    }
  }

  async function onDelete(debt: Debt) {
    if (!window.confirm(`¿Eliminar "${debt.name}" y sus pagos?`)) return;
    await financeApi.deleteDebt(debt.id);
    await load();
  }

  if (loading) return <p className="muted">Cargando…</p>;

  return (
    <section>
      <h2>Deudas</h2>
      {error && <p className="error">{error}</p>}

      <form onSubmit={onCreate} className="form card">
        <h3>Nueva deuda</h3>
        <div className="row">
          <label>
            Nombre
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ej. Préstamo coche" />
          </label>
          <label>
            Importe total
            <AmountInput id="debt-total" value={total} onChange={setTotal} />
          </label>
          <label>
            Vencimiento (opcional)
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
        </div>
        <button type="submit" className="btn-primary">
          Añadir deuda
        </button>
      </form>

      {debts.length === 0 ? (
        <EmptyState title="Sin deudas" hint="Aquí puedes registrar préstamos o tarjetas y seguir su pago." />
      ) : (
        <ul className="habit-list">
          {debts.map((d) => {
            const pct = Math.min(100, Math.round((d.paidCents / d.totalCents) * 100));
            return (
              <li key={d.id} className="card goal-card">
                <div className="goal-head">
                  <strong>💳 {d.name}</strong>
                  <span className="muted">
                    {formatMoney(d.paidCents)} / {formatMoney(d.totalCents)}
                  </span>
                </div>
                <div className="progress">
                  <span style={{ width: `${pct}%` }} />
                </div>
                <div className="goal-meta">
                  <span>Pendiente: {formatMoney(d.remainingCents)}</span>
                  {d.dueDate && <span>Vence: {d.dueDate}</span>}
                  <span>{pct}%</span>
                </div>
                <div className="goal-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setPayFor(payFor === d.id ? null : d.id);
                      setPayAmount("");
                    }}
                  >
                    Registrar pago
                  </button>
                  <button type="button" className="btn-link" onClick={() => onDelete(d)}>
                    Eliminar
                  </button>
                </div>
                {payFor === d.id && (
                  <form onSubmit={(e) => onPay(e, d)} className="row">
                    <label>
                      Importe del pago
                      <AmountInput id={`pay-${d.id}`} value={payAmount} onChange={setPayAmount} />
                    </label>
                    <button type="submit" className="btn-primary">
                      Pagar
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
