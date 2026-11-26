'use client';

import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { CmsRedirectItem } from '@/modules/cms-vietnomad/types';
import { CmsSubNav } from './CmsSubNav';

export function RedirectsClient({
  initialRedirects,
  canDelete,
}: {
  initialRedirects: CmsRedirectItem[];
  canDelete: boolean;
}) {
  const [redirects, setRedirects] = useState(initialRedirects);
  const [sourcePath, setSourcePath] = useState('');
  const [targetPath, setTargetPath] = useState('');
  const [statusCode, setStatusCode] = useState<301 | 302>(301);
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch('/api/admin/cms/redirects');
    if (res.ok) {
      const data = (await res.json()) as { redirects: CmsRedirectItem[] };
      setRedirects(data.redirects);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/cms/redirects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourcePath,
        targetPath,
        statusCode,
        isActive: true,
        note: notes,
      }),
    });
    if (res.ok) {
      setSourcePath('');
      setTargetPath('');
      setNotes('');
      await refresh();
      setMsg('Redirect rule saved.');
    }
  }

  async function toggleActive(item: CmsRedirectItem) {
    await fetch('/api/admin/cms/redirects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourcePath: item.sourcePath,
        targetPath: item.targetPath,
        statusCode: item.statusCode,
        isActive: !item.isActive,
        note: item.note,
      }),
    });
    await refresh();
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/admin/cms/redirects?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) await refresh();
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="font-serif-display text-2xl font-semibold text-[#17221E]">
          URL Redirect Manager (301 / 302)
        </h1>
        <p className="text-sm text-[#53635D]">
          Preserve SEO equity when article slugs change or sunset old editorial landing pages cleanly.
        </p>
      </div>

      <CmsSubNav />

      {msg && (
        <div className="mb-4 rounded-xl border border-[#164E3F]/25 bg-[#E7F1EC] px-4 py-2 text-xs font-semibold text-[#0F392E]">
          {msg}
        </div>
      )}

      <form
        onSubmit={(e) => void handleAdd(e)}
        className="mb-6 grid gap-2 rounded-2xl border border-[#E5DFD3] bg-white p-4 text-xs sm:grid-cols-5"
      >
        <input
          required
          placeholder="Source path (e.g. /guides/old-slug)"
          value={sourcePath}
          onChange={(e) => setSourcePath(e.target.value)}
          className="h-9 rounded-lg border border-[#E5DFD3] px-3 font-mono"
        />
        <input
          required
          placeholder="Target path (e.g. /guides/new-slug)"
          value={targetPath}
          onChange={(e) => setTargetPath(e.target.value)}
          className="h-9 rounded-lg border border-[#E5DFD3] px-3 font-mono"
        />
        <select
          value={statusCode}
          onChange={(e) => setStatusCode(Number(e.target.value) as 301 | 302)}
          className="h-9 rounded-lg border border-[#E5DFD3] bg-white px-2.5"
        >
          <option value={301}>301 Permanent</option>
          <option value={302}>302 Temporary</option>
        </select>
        <input
          placeholder="Note (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="h-9 rounded-lg border border-[#E5DFD3] px-3"
        />
        <button
          type="submit"
          className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-[#164E3F] font-semibold text-white hover:bg-[#0F392E]"
        >
          <Plus className="h-3.5 w-3.5" /> Add Redirect
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-[#E5DFD3] bg-white">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-semibold uppercase text-[#53635D]">
            <tr>
              <th className="px-4 py-3">Source Path</th>
              <th className="px-4 py-3">Target Path</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Hits</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5DFD3]">
            {redirects.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#53635D]">
                  No redirects configured yet.
                </td>
              </tr>
            ) : (
              redirects.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-mono text-[#17221E]">{r.sourcePath}</td>
                  <td className="px-4 py-3 font-mono text-[#164E3F]">{r.targetPath}</td>
                  <td className="px-4 py-3 font-bold">{r.statusCode}</td>
                  <td className="px-4 py-3">{r.hitCount}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void toggleActive(r)}
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                        r.isActive
                          ? 'bg-[#E7F1EC] text-[#164E3F]'
                          : 'bg-[#F2EDE3] text-[#53635D]'
                      }`}
                    >
                      {r.isActive ? 'ACTIVE' : 'PAUSED'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(r.id)}
                        className="rounded p-1 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
