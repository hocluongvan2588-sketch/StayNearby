'use client';

import { useEffect, useState } from 'react';
import {
  BookmarkPlus,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { formatVndExact } from '@/lib/i18n';

export type BadgeTone = 'neutral' | 'emerald' | 'amber' | 'red' | 'terracotta' | 'blue';

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-[#FAF8F3] text-[#53635D] border-[#E5DFD3]',
  emerald: 'bg-[#E7F1EC] text-[#164E3F] border-[#CBE1D6]',
  amber: 'bg-[#FEF7E6] text-[#8E6518] border-[#F2DFB3]',
  red: 'bg-[#FDF1F0] text-[#B42318] border-[#F4C7C3]',
  terracotta: 'bg-[#FAEDE5] text-[#C25E28] border-[#F0D1C0]',
  blue: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',
};

export function StatusBadge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: BadgeTone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize leading-4 whitespace-nowrap ${TONE_CLASSES[tone]}`}
    >
      {label.replace(/_/g, ' ')}
    </span>
  );
}

export function statusToTone(status: string): BadgeTone {
  const s = status.toLowerCase();
  if (
    [
      'confirmed',
      'live',
      'active',
      'paid',
      'approved',
      'completed',
      'published',
      'resolved',
      'matched',
      'verified',
      'checked_out',
      'done',
      'action_taken',
    ].includes(s)
  ) {
    return 'emerald';
  }
  if (
    [
      'pending',
      'pending_review',
      'pending_payment',
      'pending_approval',
      'requested',
      'in_progress',
      'investigating',
      'onboarding',
      'under_review',
      'scheduled',
      'waiting_user',
      'submitted',
      'limited',
      'watch',
      'in_discussion',
      'high',
    ].includes(s)
  ) {
    return 'amber';
  }
  if (
    [
      'cancelled',
      'rejected',
      'suspended',
      'failed',
      'refunded',
      'urgent',
      'critical',
      'discrepancy',
      'restricted',
      'lost',
      'no_show',
      'blocked',
    ].includes(s)
  ) {
    return 'red';
  }
  if (['direct_at_checkin', 'vip', 'first_booking', 'interested'].includes(s)) {
    return 'terracotta';
  }
  if (['checked_in', 'in_house', 'contacted', 'todo'].includes(s)) {
    return 'blue';
  }
  return 'neutral';
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col justify-between gap-3 border-b border-[#E5DFD3] pb-4 sm:flex-row sm:items-center">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-[#17221E]">{title}</h1>
        {subtitle && <p className="mt-0.5 text-xs text-[#53635D]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function KpiMetric({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: 'emerald' | 'terracotta' | 'default';
}) {
  const valColor =
    accent === 'emerald'
      ? 'text-[#164E3F]'
      : accent === 'terracotta'
        ? 'text-[#C25E28]'
        : 'text-[#17221E]';

  return (
    <div className="rounded-lg border border-[#E5DFD3] bg-white px-4 py-3">
      <div className="text-[11px] font-medium text-[#53635D]">{label}</div>
      <div className={`mt-1 text-xl font-semibold tracking-tight tabular-nums ${valColor}`}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-[#53635D]">{hint}</div>}
    </div>
  );
}

export function SideDrawer({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#17221E]/35">
      <div className="flex h-full w-full max-w-2xl flex-col border-l border-[#E5DFD3] bg-white">
        <div className="flex items-start justify-between border-b border-[#E5DFD3] px-5 py-4">
          <div className="min-w-0 pr-4">
            <h2 className="truncate text-base font-semibold text-[#17221E]">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-xs text-[#53635D]">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[#E5DFD3] p-1.5 text-[#53635D] hover:bg-[#FAF8F3] hover:text-[#17221E]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function ModalDialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17221E]/40 p-4">
      <div className="w-full max-w-lg rounded-xl border border-[#E5DFD3] bg-white">
        <div className="flex items-center justify-between border-b border-[#E5DFD3] px-5 py-3.5">
          <h3 className="text-sm font-semibold text-[#17221E]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-[#53635D] hover:bg-[#FAF8F3] hover:text-[#17221E]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export interface SavedViewRecord {
  id: string;
  name: string;
  filtersJson: Record<string, unknown>;
}

export function SavedViewToolbar({
  moduleKey,
  currentFilters,
  onApplyFilters,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  extraControls,
}: {
  moduleKey: string;
  currentFilters: Record<string, unknown>;
  onApplyFilters: (filters: Record<string, unknown>) => void;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  searchPlaceholder?: string;
  extraControls?: React.ReactNode;
}) {
  const [views, setViews] = useState<SavedViewRecord[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/admin/views?moduleKey=${encodeURIComponent(moduleKey)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d?.views) setViews(d.views);
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, [moduleKey]);

  async function handleSaveView() {
    const name = window.prompt('Save current filter preset as:');
    if (!name?.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleKey,
          name: name.trim(),
          filtersJson: currentFilters,
        }),
      });
      if (res.ok) {
        const created = (await res.json()) as { id: string };
        setViews((prev) => [{ id: created.id, name: name.trim(), filtersJson: currentFilters }, ...prev]);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteView(id: string) {
    await fetch('/api/admin/views', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setViews((prev) => prev.filter((v) => v.id !== id));
  }

  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E5DFD3] bg-white px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        {onSearchChange && (
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-[#53635D]" />
            <input
              type="text"
              value={searchValue ?? ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder ?? 'Filter records...'}
              className="h-8 w-56 rounded-md border border-[#E5DFD3] bg-[#FAF8F3] pl-8 pr-2.5 text-xs text-[#17221E] outline-none focus:border-[#164E3F]"
            />
          </div>
        )}
        {extraControls}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {views.map((v) => (
          <div
            key={v.id}
            className="inline-flex items-center rounded-md border border-[#E5DFD3] bg-[#FAF8F3] text-[11px]"
          >
            <button
              type="button"
              onClick={() => onApplyFilters(v.filtersJson)}
              className="px-2 py-1 font-medium text-[#17221E] hover:text-[#164E3F]"
            >
              <SlidersHorizontal className="mr-1 inline h-3 w-3 text-[#53635D]" />
              {v.name}
            </button>
            <button
              type="button"
              onClick={() => handleDeleteView(v.id)}
              title="Delete view"
              className="border-l border-[#E5DFD3] px-1.5 py-1 text-[#53635D] hover:text-[#B42318]"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={saving}
          onClick={handleSaveView}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-[#E5DFD3] bg-white px-2.5 text-[11px] font-medium text-[#17221E] hover:bg-[#FAF8F3] disabled:opacity-50"
        >
          <BookmarkPlus className="h-3.5 w-3.5 text-[#53635D]" />
          Save view
        </button>
      </div>
    </div>
  );
}

export function PaginationBar({
  page,
  totalItems,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (nextPage: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems <= pageSize) return null;
  return (
    <div className="flex items-center justify-between border-t border-[#E5DFD3] bg-white px-4 py-2.5 text-xs text-[#53635D]">
      <span className="tabular-nums">
        Page {page} of {totalPages} · {totalItems} records
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex h-7 items-center gap-1 rounded border border-[#E5DFD3] px-2 hover:bg-[#FAF8F3] disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Prev
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex h-7 items-center gap-1 rounded border border-[#E5DFD3] px-2 hover:bg-[#FAF8F3] disabled:opacity-40"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function fmtVnd(amount: number): string {
  return formatVndExact(Math.round(amount));
}
