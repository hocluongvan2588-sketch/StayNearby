'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck, Wallet, Zap } from 'lucide-react';
import type { SessionUser } from '@/lib/auth/session';
import type { DestinationSummary } from '@/modules/catalog';
import { usePreferences } from './PreferencesProvider';

export function ListYourStayClient({
  user,
  destinations,
}: {
  user: SessionUser | null;
  destinations: DestinationSummary[];
}) {
  const { locale } = usePreferences();
  const isVi = locale === 'vi';

  const [businessName, setBusinessName] = useState('');
  const [stayName, setStayName] = useState('');
  const [destinationSlug, setDestinationSlug] = useState(destinations[0]?.slug ?? 'da-nang');
  const [propertyType, setPropertyType] = useState<'apartment' | 'coliving' | 'boutique_hotel' | 'villa' | 'eco_lodge'>('apartment');
  const [businessModel, setBusinessModel] = useState<'booking_flow' | 'stay_direct'>('booking_flow');
  const [measuredDownloadMbps, setMeasuredDownloadMbps] = useState(250);
  const [directBookingUrl, setDirectBookingUrl] = useState('');
  const [hasKitchen, setHasKitchen] = useState(true);
  const [hasLaundry, setHasLaundry] = useState(true);
  const [hasWorkspace, setHasWorkspace] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submittedId, setSubmittedId] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      window.location.assign('/login?next=/list-your-stay');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/host/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          stayName,
          destinationSlug,
          propertyType,
          businessModel,
          measuredDownloadMbps: Number(measuredDownloadMbps),
          hasKitchen,
          hasLaundry,
          hasWorkspace,
          directBookingUrl: businessModel === 'stay_direct' ? directBookingUrl : undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error?.message ?? (isVi ? 'Không thể gửi duyệt hồ sơ.' : 'Submission failed.'));
      } else {
        setSubmittedId(json.applicationId);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-14 px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid gap-8 rounded-3xl border border-[#E5DFD3] bg-[#0F392E] p-8 text-[#FAF8F3] lg:grid-cols-12 lg:items-center lacquer-shadow">
        <div className="space-y-4 lg:col-span-7">
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-[#E6B87A]">
            {isVi ? 'Trung bình 28 đêm mỗi đơn, chỉ nhận chỗ ở riêng tư' : '28 nights average booking, private spaces only'}
          </span>
          <h1 className="font-serif-display text-4xl font-semibold leading-tight sm:text-5xl">
            {isVi
              ? 'Đón khách thuê theo tuần và tháng, nhận đủ 100% tiền nhà.'
              : 'Welcome guests staying weeks or months, with 0% host commission.'}
          </h1>
          <p className="text-sm text-[#DCECE5]">
            {isVi
              ? 'Phí kiểm duyệt một lần là 39 EUR. Sau khi được duyệt, bạn chủ động đặt giá theo gói 7, 14, 21, 30 đêm và cập nhật tốc độ Wi-Fi.'
              : 'One-time €39 verification fee. Once approved, set your weekly and monthly rates and manage bookings in your Host Portal.'}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-5">
          <div className="rounded-2xl bg-white/10 p-4">
            <Zap className="mb-2 h-5 w-5 text-[#E6B87A]" />
            <div className="font-semibold">{isVi ? 'Đặt qua VietNomad (0% hoa hồng)' : 'Book on VietNomad (0% commission)'}</div>
            <p className="mt-1 text-xs text-[#CDE0D9]">
              {isVi
                ? 'Khách đóng 12% phí giữ chỗ online và trả 100% tiền thuê trực tiếp cho bạn khi nhận phòng. Hỗ trợ đồng bộ lịch từ Airbnb và Booking.com.'
                : 'Guests pay a 12% fee online and pay 100% of your rent at check-in. Syncs automatically with Airbnb and Booking.com.'}
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <Wallet className="mb-2 h-5 w-5 text-[#E6B87A]" />
            <div className="font-semibold">{isVi ? 'Đặt trực tiếp chủ nhà (phí 1%)' : 'Direct Booking (1% referral fee)'}</div>
            <p className="mt-1 text-xs text-[#CDE0D9]">
              {isVi
                ? 'Chuyển khách sang đặt trực tiếp trên website riêng của bạn, phí giới thiệu 1% trừ vào ví quảng cáo.'
                : 'Send guests straight to your own website. A 1% referral fee is deducted from your ad balance.'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="space-y-5 rounded-3xl border border-[#E5DFD3] bg-white p-7 lg:col-span-5 h-fit">
          <h2 className="font-serif-display text-2xl font-semibold text-[#17221E]">
            {isVi ? 'Điều kiện để được duyệt' : 'Requirements to list'}
          </h2>
          <ul className="space-y-3 text-sm text-[#53635D]">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#164E3F]" />
              <span>
                {isVi
                  ? 'Không gian riêng khép kín (căn hộ, biệt thự, phòng coliving hoặc khách sạn). Không nhận phòng ghép ở chung nhà.'
                  : 'Private self-contained spaces only (apartments, villas, coliving, boutique hotels). No shared spare rooms.'}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#164E3F]" />
              <span>
                {isVi
                  ? 'Có bàn ghế làm việc riêng, bếp nấu ăn và máy giặt.'
                  : 'Must include a dedicated desk, kitchen facilities, and laundry.'}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#164E3F]" />
              <span>
                {isVi
                  ? 'Lịch phòng cập nhật liên tục cho các gói từ 7 đến 30 đêm.'
                  : 'Live calendar supporting 7, 14, 21, and 30-night stays.'}
              </span>
            </li>
          </ul>
          <div className="rounded-2xl bg-[#FAF8F3] p-4 text-xs text-[#53635D]">
            <ShieldCheck className="mr-1 inline h-4 w-4 text-[#164E3F]" />
            {isVi
              ? 'Sau khi bạn bấm Gửi duyệt, quản trị viên sẽ kiểm tra tốc độ Wi-Fi và đưa chỗ ở lên trang chủ.'
              : 'After you submit for review, an admin verifies your Wi-Fi speed and publishes your stay.'}
          </div>
        </div>

        <div className="rounded-3xl border border-[#E5DFD3] bg-white p-7 lg:col-span-7 lacquer-shadow">
          {submittedId ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-bold text-[#164E3F]">
                <CheckCircle2 className="h-6 w-6" />
                {isVi ? 'Đã gửi duyệt chỗ ở mới!' : 'Submitted for review!'}
              </div>
              <p className="text-sm text-[#53635D]">
                {isVi ? 'Mã hồ sơ:' : 'Application ID:'}{' '}
                <span className="font-mono font-semibold text-[#17221E]">{submittedId}</span>
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/host" className="rounded-xl bg-[#164E3F] px-5 py-2.5 text-sm font-semibold text-white">
                  {isVi ? 'Mở trang quản lý nhà' : 'Open Host Portal'}
                </Link>
                <Link href="/admin" className="rounded-xl border border-[#E5DFD3] px-5 py-2.5 text-sm font-semibold text-[#17221E]">
                  {isVi ? 'Xem hàng đợi duyệt' : 'View review queue'}
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="font-serif-display text-2xl font-semibold text-[#17221E]">
                {isVi ? 'Điền thông tin chỗ ở để gửi duyệt (phí 39 EUR)' : 'Submit your property for review (€39 one-time fee)'}
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                    {isVi ? 'Tên chủ nhà hoặc công ty' : 'Owner or business name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Indochine Living Co."
                    className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                    {isVi ? 'Tên chỗ ở' : 'Property name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={stayName}
                    onChange={(e) => setStayName(e.target.value)}
                    placeholder="My An Work Suites"
                    className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3.5 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                    {isVi ? 'Thành phố' : 'City'}
                  </label>
                  <select
                    value={destinationSlug}
                    onChange={(e) => setDestinationSlug(e.target.value)}
                    className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2.5 text-sm font-medium"
                  >
                    {destinations.map((d) => (
                      <option key={d.id} value={d.slug}>
                        {isVi ? d.nameVi : d.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                    {isVi ? 'Loại hình' : 'Property type'}
                  </label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value as typeof propertyType)}
                    className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2.5 text-sm font-medium"
                  >
                    <option value="apartment">{isVi ? 'Căn hộ dịch vụ' : 'Apartment'}</option>
                    <option value="coliving">{isVi ? 'Nhà ở chung (Coliving)' : 'Coliving'}</option>
                    <option value="boutique_hotel">{isVi ? 'Khách sạn nhỏ' : 'Boutique Hotel'}</option>
                    <option value="villa">{isVi ? 'Biệt thự riêng' : 'Villa'}</option>
                    <option value="eco_lodge">{isVi ? 'Nhà gỗ nghỉ dưỡng' : 'Nature Lodge'}</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                    {isVi ? 'Tốc độ Wi-Fi đo được (Mbps)' : 'Tested Wi-Fi speed (Mbps)'}
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={2000}
                    value={measuredDownloadMbps}
                    onChange={(e) => setMeasuredDownloadMbps(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2.5 text-sm font-semibold"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setBusinessModel('booking_flow')}
                  className={`rounded-2xl border p-4 text-left transition ${
                    businessModel === 'booking_flow'
                      ? 'border-[#164E3F] bg-[#E7F1EC]'
                      : 'border-[#E5DFD3] bg-[#FAF8F3]'
                  }`}
                >
                  <div className="text-sm font-bold text-[#164E3F]">
                    {isVi ? 'Đặt qua VietNomad (0% hoa hồng)' : 'Book on VietNomad (0% commission)'}
                  </div>
                  <div className="mt-1 text-xs text-[#53635D]">
                    {isVi ? 'Khách đóng 12% giữ chỗ và trả tiền nhà cho bạn khi đến.' : 'Guests pay 12% online and pay you rent at check-in.'}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setBusinessModel('stay_direct')}
                  className={`rounded-2xl border p-4 text-left transition ${
                    businessModel === 'stay_direct'
                      ? 'border-[#C25E28] bg-[#FAEDE5]'
                      : 'border-[#E5DFD3] bg-[#FAF8F3]'
                  }`}
                >
                  <div className="text-sm font-bold text-[#C25E28]">
                    {isVi ? 'Đặt trực tiếp chủ nhà (phí 1%)' : 'Direct Booking (1% referral fee)'}
                  </div>
                  <div className="mt-1 text-xs text-[#53635D]">
                    {isVi ? 'Chuyển khách sang đặt phòng trên website của bạn.' : 'Send guests directly to your own booking link.'}
                  </div>
                </button>
              </div>

              {businessModel === 'stay_direct' && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                    {isVi ? 'Đường dẫn website đặt phòng (HTTPS)' : 'Direct booking URL (HTTPS)'}
                  </label>
                  <input
                    type="url"
                    required
                    value={directBookingUrl}
                    onChange={(e) => setDirectBookingUrl(e.target.value)}
                    placeholder="https://yourproperty.vn/book"
                    className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3.5 py-2.5 text-sm"
                  />
                </div>
              )}

              <div className="flex flex-wrap gap-4 pt-1 text-xs font-medium">
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={hasWorkspace} onChange={(e) => setHasWorkspace(e.target.checked)} className="accent-[#164E3F]" />
                  {isVi ? 'Có bàn ghế làm việc' : 'Dedicated desk'}
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={hasKitchen} onChange={(e) => setHasKitchen(e.target.checked)} className="accent-[#164E3F]" />
                  {isVi ? 'Có bếp nấu' : 'Kitchen'}
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={hasLaundry} onChange={(e) => setHasLaundry(e.target.checked)} className="accent-[#164E3F]" />
                  {isVi ? 'Có máy giặt' : 'Laundry'}
                </label>
              </div>

              {error && (
                <div className="rounded-xl bg-[#FAEDE5] p-3 text-xs font-medium text-[#C25E28]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#164E3F] px-5 py-3.5 text-sm font-semibold text-white hover:bg-[#0F392E]"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {user
                  ? isVi
                    ? 'Thanh toán €39 và Gửi duyệt'
                    : 'Pay €39 and Submit for review'
                  : isVi
                    ? 'Đăng nhập để Gửi duyệt'
                    : 'Log in to Submit for review'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
