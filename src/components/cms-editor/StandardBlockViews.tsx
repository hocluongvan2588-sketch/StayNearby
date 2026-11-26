'use client';

import React from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import {
  Columns3,
  ExternalLink,
  HelpCircle,
  Images,
  Info,
  ListTree,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';

export function CalloutNodeView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const tone = String(node.attrs.tone ?? 'info');
  const title = String(node.attrs.title ?? '');
  const body = String(node.attrs.body ?? '');

  const toneBg =
    tone === 'warning'
      ? 'border-[#E6B87A] bg-[#FEF7EC]'
      : tone === 'tip'
        ? 'border-[#164E3F]/35 bg-[#E7F1EC]'
        : tone === 'highlight'
          ? 'border-[#C25E28]/35 bg-[#FAEDE5]'
          : 'border-[#E5DFD3] bg-[#FAF8F3]';

  return (
    <NodeViewWrapper
      className={`my-4 rounded-xl border p-4 transition ${toneBg} ${
        selected ? 'ring-2 ring-[#164E3F]' : ''
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#53635D]">
          <Info className="h-3.5 w-3.5 text-[#164E3F]" />
          <span>Callout Block</span>
          <select
            value={tone}
            onChange={(e) => updateAttributes({ tone: e.target.value })}
            className="rounded border border-[#E5DFD3] bg-white px-2 py-0.5 text-[11px] font-medium text-[#17221E]"
          >
            <option value="info">Info</option>
            <option value="tip">Pro Tip</option>
            <option value="warning">Important Note</option>
            <option value="highlight">Highlight</option>
          </select>
        </div>
        <button
          type="button"
          onClick={deleteNode}
          className="rounded p-1 text-[#53635D] hover:bg-white hover:text-red-600"
          title="Remove block"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <input
        type="text"
        value={title}
        onChange={(e) => updateAttributes({ title: e.target.value })}
        placeholder="Callout heading (optional)..."
        className="mb-1.5 w-full rounded border border-transparent bg-white/70 px-2.5 py-1 text-sm font-semibold text-[#17221E] focus:border-[#164E3F] focus:bg-white focus:outline-none"
      />
      <textarea
        rows={2}
        value={body}
        onChange={(e) => updateAttributes({ body: e.target.value })}
        placeholder="Write concise guidance, local etiquette, or Wi-Fi check notes..."
        className="w-full rounded border border-transparent bg-white/70 px-2.5 py-1.5 text-sm text-[#17221E] focus:border-[#164E3F] focus:bg-white focus:outline-none"
      />
    </NodeViewWrapper>
  );
}

export function FaqGroupNodeView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const title = String(node.attrs.title ?? 'Frequently Asked Questions');
  const items = Array.isArray(node.attrs.items)
    ? (node.attrs.items as Array<{ question: string; answer: string }>)
    : [];

  function updateItem(idx: number, patch: Partial<{ question: string; answer: string }>) {
    const next = items.map((item, i) => (i === idx ? { ...item, ...patch } : item));
    updateAttributes({ items: next });
  }

  function addItem() {
    updateAttributes({
      items: [...items, { question: 'New question...', answer: 'Clear answer...' }],
    });
  }

  function removeItem(idx: number) {
    updateAttributes({ items: items.filter((_, i) => i !== idx) });
  }

  return (
    <NodeViewWrapper
      className={`my-4 rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] p-4 ${
        selected ? 'ring-2 ring-[#164E3F]' : ''
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#164E3F]">
          <HelpCircle className="h-4 w-4" />
          <span>FAQ Accordion Block</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1 rounded bg-[#164E3F] px-2 py-1 text-[11px] font-semibold text-white"
          >
            <Plus className="h-3 w-3" /> Add Q&A
          </button>
          <button
            type="button"
            onClick={deleteNode}
            className="rounded p-1 text-[#53635D] hover:bg-white hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => updateAttributes({ title: e.target.value })}
        placeholder="FAQ section heading"
        className="mb-3 w-full rounded border border-[#E5DFD3] bg-white px-2.5 py-1.5 text-sm font-semibold text-[#17221E]"
      />

      <div className="space-y-2.5">
        {items.map((item, idx) => (
          <div key={idx} className="rounded-lg border border-[#E5DFD3] bg-white p-2.5 space-y-1.5">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={item.question}
                onChange={(e) => updateItem(idx, { question: e.target.value })}
                placeholder={`Question ${idx + 1}`}
                className="flex-1 rounded border border-[#E5DFD3] px-2 py-1 text-xs font-semibold text-[#17221E]"
              />
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="rounded p-1 text-[#53635D] hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <textarea
              rows={2}
              value={item.answer}
              onChange={(e) => updateItem(idx, { answer: e.target.value })}
              placeholder="Answer..."
              className="w-full rounded border border-[#E5DFD3] px-2 py-1 text-xs text-[#53635D]"
            />
          </div>
        ))}
      </div>
    </NodeViewWrapper>
  );
}

export function CtaButtonNodeView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const label = String(node.attrs.label ?? 'Browse verified stays');
  const url = String(node.attrs.url ?? '/stays');
  const variant = String(node.attrs.variant ?? 'primary');
  const align = String(node.attrs.align ?? 'left');

  return (
    <NodeViewWrapper
      className={`my-4 rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] p-3 ${
        selected ? 'ring-2 ring-[#164E3F]' : ''
      }`}
    >
      <div className="mb-2 flex items-center justify-between text-xs font-semibold text-[#53635D]">
        <span className="inline-flex items-center gap-1.5">
          <ExternalLink className="h-3.5 w-3.5 text-[#164E3F]" />
          CTA Button Block
        </span>
        <button
          type="button"
          onClick={deleteNode}
          className="rounded p-1 hover:bg-white hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        <input
          type="text"
          value={label}
          onChange={(e) => updateAttributes({ label: e.target.value })}
          placeholder="Button label"
          className="rounded border border-[#E5DFD3] bg-white px-2.5 py-1 text-xs font-medium"
        />
        <input
          type="text"
          value={url}
          onChange={(e) => updateAttributes({ url: e.target.value })}
          placeholder="/stays?destination=da-nang"
          className="rounded border border-[#E5DFD3] bg-white px-2.5 py-1 text-xs"
        />
        <select
          value={variant}
          onChange={(e) => updateAttributes({ variant: e.target.value })}
          className="rounded border border-[#E5DFD3] bg-white px-2 py-1 text-xs"
        >
          <option value="primary">Primary Jade</option>
          <option value="secondary">Terracotta Accent</option>
          <option value="outline">Outline</option>
        </select>
        <select
          value={align}
          onChange={(e) => updateAttributes({ align: e.target.value })}
          className="rounded border border-[#E5DFD3] bg-white px-2 py-1 text-xs"
        >
          <option value="left">Align Left</option>
          <option value="center">Align Center</option>
          <option value="right">Align Right</option>
        </select>
      </div>
      <div
        className={`mt-2.5 flex ${
          align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start'
        }`}
      >
        <span
          className={`inline-flex items-center rounded-lg px-4 py-2 text-xs font-semibold ${
            variant === 'secondary'
              ? 'bg-[#C25E28] text-white'
              : variant === 'outline'
                ? 'border border-[#164E3F] text-[#164E3F]'
                : 'bg-[#164E3F] text-white'
          }`}
        >
          {label || 'Button'}
        </span>
      </div>
    </NodeViewWrapper>
  );
}

export function ColumnsNodeView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const columns = Number(node.attrs.columns ?? 2);
  const items = Array.isArray(node.attrs.items)
    ? (node.attrs.items as Array<{ heading: string; body: string }>)
    : [
        { heading: 'Column 1', body: 'Details...' },
        { heading: 'Column 2', body: 'Details...' },
      ];

  function updateColCount(nextCount: number) {
    const resized =
      nextCount === 3
        ? items.length >= 3
          ? items.slice(0, 3)
          : [...items, { heading: 'Column 3', body: 'Details...' }]
        : items.slice(0, 2);
    updateAttributes({ columns: nextCount, items: resized });
  }

  function updateCol(idx: number, patch: Partial<{ heading: string; body: string }>) {
    updateAttributes({
      items: items.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    });
  }

  return (
    <NodeViewWrapper
      className={`my-4 rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] p-3.5 ${
        selected ? 'ring-2 ring-[#164E3F]' : ''
      }`}
    >
      <div className="mb-2.5 flex items-center justify-between text-xs font-semibold text-[#53635D]">
        <div className="flex items-center gap-2">
          <Columns3 className="h-3.5 w-3.5 text-[#164E3F]" />
          <span>Columns Layout</span>
          <select
            value={columns}
            onChange={(e) => updateColCount(Number(e.target.value))}
            className="rounded border border-[#E5DFD3] bg-white px-2 py-0.5 text-[11px]"
          >
            <option value={2}>2 Columns</option>
            <option value={3}>3 Columns</option>
          </select>
        </div>
        <button
          type="button"
          onClick={deleteNode}
          className="rounded p-1 hover:bg-white hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className={`grid gap-2.5 ${columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {items.map((col, idx) => (
          <div key={idx} className="rounded-lg border border-[#E5DFD3] bg-white p-2.5 space-y-1.5">
            <input
              type="text"
              value={col.heading}
              onChange={(e) => updateCol(idx, { heading: e.target.value })}
              placeholder={`Heading ${idx + 1}`}
              className="w-full rounded border border-[#E5DFD3] px-2 py-1 text-xs font-semibold"
            />
            <textarea
              rows={3}
              value={col.body}
              onChange={(e) => updateCol(idx, { body: e.target.value })}
              placeholder="Column content..."
              className="w-full rounded border border-[#E5DFD3] px-2 py-1 text-xs text-[#53635D]"
            />
          </div>
        ))}
      </div>
    </NodeViewWrapper>
  );
}

export function GalleryNodeView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const items = Array.isArray(node.attrs.items)
    ? (node.attrs.items as Array<{ url: string; alt: string; caption?: string }>)
    : [];

  function addItem() {
    updateAttributes({
      items: [...items, { url: '/images/hero-vietnam-workation.jpg', alt: '', caption: '' }],
    });
  }

  function updateItem(idx: number, patch: Partial<{ url: string; alt: string; caption: string }>) {
    updateAttributes({
      items: items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    });
  }

  function removeItem(idx: number) {
    updateAttributes({ items: items.filter((_, i) => i !== idx) });
  }

  return (
    <NodeViewWrapper
      className={`my-4 rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] p-3.5 ${
        selected ? 'ring-2 ring-[#164E3F]' : ''
      }`}
    >
      <div className="mb-2.5 flex items-center justify-between text-xs font-semibold text-[#53635D]">
        <span className="inline-flex items-center gap-1.5">
          <Images className="h-3.5 w-3.5 text-[#164E3F]" />
          Image Gallery Grid ({items.length})
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1 rounded bg-[#164E3F] px-2 py-1 text-[11px] font-semibold text-white"
          >
            <Plus className="h-3 w-3" /> Add Image URL
          </button>
          <button
            type="button"
            onClick={deleteNode}
            className="rounded p-1 hover:bg-white hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {items.map((it, idx) => (
          <div key={idx} className="rounded-lg border border-[#E5DFD3] bg-white p-2 space-y-1.5">
            {it.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={it.url}
                alt={it.alt || 'Gallery image'}
                className="h-24 w-full rounded object-cover"
              />
            )}
            <input
              type="text"
              value={it.url}
              onChange={(e) => updateItem(idx, { url: e.target.value })}
              placeholder="Image URL (/api/uploads/... or https://...)"
              className="w-full rounded border border-[#E5DFD3] px-2 py-1 text-[11px]"
            />
            <div className="flex gap-1.5">
              <input
                type="text"
                value={it.alt}
                onChange={(e) => updateItem(idx, { alt: e.target.value })}
                placeholder="Alt text (SEO)"
                className="flex-1 rounded border border-[#E5DFD3] px-2 py-1 text-[11px]"
              />
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="rounded border border-[#E5DFD3] px-2 text-[#53635D] hover:text-red-600"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
            <input
              type="text"
              value={it.caption ?? ''}
              onChange={(e) => updateItem(idx, { caption: e.target.value })}
              placeholder="Caption (optional)"
              className="w-full rounded border border-[#E5DFD3] px-2 py-1 text-[11px]"
            />
          </div>
        ))}
      </div>
    </NodeViewWrapper>
  );
}

export function TocBlockNodeView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const title = String(node.attrs.title ?? 'In this guide');
  const maxDepth = Number(node.attrs.maxDepth ?? 3);

  return (
    <NodeViewWrapper
      className={`my-4 rounded-xl border border-dashed border-[#164E3F]/40 bg-[#E7F1EC]/50 p-3.5 ${
        selected ? 'ring-2 ring-[#164E3F]' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#164E3F]">
          <ListTree className="h-4 w-4" />
          <span>Table of Contents (Auto-generated from H2–H{maxDepth} headings)</span>
        </div>
        <button
          type="button"
          onClick={deleteNode}
          className="rounded p-1 text-[#53635D] hover:bg-white hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={title}
          onChange={(e) => updateAttributes({ title: e.target.value })}
          placeholder="TOC Title"
          className="flex-1 rounded border border-[#E5DFD3] bg-white px-2.5 py-1 text-xs font-medium"
        />
        <select
          value={maxDepth}
          onChange={(e) => updateAttributes({ maxDepth: Number(e.target.value) })}
          className="rounded border border-[#E5DFD3] bg-white px-2 py-1 text-xs"
        >
          <option value={2}>H2 only</option>
          <option value={3}>H2 + H3</option>
        </select>
      </div>
    </NodeViewWrapper>
  );
}

export function RelatedArticlesNodeView({
  node,
  updateAttributes,
  deleteNode,
  selected,
}: NodeViewProps) {
  const title = String(node.attrs.title ?? 'Related Guides');
  const items = Array.isArray(node.attrs.items)
    ? (node.attrs.items as Array<{ slug: string; title: string; summary?: string }>)
    : [];

  return (
    <NodeViewWrapper
      className={`my-4 rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] p-3.5 ${
        selected ? 'ring-2 ring-[#164E3F]' : ''
      }`}
    >
      <div className="mb-2 flex items-center justify-between text-xs font-semibold text-[#53635D]">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-[#164E3F]" />
          Related Articles Block ({items.length})
        </span>
        <button
          type="button"
          onClick={deleteNode}
          className="rounded p-1 hover:bg-white hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <input
        type="text"
        value={title}
        onChange={(e) => updateAttributes({ title: e.target.value })}
        className="mb-2 w-full rounded border border-[#E5DFD3] bg-white px-2.5 py-1 text-xs font-semibold"
        placeholder="Block heading"
      />
      <div className="space-y-1.5">
        {items.map((it, idx) => (
          <div key={idx} className="flex items-center gap-2 rounded bg-white p-2 text-xs">
            <input
              type="text"
              value={it.title}
              onChange={(e) =>
                updateAttributes({
                  items: items.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)),
                })
              }
              placeholder="Article title"
              className="flex-1 rounded border border-[#E5DFD3] px-2 py-1 text-xs"
            />
            <input
              type="text"
              value={it.slug}
              onChange={(e) =>
                updateAttributes({
                  items: items.map((x, i) => (i === idx ? { ...x, slug: e.target.value } : x)),
                })
              }
              placeholder="guide-slug"
              className="w-40 rounded border border-[#E5DFD3] px-2 py-1 text-xs"
            />
            <button
              type="button"
              onClick={() =>
                updateAttributes({ items: items.filter((_, i) => i !== idx) })
              }
              className="rounded p-1 text-[#53635D] hover:text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            updateAttributes({
              items: [...items, { slug: '', title: 'New related guide', summary: '' }],
            })
          }
          className="inline-flex items-center gap-1 rounded border border-[#E5DFD3] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#164E3F]"
        >
          <Plus className="h-3 w-3" /> Add related item
        </button>
      </div>
    </NodeViewWrapper>
  );
}
