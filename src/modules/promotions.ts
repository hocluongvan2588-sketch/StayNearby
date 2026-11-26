import { addDaysIso, enumerateStayNights, getTodayIsoVietnam, isValidIsoDate, isValidUuid } from '@/lib/dates';
import { dbQuery, type DbClient, toNum } from '@/lib/db';
import { AppError } from '@/lib/errors';
import { calculateStayQuote, type PromotionAdjustmentInput } from '@/lib/pricing';
import { getPlatformFeeConfig } from '@/modules/platform-settings';

export interface ValidatedPromotionRecord extends PromotionAdjustmentInput {
  id: string;
  name: string;
  minNights: number;
  maxUses: number | null;
  usedCount: number;
  validFrom: string;
  validTo: string;
  descriptionEn: string;
  descriptionVi: string;
}

export interface PublicPromotionItem {
  id: string;
  code: string;
  name: string;
  discountType: 'percent' | 'fixed_vnd';
  discountValue: number;
  minNights: number;
  fundingSource: 'vietnomad' | 'host' | 'shared';
  validFrom: string;
  validTo: string;
  remainingUses: number | null;
  descriptionEn: string;
  descriptionVi: string;
}

export async function validatePromotionTx(
  tx: DbClient,
  params: {
    code: string;
    nights: number;
    userId?: string | null;
    lockForUpdate?: boolean;
  }
): Promise<ValidatedPromotionRecord> {
  const cleanCode = params.code.trim().toUpperCase();
  if (!cleanCode) {
    throw new AppError('VALIDATION_ERROR', 'Promotion code is empty.');
  }

  const lockSql = params.lockForUpdate ? 'FOR UPDATE' : '';
  const res = await tx.query<{
    id: string;
    code: string;
    name: string;
    discount_type: 'percent' | 'fixed_vnd';
    discount_value: string | number;
    min_nights: number;
    max_uses: number | null;
    used_count: number;
    valid_from: string | Date;
    valid_to: string | Date;
    is_active: boolean;
    funding_source: string | null;
    description_en: string | null;
    description_vi: string | null;
    eligible_user_id: string | null;
  }>(
    `SELECT * FROM promotions WHERE UPPER(code) = $1 ${lockSql}`,
    [cleanCode]
  );

  const row = res.rows[0];
  if (!row) {
    throw new AppError('NOT_FOUND', `Promotion code "${cleanCode}" does not exist.`);
  }
  if (!row.is_active) {
    throw new AppError('CONFLICT', `Promotion code "${cleanCode}" is currently inactive.`);
  }

  const todayVn = getTodayIsoVietnam();
  const validFrom =
    row.valid_from instanceof Date
      ? row.valid_from.toISOString().slice(0, 10)
      : String(row.valid_from).slice(0, 10);
  const validTo =
    row.valid_to instanceof Date
      ? row.valid_to.toISOString().slice(0, 10)
      : String(row.valid_to).slice(0, 10);

  if (todayVn < validFrom) {
    throw new AppError('CONFLICT', `Promotion "${cleanCode}" starts on ${validFrom}.`);
  }
  if (todayVn > validTo) {
    throw new AppError('CONFLICT', `Promotion "${cleanCode}" expired on ${validTo}.`);
  }

  const minNights = Math.max(1, toNum(row.min_nights, 7));
  if (params.nights < minNights) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Promotion "${cleanCode}" requires a stay of at least ${minNights} nights.`
    );
  }

  if (row.eligible_user_id && row.eligible_user_id !== params.userId) {
    throw new AppError(
      'FORBIDDEN',
      `Promotion "${cleanCode}" is restricted to another member account.`
    );
  }

  const maxUses = row.max_uses !== null && row.max_uses !== undefined ? toNum(row.max_uses) : null;
  const usedCount = toNum(row.used_count, 0);
  if (maxUses !== null && usedCount >= maxUses) {
    throw new AppError('CONFLICT', `Promotion "${cleanCode}" has reached its redemption limit.`);
  }

  const fundingSource =
    row.funding_source === 'host' || row.funding_source === 'shared'
      ? row.funding_source
      : 'vietnomad';

  return {
    id: String(row.id),
    code: String(row.code),
    name: String(row.name),
    discountType: row.discount_type === 'fixed_vnd' ? 'fixed_vnd' : 'percent',
    discountValue: toNum(row.discount_value),
    fundingSource,
    minNights,
    maxUses,
    usedCount,
    validFrom,
    validTo,
    descriptionEn: String(row.description_en ?? ''),
    descriptionVi: String(row.description_vi ?? ''),
  };
}

export async function previewBookingQuoteWithPromotion(params: {
  stayId: string;
  roomId: string;
  packageId: string;
  checkIn: string;
  nights: number;
  promotionCode?: string;
  applyVatFree?: boolean;
  useRewardCredit?: boolean;
  user?: {
    id: string;
    membershipTier: 'free' | 'premium';
    vatTaxId: string | null;
    rewardCreditVnd: number;
  } | null;
}) {
  if (!isValidUuid(params.stayId) || !isValidUuid(params.roomId) || !isValidUuid(params.packageId)) {
    throw new AppError('VALIDATION_ERROR', 'Invalid stay, room, or package ID.');
  }
  if (!isValidIsoDate(params.checkIn) || !Number.isInteger(params.nights) || params.nights < 7) {
    throw new AppError('VALIDATION_ERROR', 'Valid check-in date and at least 7 nights required.');
  }

  const checkOut = addDaysIso(params.checkIn, params.nights);
  const nightDates = enumerateStayNights(params.checkIn, checkOut);

  const [pkgRes, lockRes, platformConfig] = await Promise.all([
    dbQuery<{
      wholesale_7_vnd: string | number;
      wholesale_14_vnd: string | number;
      wholesale_21_vnd: string | number;
      wholesale_30_vnd: string | number;
      compare_30_vnd: string | number | null;
      extra_night_vnd: string | number;
    }>(
      `SELECT p.wholesale_7_vnd, p.wholesale_14_vnd, p.wholesale_21_vnd,
              p.wholesale_30_vnd, p.compare_30_vnd, p.extra_night_vnd
       FROM stay_packages p
       WHERE p.id = $1 AND p.room_id = $2 AND p.stay_id = $3 AND p.is_listed = TRUE`,
      [params.packageId, params.roomId, params.stayId]
    ),
    dbQuery<{ stay_date: string | Date; custom_nightly_vnd: string | number | null }>(
      `SELECT stay_date, custom_nightly_vnd FROM room_night_locks
       WHERE room_id = $1 AND stay_date >= $2::date AND stay_date < $3::date`,
      [params.roomId, params.checkIn, checkOut]
    ),
    getPlatformFeeConfig(),
  ]);

  const pkg = pkgRes.rows[0];
  if (!pkg) throw new AppError('NOT_FOUND', 'Stay package not found.');

  const overrideMap = new Map<string, number | null>();
  for (const r of lockRes.rows) {
    const dt =
      r.stay_date instanceof Date ? r.stay_date.toISOString().slice(0, 10) : String(r.stay_date).slice(0, 10);
    overrideMap.set(dt, r.custom_nightly_vnd ? toNum(r.custom_nightly_vnd) : null);
  }
  const nightOverridesVnd = nightDates.map((d) => overrideMap.get(d) ?? null);

  let promo: ValidatedPromotionRecord | null = null;
  if (params.promotionCode?.trim()) {
    promo = await validatePromotionTx(
      { query: (sql: string, qParams?: unknown[]) => dbQuery(sql, qParams) } as unknown as DbClient,
      {
        code: params.promotionCode,
        nights: params.nights,
        userId: params.user?.id ?? null,
        lockForUpdate: false,
      }
    );
  }

  const quote = calculateStayQuote({
    pkg: {
      wholesale7Vnd: toNum(pkg.wholesale_7_vnd),
      wholesale14Vnd: toNum(pkg.wholesale_14_vnd),
      wholesale21Vnd: toNum(pkg.wholesale_21_vnd),
      wholesale30Vnd: toNum(pkg.wholesale_30_vnd),
      compare30Vnd: pkg.compare_30_vnd ? toNum(pkg.compare_30_vnd) : null,
      extraNightVnd: toNum(pkg.extra_night_vnd),
    },
    nights: params.nights,
    isPremiumMember: params.user?.membershipTier === 'premium',
    applyVatFree: params.applyVatFree,
    vatTaxId: params.user?.vatTaxId,
    availableRewardCreditVnd: params.user?.rewardCreditVnd ?? 0,
    useRewardCredit: params.useRewardCredit,
    nightOverridesVnd,
    serviceFeeRate: platformConfig.serviceFeeRate,
    vatDiscountRate: platformConfig.vatDiscountRate,
    premiumRewardRate: platformConfig.premiumRewardRate,
    promotion: promo,
  });

  return {
    quote,
    promotion: promo
      ? {
          code: promo.code,
          name: promo.name,
          discountType: promo.discountType,
          discountValue: promo.discountValue,
          fundingSource: promo.fundingSource,
          descriptionEn: promo.descriptionEn,
          descriptionVi: promo.descriptionVi,
        }
      : null,
  };
}

export async function getPublicActivePromotions(): Promise<PublicPromotionItem[]> {
  const todayVn = getTodayIsoVietnam();
  const res = await dbQuery<{
    id: string;
    code: string;
    name: string;
    discount_type: 'percent' | 'fixed_vnd';
    discount_value: string | number;
    min_nights: number;
    funding_source: string | null;
    max_uses: number | null;
    used_count: number;
    valid_from: string | Date;
    valid_to: string | Date;
    description_en: string | null;
    description_vi: string | null;
  }>(
    `SELECT * FROM promotions
     WHERE is_active = TRUE
       AND is_public = TRUE
       AND eligible_user_id IS NULL
       AND valid_from <= $1::date
       AND valid_to >= $1::date
       AND (max_uses IS NULL OR used_count < max_uses)
     ORDER BY discount_value DESC, valid_to ASC`,
    [todayVn]
  );

  return res.rows.map((p) => {
    const maxUses = p.max_uses !== null && p.max_uses !== undefined ? toNum(p.max_uses) : null;
    const used = toNum(p.used_count, 0);
    return {
      id: String(p.id),
      code: String(p.code),
      name: String(p.name),
      discountType: p.discount_type === 'fixed_vnd' ? 'fixed_vnd' : 'percent',
      discountValue: toNum(p.discount_value),
      minNights: Math.max(1, toNum(p.min_nights, 7)),
      fundingSource:
        p.funding_source === 'host' || p.funding_source === 'shared'
          ? p.funding_source
          : 'vietnomad',
      validFrom:
        p.valid_from instanceof Date ? p.valid_from.toISOString().slice(0, 10) : String(p.valid_from).slice(0, 10),
      validTo:
        p.valid_to instanceof Date ? p.valid_to.toISOString().slice(0, 10) : String(p.valid_to).slice(0, 10),
      remainingUses: maxUses !== null ? Math.max(0, maxUses - used) : null,
      descriptionEn: String(p.description_en ?? ''),
      descriptionVi: String(p.description_vi ?? ''),
    };
  });
}
