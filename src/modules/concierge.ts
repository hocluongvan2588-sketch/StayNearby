import { formatMoneyFromVnd, type CurrencyCode, type Locale } from '@/lib/i18n';
import { usdToVnd } from '@/lib/i18n';
import { buildConciergeWhatsappUrl } from './notifications';
import { searchStays, type StayCardItem } from './catalog';

export interface ConciergeResponse {
  summary: string;
  conciergeWhatsappUrl: string;
  extractedFilters: {
    destination?: string;
    lifestyle?: string;
    minWifiMbps?: number;
    maxMonthlyVnd?: number;
    nights: number;
  };
  matches: (StayCardItem & { conciergeWhatsappUrl: string })[];
}

export async function runAiStayConcierge(params: {
  prompt: string;
  locale: Locale;
  currency: CurrencyCode;
}): Promise<ConciergeResponse> {
  const q = params.prompt.toLowerCase();

  let destination: string | undefined;
  if (q.includes('da nang') || q.includes('đà nẵng') || q.includes('my khe') || q.includes('an thuong')) {
    destination = 'da-nang';
  } else if (q.includes('hanoi') || q.includes('hà nội') || q.includes('tay ho') || q.includes('tây hồ')) {
    destination = 'hanoi';
  } else if (q.includes('hoi an') || q.includes('hội an') || q.includes('cam chau')) {
    destination = 'hoi-an';
  } else if (
    q.includes('saigon') ||
    q.includes('sài gòn') ||
    q.includes('ho chi minh') ||
    q.includes('hồ chí minh') ||
    q.includes('thao dien')
  ) {
    destination = 'ho-chi-minh-city';
  } else if (q.includes('da lat') || q.includes('đà lạt') || q.includes('pine') || q.includes('rừng thông')) {
    destination = 'da-lat';
  } else if (q.includes('phu quoc') || q.includes('phú quốc') || q.includes('island') || q.includes('đảo')) {
    destination = 'phu-quoc';
  }

  let lifestyle: string | undefined;
  if (q.includes('beach') || q.includes('biển') || q.includes('surf')) lifestyle = 'beach-surf';
  else if (q.includes('mountain') || q.includes('quiet') || q.includes('yên tĩnh') || q.includes('deep work'))
    lifestyle = destination ? undefined : 'mountain-mist';
  else if (q.includes('coliving') || q.includes('founder') || q.includes('community'))
    lifestyle = 'coliving-founders';
  else if (q.includes('heritage') || q.includes('slow') || q.includes('sống chậm'))
    lifestyle = 'heritage-slow';

  const wifiMatch = q.match(/(\d{2,4})\s*\+?\s*mbps/);
  const minWifiMbps = wifiMatch ? Number(wifiMatch[1]) : q.includes('fast wi') || q.includes('mạnh') ? 250 : undefined;

  const usdMatch = q.match(/(?:under|below|max|dưới|<|\$)\s*\$?\s*(\d{3,4})/);
  const maxMonthlyVnd = usdMatch ? usdToVnd(Number(usdMatch[1])) : undefined;

  const nights = q.includes('week') || q.includes('tuần') ? (q.includes('2') ? 14 : 7) : 30;

  let matches = await searchStays({
    destination,
    lifestyle,
    minWifiMbps,
    maxMonthlyVnd,
    nights,
    hasMonitor: q.includes('monitor') || q.includes('màn hình'),
    petFriendly: q.includes('pet') || q.includes('thú cưng'),
    sort: maxMonthlyVnd ? 'price_asc' : 'wifi_desc',
  });

  // Fallback softly to closest stays if exact strict combination yields 0
  let relaxed = false;
  if (matches.length === 0) {
    relaxed = true;
    matches = await searchStays({
      destination,
      sort: 'wifi_desc',
    });
  }
  if (matches.length === 0) {
    matches = await searchStays({ sort: 'wifi_desc' });
  }

  const top = matches.slice(0, 3).map((stay) => ({
    ...stay,
    conciergeWhatsappUrl: buildConciergeWhatsappUrl({
      stayTitle: params.locale === 'vi' ? stay.titleVi : stay.titleEn,
      nights,
      locale: params.locale,
    }),
  }));

  const conciergeWhatsappUrl = buildConciergeWhatsappUrl({
    stayTitle: top[0]
      ? params.locale === 'vi'
        ? top[0].titleVi
        : top[0].titleEn
      : 'Vietnam long-stay apartments & villas',
    nights,
    locale: params.locale,
  });

  const summary =
    params.locale === 'vi'
      ? top.length > 0
        ? `${relaxed ? 'Gợi ý gần nhất với yêu cầu của bạn:' : 'Tìm thấy'} ${top.length} chỗ ở phù hợp. Nổi bật là ${top[0].titleVi} tại ${top[0].destinationNameVi} (Wi-Fi ${top[0].wifiDownloadMbps} Mbps, đặt cọc ${formatMoneyFromVnd(top[0].monthFeeOnlineVnd, params.currency)} hôm nay và trả ${formatMoneyFromVnd(top[0].monthPayAtCheckinVnd, params.currency)} cho chủ nhà khi nhận phòng).`
        : 'Hiện chưa có chỗ ở phù hợp mô tả đó.'
      : top.length > 0
        ? `${relaxed ? 'Closest matches:' : 'Found'} ${top.length} available stays. Top match is ${top[0].titleEn} in ${top[0].destinationNameEn} (${top[0].wifiDownloadMbps} Mbps Wi-Fi, pay ${formatMoneyFromVnd(top[0].monthFeeOnlineVnd, params.currency)} today to reserve and ${formatMoneyFromVnd(top[0].monthPayAtCheckinVnd, params.currency)} to host at check-in).`
        : 'No matching stays are currently available.';

  return {
    summary,
    conciergeWhatsappUrl,
    extractedFilters: {
      destination,
      lifestyle,
      minWifiMbps,
      maxMonthlyVnd,
      nights,
    },
    matches: top,
  };
}
