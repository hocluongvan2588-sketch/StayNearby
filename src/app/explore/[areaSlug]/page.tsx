import { notFound } from 'next/navigation';
import { generatePublicExploreQrSvg } from '@/lib/qr';
import {
  getExploreAreaDetail,
  listPublishedCoworkingForArea,
  listPublishedExploreAreas,
  listPublishedGuidesForArea,
  type LocalGuideBudgetTier,
  type LocalGuideCompanion,
  type LocalGuideDurationBucket,
  type LocalGuideTheme,
} from '@/modules/local-guides';
import { ExploreAreaClient } from '@/components/local-guides/ExploreAreaClient';

export const dynamic = 'force-dynamic';

function pickEnum<T extends string>(
  raw: string | string[] | undefined,
  allowed: readonly T[]
): T | undefined {
  const val = Array.isArray(raw) ? raw[0] : raw;
  if (val && (allowed as readonly string[]).includes(val)) {
    return val as T;
  }
  return undefined;
}

export default async function ExploreAreaPage({
  params,
  searchParams,
}: {
  params: Promise<{ areaSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ areaSlug }, sp] = await Promise.all([params, searchParams]);

  const area = await getExploreAreaDetail(areaSlug);
  if (!area) {
    notFound();
  }

  const initialFilters = {
    theme: pickEnum<LocalGuideTheme>(sp.theme, [
      'food',
      'culture',
      'leisure',
      'coworking',
    ]),
    durationBucket: pickEnum<LocalGuideDurationBucket>(sp.durationBucket, [
      '1_2_hours',
      'half_day',
    ]),
    budgetTier: pickEnum<LocalGuideBudgetTier>(sp.budgetTier, [
      'budget',
      'moderate',
      'splurge',
    ]),
    companion: pickEnum<LocalGuideCompanion>(sp.companion, ['solo', 'group']),
  };

  const [areas, guides, nearbyCoworking, qr] = await Promise.all([
    listPublishedExploreAreas(),
    listPublishedGuidesForArea(area.slug, initialFilters),
    listPublishedCoworkingForArea(area.slug),
    generatePublicExploreQrSvg(area.slug),
  ]);

  return (
    <ExploreAreaClient
      area={area}
      areas={areas}
      initialGuides={guides}
      nearbyCoworking={nearbyCoworking}
      initialFilters={initialFilters}
      qrPath={qr.targetPath}
      qrSvg={qr.svg}
    />
  );
}
