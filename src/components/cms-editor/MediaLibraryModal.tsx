'use client';

import React, { useEffect, useState } from 'react';
import { Check, Image as ImageIcon, Loader2, Search, Trash2, Upload, X } from 'lucide-react';
import type { CmsMediaItem } from '@/modules/cms-vietnomad/types';

export function MediaLibraryModal({
  open,
  onClose,
  onSelect,
  title = 'Shared CMS Media Library',
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (item: CmsMediaItem) => void;
  title?: string;
}) {
  const [items, setItems] = useState<CmsMediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState('');
  const [folder, setFolder] = useState('all');
  const [selected, setSelected] = useState<CmsMediaItem | null>(null);
  const [altDraft, setAltDraft] = useState('');
  const [captionDraft, setCaptionDraft] = useState('');
  const [creditDraft, setCreditDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function loadMedia() {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      if (folder !== 'all') sp.set('folder', folder);
      if (query.trim()) sp.set('q', query.trim());
      const res = await fetch(`/api/admin/cms/media?${sp.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as { media?: CmsMediaItem[] };
        setItems(data.media ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const sp = new URLSearchParams();
    if (folder !== 'all') sp.set('folder', folder);
    if (query.trim()) sp.set('q', query.trim());

    fetch(`/api/admin/cms/media?${sp.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { media?: CmsMediaItem[] } | null) => {
        if (!cancelled && data?.media) {
          setItems(data.media);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [open, folder, query]);

  function pickItem(item: CmsMediaItem) {
    setSelected(item);
    setAltDraft(item.altEn);
    setCaptionDraft(item.captionEn);
    setCreditDraft(item.credit);
  }

  async function handleFilesUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set('folder', folder === 'all' ? 'editorial' : folder);
      for (const file of Array.from(fileList)) {
        fd.append('files', file);
      }
      const res = await fetch('/api/admin/cms/media', {
        method: 'POST',
        body: fd,
      });
      const json = (await res.json()) as { item?: CmsMediaItem; error?: string };
      if (!res.ok) {
        setError(json.error ?? 'Upload failed');
        return;
      }
      await loadMedia();
      if (json.item) pickItem(json.item);
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveMeta() {
    if (!selected) return;
    const res = await fetch('/api/admin/cms/media', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selected.id,
        altEn: altDraft,
        captionEn: captionDraft,
        credit: creditDraft,
      }),
    });
    if (res.ok) {
      const updated = { ...selected, altEn: altDraft, captionEn: captionDraft, credit: creditDraft };
      setSelected(updated);
      setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
    }
  }

  async function handleDelete(item: CmsMediaItem, force = false) {
    const res = await fetch(
      `/api/admin/cms/media?id=${encodeURIComponent(item.id)}${force ? '&force=1' : ''}`,
      { method: 'DELETE' }
    );
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      if (res.status === 409 && !force) {
        if (window.confirm(`${json.error}\n\nDelete permanently anyway?`)) {
          await handleDelete(item, true);
        }
      } else {
        setError(json.error ?? 'Could not delete media.');
      }
      return;
    }
    if (selected?.id === item.id) setSelected(null);
    await loadMedia();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#E5DFD3] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E5DFD3] bg-[#FAF8F3] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-[#164E3F]" />
            <h3 className="text-sm font-semibold text-[#17221E]">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[#53635D] hover:bg-white hover:text-[#17221E]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5DFD3] px-5 py-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-[#53635D]" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void loadMedia()}
                placeholder="Search filename or alt text..."
                className="h-8 rounded-lg border border-[#E5DFD3] pl-8 pr-3 text-xs focus:border-[#164E3F] focus:outline-none"
              />
            </div>
            <select
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              className="h-8 rounded-lg border border-[#E5DFD3] bg-white px-2.5 text-xs"
            >
              <option value="all">All folders</option>
              <option value="editorial">Editorial</option>
              <option value="destinations">Destinations</option>
              <option value="guides">Guides</option>
              <option value="banners">Banners</option>
            </select>
            <button
              type="button"
              onClick={() => void loadMedia()}
              className="h-8 rounded-lg border border-[#E5DFD3] px-3 font-medium text-[#17221E] hover:bg-[#FAF8F3]"
            >
              Search
            </button>
          </div>

          <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-[#164E3F] px-3.5 font-semibold text-white hover:bg-[#0F392E]">
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            <span>{uploading ? 'Uploading...' : 'Upload Images'}</span>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="hidden"
              onChange={(e) => void handleFilesUpload(e.target.files)}
            />
          </label>
        </div>

        {error && (
          <div className="border-b border-red-200 bg-red-50 px-5 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-12">
          <div
            className="overflow-y-auto p-4 lg:col-span-8"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void handleFilesUpload(e.dataTransfer.files);
            }}
          >
            {loading ? (
              <div className="flex h-48 items-center justify-center text-xs text-[#53635D]">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading media library...
              </div>
            ) : items.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-[#E5DFD3] bg-[#FAF8F3] text-center text-xs text-[#53635D]">
                <Upload className="mb-2 h-6 w-6 text-[#164E3F]" />
                <p className="font-medium text-[#17221E]">Drag & drop images here or click Upload</p>
                <p className="mt-1">Supports JPEG, PNG, WebP, AVIF up to 10 MB.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {items.map((item) => {
                  const isSel = selected?.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => pickItem(item)}
                      className={`group relative overflow-hidden rounded-xl border text-left transition ${
                        isSel
                          ? 'border-[#164E3F] ring-2 ring-[#164E3F]'
                          : 'border-[#E5DFD3] hover:border-[#164E3F]/60'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.url}
                        alt={item.altEn || item.filename}
                        className="h-28 w-full object-cover"
                      />
                      {isSel && (
                        <span className="absolute right-1.5 top-1.5 rounded-full bg-[#164E3F] p-1 text-white">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                      <div className="p-1.5">
                        <div className="truncate text-[11px] font-medium text-[#17221E]">
                          {item.filename}
                        </div>
                        <div className="text-[10px] text-[#53635D]">
                          {item.width && item.height ? `${item.width}×${item.height} · ` : ''}
                          {item.usageCount > 0 ? `Used (${item.usageCount})` : 'Unused'}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-[#E5DFD3] bg-[#FAF8F3] p-4 lg:col-span-4 lg:border-l lg:border-t-0 overflow-y-auto">
            {!selected ? (
              <div className="flex h-full items-center justify-center text-center text-xs text-[#53635D]">
                Select an image to edit alt text, caption, credit, or insert into your article.
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selected.url}
                  alt={selected.altEn || selected.filename}
                  className="h-36 w-full rounded-xl border border-[#E5DFD3] object-cover"
                />
                <div className="text-[11px] text-[#53635D]">
                  <div className="font-semibold text-[#17221E] truncate">{selected.filename}</div>
                  <div>
                    {selected.mimeType} · {Math.round(selected.sizeBytes / 1024)} KB
                    {selected.width ? ` · ${selected.width}×${selected.height}px` : ''}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[#17221E]">
                    Alt Text (SEO & Accessibility)
                  </label>
                  <input
                    type="text"
                    value={altDraft}
                    onChange={(e) => setAltDraft(e.target.value)}
                    placeholder="Describe the scene clearly..."
                    className="h-8 w-full rounded-lg border border-[#E5DFD3] bg-white px-2.5"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[#17221E]">Caption</label>
                  <input
                    type="text"
                    value={captionDraft}
                    onChange={(e) => setCaptionDraft(e.target.value)}
                    placeholder="Optional photo caption"
                    className="h-8 w-full rounded-lg border border-[#E5DFD3] bg-white px-2.5"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-[#17221E]">Photo Credit</label>
                  <input
                    type="text"
                    value={creditDraft}
                    onChange={(e) => setCreditDraft(e.target.value)}
                    placeholder="e.g. VietNomad Editorial"
                    className="h-8 w-full rounded-lg border border-[#E5DFD3] bg-white px-2.5"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void handleSaveMeta()}
                    className="h-8 flex-1 rounded-lg border border-[#E5DFD3] bg-white font-semibold text-[#17221E] hover:bg-[#F2EDE3]"
                  >
                    Save Metadata
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(selected)}
                    className="inline-flex h-8 items-center justify-center rounded-lg border border-red-200 bg-white px-2.5 text-red-600 hover:bg-red-50"
                    title="Delete asset"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onSelect({
                      ...selected,
                      altEn: altDraft,
                      captionEn: captionDraft,
                      credit: creditDraft,
                    });
                    onClose();
                  }}
                  className="h-9 w-full rounded-xl bg-[#164E3F] font-semibold text-white hover:bg-[#0F392E]"
                >
                  Use Selected Image
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
