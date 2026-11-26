import crypto from 'node:crypto';
import type { SessionUser } from '@/lib/auth/session';
import { dbQuery, dbTransaction, type DbClient, toNum } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { logAdminAudit, type AdminActorContext } from './admin-rbac';
import { safeRevalidateAll } from '@/lib/revalidate-safe';

export interface PlatformFeeConfig {
  serviceFeeRate: number;
  hostCommissionRate: number;
  vatDiscountRate: number;
  premiumRewardRate: number;
  defaultMinNights: number;
  fxRates: Record<string, number>;
}

export const DEFAULT_PLATFORM_CONFIG: PlatformFeeConfig = {
  serviceFeeRate: 0.12,
  hostCommissionRate: 0,
  vatDiscountRate: 0.05,
  premiumRewardRate: 0.04,
  defaultMinNights: 7,
  fxRates: {
    VND: 1,
    USD: 25400,
    EUR: 27400,
    GBP: 32000,
    SGD: 18900,
    AUD: 16500,
  },
};

export async function getPlatformFeeConfig(tx?: DbClient): Promise<PlatformFeeConfig> {
  try {
    const exec = tx
      ? <T extends Record<string, unknown>>(s: string, p?: unknown[]) => tx.query<T>(s, p)
      : <T extends Record<string, unknown>>(s: string, p?: unknown[]) => dbQuery<T>(s, p);

    const res = await exec<{ key: string; value_json: unknown }>(
      `SELECT key, value_json FROM platform_settings`
    );
    if (res.rows.length === 0) return DEFAULT_PLATFORM_CONFIG;

    const map = new Map<string, unknown>();
    for (const r of res.rows) map.set(r.key, r.value_json);

    const numVal = (k: string, fallback: number) => {
      const raw = map.get(k);
      if (raw && typeof raw === 'object' && 'value' in raw) {
        return toNum((raw as { value: unknown }).value, fallback);
      }
      if (typeof raw === 'number' || typeof raw === 'string') {
        return toNum(raw, fallback);
      }
      return fallback;
    };

    const fxRaw = map.get('fx_rates');
    const fxRates =
      fxRaw && typeof fxRaw === 'object' && !Array.isArray(fxRaw)
        ? { ...DEFAULT_PLATFORM_CONFIG.fxRates, ...(fxRaw as Record<string, number>) }
        : DEFAULT_PLATFORM_CONFIG.fxRates;

    return {
      serviceFeeRate: numVal('service_fee_rate', DEFAULT_PLATFORM_CONFIG.serviceFeeRate),
      hostCommissionRate: numVal(
        'host_commission_rate',
        DEFAULT_PLATFORM_CONFIG.hostCommissionRate
      ),
      vatDiscountRate: numVal('vat_discount_rate', DEFAULT_PLATFORM_CONFIG.vatDiscountRate),
      premiumRewardRate: numVal('premium_reward_rate', DEFAULT_PLATFORM_CONFIG.premiumRewardRate),
      defaultMinNights: Math.max(
        7,
        Math.round(numVal('default_min_nights', DEFAULT_PLATFORM_CONFIG.defaultMinNights))
      ),
      fxRates,
    };
  } catch {
    return DEFAULT_PLATFORM_CONFIG;
  }
}

export async function updatePlatformFeeConfig(
  actorOrCtx: SessionUser | AdminActorContext,
  input: Partial<PlatformFeeConfig> & { reason?: string }
): Promise<PlatformFeeConfig> {
  const actor = 'user' in actorOrCtx ? actorOrCtx.user : actorOrCtx;
  return dbTransaction(async (tx) => {
    const before = await getPlatformFeeConfig(tx);

    const pairs: Array<[string, unknown]> = [];
    if (typeof input.serviceFeeRate === 'number') {
      if (input.serviceFeeRate < 0 || input.serviceFeeRate > 0.5) {
        throw new AppError('VALIDATION_ERROR', 'Service fee rate must be between 0% and 50%.');
      }
      pairs.push(['service_fee_rate', { value: input.serviceFeeRate }]);
    }
    if (typeof input.hostCommissionRate === 'number') {
      if (input.hostCommissionRate < 0 || input.hostCommissionRate > 0.4) {
        throw new AppError('VALIDATION_ERROR', 'Host commission rate must be between 0% and 40%.');
      }
      pairs.push(['host_commission_rate', { value: input.hostCommissionRate }]);
    }
    if (typeof input.vatDiscountRate === 'number') {
      pairs.push(['vat_discount_rate', { value: input.vatDiscountRate }]);
    }
    if (typeof input.premiumRewardRate === 'number') {
      pairs.push(['premium_reward_rate', { value: input.premiumRewardRate }]);
    }
    if (typeof input.defaultMinNights === 'number') {
      pairs.push(['default_min_nights', { value: Math.max(7, Math.round(input.defaultMinNights)) }]);
    }
    if (input.fxRates && typeof input.fxRates === 'object') {
      const mergedFx = { ...before.fxRates, ...input.fxRates };
      pairs.push(['fx_rates', mergedFx]);
      for (const [currencyCode, rate] of Object.entries(input.fxRates)) {
        if (typeof rate === 'number' && rate > 0 && currencyCode !== 'VND') {
          await tx.query(
            `INSERT INTO fx_rate_history (id, currency_code, rate_to_vnd, source, created_by)
             VALUES ($1, $2, $3, 'admin_settings', $4)`,
            [crypto.randomUUID(), currencyCode.toUpperCase(), rate, actor.id]
          );
        }
      }
    }

    for (const [key, val] of pairs) {
      await tx.query(
        `INSERT INTO platform_settings (key, value_json, updated_by, updated_at)
         VALUES ($1, $2::jsonb, $3, NOW())
         ON CONFLICT (key) DO UPDATE SET
           value_json = EXCLUDED.value_json,
           updated_by = EXCLUDED.updated_by,
           updated_at = NOW()`,
        [key, JSON.stringify(val), actor.id]
      );
    }

    const after = await getPlatformFeeConfig(tx);

    await logAdminAudit(
      {
        actor,
        module: 'system_settings',
        action: 'update_platform_settings',
        entityType: 'platform_settings',
        entityId: 'global',
        before,
        after,
        reason: input.reason || 'Updated system fee or FX configuration',
      },
      tx
    );

    safeRevalidateAll(['/', '/stays', '/deals', '/membership']);
    return after;
  });
}

export async function listPlatformSettingsSnapshot() {
  const [config, fxRes] = await Promise.all([
    getPlatformFeeConfig(),
    dbQuery<{
      id: string;
      currency_code: string;
      rate_to_vnd: string | number;
      source: string;
      effective_from: string;
    }>(`SELECT id, currency_code, rate_to_vnd, source, effective_from FROM fx_rate_history ORDER BY effective_from DESC LIMIT 30`),
  ]);

  return {
    config,
    fxHistory: fxRes.rows.map((h) => ({
      id: String(h.id),
      currencyCode: String(h.currency_code),
      rateToVnd: toNum(h.rate_to_vnd),
      source: String(h.source),
      effectiveFrom: new Date(String(h.effective_from)).toISOString(),
    })),
  };
}

export async function updatePlatformSetting(
  actorOrCtx: SessionUser | AdminActorContext,
  key: string,
  value: unknown,
  reason = ''
): Promise<PlatformFeeConfig> {
  const numVal = (v: unknown): number => {
    if (typeof v === 'number') return v;
    if (v && typeof v === 'object' && 'value' in v) return Number((v as { value: unknown }).value);
    return Number(v);
  };

  if (key === 'service_fee_rate') {
    return updatePlatformFeeConfig(actorOrCtx, { serviceFeeRate: numVal(value), reason });
  }
  if (key === 'host_commission_rate') {
    return updatePlatformFeeConfig(actorOrCtx, { hostCommissionRate: numVal(value), reason });
  }
  if (key === 'vat_discount_rate') {
    return updatePlatformFeeConfig(actorOrCtx, { vatDiscountRate: numVal(value), reason });
  }
  if (key === 'premium_reward_rate') {
    return updatePlatformFeeConfig(actorOrCtx, { premiumRewardRate: numVal(value), reason });
  }
  if (key === 'default_min_nights') {
    return updatePlatformFeeConfig(actorOrCtx, { defaultMinNights: numVal(value), reason });
  }
  if (key === 'fx_rates' && value && typeof value === 'object') {
    return updatePlatformFeeConfig(actorOrCtx, {
      fxRates: value as Record<string, number>,
      reason,
    });
  }
  throw new AppError('VALIDATION_ERROR', `Unsupported setting key: ${key}`);
}

export async function getAutomationRules() {
  const res = await dbQuery<{
    id: string;
    rule_key: string;
    name: string;
    trigger_event: string;
    action_type: string;
    action_config: unknown;
    is_active: boolean;
  }>('SELECT * FROM automation_rules ORDER BY created_at ASC');
  return res.rows.map((r) => ({
    id: String(r.id),
    ruleKey: String(r.rule_key),
    name: String(r.name),
    triggerEvent: String(r.trigger_event),
    actionType: String(r.action_type),
    actionConfig: r.action_config,
    isActive: Boolean(r.is_active),
  }));
}

export const listAutomationRules = getAutomationRules;

export async function toggleAutomationRule(
  actorOrCtx: SessionUser | AdminActorContext,
  ruleId: string,
  isActive: boolean
) {
  const actor = 'user' in actorOrCtx ? actorOrCtx.user : actorOrCtx;
  await dbTransaction(async (tx) => {
    const res = await tx.query<{ rule_key: string; is_active: boolean }>(
      'UPDATE automation_rules SET is_active = $1 WHERE id = $2 RETURNING rule_key, is_active',
      [isActive, ruleId]
    );
    if (!res.rows[0]) throw new AppError('NOT_FOUND', 'Automation rule not found.');
    await logAdminAudit(
      {
        actor,
        module: 'system_settings',
        action: 'toggle_automation_rule',
        entityType: 'automation_rule',
        entityId: ruleId,
        after: { ruleKey: res.rows[0].rule_key, isActive },
      },
      tx
    );
  });
  return { ok: true };
}
