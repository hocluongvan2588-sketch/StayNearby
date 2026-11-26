'use client';

import React, { useState } from 'react';
import { Check, Copy, Image as ImageIcon, Loader2, Search, Trash2, Upload } from 'lucide-react';
import type { CmsMediaItem } from '@/modules/cms-vietnomad/types';
import { CmsSubNav } from './CmsSubNav';

export function MediaManagerClient({
  initialItems,
  canDelete,
}: {
  initialItems: CmsMediaItem[];
  canDelete: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [search, setSearch] = useState('');
  const [folder, setFolder] = useState('all');
  const [selected, setSelected] = useState<CmsMediaItem | null>(initialItems[0] ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadFolder, setUploadFolder] = useState('editorial');
  const [altEn, setAltEn] = useState(selected?.altEn ?? '');
  const [altVi, setAltVi] = useState(selected?.altVi ?? '');
  const [captionEn, setCaptionEn] = useState(selected?.captionEn ?? '');
  const [credit, setCredit] = useState(selected?.credit ?? '');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function selectItem(item: CmsMediaItem) {
    setSelected(item);
    setAltEn(item.altEn);
    setAltVi(item.altVi);
    setCaptionEn(item.captionEn);
    setCredit(item.credit);
  }

  async function refresh() {
    const res = await fetch('/api/admin/cms/media');
    if (res.ok) {
      const data = (await res.json()) as { media: CmsMediaItem[] };
      setItems(data.media ?? []);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setMessage(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('folder', uploadFolder);
        await fetch('/api/admin/cms/media', { method: 'POST', body: fd });
      }
      await refresh();
      setMessage(`Uploaded ${files.length} image(s).`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function saveMetadata() {
    if (!selected) return;
    const res = await fetch('/api/admin/cms/media', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selected.id,
        altEn,
        altVi,
        captionEn,
        credit,
      }),
    });
    if (res.ok) {
      await refresh();
      setMessage('Saved image alt text & metadata.');
    }
  }

  async function handleDelete(item: CmsMediaItem) {
    if (!window.confirm(`Delete "${item.filename}"?`)) return;
    const res = await fetch(`/api/admin/cms/media?id=${encodeURIComponent(item.id)}`, {
      method: 'DELETE',
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setMessage(data.error ?? 'Could not delete media.');
      return;
    }
    setSelected(null);
    await refresh();
    setMessage('Media removed.');
  }

  const filtered = items.filter((item) => {
    if (folder !== 'all' && item.folder !== folder) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!`${item.filename} ${item.altEn} ${item.credit}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const folders = Array.from(new Set(['editorial', 'destinations', 'stays', ...items.map((i) => i.folder)]));

  return (
    <div>
      <div className="mb-4">
        <h1 className="font-serif-display text-2xl font-semibold text-[#17221E]">
          Shared CMS Media Library
        </h1>
        <p className="text-sm text-[#53635D]">
          Upload JPEG, PNG, WebP, or AVIF assets once, manage bilingual alt text for SEO, and track article usages.
        </p>
      </div>

      <CmsSubNav />

      {message && (
        <div className="mb-4 rounded-xl border border-[#164E3F]/25 bg-[#E7F1EC] px-4 py-2 text-xs font-semibold text-[#0F392E]">
          {message}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E5DFD3] bg-white p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#53635D]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search filename or alt text..."
              className="h-8 w-56 rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] pl-8 pr-2 text-xs"
            />
          </div>
          <select
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            className="h-8 rounded-lg border border-[#E5DFD3] bg-white px-2.5 text-xs"
          >
            <option value="all">All Folders</option>
            {folders.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={uploadFolder}
            onChange={(e) => setUploadFolder(e.target.value)}
            className="h-8 rounded-lg border border-[#E5DFD3] bg-white px-2 text-xs"
          >
            <option value="editorial">Folder: editorial</option>
            <option value="destinations">Folder: destinations</option>
            <option value="stays">Folder: stays</option>
          </select>
          <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-[#164E3F] px-3.5 text-xs font-semibold text-white hover:bg-[#0F392E]">
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            <span>Upload Images</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              multiple
              onChange={(e) => void handleUpload(e)}
              className="hidden"
            />
          </label>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:col-span-2">
          {filtered.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-[#E5DFD3] bg-white p-12 text-center text-sm text-[#53635D]">
              No media assets found in this folder.
            </div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectItem(item)}
                className={`overflow-hidden rounded-xl border bg-white text-left transition ${
                  selected?.id === item.id
                    ? 'border-[#164E3F] ring-2 ring-[#164E3F]/20'
                    : 'border-[#E5DFD3] hover:border-[#164E3F]'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt={item.altEn || item.filename}
                  className="h-32 w-full object-cover"
                />
                <div className="p-2.5 text-xs">
                  <div className="truncate font-semibold text-[#17221E]">{item.filename}</div>
                  <div className="mt-0.5 flex items-center justify-between text-[11px] text-[#53635D]">
                    <span>{item.folder}</span>
                    <span>Used in {item.usageCount}</span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Metadata Inspector */}
        <div className="rounded-2xl border border-[#E5DFD3] bg-white p-4 text-xs">
          {selected ? (
            <div className="space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selected.url}
                alt={selected.altEn || selected.filename}
                className="h-44 w-full rounded-xl border border-[#E5DFD3] object-cover"
              />
              <div className="font-semibold text-[#17221E]">{selected.filename}</div>
              <div className="text-[11px] text-[#53635D]">
                {selected.width ?? '?'}×{selected.height ?? '?'}px ·{' '}
                {Math.round(selected.sizeBytes / 1024)} KB · Used in{' '}
                <strong>{selected.usageCount}</strong> article(s)
              </div>

              <div className="flex items-center gap-1.5">
                <input
                  readOnly
                  value={selected.url}
                  className="h-8 flex-1 rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-2 font-mono text-[10px]"
                />
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(selected.url);
                    setCopiedId(selected.id);
                    setTimeout(() => setCopiedId(null), 1500);
                  }}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E5DFD3] px-2.5 font-semibold"
                >
                  {copiedId === selected.id ? (
                    <Check className="h-3.5 w-3.5 text-[#164E3F]" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>

              <div>
                <label className="mb-1 block font-semibold">Alt Text (EN)</label>
                <input
                  type="text"
                  value={altEn}
                  onChange={(e) => setAltEn(e.target.value)}
                  className="h-8 w-full rounded-lg border border-[#E5DFD3] px-2.5"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold">Alt Text (VI)</label>
                <input
                  type="text"
                  value={altVi}
                  onChange={(e) => setAltVi(e.target.value)}
                  className="h-8 w-full rounded-lg border border-[#E5DFD3] px-2.5"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold">Caption (EN)</label>
                <input
                  type="text"
                  value={captionEn}
                  onChange={(e) => setCaptionEn(e.target.value)}
                  className="h-8 w-full rounded-lg border border-[#E5DFD3] px-2.5"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold">Credit / Photographer</label>
                <input
                  type="text"
                  value={credit}
                  onChange={(e) => setCredit(e.target.value)}
                  className="h-8 w-full rounded-lg border border-[#E5DFD3] px-2.5"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => void saveMetadata()}
                  className="h-8 flex-1 rounded-lg bg-[#164E3F] font-semibold text-white hover:bg-[#0F392E]"
                >
                  Save Alt &amp; Credit
                </button>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => void handleDelete(selected)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-200 px-3 font-semibold text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center text-center text-[#53635D]">
              <ImageIcon className="mb-2 h-8 w-8 opacity-40" />
              <p>Select an image to inspect alt text, usages, and dimensions.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
