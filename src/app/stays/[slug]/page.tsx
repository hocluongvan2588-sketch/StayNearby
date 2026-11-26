import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Laptop,
  MapPin,
  MessageCircle,
  Monitor,
  Shield,
  ShieldCheck,
  Star,
  Utensils,
  Wifi,
} from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/session';
import { getConfig } from '@/lib/config';
import { addDaysIso, getTodayIsoVietnam } from '@/lib/dates';
import { getServerPreferences } from '@/lib/preferences';
import {
  formatMoneyFromVnd,
  formatVerificationTierLabel,
  formatVndExact,
} from '@/lib/i18n';
import { formatPropertyTypeLabel, getStayDetailBySlug } from '@/modules/catalog';
import { buildConciergeWhatsappUrl } from '@/modules/notifications';
import { StayBookingWidget } from '@/components/StayBookingWidget';

export const dynamic = 'force-dynamic';

export default async function StayDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [stay, prefs, user] = await Promise.all([
    getStayDetailBySlug(slug),
    getServerPreferences(),
    getCurrentUser(),
  ]);

  if (!stay) notFound();
  const isVi = prefs.locale === 'vi';
  const defaultCheckIn = addDaysIso(getTodayIsoVietnam(), 7);
  const conciergeWhatsappUrl = buildConciergeWhatsappUrl({
    stayTitle: isVi ? stay.titleVi : stay.titleEn,
    checkIn: defaultCheckIn,
    nights: 30,
    locale: prefs.locale,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-xs text-[#53635D]">
        <div className="flex items-center gap-2">
          <Link href="/stays" className="inline-flex items-center gap-1 font-semibold text-[#164E3F] hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" />
            {isVi ? 'Danh sách chỗ ở' : 'All stays'}
          </Link>
          <span>/</span>
          <Link href={`/destinations/${stay.destinationSlug}`} className="hover:underline">
            {isVi ? stay.destinationNameVi : stay.destinationNameEn}
          </Link>
          <span>/</span>
          <span className="text-[#17221E]">{isVi ? stay.titleVi : stay.titleEn}</span>
        </div>
        <span className="rounded-full border border-[#E5DFD3] bg-white px-3 py-1 font-medium">
          {isVi ? 'Mã đăng ký:' : 'Listing ID:'} {stay.registrationCode}
        </span>
      </div>

      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-full bg-[#164E3F] px-3 py-1 text-white">
              {formatPropertyTypeLabel(stay.propertyType, prefs.locale)}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 ${
                stay.verificationTier === 'VIETNOMAD_CERTIFIED'
                  ? 'bg-[#E7F1EC] text-[#164E3F] border border-[#164E3F]/25'
                  : 'bg-[#FAF8F3] text-[#A67C2E] border border-[#A67C2E]/35'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {formatVerificationTierLabel(stay.verificationTier, prefs.locale)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FAF8F3] px-3 py-1 text-[#A67C2E] border border-[#E5DFD3]">
              <Star className="h-3.5 w-3.5" fill="#A67C2E" />
              {stay.googleRating.toFixed(1)} ({stay.googleReviewCount} {isVi ? 'đánh giá Google' : 'Google reviews'})
            </span>
          </div>
          <h1 className="font-serif-display mt-2 text-3xl font-semibold text-[#17221E] sm:text-5xl">
            {isVi ? stay.titleVi : stay.titleEn}
          </h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-[#53635D]">
            <MapPin className="h-4 w-4 text-[#C25E28]" />
            {isVi ? stay.neighborhoodVi : stay.neighborhoodEn}.{' '}
            {isVi ? 'Địa chỉ cụ thể mở khóa ngay sau khi giữ phòng.' : 'Exact address unlocks right after booking.'}
          </p>
        </div>
      </div>

      <div className="mb-10 grid gap-3 sm:grid-cols-12">
        <div className="overflow-hidden rounded-3xl bg-[#F2EDE3] sm:col-span-7">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={stay.heroImage}
            alt={isVi ? stay.titleVi : stay.titleEn}
            className="aspect-[4/3] h-full w-full object-cover"
          />
        </div>
        <div className="grid gap-3 sm:col-span-5">
          <div className="relative overflow-hidden rounded-3xl bg-[#F2EDE3]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={stay.workspacePhotoUrl}
              alt="Workspace Desk"
              className="aspect-[16/9] h-full w-full object-cover"
            />
            <span className="absolute bottom-3 left-3 rounded-full bg-[#164E3F]/90 px-3 py-1 text-xs font-semibold text-white">
              <Laptop className="mr-1 inline h-3.5 w-3.5" />
              {isVi ? 'Ảnh góc làm việc thực tế' : 'Workspace photo'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {stay.galleryImages.slice(0, 2).map((img, i) => (
              <div key={`${img}-${i}`} className="overflow-hidden rounded-2xl bg-[#F2EDE3]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt="Residence view" className="aspect-[4/3] h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-12">
        <div className="space-y-10 lg:col-span-7">
          <section className="rounded-3xl border border-[#164E3F]/25 bg-white p-6 lacquer-shadow">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E7F1EC] text-[#164E3F]">
                  <Wifi className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-serif-display text-xl font-semibold text-[#17221E]">
                    {isVi ? 'Tốc độ Internet đã kiểm tra' : 'Verified Wi-Fi Speed'}
                  </h2>
                  <p className="text-xs text-[#53635D]">{stay.wifiTesterNote}</p>
                </div>
              </div>
              <span className="rounded-full bg-[#E7F1EC] px-3 py-1 text-xs font-semibold text-[#164E3F]">
                {isVi ? 'Đo ngày' : 'Tested'} {stay.wifiTestedAt.slice(0, 10)}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-[#FAF8F3] p-4">
                <div className="text-xs text-[#53635D]">{isVi ? 'Tải xuống' : 'Download'}</div>
                <div className="font-serif-display text-2xl font-bold text-[#164E3F]">
                  {stay.wifiDownloadMbps} <span className="text-xs font-normal">Mbps</span>
                </div>
              </div>
              <div className="rounded-2xl bg-[#FAF8F3] p-4">
                <div className="text-xs text-[#53635D]">{isVi ? 'Tải lên' : 'Upload'}</div>
                <div className="font-serif-display text-2xl font-bold text-[#17221E]">
                  {stay.wifiUploadMbps} <span className="text-xs font-normal">Mbps</span>
                </div>
              </div>
              <div className="rounded-2xl bg-[#FAF8F3] p-4">
                <div className="text-xs text-[#53635D]">{isVi ? 'Độ trễ' : 'Jitter'}</div>
                <div className="font-serif-display text-2xl font-bold text-[#C25E28]">
                  {stay.wifiJitterMs} <span className="text-xs font-normal">ms</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#E5DFD3] pt-4 text-xs">
              <div className="text-[#53635D]">
                {isVi
                  ? `Cập nhật ${stay.verifiedAt.slice(0, 10)}. Hoàn 100% phí giữ chỗ nếu Wi-Fi không đạt.`
                  : `Checked ${stay.verifiedAt.slice(0, 10)}. Covered by 100% booking fee refund guarantee.`}
              </div>
              <div className="flex flex-wrap gap-2">
                {stay.speedtestProofUrl && (
                  <a
                    href={stay.speedtestProofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-[#164E3F]/25 bg-[#E7F1EC] px-3 py-1.5 font-semibold text-[#164E3F] hover:bg-[#d7eae0]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {isVi ? 'Xem chứng nhận Wi-Fi' : 'View Wi-Fi certificate'}
                  </a>
                )}
                {stay.workspaceVideoUrl && (
                  <a
                    href={stay.workspaceVideoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-1.5 font-semibold text-[#17221E] hover:bg-[#F2EDE3]"
                  >
                    <Laptop className="h-3.5 w-3.5 text-[#C25E28]" />
                    {isVi ? 'Xem chi tiết bàn làm việc' : 'View desk setup'}
                  </a>
                )}
              </div>
            </div>
          </section>

          {stay.businessModel === 'booking_flow' && (
            <section className="rounded-3xl border border-[#C25E28]/25 bg-[#FAF8F3] p-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="space-y-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-[#C25E28]">
                    {isVi ? 'Trả trước 12% giữ chỗ, phần thuê trả chủ nhà khi nhận phòng' : 'Pay 12% online today, pay rent at check-in'}
                  </div>
                  <h3 className="font-serif-display text-xl font-semibold text-[#17221E]">
                    {isVi
                      ? `Trả ${formatMoneyFromVnd(stay.monthFeeOnlineVnd, prefs.currency)} hôm nay, trả ${formatMoneyFromVnd(stay.monthPayAtCheckinVnd, prefs.currency)} cho chủ nhà khi nhận phòng`
                      : `Pay ${formatMoneyFromVnd(stay.monthFeeOnlineVnd, prefs.currency)} today, pay ${formatMoneyFromVnd(stay.monthPayAtCheckinVnd, prefs.currency)} to host at check-in`}
                  </h3>
                  <p className="text-xs text-[#53635D]">
                    {isVi
                      ? 'Bạn được kiểm tra phòng và tốc độ Wi-Fi thực tế trước khi thanh toán tiền thuê nhà cho chủ nhà.'
                      : 'Check the apartment and Wi-Fi speed in person before paying your rent to the host.'}
                  </p>
                </div>
                <a
                  href={conciergeWhatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-2.5 text-xs font-bold text-[#0F392E] shadow-sm transition hover:brightness-105"
                >
                  <MessageCircle className="h-4 w-4" />
                  {isVi ? 'Nhắn hỗ trợ qua WhatsApp' : 'Ask on WhatsApp'}
                </a>
              </div>
            </section>
          )}

          <section className="space-y-3">
            <h2 className="font-serif-display text-2xl font-semibold text-[#17221E]">
              {isVi ? 'Thông tin chỗ ở' : 'About this stay'}
            </h2>
            <p className="text-sm leading-relaxed text-[#53635D]">
              {isVi ? stay.descriptionVi : stay.descriptionEn}
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-medium border border-[#E5DFD3]">
                <Shield className="h-3.5 w-3.5 text-[#164E3F]" />
                {isVi ? 'Không gian riêng, không ở ghép' : 'Private space, no home-share'}
              </span>
              {stay.hasExternalMonitor && (
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#E7F1EC] px-3 py-1.5 text-xs font-semibold text-[#164E3F]">
                  <Monitor className="h-3.5 w-3.5" /> {isVi ? 'Có sẵn màn hình 4K' : '4K Monitor Included'}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-medium border border-[#E5DFD3]">
                <Utensils className="h-3.5 w-3.5 text-[#C25E28]" />
                {isVi
                  ? `${stay.kitchenType === 'full' ? 'Bếp riêng' : 'Bếp chung'}, ${stay.laundryType === 'in_unit' ? 'máy giặt riêng' : 'khu giặt chung'}`
                  : `${stay.kitchenType === 'full' ? 'Full kitchen' : 'Shared kitchen'}, ${stay.laundryType === 'in_unit' ? 'in-unit washer' : 'building laundry'}`}
              </span>
            </div>
          </section>

          <section className="rounded-3xl border border-[#E5DFD3] bg-white p-6">
            <h2 className="font-serif-display text-2xl font-semibold text-[#17221E]">
              {isVi ? 'Bàn ghế và tiện nghi làm việc' : 'Workspace & amenities'}
            </h2>
            <p className="mt-2 text-sm text-[#53635D]">
              {isVi ? stay.workspaceSummaryVi : stay.workspaceSummaryEn}
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {stay.amenities.map((a) => (
                <div key={a} className="flex items-center gap-2 text-sm text-[#17221E]">
                  <CheckCircle2 className="h-4 w-4 text-[#164E3F]" />
                  <span>{a}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-[#E5DFD3] bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-serif-display text-2xl font-semibold text-[#17221E]">
                {isVi ? 'Chỗ làm việc chung gần nhất' : 'Nearby coworking spaces'}
              </h2>
              <span className="text-xs text-[#53635D]">
                {isVi ? 'Trong bán kính 2.5 km' : 'Within 2.5 km'}
              </span>
            </div>

            {stay.nearbyCoworking.length === 0 ? (
              <p className="text-sm text-[#53635D]">
                {isVi
                  ? 'Đã có sẵn bàn làm việc riêng trong phòng.'
                  : 'Private desk setup included inside your unit.'}
              </p>
            ) : (
              <div className="space-y-3">
                {stay.nearbyCoworking.map((cw) => (
                  <div
                    key={cw.name}
                    className="flex flex-col justify-between gap-2 rounded-2xl border border-[#E5DFD3] bg-[#FAF8F3] p-4 sm:flex-row sm:items-center"
                  >
                    <div>
                      <div className="font-semibold text-[#17221E]">{cw.name}</div>
                      <div className="text-xs text-[#53635D]">
                        {isVi ? cw.noteVi : cw.noteEn}
                        {cw.hasCallBooth && (
                          <span className="ml-2 rounded bg-[#E7F1EC] px-1.5 py-0.5 text-[10px] font-semibold text-[#164E3F]">
                            {isVi ? 'Có phòng họp riêng' : 'Call booths'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs">
                      <div className="font-bold text-[#C25E28]">{cw.distanceKm} km</div>
                      <div className="text-[#53635D]">
                        {cw.dayPassVnd === 0
                          ? isVi
                            ? 'Miễn phí cho khách ở'
                            : 'Free for residents'
                          : `${formatVndExact(cw.dayPassVnd)} / ${isVi ? 'ngày' : 'day'}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="lg:col-span-5">
          <StayBookingWidget
            stay={stay}
            user={user}
            conciergeWhatsapp={getConfig().conciergeWhatsapp}
          />
        </div>
      </div>
    </div>
  );
}
