import { Tag } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';
import { formatMoneyFromVnd } from '@/lib/i18n';
import { getServerPreferences } from '@/lib/preferences';
import { searchStays } from '@/modules/catalog';
import { getPlatformFeeConfig } from '@/modules/platform-settings';
import { getPublicActivePromotions } from '@/modules/promotions';
import { PaginatedStayGrid } from '@/components/PaginatedStayGrid';

export const dynamic = 'force-dynamic';

export default async function DealsPage() {
  const [prefs, user, stays, feeConfig, publicPromos] = await Promise.all([
    getServerPreferences(),
    getCurrentUser(),
    searchStays({ sort: 'savings_desc' }),
    getPlatformFeeConfig(),
    getPublicActivePromotions(),
  ]);
  const isVi = prefs.locale === 'vi';
  const serviceFeePct = Math.round(feeConfig.serviceFeeRate * 100);

  let savedIds = new Set<string>();
  if (user) {
    const sv = await dbQuery<{ stay_id: string }>(
      'SELECT stay_id FROM saved_stays WHERE user_id = $1',
      [user.id]
    );
    savedIds = new Set(sv.rows.map((r) => r.stay_id));
  }

  const dealStays = stays.filter((s) => s.dealSavingsPct > 0 || s.isDealFeatured);

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-3xl space-y-2">
        <span className="inline-block rounded-full bg-[#FAEDE5] px-3 py-1 text-xs font-semibold text-[#C25E28]">
          {isVi ? 'Ưu đãi lưu trú 1 tháng' : 'Monthly Deals'}
        </span>
        <h1 className="text-[30px] font-semibold tracking-tight text-[#17221E] sm:text-[36px]">
          {isVi
            ? 'Thuê trọn 1 tháng tại Việt Nam, ưu đãi nhiều nhất xếp trước'
            : 'Month-long stays across Vietnam, sorted by biggest savings'}
        </h1>
        <p className="text-sm text-[#53635D]">
          {isVi
            ? `Hiển thị sẵn giá 30 đêm, phí dịch vụ ${serviceFeePct}% trả online và phần tiền thuê trả chủ nhà khi nhận phòng.`
            : `All stays below are available for 30-night stays, with upfront ${serviceFeePct}% online fee and check-in rent breakdown.`}
        </p>
      </div>

      {publicPromos.length > 0 && (
        <section className="rounded-2xl border border-[#E5DFD3] bg-[#FAF8F3] p-6">
          <div className="mb-4 flex items-center gap-2">
            <Tag className="h-4 w-4 text-[#C25E28]" />
            <h2 className="text-lg font-semibold text-[#17221E]">
              {isVi ? 'Mã ưu đãi đang mở áp dụng' : 'Active Public Promo Codes'}
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {publicPromos.map((promo) => (
              <div
                key={promo.id}
                className="flex flex-col justify-between rounded-2xl border border-[#E5DFD3] bg-white p-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-lg bg-[#E7F1EC] px-2.5 py-1 font-mono text-xs font-bold text-[#164E3F]">
                      {promo.code}
                    </span>
                    <span className="rounded-full bg-[#FAEDE5] px-2.5 py-0.5 text-[11px] font-semibold text-[#C25E28]">
                      {promo.discountType === 'percent'
                        ? `-${promo.discountValue}%`
                        : `-${formatMoneyFromVnd(promo.discountValue, prefs.currency, {
                            fxRates: feeConfig.fxRates,
                          })}`}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-[#17221E]">{promo.name}</div>
                  {(promo.descriptionEn || promo.descriptionVi) && (
                    <p className="text-xs text-[#53635D]">
                      {isVi
                        ? promo.descriptionVi || promo.descriptionEn
                        : promo.descriptionEn || promo.descriptionVi}
                    </p>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-[#E5DFD3] pt-2 text-[11px] text-[#53635D]">
                  <span>
                    {isVi ? `Tối thiểu ${promo.minNights} đêm` : `Min ${promo.minNights} nights`}
                  </span>
                  <span>
                    {isVi ? 'Hạn:' : 'Until'} {promo.validTo}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <PaginatedStayGrid
        stays={dealStays}
        savedIds={Array.from(savedIds)}
        isAuthenticated={Boolean(user)}
      />
    </div>
  );
}
