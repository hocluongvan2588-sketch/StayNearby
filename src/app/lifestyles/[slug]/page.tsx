import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';
import { getServerPreferences } from '@/lib/preferences';
import { getLifestyles, searchStays } from '@/modules/catalog';
import { PaginatedStayGrid } from '@/components/PaginatedStayGrid';

export const dynamic = 'force-dynamic';

export default async function LifestyleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [prefs, user, lifestyles, stays] = await Promise.all([
    getServerPreferences(),
    getCurrentUser(),
    getLifestyles(),
    searchStays({ lifestyle: slug }),
  ]);

  const lifestyle = lifestyles.find((l) => l.slug === slug);
  if (!lifestyle) notFound();
  const isVi = prefs.locale === 'vi';

  let savedIds: string[] = [];
  if (user) {
    const sv = await dbQuery<{ stay_id: string }>(
      'SELECT stay_id FROM saved_stays WHERE user_id = $1',
      [user.id]
    );
    savedIds = sv.rows.map((r) => r.stay_id);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/stays"
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-[#164E3F] hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {isVi ? 'Xem tất cả chỗ ở' : 'Browse all stays'}
      </Link>

      <div className="mb-10 overflow-hidden rounded-2xl bg-[#0F392E] text-white">
        <div className="grid items-center gap-6 md:grid-cols-12">
          <div className="space-y-3 p-8 md:col-span-7">
            <span className="text-xs font-semibold text-[#E6B87A]">
              {isVi ? 'Phong cách lưu trú' : 'Stay style'}
            </span>
            <h1 className="font-serif-display text-3xl font-semibold sm:text-4xl">
              {isVi ? lifestyle.nameVi : lifestyle.nameEn}
            </h1>
            <p className="text-sm leading-relaxed text-[#DCECE5]">
              {isVi ? lifestyle.descriptionVi : lifestyle.descriptionEn}
            </p>
          </div>
          <div className="md:col-span-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lifestyle.heroImage}
              alt={isVi ? lifestyle.nameVi : lifestyle.nameEn}
              className="aspect-[4/3] h-full w-full object-cover"
            />
          </div>
        </div>
      </div>

      <PaginatedStayGrid
        stays={stays}
        savedIds={savedIds}
        isAuthenticated={Boolean(user)}
      />
    </div>
  );
}
