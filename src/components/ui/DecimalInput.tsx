import { useId } from 'react';
import { sanitizeDecimalInput } from '../../lib/formatters';

interface DecimalInputProps {
  label?: string;
  hint?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  'aria-label'?: string;
}

/**
 * Campo numérico livre sem setas (steppers) e sem aceitar texto.
 * Permite digitar qualquer valor diretamente (ex.: 19,90 ou 150) no celular ou desktop.
 */
export function DecimalInput({
  label,
  hint,
  error,
  value,
  onChange,
  placeholder = '0,00',
  disabled = false,
  required = false,
  className = '',
  'aria-label': ariaLabel,
}: DecimalInputProps) {
  const id = useId();

  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={id} className="block text-sm font-medium text-stone-800">
          {label}
          {required ? <span className="ml-0.5 text-rose-600">*</span> : null}
        </label>
      ) : null}
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={ariaLabel}
        required={required}
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(sanitizeDecimalInput(e.target.value))}
        className={`w-full rounded-xl border bg-white px-3.5 py-2 text-sm text-zinc-950 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/15 disabled:bg-stone-50 disabled:text-stone-500 ${
          error ? 'border-rose-400 focus:border-rose-500' : 'border-stone-300 focus:border-zinc-950'
        } ${className}`}
      />
      {error ? (
        <p className="text-xs font-medium text-rose-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-stone-500">{hint}</p>
      ) : null}
    </div>
  );
}
