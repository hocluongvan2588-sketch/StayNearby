'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Globe,
  Monitor,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import type { SeoAnalysisReport } from '@/lib/cms-core/seo-analyzer';
import type { CmsGscStatus, CmsSchemaType } from '@/modules/cms-vietnomad/types';

export function SeoPanel({
  title,
  slug,
  excerpt,
  seoTitle,
  seoDescription,
  focusKeyword,
  secondaryKeywords,
  canonicalUrl,
  ogTitle,
  ogDescription,
  ogImageUrl,
  robotsIndex,
  robotsFollow,
  schemaType,
  breadcrumbTitle,
  gscStatus,
  gscLastCheckedAt,
  gscNote,
  seoReport,
  duplicateKeywords,
  onChange,
  onPickOgImage,
  onRequestAiSeo,
}: {
  title: string;
  slug: string;
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
  secondaryKeywords: string[];
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string;
  robotsIndex: boolean;
  robotsFollow: boolean;
  schemaType: CmsSchemaType;
  breadcrumbTitle: string;
  gscStatus: CmsGscStatus;
  gscLastCheckedAt: string | null;
  gscNote: string;
  seoReport: SeoAnalysisReport;
  duplicateKeywords: Array<{ id: string; slug: string; title: string }>;
  onChange: (patch: Record<string, unknown>) => void;
  onPickOgImage: () => void;
  onRequestAiSeo: () => void;
}) {
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [secInput, setSecInput] = useState('');

  const displayTitle = (seoTitle || title || 'Article Title').slice(0, 62);
  const displayDesc = (
    seoDescription ||
    excerpt ||
    'Practical guide to longer stays, neighborhood life, and verified local insights across Vietnam.'
  ).slice(0, 160);
  const displayUrl = `vietnomad.stays/guides/${slug || 'your-slug'}`;

  const scoreTone =
    seoReport.grade === 'good'
      ? 'bg-[#E7F1EC] text-[#164E3F] border-[#164E3F]/30'
      : seoReport.grade === 'ok'
        ? 'bg-[#FEF7EC] text-[#9A5B13] border-[#E6B87A]'
        : 'bg-[#FAEDE5] text-[#C25E28] border-[#C25E28]/35';

  return (
    <div className="space-y-4 text-xs">
      {/* Score Summary */}
      <div className={`rounded-xl border p-3 ${scoreTone}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide">
              SEO Readiness Score
            </div>
            <div className="mt-0.5 text-2xl font-bold">{seoReport.score}/100</div>
          </div>
          <button
            type="button"
            onClick={onRequestAiSeo}
            className="inline-flex items-center gap-1 rounded-lg bg-white/90 px-2.5 py-1.5 text-[11px] font-semibold text-[#164E3F] shadow-xs hover:bg-white"
          >
            <Sparkles className="h-3 w-3" /> AI Meta Ideas
          </button>
        </div>
        <div className="mt-1.5 text-[11px] opacity-90">
          {seoReport.wordCount} words · {seoReport.internalLinksCount} internal links ·{' '}
          {seoReport.imagesCount} images (non-blocking guidance)
        </div>
      </div>

      {/* Google Search Snippet Preview */}
      <div className="rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-semibold text-[#17221E]">Google Search Preview</span>
          <div className="flex rounded-lg border border-[#E5DFD3] bg-white p-0.5">
            <button
              type="button"
              onClick={() => setPreviewDevice('desktop')}
              className={`rounded p-1 ${previewDevice === 'desktop' ? 'bg-[#E7F1EC] text-[#164E3F]' : 'text-[#53635D]'}`}
            >
              <Monitor className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice('mobile')}
              className={`rounded p-1 ${previewDevice === 'mobile' ? 'bg-[#E7F1EC] text-[#164E3F]' : 'text-[#53635D]'}`}
            >
              <Smartphone className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div
          className={`rounded-lg border border-[#E5DFD3] bg-white p-3 ${
            previewDevice === 'mobile' ? 'max-w-[310px]' : 'w-full'
          }`}
        >
          <div className="truncate text-[11px] text-[#3c4043]">{displayUrl}</div>
          <div className="mt-0.5 truncate text-sm font-medium text-[#1a0dab]">{displayTitle}</div>
          <div className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-[#4d5156]">
            {displayDesc}
          </div>
        </div>
      </div>

      {/* Focus & Secondary Keywords */}
      <div className="space-y-2">
        <label className="block font-semibold text-[#17221E]">Focus Keyword</label>
        <input
          type="text"
          value={focusKeyword}
          onChange={(e) => onChange({ focusKeyword: e.target.value })}
          placeholder="e.g. an thuong da nang monthly guide"
          className="h-8 w-full rounded-lg border border-[#E5DFD3] px-2.5 text-xs focus:border-[#164E3F] focus:outline-none"
        />
        {duplicateKeywords.length > 0 && (
          <div className="rounded-lg border border-[#E6B87A] bg-[#FEF7EC] p-2 text-[11px] text-[#7D4B12]">
            <div className="flex items-center gap-1 font-semibold">
              <AlertTriangle className="h-3.5 w-3.5" /> Potential Keyword Cannibalization
            </div>
            <p className="mt-0.5">
              Same focus keyword used in:{' '}
              {duplicateKeywords.map((d) => `/guides/${d.slug}`).join(', ')}
            </p>
          </div>
        )}

        <label className="block pt-1 font-semibold text-[#17221E]">Secondary Keywords</label>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={secInput}
            onChange={(e) => setSecInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && secInput.trim()) {
                e.preventDefault();
                if (!secondaryKeywords.includes(secInput.trim())) {
                  onChange({ secondaryKeywords: [...secondaryKeywords, secInput.trim()] });
                }
                setSecInput('');
              }
            }}
            placeholder="Add secondary keyword + Enter"
            className="h-8 flex-1 rounded-lg border border-[#E5DFD3] px-2.5 text-xs"
          />
        </div>
        {secondaryKeywords.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {secondaryKeywords.map((kw) => (
              <span
                key={kw}
                className="inline-flex items-center gap-1 rounded-full bg-[#E7F1EC] px-2 py-0.5 text-[11px] text-[#164E3F]"
              >
                {kw}
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      secondaryKeywords: secondaryKeywords.filter((k) => k !== kw),
                    })
                  }
                  className="font-bold hover:text-red-600"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Meta Title & Meta Description */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="font-semibold text-[#17221E]">SEO Meta Title</label>
          <span className="text-[10px] text-[#53635D]">{seoTitle.length}/60</span>
        </div>
        <input
          type="text"
          value={seoTitle}
          onChange={(e) => onChange({ seoTitle: e.target.value })}
          placeholder="45–60 characters recommended"
          className="h-8 w-full rounded-lg border border-[#E5DFD3] px-2.5 text-xs"
        />

        <div className="flex items-center justify-between pt-1">
          <label className="font-semibold text-[#17221E]">SEO Meta Description</label>
          <span className="text-[10px] text-[#53635D]">{seoDescription.length}/160</span>
        </div>
        <textarea
          rows={3}
          value={seoDescription}
          onChange={(e) => onChange({ seoDescription: e.target.value })}
          placeholder="120–158 characters summarizing why this guide helps long-stay guests"
          className="w-full rounded-lg border border-[#E5DFD3] p-2 text-xs"
        />
      </div>

      {/* Indexing & Technical SEO */}
      <div className="space-y-2 rounded-xl border border-[#E5DFD3] p-3">
        <div className="font-semibold text-[#17221E]">Technical SEO & Schema</div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 rounded-lg bg-[#FAF8F3] px-2.5 py-1.5">
            <input
              type="checkbox"
              checked={robotsIndex}
              onChange={(e) => onChange({ robotsIndex: e.target.checked })}
            />
            <span>robots: index</span>
          </label>
          <label className="flex items-center gap-2 rounded-lg bg-[#FAF8F3] px-2.5 py-1.5">
            <input
              type="checkbox"
              checked={robotsFollow}
              onChange={(e) => onChange({ robotsFollow: e.target.checked })}
            />
            <span>robots: follow</span>
          </label>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-[#53635D]">
            Structured Data Schema
          </label>
          <select
            value={schemaType}
            onChange={(e) => onChange({ schemaType: e.target.value })}
            className="h-8 w-full rounded-lg border border-[#E5DFD3] bg-white px-2 text-xs"
          >
            <option value="Article">Article + BreadcrumbList</option>
            <option value="Guide">Travel / Living Guide</option>
            <option value="FAQPage">FAQPage Schema</option>
            <option value="WebPage">Landing WebPage</option>
            <option value="CollectionPage">CollectionPage</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-[#53635D]">
            Canonical URL Override (optional)
          </label>
          <input
            type="text"
            value={canonicalUrl}
            onChange={(e) => onChange({ canonicalUrl: e.target.value })}
            placeholder="https://vietnomad.stays/guides/..."
            className="h-8 w-full rounded-lg border border-[#E5DFD3] px-2.5 text-xs"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-[#53635D]">
            Breadcrumb Short Label
          </label>
          <input
            type="text"
            value={breadcrumbTitle}
            onChange={(e) => onChange({ breadcrumbTitle: e.target.value })}
            placeholder="Short title for breadcrumb trail"
            className="h-8 w-full rounded-lg border border-[#E5DFD3] px-2.5 text-xs"
          />
        </div>
      </div>

      {/* Open Graph Social Preview */}
      <div className="space-y-2 rounded-xl border border-[#E5DFD3] p-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[#17221E]">Social Sharing (Open Graph)</span>
          <button
            type="button"
            onClick={onPickOgImage}
            className="text-[11px] font-semibold text-[#164E3F] hover:underline"
          >
            Choose OG Image
          </button>
        </div>
        <input
          type="text"
          value={ogTitle}
          onChange={(e) => onChange({ ogTitle: e.target.value })}
          placeholder="OG Title (falls back to SEO Title)"
          className="h-8 w-full rounded-lg border border-[#E5DFD3] px-2.5 text-xs"
        />
        <textarea
          rows={2}
          value={ogDescription}
          onChange={(e) => onChange({ ogDescription: e.target.value })}
          placeholder="OG Description (falls back to Meta Description)"
          className="w-full rounded-lg border border-[#E5DFD3] p-2 text-xs"
        />
        {ogImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ogImageUrl}
            alt="Social OG Preview"
            className="h-24 w-full rounded-lg border border-[#E5DFD3] object-cover"
          />
        )}
      </div>

      {/* Honest Google Search Console Indexing Readiness */}
      <div className="rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] p-3">
        <div className="flex items-center gap-1.5 font-semibold text-[#17221E]">
          <Globe className="h-3.5 w-3.5 text-[#164E3F]" />
          Google Search Console Readiness
        </div>
        <div className="mt-1.5 space-y-1 text-[11px] text-[#53635D]">
          <div>
            Crawl Directive:{' '}
            <strong className="text-[#17221E]">
              {robotsIndex ? 'index' : 'noindex'}, {robotsFollow ? 'follow' : 'nofollow'}
            </strong>
          </div>
          <div>
            GSC Verification Status:{' '}
            <strong className="text-[#17221E]">{gscStatus.replace('_', ' ')}</strong>
          </div>
          {gscLastCheckedAt && <div>Last inspected: {gscLastCheckedAt.slice(0, 10)}</div>}
          {gscNote && <div>Note: {gscNote}</div>}
          <p className="text-[10px] italic">
            Indexing status only changes when synced via Search Console API or manual URL inspection; published pages are never falsely marked &ldquo;Indexed&rdquo;.
          </p>
        </div>
      </div>

      {/* Checklist */}
      <div className="space-y-1.5">
        <div className="font-semibold text-[#17221E]">Content SEO Checklist</div>
        {seoReport.checks.map((chk) => (
          <div
            key={chk.id}
            className="flex items-start gap-2 rounded-lg border border-[#E5DFD3] bg-white p-2"
          >
            {chk.status === 'pass' ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#164E3F]" />
            ) : (
              <AlertTriangle
                className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                  chk.status === 'warn' ? 'text-[#A67C2E]' : 'text-[#C25E28]'
                }`}
              />
            )}
            <div className="min-w-0">
              <div className="font-semibold text-[#17221E]">{chk.label}</div>
              <div className="text-[11px] text-[#53635D]">{chk.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
