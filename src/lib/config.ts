export type CancellationPolicyVersion = 'flexible_24h' | 'moderate_5d';

export interface CancellationPolicySpec {
  version: CancellationPolicyVersion;
  titleEn: string;
  titleVi: string;
  summaryEn: string;
  summaryVi: string;
  freeCancellationHoursBeforeCheckIn: number;
}

export const CANCELLATION_POLICIES: Record<
  CancellationPolicyVersion,
  CancellationPolicySpec
> = {
  flexible_24h: {
    version: 'flexible_24h',
    titleEn: 'Flexible (24 hours before check-in)',
    titleVi: 'Linh hoạt (trước giờ nhận phòng 24 giờ)',
    summaryEn:
      'Free cancellation up to 24 hours before local check-in time (14:00). Later cancellations follow the agreed terms with the host.',
    summaryVi:
      'Hủy miễn phí trước 24 giờ so với giờ nhận phòng địa phương (14:00). Hủy muộn hơn áp dụng theo thỏa thuận đã công bố với chủ nhà.',
    freeCancellationHoursBeforeCheckIn: 24,
  },
  moderate_5d: {
    version: 'moderate_5d',
    titleEn: 'Moderate (5 days before check-in)',
    titleVi: 'Trung bình (trước ngày nhận phòng 5 ngày)',
    summaryEn:
      'Free cancellation up to 5 days before local check-in time (14:00). Cancellations within 5 days may incur host terms.',
    summaryVi:
      'Hủy miễn phí trước 5 ngày so với giờ nhận phòng địa phương (14:00). Hủy trong vòng 5 ngày áp dụng điều kiện đã công bố.',
    freeCancellationHoursBeforeCheckIn: 120,
  },
};

export function getAppConfig() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    '';
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    '';
  const supabaseServiceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    '';
  const databaseUrl =
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.POSTGRES_URL_NON_POOLING?.trim() ||
    process.env.POSTGRES_PRISMA_URL?.trim() ||
    '';

  const isVercel = process.env.VERCEL === '1';
  const rawPgliteDir = process.env.PGLITE_DATA_DIR?.trim() || '';
  const pgliteDataDir =
    rawPgliteDir && !(isVercel && rawPgliteDir.startsWith('.data'))
      ? rawPgliteDir
      : isVercel
        ? '/tmp/staynearby-pglite'
        : '.data/staynearby-pglite';

  const timeoutHours = Number.parseInt(
    process.env.BOOKING_RESPONSE_TIMEOUT_HOURS || '24',
    10
  );

  return {
    brandName: process.env.NEXT_PUBLIC_BRAND_NAME?.trim() || 'WorkingHome',
    demoMode: (process.env.NEXT_PUBLIC_DEMO_MODE ?? 'true') !== 'false',
    databaseUrl,
    pgliteDataDir,
    supabase: {
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      serviceRoleKey: supabaseServiceRoleKey,
      isConfigured: Boolean(supabaseUrl && supabaseAnonKey),
    },
    authSecret:
      process.env.AUTH_SECRET?.trim() ||
      'staynearby-dev-only-secret-change-before-production-2026',
    bookingResponseTimeoutHours: Number.isFinite(timeoutHours) && timeoutHours > 0 ? timeoutHours : 24,
    defaultCurrency: 'VND' as const,
    defaultTimezone: process.env.DEFAULT_TIMEZONE?.trim() || 'Asia/Ho_Chi_Minh',
    defaultCancellationPolicyVersion:
      (process.env.DEFAULT_CANCELLATION_POLICY_VERSION as CancellationPolicyVersion) ||
      'flexible_24h',
    maxListingPhotos: Number.parseInt(process.env.MAX_LISTING_PHOTOS || '12', 10) || 12,
    maxPhotoSizeBytes:
      Number.parseInt(process.env.MAX_PHOTO_SIZE_BYTES || String(5 * 1024 * 1024), 10) ||
      5 * 1024 * 1024,
    opsSecret:
      process.env.OPS_SECRET?.trim() || process.env.CRON_SECRET?.trim() || '',
    outboxWebhookUrl: process.env.OUTBOX_WEBHOOK_URL?.trim() || '',
    outboxMaxAttempts:
      Number.parseInt(process.env.OUTBOX_MAX_ATTEMPTS || '5', 10) || 5,
  };
}
