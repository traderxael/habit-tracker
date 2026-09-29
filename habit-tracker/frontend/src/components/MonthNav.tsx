import { addMonths, monthLabelES } from "../lib/money";

interface Props {
  month: string;
  onChange: (month: string) => void;
}

export function MonthNav({ month, onChange }: Props) {
  return (
    <div className="month-nav">
      <button type="button" className="btn-ghost" aria-label="Mes anterior" onClick={() => onChange(addMonths(month, -1))}>
        ‹
      </button>
      <strong>{monthLabelES(month)}</strong>
      <button type="button" className="btn-ghost" aria-label="Mes siguiente" onClick={() => onChange(addMonths(month, 1))}>
        ›
      </button>
    </div>
  );
}
