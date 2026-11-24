import { AlertCircle } from 'lucide-react';
import { type ErrorCode, localizeError } from '@/lib/errors';

interface ErrorAlertProps {
  code?: ErrorCode;
  message?: string;
  locale?: 'en' | 'vi';
}

export function ErrorAlert({ code, message, locale = 'en' }: ErrorAlertProps) {
  const display = code ? localizeError(code, locale, message) : message;
  if (!display) return null;

  return (
    <div
      role="alert"
      className="flex items-start gap-3 p-4 rounded-[12px] border border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger-text)] text-sm"
    >
      <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="space-y-1">
        {code && <p className="font-semibold text-xs tracking-wide uppercase">{code}</p>}
        <p>{display}</p>
      </div>
    </div>
  );
}
