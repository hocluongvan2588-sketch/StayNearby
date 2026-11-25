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
        setError(json.error?.message ?? 'Submission failed.');
      } else {
        setSubmittedId(json.applicationId);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-14 px-4 py-12 sm:px-6 lg:px-8">
      {/* Hero */}
      <div className="grid gap-8 rounded-3xl border border-[#E5DFD3] bg-[#0F392E] p-8 text-[#FAF8F3] lg:grid-cols-12 lg:items-center lacquer-shadow">
        <div className="space-y-4 lg:col-span-7">
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-[#E6B87A]">
            {isVi ? 'Trung bình 28.3 đêm mỗi đơn đặt' : '28.3 nights average booking · Zero home-shares'}
          </span>
          <h1 className="font-serif-display text-4xl font-semibold leading-tight sm:text-5xl">
            {isVi
              ? 'Đón khách quốc tế ở theo tuần & tháng với 0% hoa hồng Chủ nhà'
              : 'Reach remote workers staying weeks or months — with BookingFlow or StayDirect™'}
          </h1>
          <p className="text-sm text-[#DCECE5]">
            {isVi
              ? 'Phí duyệt hồ sơ một lần €39. Sau khi được duyệt, bạn quản lý toàn bộ gói 7/14/21/30 đêm và tốc độ Wi-Fi ngay trên Cổng Chủ nhà.'
              : 'One-time €39 application fee. Choose full agent automation (BookingFlow 0% commission) or direct traffic referrals (StayDirect™ 1% ad wallet).'}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-5">
          <div className="rounded-2xl bg-white/10 p-4">
            <Zap className="mb-2 h-5 w-5 text-[#E6B87A]" />
            <div className="font-semibold">BookingFlow (0% Commission)</div>
            <p className="mt-1 text-xs text-[#CDE0D9]">
              {isVi
                ? 'Bạn nhập giá Wholesale Net; VietNomad xử lý Instant Booking và thanh toán cho khách.'
                : 'Submit wholesale net rates; travelers pay our transparent 12% service fee.'}
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <Wallet className="mb-2 h-5 w-5 text-[#E6B87A]" />
            <div className="font-semibold">StayDirect™ (1% Referral)</div>
            <p className="mt-1 text-xs text-[#CDE0D9]">
              {isVi
                ? 'Chuyển khách đặt trực tiếp trên hệ thống của bạn; trừ 1% từ ví nạp sẵn ($50/$100/$200).'
                : 'Send logged-in nomads to your booking URL at retail rates; 1% deducted from ad wallet.'}
            </p>
          </div>
        </div>
      </div>

      {/* Onboarding Application Form */}
      <div className="grid gap-8 lg:grid-cols-12">
        <div className="space-y-5 rounded-3xl border border-[#E5DFD3] bg-white p-7 lg:col-span-5 h-fit">
          <h2 className="font-serif-display text-2xl font-semibold text-[#17221E]">
            {isVi ? 'Tiêu chuẩn bắt buộc kiểu NomadStays' : 'Eligibility & Baseline Checklist'}
          </h2>
          <ul className="space-y-3 text-sm text-[#53635D]">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#164E3F]" />
              <span>
                {isVi
                  ? 'Không gian riêng tư hoàn toàn (căn hộ, villa, phòng coliving/khách sạn boutique) — không nhận ở ghép phòng trong nhà dân.'
                  : 'Self-contained living spaces only (apartments, villas, coliving, boutique hotels) — no spare-room home-shares.'}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#164E3F]" />
              <span>
                {isVi
                  ? 'Bắt buộc có bàn ghế làm việc, bếp nấu và giặt ủi.'
                  : 'Mandatory dedicated workspace, kitchen facilities, and laundry.'}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#164E3F]" />
              <span>
                {isVi
                  ? 'Lịch trống theo thời gian thực để xác nhận ngay (Instant Booking), tối thiểu 7 đêm.'
                  : 'Live availability supporting 7, 14, 21, and 30-night packages — no slow request-only hosts.'}
              </span>
            </li>
          </ul>
          <div className="rounded-2xl bg-[#FAF8F3] p-4 text-xs text-[#53635D]">
            <ShieldCheck className="mr-1 inline h-4 w-4 text-[#164E3F]" />
            {isVi
              ? 'Sau khi nộp đơn tại đây, tài khoản Admin (`admin@vietnomad.demo`) có thể duyệt ngay để xuất bản chỗ ở lên trang chủ!'
              : 'After submitting here, sign in as Admin (`admin@vietnomad.demo`) to approve and publish your new stay live immediately.'}
          </div>
        </div>

        <div className="rounded-3xl border border-[#E5DFD3] bg-white p-7 lg:col-span-7 lacquer-shadow">
          {submittedId ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-bold text-[#164E3F]">
                <CheckCircle2 className="h-6 w-6" />
                {isVi ? 'Đã nộp đơn đăng ký đối tác (€39 Fee Settled)!' : 'Stay Application Submitted (€39 Fee Settled)!'}
              </div>
              <p className="text-sm text-[#53635D]">
                Application ID: <span className="font-mono font-semibold text-[#17221E]">{submittedId}</span>
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/host" className="rounded-xl bg-[#164E3F] px-5 py-2.5 text-sm font-semibold text-white">
                  {isVi ? 'Mở Cổng Chủ nhà →' : 'Go to Host Console →'}
                </Link>
                <Link href="/admin" className="rounded-xl border border-[#E5DFD3] px-5 py-2.5 text-sm font-semibold text-[#17221E]">
                  {isVi ? 'Duyệt tại Admin Queue →' : 'Review in Admin Queue →'}
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="font-serif-display text-2xl font-semibold text-[#17221E]">
                {isVi ? 'Nộp đơn đăng ký chỗ ở mới' : 'Begin Stay Application (€39 one-time)'}
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                    {isVi ? 'Tên doanh nghiệp / Chủ sở hữu' : 'Legal Business / Host Name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Indochine Living Co."
                    className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                    {isVi ? 'Tên chỗ ở hiển thị' : 'Stay Property Name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={stayName}
                    onChange={(e) => setStayName(e.target.value)}
                    placeholder="e.g. My An Bamboo Work Suites"
                    className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3.5 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                    {isVi ? 'Thành phố' : 'Destination'}
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
                    {isVi ? 'Loại hình' : 'Property Type'}
                  </label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value as typeof propertyType)}
                    className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2.5 text-sm font-medium"
                  >
                    <option value="apartment">Apartment</option>
                    <option value="coliving">Coliving</option>
                    <option value="boutique_hotel">Boutique Hotel</option>
                    <option value="villa">Villa</option>
                    <option value="eco_lodge">Eco Lodge</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                    {isVi ? 'Wi-Fi đo được (Mbps)' : 'Measured Wi-Fi (Mbps)'}
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
                  <div className="text-sm font-bold text-[#164E3F]">BookingFlow (0% Commission)</div>
                  <div className="mt-1 text-xs text-[#53635D]">
                    {isVi ? 'VietNomad nhận đặt & thanh toán tức thì.' : 'Managed instant bookings & payments.'}
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
                  <div className="text-sm font-bold text-[#C25E28]">StayDirect™ (1% Referral)</div>
                  <div className="mt-1 text-xs text-[#53635D]">
                    {isVi ? 'Dẫn khách trực tiếp về website của bạn.' : 'Direct referrals to your own booking link.'}
                  </div>
                </button>
              </div>

              {businessModel === 'stay_direct' && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                    Direct Booking HTTPS URL
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
                  {isVi ? 'Có bàn & ghế làm việc' : 'Dedicated Workspace'}
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={hasKitchen} onChange={(e) => setHasKitchen(e.target.checked)} className="accent-[#164E3F]" />
                  {isVi ? 'Có bếp nấu' : 'Kitchen Included'}
                </label>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={hasLaundry} onChange={(e) => setHasLaundry(e.target.checked)} className="accent-[#164E3F]" />
                  {isVi ? 'Có máy giặt / giặt ủi' : 'Laundry Available'}
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
                    ? 'Thanh toán €39 & Nộp hồ sơ (Demo)'
                    : 'Settle €39 Fee & Submit Stay Application'
                  : isVi
                    ? 'Đăng nhập để nộp hồ sơ đối tác'
                    : 'Log In to Submit Stay Application'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
