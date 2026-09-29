import { useState, type FormEvent } from "react";
import { financeApi } from "../api/client";

interface Props {
  onCreated: () => void;
}

export function CategoryForm({ onCreated }: Props) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("");
  const [type, setType] = useState<"income" | "expense">("expense");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await financeApi.createCategory({ name, icon: icon || undefined, type });
      setName("");
      setIcon("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la categoría");
    }
  }

  return (
    <form onSubmit={onSubmit} className="form card">
      <h3>Nueva categoría</h3>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <label>
          Nombre
          <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ej. Mascotas" />
        </label>
        <label>
          Icono
          <input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} placeholder="🐕" />
        </label>
        <label>
          Tipo
          <select value={type} onChange={(e) => setType(e.target.value as "income" | "expense")}>
            <option value="expense">Gasto</option>
            <option value="income">Ingreso</option>
          </select>
        </label>
      </div>
      <button type="submit" className="btn-ghost">
        Crear categoría
      </button>
    </form>
  );
}
