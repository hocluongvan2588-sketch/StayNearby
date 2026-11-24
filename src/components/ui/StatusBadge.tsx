import { AlertCircle, CheckCircle2, Clock, Info } from 'lucide-react';

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger';

interface StatusBadgeProps {
  label: string;
  tone?: BadgeTone;
  withIcon?: boolean;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral:
    'bg-[var(--color-surface-muted)] text-[var(--color-text)] border-[var(--color-border)]',
  success:
    'bg-[var(--color-primary-soft)] text-[var(--color-primary)] border-[#C4DCD2]',
  warning:
    'bg-[var(--color-warning-bg)] text-[var(--color-warning-text)] border-[var(--color-warning-border)]',
  danger:
    'bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] border-[var(--color-danger-border)]',
};

export function StatusBadge({
  label,
  tone = 'neutral',
  withIcon = false,
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${TONE_CLASSES[tone]}`}
    >
      {withIcon && tone === 'success' && (
        <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
      )}
      {withIcon && tone === 'warning' && (
        <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
      )}
      {withIcon && tone === 'danger' && (
        <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
      )}
      {withIcon && tone === 'neutral' && (
        <Info className="w-4 h-4 shrink-0" aria-hidden="true" />
      )}
      <span>{label}</span>
    </span>
  );
}
