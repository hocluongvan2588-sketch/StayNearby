import { getCurrentUser } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';
import { getServerPreferences } from '@/lib/preferences';
import { searchStays } from '@/modules/catalog';
import { PaginatedStayGrid } from '@/components/PaginatedStayGrid';

export const dynamic = 'force-dynamic';

export default async function DealsPage() {
  const [prefs, user, stays] = await Promise.all([
    getServerPreferences(),
    getCurrentUser(),
    searchStays({ sort: 'savings_desc' }),
  ]);
  const isVi = prefs.locale === 'vi';

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
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-10 max-w-3xl space-y-2">
        <span className="inline-block rounded-full bg-[#FAEDE5] px-3 py-1 text-xs font-semibold text-[#C25E28]">
          {isVi ? 'Giá tốt khi thuê 1 tháng' : 'Monthly Deals'}
        </span>
        <h1 className="font-serif-display text-4xl font-semibold text-[#17221E]">
          {isVi
            ? 'Thuê tròn 1 tháng tại Việt Nam, ưu đãi nhiều nhất xếp trước'
            : 'Month-long stays across Vietnam, sorted by biggest savings'}
        </h1>
        <p className="text-sm text-[#53635D]">
          {isVi
            ? 'Tất cả chỗ ở dưới đây đang còn phòng cho gói 30 đêm, hiển thị sẵn tiền cọc 12% và phần trả chủ nhà khi nhận phòng.'
            : 'All places below are open for 30-night stays, with tested Wi-Fi speeds and upfront payment totals.'}
        </p>
      </div>

      <PaginatedStayGrid
        stays={dealStays}
        savedIds={Array.from(savedIds)}
        isAuthenticated={Boolean(user)}
      />
    </div>
  );
}
