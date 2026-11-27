import type { ReactNode } from 'react';

/**
 * Shared listing form primitives — used by the Listing Editor (10 sections)
 * and the create Wizard (Phase 3) so both forms render identical field
 * markup, styling and interaction from one place.
 *
 * Styling follows the Content Design System tokens used across the guest
 * platform and host console: sand inputs (`#FAF8F3`), subtle borders
 * (`#E5DFD3`), jade focus/active (`#164E3F` / `#E7F1EC`).
 */

const INPUT_CLASS =
  'w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3.5 py-2.5 text-sm text-[#17221E] outline-none transition placeholder:text-[#8A9691] focus:border-[#164E3F] focus:bg-white disabled:opacity-60';

const LABEL_CLASS = 'mb-1.5 block text-xs font-semibold text-[#53635D]';

export interface ListingOptionLike {
  value: string;
  label: string;
}

/** Label + control wrapper with optional hint line. */
export function ListingField({
  label,
  hint,
  children,
  className = '',
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <span className={LABEL_CLASS}>{label}</span>
      {children}
      {hint ? <p className="mt-1 text-xs text-[#53635D]">{hint}</p> : null}
    </div>
  );
}

/** Labeled text/number input. */
export function ListingInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  min,
  max,
  step,
  disabled,
  className = '',
  hint,
}: {
  label: ReactNode;
  value: string | number;
  onChange: (value: string) => void;
  type?: 'text' | 'number' | 'url';
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  hint?: ReactNode;
}) {
  return (
    <ListingField label={label} hint={hint} className={className}>
      <input
        type={type}
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT_CLASS}
      />
    </ListingField>
  );
}

/** Labeled textarea. */
export function ListingTextarea({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
  className = '',
  hint,
}: {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  className?: string;
  hint?: ReactNode;
}) {
  return (
    <ListingField label={label} hint={hint} className={className}>
      <textarea
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${INPUT_CLASS} resize-y`}
      />
    </ListingField>
  );
}

/** Labeled select fed from shared option lists. */
export function ListingSelect({
  label,
  value,
  onChange,
  options,
  disabled,
  className = '',
  hint,
}: {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: readonly ListingOptionLike[];
  disabled?: boolean;
  className?: string;
  hint?: ReactNode;
}) {
  return (
    <ListingField label={label} hint={hint} className={className}>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`${INPUT_CLASS} cursor-pointer font-medium`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </ListingField>
  );
}

/** Checkbox rendered as a selectable card (jade active state). */
export function ListingCheckboxCard({
  label,
  checked,
  onChange,
  className = '',
  children,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
        checked
          ? 'border-[#164E3F]/40 bg-[#E7F1EC] text-[#164E3F]'
          : 'border-[#E5DFD3] bg-white text-[#17221E] hover:bg-[#FAF8F3]'
      } ${className}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[#164E3F]"
      />
      <span>
        {label}
        {children}
      </span>
    </label>
  );
}

/** Single-select chip group (property type, kitchen, policies, …). */
export function ListingChipGroup<T extends string>({
  value,
  onChange,
  options,
  columns = 2,
  className = '',
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: ReactNode }[];
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  const gridCols =
    columns === 3 ? 'sm:grid-cols-3' : columns === 1 ? 'sm:grid-cols-1' : 'sm:grid-cols-2';
  return (
    <div className={`grid gap-2.5 ${gridCols} ${className}`}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold transition ${
              active
                ? 'border-[#164E3F]/40 bg-[#E7F1EC] text-[#164E3F]'
                : 'border-[#E5DFD3] bg-white text-[#17221E] hover:bg-[#FAF8F3]'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Section heading inside the editor card / wizard step. */
export function ListingSectionTitle({
  children,
  description,
}: {
  children: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <h2 className="text-base font-semibold text-[#17221E]">{children}</h2>
      {description ? <p className="text-xs text-[#53635D]">{description}</p> : null}
    </div>
  );
}

/** Sand note box for optional-section guidance. */
export function ListingHint({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] p-3.5 text-sm leading-relaxed text-[#53635D]">
      {children}
    </p>
  );
}
