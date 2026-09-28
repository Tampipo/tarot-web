import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import type { Side } from "@tarot/shared";

/* ---- Button --------------------------------------------------------------- */
type BtnVariant = "primary" | "default" | "ghost" | "danger";
export function Button({
  variant = "default",
  block,
  loading,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  block?: boolean;
  loading?: boolean;
}) {
  const v = variant === "default" ? "" : `btn-${variant}`;
  return (
    <button
      className={`btn ${v} ${block ? "btn-block" : ""} ${className}`.trim()}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : children}
    </button>
  );
}

/* ---- Card ------------------------------------------------------------------ */
export function Card({
  title,
  subtitle,
  children,
  className = "",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`.trim()}>
      {title && <h2 className="card-title">{title}</h2>}
      {subtitle && <p className="card-sub">{subtitle}</p>}
      {children}
    </section>
  );
}

/* ---- Field wrapper + inputs ----------------------------------------------- */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

export function Select({
  placeholder,
  options,
  className = "",
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & {
  placeholder?: string;
  options: { value: string; label: string; disabled?: boolean }[];
}) {
  return (
    <select className={`select ${className}`.trim()} {...rest}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/* ---- Segmented control for a bonus camp (none / attack / defense) ---------- */
export function SideToggle({
  value,
  onChange,
}: {
  value: Side;
  onChange: (v: Side) => void;
}) {
  const opts: { v: Side; label: string; cls: string }[] = [
    { v: "none", label: "Off", cls: "" },
    { v: "attack", label: "Attack", cls: "seg-attack" },
    { v: "defense", label: "Defense", cls: "seg-defense" },
  ];
  return (
    <div className="segmented" role="group">
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          className={`seg ${o.cls}`.trim()}
          aria-pressed={value === o.v}
          onClick={() => onChange(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---- Modal ------------------------------------------------------------------ */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="btn btn-ghost icon-btn modal-close"
          aria-label="Close"
          onClick={onClose}
        >
          ✕
        </button>
        {title && <h2 className="card-title" style={{ marginBottom: 18 }}>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

/* ---- Misc ----------------------------------------------------------------- */
export function Alert({
  kind,
  children,
}: {
  kind: "success" | "danger";
  children: ReactNode;
}) {
  return <div className={`alert alert-${kind}`}>{children}</div>;
}

export function Spinner() {
  return (
    <div className="loading">
      <span className="spinner" />
    </div>
  );
}

export function Tile({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="tile">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
    </div>
  );
}
