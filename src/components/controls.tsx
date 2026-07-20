// Compact form controls for the editor sidebars.

import { useId, useState, type ReactNode } from 'react';
import { useStore } from '../state/store';

export function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="section">
      <button className="section-header" onClick={() => setOpen(!open)}>
        <span className={`chevron ${open ? 'open' : ''}`}>▸</span>
        {title}
      </button>
      {open && <div className="section-body">{children}</div>}
    </div>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="row">
      <span className="row-label">{label}</span>
      <div className="row-control">{children}</div>
    </div>
  );
}

function formatValue(v: number): string {
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a < 0.01 || a >= 100000) return v.toExponential(2);
  if (a < 1) return v.toFixed(3);
  if (a < 100) return v.toFixed(2);
  return v.toFixed(0);
}

/** Slider that flags isInteracting during drags so the engine previews. */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  log = false,
  format = formatValue,
  interactive = true,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  /** slider position maps to log10(value) */
  log?: boolean;
  format?: (v: number) => string;
  interactive?: boolean;
}) {
  const setState = useStore((s) => s.set);
  const sliderValue = log ? Math.log10(Math.max(value, 1e-9)) : value;
  const sliderMin = log ? Math.log10(Math.max(min, 1e-9)) : min;
  const sliderMax = log ? Math.log10(Math.max(max, 1e-9)) : max;
  const sliderStep = step ?? (log ? 0.01 : (sliderMax - sliderMin) / 200);

  return (
    <div className="row">
      <span className="row-label">{label}</span>
      <input
        type="range"
        min={sliderMin}
        max={sliderMax}
        step={sliderStep}
        value={sliderValue}
        onPointerDown={() => interactive && setState({ isInteracting: true })}
        onPointerUp={() => interactive && setState({ isInteracting: false })}
        onChange={(e) => {
          const raw = parseFloat(e.target.value);
          onChange(log ? Math.pow(10, raw) : raw);
        }}
      />
      <span className="row-value">{format(value)}</span>
    </div>
  );
}

export function NumberField({
  value,
  onChange,
  step = 0.05,
  width = 64,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  width?: number;
}) {
  return (
    <input
      className="num"
      style={{ width }}
      type="number"
      step={step}
      value={Number.isFinite(value) ? Number(value.toFixed(4)) : 0}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        if (Number.isFinite(v)) onChange(v);
      }}
    />
  );
}

export function SelectField<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  const numeric = typeof value === 'number';
  return (
    <select
      value={String(value)}
      onChange={(e) => onChange((numeric ? Number(e.target.value) : e.target.value) as T)}
    >
      {options.map(([v, label]) => (
        <option key={String(v)} value={String(v)}>
          {label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="row">
      <label className="row-label" htmlFor={id}>
        {label}
      </label>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = 'default',
  title,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button className={`btn btn-${variant}`} onClick={onClick} title={title} disabled={disabled}>
      {children}
    </button>
  );
}
