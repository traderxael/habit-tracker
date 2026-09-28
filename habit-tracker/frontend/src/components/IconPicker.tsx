import { HABIT_ICONS } from "../lib/icons";

type Props = {
  value: string;
  onChange: (icon: string) => void;
};

export function IconPicker({ value, onChange }: Props) {
  return (
    <div className="icon-picker">
      <button
        type="button"
        className={"icon-opt" + (value === "" ? " on" : "")}
        onClick={() => onChange("")}
        aria-label="Sin icono"
        aria-pressed={value === ""}
        title="Sin icono"
      >
        <span className="icon-none" aria-hidden="true">
          ∅
        </span>
      </button>
      {HABIT_ICONS.map((ic) => (
        <button
          type="button"
          key={ic}
          className={"icon-opt" + (value === ic ? " on" : "")}
          onClick={() => onChange(value === ic ? "" : ic)}
          aria-label={`Icono ${ic}`}
          aria-pressed={value === ic}
          title={ic}
        >
          {ic}
        </button>
      ))}
    </div>
  );
}
