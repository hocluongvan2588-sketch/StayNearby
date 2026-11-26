'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Edit3,
  ExternalLink,
  Eye,
  Search,
  Trash2,
} from 'lucide-react';
import type {
  CmsCategoryItem,
  CmsContentListItem,
  CmsWorkflowStatus,
} from '@/modules/cms-vietnomad/types';
import { CmsSubNav } from './CmsSubNav';

const STATUS_BADGES: Record<CmsWorkflowStatus, string> = {
  draft: 'bg-[#F2EDE3] text-[#53635D]',
  in_review: 'bg-[#FEF7EC] text-[#9A5B13]',
  approved: 'bg-[#E7F1EC] text-[#164E3F]',
  scheduled: 'bg-[#E8EEF8] text-[#1D4ED8]',
  published: 'bg-[#164E3F] text-white',
  archived: 'bg-[#EAE6DF] text-[#7A7A7A]',
};

export function ContentHubClient({
  initialItems,
  categories,
  canApprove,
  canDelete,
}: {
  initialItems: CmsContentListItem[];
  categories: CmsCategoryItem[];
  canApprove: boolean;
  canDelete: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CmsWorkflowStatus | 'low_seo'>('all');
  const [localeFilter, setLocaleFilter] = useState<'all' | 'en' | 'vi'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter === 'low_seo' && item.seoScore >= 70) return false;
      if (statusFilter !== 'all' && statusFilter !== 'low_seo' && item.status !== statusFilter)
        return false;
      if (localeFilter !== 'all' && item.locale !== localeFilter) return false;
      if (categoryFilter !== 'all' && item.categoryId !== categoryFilter) return false;
      if (q) {
        const hay = `${item.titleEn} ${item.titleVi} ${item.slug} ${item.focusKeyword}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, search, statusFilter, localeFilter, categoryFilter]);

  async function refreshList() {
    const res = await fetch('/api/admin/cms');
    if (res.ok) {
      const data = (await res.json()) as { contents: CmsContentListItem[] };
      setItems(data.contents);
    }
  }

  async function handleBulkAction(action: 'publish' | 'archive' | 'delete') {
    if (selectedIds.length === 0) return;
    if (action === 'delete' && !window.confirm(`Delete ${selectedIds.length} selected items?`))
      return;
    setBusy(true);
    try {
      for (const id of selectedIds) {
        if (action === 'delete') {
          await fetch(`/api/admin/cms/${id}`, { method: 'DELETE' });
        } else {
          await fetch(`/api/admin/cms/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kind: 'workflow',
              action: action === 'publish' ? 'publish' : 'archive',
            }),
          });
        }
      }
      setSelectedIds([]);
      await refreshList();
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSingle(id: string, title: string) {
    if (!window.confirm(`Delete "${title}" permanently?`)) return;
    const res = await fetch(`/api/admin/cms/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await refreshList();
    }
  }

  const counts = useMemo(
    () => ({
      all: items.length,
      published: items.filter((i) => i.status === 'published').length,
      draft: items.filter((i) => i.status === 'draft').length,
      in_review: items.filter((i) => i.status === 'in_review').length,
      scheduled: items.filter((i) => i.status === 'scheduled').length,
      low_seo: items.filter((i) => i.seoScore < 70).length,
    }),
    [items]
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif-display text-2xl font-semibold text-[#17221E]">
            VietNomad Enterprise CMS &amp; SEO Hub
          </h1>
          <p className="text-sm text-[#53635D]">
            Block editorial studio, live stay &amp; neighborhood embeds, Yoast-grade SEO checks, EN/VI translations, and attribution insights.
          </p>
        </div>
      </div>

      <CmsSubNav />

      {/* Status Quick Tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(
          [
            ['all', `All (${counts.all})`],
            ['published', `Published (${counts.published})`],
            ['draft', `Drafts (${counts.draft})`],
            ['in_review', `In Review (${counts.in_review})`],
            ['scheduled', `Scheduled (${counts.scheduled})`],
            ['low_seo', `Needs SEO (<70) (${counts.low_seo})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatusFilter(key)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              statusFilter === key
                ? 'bg-[#17221E] text-white'
                : 'border border-[#E5DFD3] bg-white text-[#53635D] hover:bg-[#FAF8F3]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Filters & Bulk Actions Bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E5DFD3] bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#53635D]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, slug, focus keyword..."
              className="h-8 w-64 rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] pl-8 pr-2.5 text-xs focus:border-[#164E3F] focus:bg-white focus:outline-none"
            />
          </div>

          <select
            value={localeFilter}
            onChange={(e) => setLocaleFilter(e.target.value as 'all' | 'en' | 'vi')}
            className="h-8 rounded-lg border border-[#E5DFD3] bg-white px-2 text-xs"
          >
            <option value="all">All Languages</option>
            <option value="en">English (EN)</option>
            <option value="vi">Tiếng Việt (VI)</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-8 rounded-lg border border-[#E5DFD3] bg-white px-2 text-xs"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameEn}
              </option>
            ))}
          </select>
        </div>

        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-[#17221E]">
              {selectedIds.length} selected
            </span>
            {canApprove && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleBulkAction('publish')}
                className="rounded-lg bg-[#164E3F] px-2.5 py-1 font-semibold text-white"
              >
                Publish
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleBulkAction('archive')}
              className="rounded-lg border border-[#E5DFD3] px-2.5 py-1 font-semibold text-[#53635D]"
            >
              Archive
            </button>
            {canDelete && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleBulkAction('delete')}
                className="rounded-lg border border-red-200 px-2.5 py-1 font-semibold text-red-600"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content Table */}
      <div className="overflow-x-auto rounded-xl border border-[#E5DFD3] bg-white">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-semibold uppercase tracking-wide text-[#53635D]">
            <tr>
              <th className="w-8 px-3 py-3">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selectedIds.length === filtered.length}
                  onChange={(e) =>
                    setSelectedIds(e.target.checked ? filtered.map((f) => f.id) : [])
                  }
                />
              </th>
              <th className="px-3 py-3">Article / Guide</th>
              <th className="px-3 py-3">Type &amp; Category</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3">SEO Score</th>
              <th className="px-3 py-3">Words / Read</th>
              <th className="px-3 py-3">Updated</th>
              <th className="px-3 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5DFD3]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-10 text-center text-sm text-[#53635D]">
                  No articles match your current filter.{' '}
                  <Link href="/admin/growth/content/new" className="font-semibold text-[#164E3F] underline">
                    Create your first article
                  </Link>
                  .
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                const seoColor =
                  item.seoScore >= 80
                    ? 'bg-[#E7F1EC] text-[#164E3F]'
                    : item.seoScore >= 55
                      ? 'bg-[#FEF7EC] text-[#9A5B13]'
                      : 'bg-red-50 text-red-700';

                return (
                  <tr key={item.id} className="hover:bg-[#FAF8F3]/60">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) =>
                          setSelectedIds((prev) =>
                            e.target.checked
                              ? [...prev, item.id]
                              : prev.filter((x) => x !== item.id)
                          )
                        }
                      />
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/admin/growth/content/${item.id}`}
                        className="font-semibold text-sm text-[#17221E] hover:text-[#164E3F] hover:underline"
                      >
                        {item.locale === 'vi' ? item.titleVi : item.titleEn}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[11px] text-[#53635D]">
                        <span className="rounded bg-[#FAF8F3] px-1.5 py-0.2 font-sans font-bold uppercase text-[#164E3F]">
                          {item.locale}
                        </span>
                        <span>/guides/{item.slug}</span>
                        {item.hasUnpublishedChanges && (
                          <span className="rounded bg-[#FEF7EC] px-1.5 font-sans text-[10px] font-semibold text-[#9A5B13]">
                            Draft changes
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-[#17221E]">
                        {item.categoryNameEn || 'Uncategorized'}
                      </div>
                      <div className="text-[11px] text-[#53635D]">
                        {item.contentType.replace('_', ' ')}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                          STATUS_BADGES[item.status]
                        }`}
                      >
                        {item.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 font-bold ${seoColor}`}>
                        {item.seoScore}/100
                      </span>
                      {item.focusKeyword ? (
                        <div className="mt-0.5 max-w-[140px] truncate text-[10px] text-[#53635D]">
                          KW: {item.focusKeyword}
                        </div>
                      ) : (
                        <div className="mt-0.5 text-[10px] text-[#9A5B13]">No keyword</div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-[#53635D]">
                      <div>{item.wordCount} words</div>
                      <div className="text-[11px]">{item.readingTimeMinutes} min read</div>
                    </td>
                    <td className="px-3 py-3 text-[11px] text-[#53635D]">
                      <div>{item.updatedAt.slice(0, 10)}</div>
                      <div>{item.authorName}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/admin/growth/content/${item.id}`}
                          className="inline-flex h-7 items-center gap-1 rounded-md border border-[#E5DFD3] bg-white px-2.5 font-semibold text-[#17221E] hover:border-[#164E3F]"
                        >
                          <Edit3 className="h-3 w-3" /> Edit
                        </Link>
                        <Link
                          href={
                            item.status === 'published'
                              ? `/guides/${item.slug}`
                              : `/guides/${item.slug}?preview=1`
                          }
                          target="_blank"
                          title={item.status === 'published' ? 'View Live' : 'Preview Draft'}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#E5DFD3] bg-white text-[#53635D] hover:text-[#164E3F]"
                        >
                          {item.status === 'published' ? (
                            <ExternalLink className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </Link>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => void handleDeleteSingle(item.id, item.titleEn)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#E5DFD3] bg-white text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
