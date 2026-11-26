import { getCurrentUser } from '@/lib/auth/session';
import { addDaysIso, getTodayIsoVietnam } from '@/lib/dates';
import { dbQuery } from '@/lib/db';
import { getDestinations, getLifestyles, searchStays } from '@/modules/catalog';
import { SearchStaysClient } from '@/components/SearchStaysClient';

export const dynamic = 'force-dynamic';

export default async function StaysPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const pick = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? '';

  const destination = pick('destination') || 'all';
  const lifestyle = pick('lifestyle') || 'all';
  const checkIn = pick('checkIn') || addDaysIso(getTodayIsoVietnam(), 7);
  const nights = Math.max(7, Number(pick('nights') || '30') || 30);
  const minWifi = pick('minWifi');
  const wifiVerified = pick('wifiVerified') === '1';
  const workReady = pick('workReady') === '1';
  const workspace = pick('workspace') === '1';
  const chair = pick('chair') === '1';
  const monitor = pick('monitor') === '1';
  const booth = pick('booth') === '1';
  const kitchen = pick('kitchen') === '1';
  const laundry = pick('laundry') === '1';
  const pet = pick('pet') === '1';
  const sort = (pick('sort') || 'featured') as 'featured' | 'wifi_desc' | 'price_asc' | 'savings_desc' | 'rating_desc';

  const [user, destinations, lifestyles, stays] = await Promise.all([
    getCurrentUser(),
    getDestinations(),
    getLifestyles(),
    searchStays({
      destination,
      lifestyle,
      checkIn,
      nights,
      minWifiMbps: minWifi ? Number(minWifi) : undefined,
      wifiVerifiedOnly: wifiVerified,
      workReadyOnly: workReady,
      hasWorkspace: workspace,
      hasErgonomicChair: chair,
      hasMonitor: monitor,
      hasCallBooth: booth,
      fullKitchen: kitchen,
      inUnitLaundry: laundry,
      petFriendly: pet,
      sort,
    }),
  ]);

  let savedIds: string[] = [];
  if (user) {
    const sv = await dbQuery<{ stay_id: string }>(
      'SELECT stay_id FROM saved_stays WHERE user_id = $1',
      [user.id]
    );
    savedIds = sv.rows.map((r) => r.stay_id);
  }

  return (
    <SearchStaysClient
      stays={stays}
      destinations={destinations}
      lifestyles={lifestyles}
      filters={{
        destination,
        lifestyle,
        checkIn,
        nights,
        minWifi,
        wifiVerified,
        workReady,
        workspace,
        chair,
        monitor,
        booth,
        kitchen,
        laundry,
        pet,
        sort,
      }}
      savedIds={savedIds}
      isAuthenticated={Boolean(user)}
    />
  );
}
