'use client';

import React, { useEffect, useState } from 'react';
import { Link2, Search, X } from 'lucide-react';

interface EntityHit {
  id: string;
  label: string;
  subtitle: string;
  path: string;
  status: string;
  kind: string;
}

export function InternalLinkPickerModal({
  open,
  initialHref = '',
  onClose,
  onInsert,
}: {
  open: boolean;
  initialHref?: string;
  onClose: () => void;
  onInsert: (href: string, suggestedLabel?: string) => void;
}) {
  const [tab, setTab] = useState<'all' | 'guide' | 'stay' | 'destination' | 'category'>('all');
  const [q, setQ] = useState('');
  const [draftUrl, setDraftUrl] = useState<string | null>(null);
  const [hits, setHits] = useState<EntityHit[]>([]);
  const customUrl = draftUrl ?? initialHref;

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(async () => {
      const res = await fetch(
        `/api/admin/cms/entities?type=${tab}&q=${encodeURIComponent(q.trim())}`
      );
      if (res.ok) {
        const data = (await res.json()) as { items?: EntityHit[] };
        setHits(data.items ?? []);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [open, tab, q]);

  if (!open) return null;

  const closeModal = () => {
    setDraftUrl(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-[#E5DFD3] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#E5DFD3] bg-[#FAF8F3] px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#17221E]">
            <Link2 className="h-4 w-4 text-[#164E3F]" />
            Insert Internal or External Link
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="rounded p-1 text-[#53635D] hover:bg-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-4 text-xs">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (customUrl.trim()) {
                onInsert(customUrl.trim());
                closeModal();
              }
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={customUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
              placeholder="Paste URL (/guides/..., /stays/..., or https://...)"
              className="h-8 flex-1 rounded-lg border border-[#E5DFD3] px-2.5 text-xs focus:border-[#164E3F] focus:outline-none"
            />
            <button
              type="submit"
              className="h-8 rounded-lg bg-[#164E3F] px-3.5 font-semibold text-white hover:bg-[#0F392E]"
            >
              Apply Link
            </button>
          </form>

          <div className="flex flex-wrap gap-1.5 border-t border-[#E5DFD3] pt-3">
            {(
              [
                ['all', 'All Entities'],
                ['guide', 'Articles & Guides'],
                ['stay', 'Live Stays'],
                ['destination', 'Destinations'],
                ['category', 'Categories'],
              ] as const
            ).map(([k, lbl]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  tab === k
                    ? 'bg-[#164E3F] text-white'
                    : 'bg-[#FAF8F3] text-[#53635D] hover:bg-[#E7F1EC]'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-[#53635D]" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search stays, guides, destinations, or categories..."
              className="h-8 w-full rounded-lg border border-[#E5DFD3] pl-8 pr-3 text-xs focus:border-[#164E3F] focus:outline-none"
            />
          </div>

          <div className="max-h-60 divide-y divide-[#F2EDE3] overflow-y-auto rounded-xl border border-[#E5DFD3]">
            {hits.length === 0 ? (
              <div className="p-4 text-center text-[#53635D]">No matching internal targets.</div>
            ) : (
              hits.map((h) => (
                <button
                  key={`${h.kind}-${h.id}`}
                  type="button"
                  onClick={() => {
                    onInsert(h.path, h.label);
                    onClose();
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-[#FAF8F3]"
                >
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-[#17221E]">{h.label}</div>
                    <div className="truncate text-[11px] text-[#53635D]">{h.subtitle}</div>
                  </div>
                  <span className="ml-2 shrink-0 rounded bg-[#E7F1EC] px-2 py-0.5 text-[10px] font-semibold uppercase text-[#164E3F]">
                    {h.kind}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
