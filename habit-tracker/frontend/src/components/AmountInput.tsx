interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
}

export function AmountInput({ id, value, onChange }: Props) {
  return (
    <span className="amount-input">
      <span aria-hidden="true">$</span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="0.00"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </span>
  );
}
