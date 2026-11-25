import { errJson, okJson } from '@/lib/http';
import { searchStays } from '@/modules/catalog';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const stays = await searchStays({
      destination: searchParams.get('destination') ?? undefined,
      lifestyle: searchParams.get('lifestyle') ?? undefined,
      checkIn: searchParams.get('checkIn') ?? undefined,
      nights: searchParams.get('nights') ? Number(searchParams.get('nights')) : undefined,
      minWifiMbps: searchParams.get('minWifi') ? Number(searchParams.get('minWifi')) : undefined,
      businessModel: (searchParams.get('model') as 'booking_flow' | 'stay_direct' | 'all') ?? 'all',
      hasMonitor: searchParams.get('monitor') === '1',
      hasCallBooth: searchParams.get('booth') === '1',
      fullKitchen: searchParams.get('kitchen') === '1',
      inUnitLaundry: searchParams.get('laundry') === '1',
      petFriendly: searchParams.get('pet') === '1',
      sort: (searchParams.get('sort') as 'wifi_desc' | 'price_asc' | 'savings_desc' | 'rating_desc') ?? 'wifi_desc',
    });
    return okJson({ stays });
  } catch (err) {
    return errJson(err);
  }
}
