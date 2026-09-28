import { useCallback, useEffect, useState, type FormEvent } from "react";
import { financeApi } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { MonthNav } from "../components/MonthNav";
import { AmountInput } from "../components/AmountInput";
import { CategoryForm } from "../components/CategoryForm";
import { formatMoney, monthKey, parseAmountToCents } from "../lib/money";
import type { Category, FinanceSummary, Transaction } from "../types";

export default function FinancePage() {
  const [month, setMonth] = useState(monthKey(new Date()));
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [type, setType] = useState<"income" | "expense">("expense");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(monthKey(new Date()) + "-01");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, tx, sum] = await Promise.all([
        financeApi.listCategories(),
        financeApi.listTransactions(month),
        financeApi.summary(month),
      ]);
      setCategories(cats.categories);
      setTransactions(tx.transactions);
      setSummary(sum);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const byDay = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const list = byDay.get(t.date) ?? [];
    list.push(t);
    byDay.set(t.date, list);
  }
  const expenseMax = summary?.byCategory.length ? summary.byCategory[0].total : 0;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const cents = parseAmountToCents(amount);
    if (!cents) {
      setError("Importe inválido (ej. 12.50)");
      return;
    }
    try {
      await financeApi.createTransaction({
        type,
        amount_cents: cents,
        date,
        category_id: categoryId ? Number(categoryId) : null,
        note: note.trim() || undefined,
      });
      setAmount("");
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    }
  }

  async function onDelete(id: number) {
    if (!window.confirm("¿Eliminar este movimiento?")) return;
    await financeApi.deleteTransaction(id);
    await load();
  }

  return (
    <section>
      <h2>Finanzas</h2>
      <MonthNav month={month} onChange={setMonth} />
      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="muted">Cargando…</p>
      ) : (
        <>
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-name">Ingresos</div>
              <div className="stat-nums amount-pos">{formatMoney(summary?.income ?? 0)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-name">Gastos</div>
              <div className="stat-nums amount-neg">{formatMoney(summary?.expense ?? 0)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-name">Balance</div>
              <div className="stat-nums">{formatMoney(summary?.balance ?? 0)}</div>
            </div>
          </div>

          <form onSubmit={onSubmit} className="form card">
            <h3>Nuevo movimiento</h3>
            <fieldset>
              <legend>Tipo</legend>
              <label className="inline">
                <input type="radio" checked={type === "expense"} onChange={() => setType("expense")} /> Gasto
              </label>
              <label className="inline">
                <input type="radio" checked={type === "income"} onChange={() => setType("income")} /> Ingreso
              </label>
            </fieldset>
            <div className="row">
              <label>
                Importe
                <AmountInput id="tx-amount" value={amount} onChange={setAmount} />
              </label>
              <label>
                Fecha
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </label>
            </div>
            <div className="row">
              <label>
                Categoría
                <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">Sin categoría</option>
                  {categories
                    .filter((c) => c.type === type)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon ? `${c.icon} ` : ""}
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Nota
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" />
              </label>
            </div>
            <button type="submit" className="btn-primary">
              Añadir movimiento
            </button>
          </form>

          {summary && summary.byCategory.length > 0 && (
            <div className="card">
              <h3>Por categoría</h3>
              {summary.byCategory.map((c) => (
                <div key={c.categoryId} className="by-cat-row">
                  <div>
                    {c.icon ? `${c.icon} ` : ""}
                    {c.name} <span className="by-cat-total">{formatMoney(c.total)}</span>
                  </div>
                  <div className="bar">
                    <span style={{ width: `${expenseMax ? Math.round((c.total / expenseMax) * 100) : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <h3>Movimientos</h3>
            {transactions.length === 0 ? (
              <EmptyState title="Sin movimientos este mes" hint="Añade tu primer ingreso o gasto con el formulario." />
            ) : (
              [...byDay.entries()].map(([day, items]) => (
                <div key={day} className="mov-day">
                  <h4>{day}</h4>
                  {items.map((t) => (
                    <div key={t.id} className="mov-item">
                      <span className="mov-cat">
                        <span aria-hidden="true">{t.categoryIcon ?? "•"}</span>
                        <span>{t.categoryName ?? "Sin categoría"}</span>
                        {t.note && <span className="mov-note">{t.note}</span>}
                      </span>
                      <span className={"mov-amount " + (t.type === "income" ? "amount-pos" : "amount-neg")}>
                        {t.type === "income" ? "+" : "−"}
                        {formatMoney(t.amountCents)}
                      </span>
                      <button type="button" className="btn-link" onClick={() => onDelete(t.id)}>
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          <CategoryForm onCreated={() => void load()} />
        </>
      )}
    </section>
  );
}
