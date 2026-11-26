'use client';

import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { CmsCategoryItem, CmsTagItem } from '@/modules/cms-vietnomad/types';
import { CmsSubNav } from './CmsSubNav';

export function TaxonomiesClient({
  initialCategories,
  initialTags,
  canDelete,
}: {
  initialCategories: CmsCategoryItem[];
  initialTags: CmsTagItem[];
  canDelete: boolean;
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [tags, setTags] = useState(initialTags);
  const [catSlug, setCatSlug] = useState('');
  const [catNameEn, setCatNameEn] = useState('');
  const [catNameVi, setCatNameVi] = useState('');
  const [tagSlug, setTagSlug] = useState('');
  const [tagNameEn, setTagNameEn] = useState('');
  const [tagNameVi, setTagNameVi] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch('/api/admin/cms/taxonomies');
    if (res.ok) {
      const data = (await res.json()) as {
        categories: CmsCategoryItem[];
        tags: CmsTagItem[];
      };
      setCategories(data.categories);
      setTags(data.tags);
    }
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/cms/taxonomies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'category',
        slug: catSlug || catNameEn,
        nameEn: catNameEn,
        nameVi: catNameVi || catNameEn,
      }),
    });
    if (res.ok) {
      setCatSlug('');
      setCatNameEn('');
      setCatNameVi('');
      await refresh();
      setMsg('Category saved.');
    }
  }

  async function addTag(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/cms/taxonomies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'tag',
        slug: tagSlug || tagNameEn,
        nameEn: tagNameEn,
        nameVi: tagNameVi || tagNameEn,
      }),
    });
    if (res.ok) {
      setTagSlug('');
      setTagNameEn('');
      setTagNameVi('');
      await refresh();
      setMsg('Tag saved.');
    }
  }

  async function remove(kind: 'category' | 'tag', id: string) {
    const res = await fetch(`/api/admin/cms/taxonomies?kind=${kind}&id=${id}`, {
      method: 'DELETE',
    });
    if (res.ok) await refresh();
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="font-serif-display text-2xl font-semibold text-[#17221E]">
          Categories &amp; Topic Tags
        </h1>
        <p className="text-sm text-[#53635D]">
          Organize editorial hubs, neighborhood guides, and remote-work topic clusters in EN and VI.
        </p>
      </div>

      <CmsSubNav />

      {msg && (
        <div className="mb-4 rounded-xl border border-[#164E3F]/25 bg-[#E7F1EC] px-4 py-2 text-xs font-semibold text-[#0F392E]">
          {msg}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Categories */}
        <section className="rounded-2xl border border-[#E5DFD3] bg-white p-5">
          <h2 className="mb-3 font-serif-display text-lg font-semibold text-[#17221E]">
            Categories ({categories.length})
          </h2>
          <form onSubmit={(e) => void addCategory(e)} className="mb-4 grid gap-2 sm:grid-cols-4">
            <input
              required
              placeholder="Name (EN)"
              value={catNameEn}
              onChange={(e) => setCatNameEn(e.target.value)}
              className="h-8 rounded-lg border border-[#E5DFD3] px-2.5 text-xs"
            />
            <input
              placeholder="Name (VI)"
              value={catNameVi}
              onChange={(e) => setCatNameVi(e.target.value)}
              className="h-8 rounded-lg border border-[#E5DFD3] px-2.5 text-xs"
            />
            <input
              placeholder="slug-optional"
              value={catSlug}
              onChange={(e) => setCatSlug(e.target.value)}
              className="h-8 rounded-lg border border-[#E5DFD3] px-2.5 font-mono text-xs"
            />
            <button
              type="submit"
              className="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-[#164E3F] text-xs font-semibold text-white"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </form>

          <div className="divide-y divide-[#E5DFD3]">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-2.5 text-xs">
                <div>
                  <div className="font-semibold text-[#17221E]">
                    {c.nameEn} <span className="text-[#53635D]">/ {c.nameVi}</span>
                  </div>
                  <div className="font-mono text-[11px] text-[#53635D]">
                    /{c.slug} · {c.articleCount} article(s)
                  </div>
                </div>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => void remove('category', c.id)}
                    className="rounded p-1.5 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Tags */}
        <section className="rounded-2xl border border-[#E5DFD3] bg-white p-5">
          <h2 className="mb-3 font-serif-display text-lg font-semibold text-[#17221E]">
            Tags ({tags.length})
          </h2>
          <form onSubmit={(e) => void addTag(e)} className="mb-4 grid gap-2 sm:grid-cols-4">
            <input
              required
              placeholder="Tag (EN)"
              value={tagNameEn}
              onChange={(e) => setTagNameEn(e.target.value)}
              className="h-8 rounded-lg border border-[#E5DFD3] px-2.5 text-xs"
            />
            <input
              placeholder="Tag (VI)"
              value={tagNameVi}
              onChange={(e) => setTagNameVi(e.target.value)}
              className="h-8 rounded-lg border border-[#E5DFD3] px-2.5 text-xs"
            />
            <input
              placeholder="slug-optional"
              value={tagSlug}
              onChange={(e) => setTagSlug(e.target.value)}
              className="h-8 rounded-lg border border-[#E5DFD3] px-2.5 font-mono text-xs"
            />
            <button
              type="submit"
              className="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-[#164E3F] text-xs font-semibold text-white"
            >
              <Plus className="h-3.5 w-3.5" /> Add
            </button>
          </form>

          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <div
                key={t.id}
                className="inline-flex items-center gap-2 rounded-full border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-1 text-xs"
              >
                <span className="font-semibold text-[#17221E]">{t.nameEn}</span>
                <span className="text-[11px] text-[#53635D]">({t.articleCount})</span>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => void remove('tag', t.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
