import type { ReactNode } from "react";

type Props = {
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
};

export function EmptyState({ title, hint, action }: Props) {
  return (
    <div className="empty-state">
      <svg
        className="empty-art"
        viewBox="0 0 120 96"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <rect x="14" y="20" width="92" height="62" rx="12" className="es-card" />
        <rect x="26" y="34" width="40" height="6" rx="3" className="es-line" />
        <rect x="26" y="48" width="56" height="6" rx="3" className="es-line" />
        <rect x="26" y="62" width="30" height="6" rx="3" className="es-line" />
        <circle cx="88" cy="60" r="18" className="es-badge" />
        <path
          d="M80 60.5l5.5 5.5L97 54"
          className="es-check"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p className="empty-title">{title}</p>
      {hint && <p className="empty-hint muted">{hint}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}
