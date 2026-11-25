import { getCurrentUser } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';
import { getServerPreferences } from '@/lib/preferences';
import { searchStays } from '@/modules/catalog';
import { StayCard } from '@/components/StayCard';

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
          {isVi ? 'Ưu đãi dài ngày theo tháng' : 'Monthly Nomad Deals'}
        </span>
        <h1 className="font-serif-display text-4xl font-semibold text-[#17221E]">
          {isVi
            ? 'Ở trọn 1 tháng tại Việt Nam — Xếp hạng theo mức tiết kiệm cao nhất'
            : 'Month-long Vietnam bases — Biggest savings first'}
        </h1>
        <p className="text-sm text-[#53635D]">
          {isVi
            ? 'Mọi chỗ ở đều hiển thị sẵn tổng giá trọn gói đã bao gồm thuế phí và Wi-Fi kiểm định tốc độ.'
            : 'Every stay below has open 30-night inventory with all-inclusive totals and tested Wi-Fi speeds.'}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {dealStays.map((s) => (
          <StayCard
            key={s.id}
            stay={s}
            initialSaved={savedIds.has(s.id)}
            isAuthenticated={Boolean(user)}
          />
        ))}
      </div>
    </div>
  );
}
