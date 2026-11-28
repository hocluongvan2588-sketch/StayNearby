import crypto from 'node:crypto';
import { dbQuery, toNum } from '@/lib/db';
import { isValidUuid } from '@/lib/dates';
import type { AdminActorContext } from '@/modules/admin-rbac';

export type AiFeatureKey =
  | 'inlineRewrite'
  | 'seoSuggestions'
  | 'translateEnVi'
  | 'outlineBrief'
  | 'faqGenerator'
  | 'internalLinkSuggestions'
  | 'contentGapAnalysis';

export interface AiGatewayConfigState {
  key: string;
  provider: string;
  model: string;
  isEnabled: boolean;
  hasApiKey: boolean;
  monthlyBudgetUsd: number;
  rateLimitPerHour: number;
  featureFlags: Record<AiFeatureKey, boolean>;
  monthSpendUsd: number;
  requestsLastHour: number;
}

export interface AiGatewayRequest {
  featureKey: AiFeatureKey;
  locale: 'en' | 'vi';
  contentId?: string | null;
  destinationId?: string | null;
  title?: string;
  selectedText?: string;
  action?: 'rewrite' | 'tone_editorial' | 'shorten' | 'expand' | 'seo_clarity' | 'translate';
  bodyExcerpt?: string;
  focusKeyword?: string;
}

export interface AiGatewayResult {
  ok: boolean;
  status: 'success' | 'unconfigured' | 'disabled' | 'blocked' | 'error';
  message: string;
  outputText?: string;
  suggestions?: Array<{ title: string; detail: string; targetPath?: string }>;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
}

export interface AiCompletionTransport {
  complete(params: {
    model: string;
    systemPrompt: string;
    userPrompt: string;
  }): Promise<{
    text: string;
    promptTokens: number;
    completionTokens: number;
  }>;
}

const DEFAULT_FLAGS: Record<AiFeatureKey, boolean> = {
  inlineRewrite: true,
  seoSuggestions: true,
  translateEnVi: true,
  outlineBrief: true,
  faqGenerator: true,
  internalLinkSuggestions: true,
  contentGapAnalysis: true,
};

function estimateOpenAiCostUsd(model: string, promptTokens: number, completionTokens: number): number {
  const isGpt4o = model.includes('gpt-4o') && !model.includes('mini');
  const inPer1M = isGpt4o ? 2.5 : 0.15;
  const outPer1M = isGpt4o ? 10.0 : 0.6;
  return Number(
    ((promptTokens / 1_000_000) * inPer1M + (completionTokens / 1_000_000) * outPer1M).toFixed(6)
  );
}

export async function getAiGatewayStatus(): Promise<AiGatewayConfigState> {
  const [cfgRes, spendRes, rateRes] = await Promise.all([
    dbQuery<{
      key: string;
      provider: string;
      model: string;
      is_enabled: boolean;
      monthly_budget_usd: string | number;
      rate_limit_per_hour: number;
      feature_flags: Record<string, boolean> | null;
    }>(`SELECT * FROM ai_gateway_configs WHERE key = 'default' LIMIT 1`),
    dbQuery<{ total: string | number }>(
      `SELECT COALESCE(SUM(estimated_cost_usd), 0) AS total
       FROM ai_usage_logs
       WHERE status = 'success'
         AND created_at >= date_trunc('month', NOW())`
    ),
    dbQuery<{ cnt: string | number }>(
      `SELECT COUNT(*) AS cnt
       FROM ai_usage_logs
       WHERE status = 'success'
         AND created_at >= NOW() - INTERVAL '1 hour'`
    ),
  ]);

  const row = cfgRes.rows[0];
  const flags = { ...DEFAULT_FLAGS, ...(row?.feature_flags ?? {}) };
  const apiKey = process.env.OPENAI_API_KEY?.trim() || '';

  return {
    key: 'default',
    provider: row?.provider ?? 'openai',
    model: row?.model ?? 'gpt-4o-mini',
    isEnabled: Boolean(row?.is_enabled),
    hasApiKey: apiKey.length > 0,
    monthlyBudgetUsd: toNum(row?.monthly_budget_usd, 50),
    rateLimitPerHour: toNum(row?.rate_limit_per_hour, 60),
    featureFlags: flags,
    monthSpendUsd: toNum(spendRes.rows[0]?.total, 0),
    requestsLastHour: toNum(rateRes.rows[0]?.cnt, 0),
  };
}

export async function updateAiGatewayConfig(
  actor: AdminActorContext,
  input: {
    model?: string;
    isEnabled?: boolean;
    monthlyBudgetUsd?: number;
    rateLimitPerHour?: number;
    featureFlags?: Partial<Record<AiFeatureKey, boolean>>;
  }
): Promise<AiGatewayConfigState> {
  const current = await getAiGatewayStatus();
  const nextModel = input.model?.trim() || current.model;
  const nextEnabled = input.isEnabled ?? current.isEnabled;
  const nextBudget =
    typeof input.monthlyBudgetUsd === 'number'
      ? Math.max(0, Number(input.monthlyBudgetUsd.toFixed(2)))
      : current.monthlyBudgetUsd;
  const nextRate =
    typeof input.rateLimitPerHour === 'number'
      ? Math.max(1, Math.round(input.rateLimitPerHour))
      : current.rateLimitPerHour;
  const nextFlags = { ...current.featureFlags, ...(input.featureFlags ?? {}) };

  await dbQuery(
    `INSERT INTO ai_gateway_configs (
      key, provider, model, is_enabled, monthly_budget_usd, rate_limit_per_hour, feature_flags, updated_by, updated_at
    ) VALUES ('default', 'openai', $1, $2, $3, $4, $5::jsonb, $6, NOW())
    ON CONFLICT (key) DO UPDATE SET
      model = EXCLUDED.model,
      is_enabled = EXCLUDED.is_enabled,
      monthly_budget_usd = EXCLUDED.monthly_budget_usd,
      rate_limit_per_hour = EXCLUDED.rate_limit_per_hour,
      feature_flags = EXCLUDED.feature_flags,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()`,
    [nextModel, nextEnabled, nextBudget, nextRate, JSON.stringify(nextFlags), actor.user.id]
  );

  return getAiGatewayStatus();
}

export interface AiUsageLogRow {
  id: string;
  featureKey: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  status: string;
  errorMessage: string;
  actorName: string;
  createdAt: string;
}

export async function listAiUsageLogs(limit = 30): Promise<AiUsageLogRow[]> {
  const res = await dbQuery<{
    id: string;
    feature_key: string;
    model: string;
    prompt_tokens: number;
    completion_tokens: number;
    estimated_cost_usd: string | number;
    status: string;
    error_message: string;
    created_at: string;
    actor_name: string | null;
  }>(
    `SELECT l.*, u.full_name AS actor_name
     FROM ai_usage_logs l
     LEFT JOIN users u ON u.id = l.actor_user_id
     ORDER BY l.created_at DESC
     LIMIT $1`,
    [Math.min(100, Math.max(1, limit))]
  );

  return res.rows.map((r) => ({
    id: String(r.id),
    featureKey: String(r.feature_key),
    model: String(r.model),
    promptTokens: toNum(r.prompt_tokens),
    completionTokens: toNum(r.completion_tokens),
    estimatedCostUsd: toNum(r.estimated_cost_usd),
    status: String(r.status),
    errorMessage: String(r.error_message),
    actorName: r.actor_name ? String(r.actor_name) : 'Staff',
    createdAt: new Date(String(r.created_at)).toISOString(),
  }));
}

async function buildVerifiedGroundingContext(destinationId?: string | null): Promise<string> {
  const [destsRes, placesRes, staysRes, guidesRes] = await Promise.all([
    dbQuery<{ slug: string; name_en: string; avg_wifi_mbps: number; monthly_cost_usd: number }>(
      `SELECT slug, name_en, avg_wifi_mbps, monthly_cost_usd FROM destinations
       ${destinationId && isValidUuid(destinationId) ? 'WHERE id = $1' : ''}
       ORDER BY name_en LIMIT 8`,
      destinationId && isValidUuid(destinationId) ? [destinationId] : []
    ),
    dbQuery<{ name: string; category: string; address: string }>(
      `SELECT name, category, address FROM places
       WHERE verification_status = 'verified'
       ${destinationId && isValidUuid(destinationId) ? 'AND destination_id = $1' : ''}
       ORDER BY is_featured DESC LIMIT 10`,
      destinationId && isValidUuid(destinationId) ? [destinationId] : []
    ),
    dbQuery<{ slug: string; title_en: string; neighborhood_en: string; wifi_download_mbps: number }>(
      `SELECT slug, title_en, neighborhood_en, wifi_download_mbps FROM stays
       WHERE status = 'live'
       ${destinationId && isValidUuid(destinationId) ? 'AND destination_id = $1' : ''}
       ORDER BY is_featured DESC LIMIT 10`,
      destinationId && isValidUuid(destinationId) ? [destinationId] : []
    ),
    dbQuery<{ slug: string; title_en: string; focus_keyword: string }>(
      `SELECT slug, title_en, focus_keyword FROM cms_contents
       WHERE status = 'published'
       ORDER BY updated_at DESC LIMIT 12`
    ),
  ]);

  return JSON.stringify(
    {
      verifiedDestinations: destsRes.rows,
      verifiedLocalPlaces: placesRes.rows,
      liveStays: staysRes.rows.map((s) => ({
        slug: s.slug,
        title: s.title_en,
        neighborhood: s.neighborhood_en,
        wifiMbps: s.wifi_download_mbps,
        path: `/stays/${s.slug}`,
      })),
      publishedGuides: guidesRes.rows.map((g) => ({
        slug: g.slug,
        title: g.title_en,
        focusKeyword: g.focus_keyword,
        path: `/guides/${g.slug}`,
      })),
    },
    null,
    2
  );
}

const openAiHttpTransport: AiCompletionTransport = {
  async complete({ model, systemPrompt, userPrompt }) {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    const baseUrl = (process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(
      /\/+$/,
      ''
    );
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`OpenAI Gateway HTTP ${res.status}: ${errText.slice(0, 180)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return {
      text: json.choices?.[0]?.message?.content?.trim() ?? '',
      promptTokens: Number(json.usage?.prompt_tokens ?? 0),
      completionTokens: Number(json.usage?.completion_tokens ?? 0),
    };
  },
};

async function recordAiLog(params: {
  actorUserId: string;
  featureKey: string;
  contentId?: string | null;
  model: string;
  promptTokens: number;
  completionTokens: number;
  estimatedCostUsd: number;
  status: 'success' | 'blocked' | 'unconfigured' | 'error';
  errorMessage?: string;
}) {
  await dbQuery(
    `INSERT INTO ai_usage_logs (
      id, actor_user_id, feature_key, content_id, model, prompt_tokens,
      completion_tokens, estimated_cost_usd, status, error_message
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      crypto.randomUUID(),
      params.actorUserId,
      params.featureKey,
      params.contentId && isValidUuid(params.contentId) ? params.contentId : null,
      params.model,
      params.promptTokens,
      params.completionTokens,
      params.estimatedCostUsd,
      params.status,
      (params.errorMessage ?? '').slice(0, 400),
    ]
  ).catch(() => undefined);
}

export async function runCmsAiAssistant(
  actor: AdminActorContext,
  req: AiGatewayRequest,
  transportOverride?: AiCompletionTransport
): Promise<AiGatewayResult> {
  const state = await getAiGatewayStatus();

  if (!state.isEnabled) {
    await recordAiLog({
      actorUserId: actor.user.id,
      featureKey: req.featureKey,
      contentId: req.contentId,
      model: state.model,
      promptTokens: 0,
      completionTokens: 0,
      estimatedCostUsd: 0,
      status: 'blocked',
      errorMessage: 'Central AI Gateway is disabled by admin settings.',
    });
    return {
      ok: false,
      status: 'disabled',
      message:
        'AI Writing Assistant is currently disabled in CMS & AI Gateway Settings. Enable the feature flag when ready.',
    };
  }

  if (!state.featureFlags[req.featureKey]) {
    return {
      ok: false,
      status: 'disabled',
      message: `Feature "${req.featureKey}" is turned off in AI Gateway feature flags.`,
    };
  }

  if (!transportOverride && !state.hasApiKey) {
    await recordAiLog({
      actorUserId: actor.user.id,
      featureKey: req.featureKey,
      contentId: req.contentId,
      model: state.model,
      promptTokens: 0,
      completionTokens: 0,
      estimatedCostUsd: 0,
      status: 'unconfigured',
      errorMessage: 'OPENAI_API_KEY is not configured in the server environment.',
    });
    return {
      ok: false,
      status: 'unconfigured',
      message:
        'Central AI Gateway interface is ready, but OPENAI_API_KEY is not configured yet. Configure OPENAI_API_KEY on the server to activate live OpenAI completions.',
    };
  }

  if (state.monthSpendUsd >= state.monthlyBudgetUsd) {
    await recordAiLog({
      actorUserId: actor.user.id,
      featureKey: req.featureKey,
      contentId: req.contentId,
      model: state.model,
      promptTokens: 0,
      completionTokens: 0,
      estimatedCostUsd: 0,
      status: 'blocked',
      errorMessage: 'Monthly AI budget cap reached.',
    });
    return {
      ok: false,
      status: 'blocked',
      message: `Monthly AI Gateway budget ($${state.monthlyBudgetUsd.toFixed(2)}) reached.`,
    };
  }

  if (state.requestsLastHour >= state.rateLimitPerHour) {
    return {
      ok: false,
      status: 'blocked',
      message: `Hourly AI Gateway rate limit (${state.rateLimitPerHour}/hr) reached. Try again later.`,
    };
  }

  const groundingJson = await buildVerifiedGroundingContext(req.destinationId);

  const systemPrompt = [
    'You are the editorial assistant for VietNomad Stays (weekly and monthly stays across Vietnam for remote workers, travelers, families, and long-term guests).',
    'STRICT BRAND & GROUNDING RULES:',
    '1. Never invent prices, Wi-Fi Mbps measurements, local businesses, addresses, or legal/visa guarantees.',
    '2. Only cite stays, destinations, local places, and guide links that appear in the VERIFIED DATABASE SNAPSHOT below.',
    '3. Write in a calm, warm, practical editorial tone. Avoid hype, exclamation spam, and AI clichés ("game-changer", "nestled in", "seamless experience", "unlock").',
    `4. Output language: ${req.locale === 'vi' ? 'Vietnamese (natural, clear, accurate terminology)' : 'English'}.`,
    '',
    'VERIFIED DATABASE SNAPSHOT:',
    groundingJson,
  ].join('\n');

  let userPrompt = '';
  if (req.featureKey === 'inlineRewrite') {
    const mode = req.action ?? 'rewrite';
    userPrompt = `Task: ${mode}\nSelected text:\n"""\n${req.selectedText ?? ''}\n"""\nReturn only the improved text ready to replace the selection.`;
  } else if (req.featureKey === 'translateEnVi') {
    const target = req.locale === 'vi' ? 'Vietnamese' : 'English';
    userPrompt = `Translate the text cleanly into ${target}, preserving VietNomad brand names (BookingFlow, Wi-Fi Verified, Work-Ready, VietNomad Stays):\n"""\n${req.selectedText ?? req.bodyExcerpt ?? ''}\n"""`;
  } else if (req.featureKey === 'seoSuggestions') {
    userPrompt = `Title: ${req.title ?? ''}\nFocus Keyword: ${req.focusKeyword ?? ''}\nExcerpt/Body:\n${req.bodyExcerpt ?? ''}\n\nProvide 3 concise SEO Title options (45-60 chars) and 3 Meta Description options (125-155 chars) using the focus keyword naturally.`;
  } else if (req.featureKey === 'outlineBrief') {
    userPrompt = `Topic: ${req.title ?? req.focusKeyword ?? 'Vietnam long-stay guide'}\nDraft an H2/H3 article brief tailored to guests staying 7-30+ nights, suggesting where to embed live VietNomad stay or destination blocks.`;
  } else if (req.featureKey === 'faqGenerator') {
    userPrompt = `Topic: ${req.title ?? ''}\nBody context:\n${req.bodyExcerpt ?? ''}\n\nGenerate 4 practical Q&A pairs for long-stay guests (checking neighborhood fit, Wi-Fi/workspace expectations, check-in, and online service fee transparency (describe the fee mechanism only, never state a specific percentage unless one is given in the context) without fabricating property-specific claims).`;
  } else if (req.featureKey === 'internalLinkSuggestions') {
    userPrompt = `Current article: "${req.title ?? ''}"\nBody:\n${req.bodyExcerpt ?? ''}\n\nSuggest up to 5 internal links strictly from liveStays, verifiedDestinations, or publishedGuides in the snapshot, including exact /path and natural anchor text.`;
  } else {
    userPrompt = `Analyze existing publishedGuides and verifiedDestinations in the snapshot and propose 5 high-intent long-stay guide topics (content gaps) we should write next to avoid keyword cannibalization with /destinations/* pages.`;
  }

  try {
    const transport = transportOverride ?? openAiHttpTransport;
    const result = await transport.complete({
      model: state.model,
      systemPrompt,
      userPrompt,
    });
    const cost = estimateOpenAiCostUsd(state.model, result.promptTokens, result.completionTokens);
    await recordAiLog({
      actorUserId: actor.user.id,
      featureKey: req.featureKey,
      contentId: req.contentId,
      model: state.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      estimatedCostUsd: cost,
      status: 'success',
    });

    return {
      ok: true,
      status: 'success',
      message: 'Generated via VietNomad Central AI Gateway.',
      outputText: result.text,
      model: state.model,
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI Gateway execution error';
    await recordAiLog({
      actorUserId: actor.user.id,
      featureKey: req.featureKey,
      contentId: req.contentId,
      model: state.model,
      promptTokens: 0,
      completionTokens: 0,
      estimatedCostUsd: 0,
      status: 'error',
      errorMessage: msg,
    });
    return {
      ok: false,
      status: 'error',
      message: msg,
    };
  }
}
