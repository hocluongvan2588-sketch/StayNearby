'use client';

import React, { useState } from 'react';
import { Check, Sparkles } from 'lucide-react';
import type { CmsSettingsBundle } from '@/modules/cms-vietnomad/types';
import type {
  AiFeatureKey,
  AiGatewayConfigState,
  AiUsageLogRow,
} from '@/modules/ai-gateway';
import { CmsSubNav } from './CmsSubNav';

const AI_FEATURE_LABELS: Record<AiFeatureKey, string> = {
  outlineBrief: 'Generate Outline & Content Brief',
  seoSuggestions: 'SEO Title & Meta Description Suggestions',
  faqGenerator: 'FAQ Question Generator',
  internalLinkSuggestions: 'Internal Link Ideas',
  contentGapAnalysis: 'Destination Content Gap Analysis',
  inlineRewrite: 'Inline Selection Rewrite & Tone Polish',
  translateEnVi: 'Bilingual EN ↔ VI Translation Drafts',
};

export function CmsSettingsClient({
  initialSettings,
  initialAiStatus,
  initialLogs,
}: {
  initialSettings: CmsSettingsBundle;
  initialAiStatus: AiGatewayConfigState;
  initialLogs: AiUsageLogRow[];
}) {
  const [settings, setSettings] = useState<CmsSettingsBundle>(initialSettings);
  const [aiStatus, setAiStatus] = useState<AiGatewayConfigState>(initialAiStatus);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  async function saveCmsSettings(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/cms/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seoDefaults: settings.seoDefaults,
        editorialWorkflow: settings.editorialWorkflow,
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { settings: CmsSettingsBundle };
      if (data.settings) setSettings(data.settings);
      setSavedBanner('CMS Editorial & SEO Defaults saved.');
    }
  }

  async function saveAiConfig(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/admin/cms/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aiGateway: {
          isEnabled: aiStatus.isEnabled,
          model: aiStatus.model,
          monthlyBudgetUsd: aiStatus.monthlyBudgetUsd,
          rateLimitPerHour: aiStatus.rateLimitPerHour,
          featureFlags: aiStatus.featureFlags,
        },
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { aiGateway: AiGatewayConfigState };
      if (data.aiGateway) setAiStatus(data.aiGateway);
      setSavedBanner('OpenAI Central Gateway settings updated.');
    }
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="font-serif-display text-2xl font-semibold text-[#17221E]">
          CMS Settings &amp; Central AI Gateway
        </h1>
        <p className="text-sm text-[#53635D]">
          Configure editorial workflow defaults, SEO title suffixes, auto-redirects, and OpenAI Gateway feature flags, monthly budget, and rate limits.
        </p>
      </div>

      <CmsSubNav />

      {savedBanner && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-[#164E3F]/30 bg-[#E7F1EC] px-4 py-2 text-xs font-semibold text-[#0F392E]">
          <Check className="h-4 w-4" />
          <span>{savedBanner}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Global CMS Settings */}
        <form
          onSubmit={(e) => void saveCmsSettings(e)}
          className="space-y-3 rounded-2xl border border-[#E5DFD3] bg-white p-5 text-xs"
        >
          <h2 className="font-serif-display text-lg font-semibold text-[#17221E]">
            Editorial &amp; SEO Global Defaults
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block font-semibold">Site Name (Title Suffix)</label>
              <input
                type="text"
                value={settings.seoDefaults.siteName}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    seoDefaults: { ...s.seoDefaults, siteName: e.target.value },
                  }))
                }
                className="h-9 w-full rounded-lg border border-[#E5DFD3] px-3"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold">Title Separator</label>
              <input
                type="text"
                value={settings.seoDefaults.titleSeparator}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    seoDefaults: { ...s.seoDefaults, titleSeparator: e.target.value },
                  }))
                }
                className="h-9 w-full rounded-lg border border-[#E5DFD3] px-3"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block font-semibold">
              GSC Property URL (for verification &amp; inspection links)
            </label>
            <input
              type="text"
              value={settings.seoDefaults.gscPropertyUrl}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  seoDefaults: { ...s.seoDefaults, gscPropertyUrl: e.target.value },
                }))
              }
              placeholder="https://vietnomad.vn/"
              className="h-9 w-full rounded-lg border border-[#E5DFD3] px-3"
            />
          </div>

          <div className="space-y-1.5 pt-1">
            <label className="flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={settings.seoDefaults.defaultRobotsIndex}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    seoDefaults: { ...s.seoDefaults, defaultRobotsIndex: e.target.checked },
                  }))
                }
              />
              Default articles to index (robots: index)
            </label>
            <label className="flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={settings.seoDefaults.defaultRobotsFollow}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    seoDefaults: { ...s.seoDefaults, defaultRobotsFollow: e.target.checked },
                  }))
                }
              />
              Default articles to follow links (robots: follow)
            </label>
            <label className="flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={settings.editorialWorkflow.autoCreateRedirectOnSlugChange}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    editorialWorkflow: {
                      ...s.editorialWorkflow,
                      autoCreateRedirectOnSlugChange: e.target.checked,
                    },
                  }))
                }
              />
              Auto-create 301 redirect when published article slug changes
            </label>
            <label className="flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                checked={settings.editorialWorkflow.requireReviewBeforePublish}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    editorialWorkflow: {
                      ...s.editorialWorkflow,
                      requireReviewBeforePublish: e.target.checked,
                    },
                  }))
                }
              />
              Require editorial approval step before publishing
            </label>
          </div>

          <button
            type="submit"
            className="h-9 rounded-lg bg-[#164E3F] px-4 font-semibold text-white hover:bg-[#0F392E]"
          >
            Save Editorial Defaults
          </button>
        </form>

        {/* Central OpenAI Gateway Config */}
        <form
          onSubmit={(e) => void saveAiConfig(e)}
          className="space-y-3 rounded-2xl border border-[#E5DFD3] bg-white p-5 text-xs"
        >
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 font-serif-display text-lg font-semibold text-[#17221E]">
              <Sparkles className="h-4 w-4 text-[#164E3F]" />
              Central OpenAI Gateway
            </h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                aiStatus.hasApiKey
                  ? 'bg-[#E7F1EC] text-[#164E3F]'
                  : 'bg-[#FEF7EC] text-[#9A5B13]'
              }`}
            >
              {aiStatus.hasApiKey ? 'API Key Configured' : 'OPENAI_API_KEY Not Set'}
            </span>
          </div>

          <label className="flex items-center gap-2 rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] p-3 font-semibold text-[#17221E]">
            <input
              type="checkbox"
              checked={aiStatus.isEnabled}
              onChange={(e) =>
                setAiStatus((s) => ({ ...s, isEnabled: e.target.checked }))
              }
            />
            Enable AI Writing Assistant for CMS Editors
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block font-semibold">OpenAI Model</label>
              <input
                type="text"
                value={aiStatus.model}
                onChange={(e) =>
                  setAiStatus((s) => ({ ...s, model: e.target.value }))
                }
                className="h-9 w-full rounded-lg border border-[#E5DFD3] px-2.5 font-mono"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold">Monthly Budget ($)</label>
              <input
                type="number"
                min={0}
                step={1}
                value={aiStatus.monthlyBudgetUsd}
                onChange={(e) =>
                  setAiStatus((s) => ({
                    ...s,
                    monthlyBudgetUsd: Number(e.target.value),
                  }))
                }
                className="h-9 w-full rounded-lg border border-[#E5DFD3] px-2.5"
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold">Hourly Rate Limit</label>
              <input
                type="number"
                min={1}
                value={aiStatus.rateLimitPerHour}
                onChange={(e) =>
                  setAiStatus((s) => ({
                    ...s,
                    rateLimitPerHour: Number(e.target.value),
                  }))
                }
                className="h-9 w-full rounded-lg border border-[#E5DFD3] px-2.5"
              />
            </div>
          </div>

          <div className="space-y-1.5 rounded-xl border border-[#E5DFD3] p-3">
            <div className="mb-1 font-semibold text-[#17221E]">Per-Feature Flags</div>
            {(Object.keys(AI_FEATURE_LABELS) as AiFeatureKey[]).map((fk) => (
              <label key={fk} className="flex items-center gap-2 text-[#17221E]">
                <input
                  type="checkbox"
                  checked={aiStatus.featureFlags[fk] ?? true}
                  onChange={(e) =>
                    setAiStatus((s) => ({
                      ...s,
                      featureFlags: { ...s.featureFlags, [fk]: e.target.checked },
                    }))
                  }
                />
                <span>{AI_FEATURE_LABELS[fk]}</span>
              </label>
            ))}
          </div>

          <div className="text-[11px] text-[#53635D]">
            Month-to-date spend: <strong>${aiStatus.monthSpendUsd.toFixed(4)}</strong> · API key is read exclusively on the server via <code>OPENAI_API_KEY</code>.
          </div>

          <button
            type="submit"
            className="h-9 rounded-lg bg-[#164E3F] px-4 font-semibold text-white hover:bg-[#0F392E]"
          >
            Save AI Gateway Config
          </button>
        </form>
      </div>

      {/* AI Usage Audit Trail */}
      <section className="mt-6 rounded-2xl border border-[#E5DFD3] bg-white p-5">
        <h2 className="mb-3 font-serif-display text-lg font-semibold text-[#17221E]">
          AI Gateway Usage &amp; Cost Audit Log
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E5DFD3] bg-[#FAF8F3] text-[11px] font-semibold uppercase text-[#53635D]">
              <tr>
                <th className="px-3 py-2.5">Timestamp</th>
                <th className="px-3 py-2.5">Feature</th>
                <th className="px-3 py-2.5">Model</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Tokens (In/Out)</th>
                <th className="px-3 py-2.5">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5DFD3]">
              {initialLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-[#53635D]">
                    No AI assistant requests logged yet.
                  </td>
                </tr>
              ) : (
                initialLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-3 py-2 text-[#53635D]">
                      {log.createdAt.slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="px-3 py-2 font-semibold">{log.featureKey}</td>
                    <td className="px-3 py-2 font-mono">{log.model}</td>
                    <td className="px-3 py-2">{log.status}</td>
                    <td className="px-3 py-2">
                      {log.promptTokens} / {log.completionTokens}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      ${log.estimatedCostUsd.toFixed(5)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
