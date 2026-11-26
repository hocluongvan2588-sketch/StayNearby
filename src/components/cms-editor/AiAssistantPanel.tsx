'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Check,
  Loader2,
  RefreshCw,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import type { AiFeatureKey, AiGatewayConfigState, AiGatewayResult } from '@/modules/ai-gateway';

export function AiAssistantPanel({
  contentId,
  destinationId,
  locale,
  title,
  focusKeyword,
  bodyExcerpt,
  selectedText,
  onInsertText,
  onReplaceSelection,
}: {
  contentId?: string;
  destinationId?: string | null;
  locale: 'en' | 'vi';
  title: string;
  focusKeyword: string;
  bodyExcerpt: string;
  selectedText: string;
  onInsertText: (text: string) => void;
  onReplaceSelection: (text: string) => void;
}) {
  const [status, setStatus] = useState<AiGatewayConfigState | null>(null);
  const [featureKey, setFeatureKey] = useState<AiFeatureKey>('outlineBrief');
  const [inlineAction, setInlineAction] = useState<
    'rewrite' | 'tone_editorial' | 'shorten' | 'expand' | 'seo_clarity' | 'translate'
  >('rewrite');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<AiGatewayResult | null>(null);

  useEffect(() => {
    fetch('/api/admin/cms/ai')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { status?: AiGatewayConfigState } | null) => {
        if (d?.status) setStatus(d.status);
      })
      .catch(() => undefined);
  }, []);

  async function runAssistant(overrideFeature?: AiFeatureKey) {
    const fk = overrideFeature ?? featureKey;
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/cms/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          featureKey: fk,
          locale,
          contentId: contentId ?? null,
          destinationId: destinationId ?? null,
          title,
          focusKeyword,
          bodyExcerpt: bodyExcerpt.slice(0, 3500),
          selectedText: selectedText.slice(0, 3000),
          action: inlineAction,
        }),
      });
      const json = (await res.json()) as AiGatewayResult;
      setResult(json);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-3 text-xs">
      <div className="rounded-xl border border-[#164E3F]/25 bg-[#E7F1EC]/60 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 font-semibold text-[#0F392E]">
            <Sparkles className="h-3.5 w-3.5" />
            VietNomad AI Gateway
          </div>
          <Link
            href="/admin/growth/content/settings"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#164E3F] hover:underline"
          >
            <Settings className="h-3 w-3" /> Config
          </Link>
        </div>
        {status && (
          <div className="mt-1.5 space-y-0.5 text-[11px] text-[#53635D]">
            <div>
              Status:{' '}
              <strong className="text-[#17221E]">
                {!status.isEnabled
                  ? 'Feature flag OFF'
                  : !status.hasApiKey
                    ? 'Awaiting OPENAI_API_KEY'
                    : `Active (${status.model})`}
              </strong>
            </div>
            <div>
              Budget used: ${status.monthSpendUsd.toFixed(3)} / ${status.monthlyBudgetUsd.toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {selectedText.trim() && (
        <div className="rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] p-2.5">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#53635D]">
            Selected Text ({selectedText.trim().length} chars)
          </div>
          <p className="line-clamp-3 italic text-[#17221E]">{selectedText}</p>
        </div>
      )}

      <div className="space-y-2">
        <label className="block font-semibold text-[#17221E]">Assistant Mode</label>
        <select
          value={featureKey}
          onChange={(e) => setFeatureKey(e.target.value as AiFeatureKey)}
          className="h-8 w-full rounded-lg border border-[#E5DFD3] bg-white px-2 text-xs"
        >
          <option value="outlineBrief">Generate Outline / Content Brief</option>
          <option value="seoSuggestions">Suggest SEO Titles & Meta Descriptions</option>
          <option value="faqGenerator">Generate Practical FAQ Questions</option>
          <option value="internalLinkSuggestions">Suggest Verified Internal Links</option>
          <option value="contentGapAnalysis">Analyze Content Gaps by Destination</option>
          <option value="inlineRewrite">Rewrite / Adjust Selected Text</option>
          <option value="translateEnVi">Translate Selection (EN ↔ VI)</option>
        </select>

        {featureKey === 'inlineRewrite' && (
          <select
            value={inlineAction}
            onChange={(e) => setInlineAction(e.target.value as typeof inlineAction)}
            className="h-8 w-full rounded-lg border border-[#E5DFD3] bg-white px-2 text-xs"
          >
            <option value="rewrite">Improve Clarity & Flow</option>
            <option value="tone_editorial">Align with VietNomad Editorial Tone</option>
            <option value="shorten">Make More Concise</option>
            <option value="expand">Expand with Practical Details</option>
            <option value="seo_clarity">Optimize Paragraph for SEO</option>
          </select>
        )}

        <button
          type="button"
          disabled={running}
          onClick={() => void runAssistant()}
          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-[#164E3F] font-semibold text-white hover:bg-[#0F392E] disabled:opacity-50"
        >
          {running ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Running via AI Gateway...
            </>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" /> Generate Suggestion
            </>
          )}
        </button>
      </div>

      {result && !result.ok && (
        <div className="rounded-xl border border-[#E6B87A] bg-[#FEF7EC] p-3 text-[11px] text-[#6B4211]">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>Gateway status: {result.status}</span>
          </div>
          <p className="mt-1 leading-relaxed">{result.message}</p>
        </div>
      )}

      {result && result.ok && result.outputText && (
        <div className="space-y-2 rounded-xl border border-[#164E3F]/30 bg-white p-3">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-[#164E3F]">
            <span>Preview Output ({result.model})</span>
            <button
              type="button"
              onClick={() => setResult(null)}
              className="text-[#53635D] hover:text-[#17221E]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg bg-[#FAF8F3] p-2.5 text-xs leading-relaxed text-[#17221E]">
            {result.outputText}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedText.trim() && (featureKey === 'inlineRewrite' || featureKey === 'translateEnVi') ? (
              <button
                type="button"
                onClick={() => {
                  onReplaceSelection(result.outputText!);
                  setResult(null);
                }}
                className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-[#164E3F] px-2.5 font-semibold text-white"
              >
                <Check className="h-3.5 w-3.5" /> Replace Selection
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onInsertText(result.outputText!);
                  setResult(null);
                }}
                className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-lg bg-[#164E3F] px-2.5 font-semibold text-white"
              >
                <Check className="h-3.5 w-3.5" /> Insert into Article
              </button>
            )}
            <button
              type="button"
              onClick={() => void runAssistant()}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E5DFD3] px-2.5 font-medium text-[#17221E] hover:bg-[#FAF8F3]"
            >
              <RefreshCw className="h-3 w-3" /> Retry
            </button>
          </div>
        </div>
      )}

      <p className="text-[10px] leading-relaxed text-[#53635D]">
        Grounded in verified VietNomad Destinations, Local Discovery places, and Live Stays. AI never applies edits automatically without your confirmation.
      </p>
    </div>
  );
}
