import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "ai" | "danger";
  loading?: boolean;
};

export function Button({ variant = "primary", loading, className = "", children, ...props }: ButtonProps) {
  return (
    <button className={`btn btn-${variant} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading ? <LoaderCircle className="spin" size={18} /> : variant === "ai" ? <Sparkles size={17} /> : null}
      {children}
    </button>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
};

export function Field({ label, hint, error, icon, trailing, className = "", ...props }: FieldProps) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      <span className={`field-control ${error ? "has-error" : ""}`}>
        {icon}
        <input aria-invalid={Boolean(error)} {...props} />
        {trailing}
      </span>
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function Textarea({
  label,
  hint,
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      <textarea {...props} />
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Select({
  label,
  children,
  options,
  value,
  onChange,
}: {
  label: string;
  children?: ReactNode;
  options?: Array<[value: string, label: string]>;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select value={value} onChange={onChange}>
        {options?.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
        {children}
      </select>
    </label>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "ai" | "teal";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

export function AINotice() {
  return (
    <div className="ai-notice">
      <Sparkles size={16} />
      <span><strong>Contenu assisté par IA.</strong> Généré uniquement à partir de tes informations. Vérifie avant d’exporter.</span>
    </div>
  );
}

export function Progress({ value, label }: { value: number; label?: string }) {
  return (
    <div className="progress-wrap" aria-label={label || `${value} %`}>
      <div className="progress-track"><div className="progress-fill" style={{ width: `${value}%` }} /></div>
      {label && <span>{label}</span>}
    </div>
  );
}

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="stepper">
      {steps.map((step, index) => (
        <div className={`step ${index === current ? "active" : ""} ${index < current ? "done" : ""}`} key={step}>
          <span>{index + 1}</span><small>{step}</small>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{description}</p>{action}</div>;
}
