'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import type { SessionUser } from '@/lib/auth/session';
import { localizeGuestError } from '@/lib/error-copy';
import type { DestinationSummary } from '@/modules/catalog';
import { usePreferences } from './PreferencesProvider';

export function ListYourStayClient({
  user,
  destinations,
}: {
  user: SessionUser | null;
  destinations: DestinationSummary[];
}) {
  const { locale, hostCommissionPct } = usePreferences();
  const isVi = locale === 'vi';

  const [businessName, setBusinessName] = useState('');
  const [stayName, setStayName] = useState('');
  const [destinationSlug, setDestinationSlug] = useState(destinations[0]?.slug ?? 'da-nang');
  const [propertyType, setPropertyType] = useState<'apartment' | 'coliving' | 'boutique_hotel' | 'villa' | 'eco_lodge'>('apartment');
  const [measuredDownloadMbps, setMeasuredDownloadMbps] = useState(150);
  const [hasWorkspace, setHasWorkspace] = useState(true);
  const [hasErgonomicChair, setHasErgonomicChair] = useState(false);
  const [hasExternalMonitor, setHasExternalMonitor] = useState(false);
  const [kitchenType, setKitchenType] = useState<'full' | 'kitchenette' | 'shared' | 'none'>('full');
  const [laundryType, setLaundryType] = useState<'in_unit' | 'building' | 'service' | 'none'>('in_unit');
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
      const params = new URLSearchParams(window.location.search);
      const utmSource = params.get('utm_source') || undefined;
      const utmCampaign = params.get('utm_campaign') || undefined;
      const sourceDetail = params.get('ref') || 'list_your_stay_web';

      const res = await fetch('/api/host/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          stayName,
          destinationSlug,
          propertyType,
          measuredDownloadMbps: Math.max(0, Number(measuredDownloadMbps) || 0),
          hasWorkspace,
          hasErgonomicChair,
          hasExternalMonitor,
          kitchenType,
          laundryType,
          hasKitchen: kitchenType !== 'none',
          hasLaundry: laundryType !== 'none',
          sourceDetail,
          utmSource,
          utmCampaign,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(localizeGuestError(json.error?.message, locale));
      } else {
        setSubmittedId(json.applicationId);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-12 px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid gap-8 rounded-2xl border border-[#E5DFD3] bg-[#0F392E] p-8 text-[#FAF8F3] lg:grid-cols-12 lg:items-center">
        <div className="space-y-4 lg:col-span-7">
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-[#E6B87A]">
            {isVi
              ? `Đăng chỗ ở miễn phí (€0) · ${hostCommissionPct}% hoa hồng chủ nhà`
              : `Free to list (€0) · ${hostCommissionPct}% host commission`}
          </span>
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
            {isVi
              ? 'Đón khách lưu trú dài ngày và giữ trọn tiền thuê nhà.'
              : 'Host weekly & monthly guests with 0% host commission.'}
          </h1>
          <p className="text-sm text-[#DCECE5]">
            {isVi
              ? 'Đăng ký hoàn toàn miễn phí, không thu phí khởi tạo và không bắt buộc thiết bị hay kiểm định đầu vào. Bạn tự khai tiện nghi thực tế và có thể đăng ký thêm badge Wi-Fi Verified hoặc Work-Ready bất cứ lúc nào.'
              : 'Free to join with no onboarding fees and no mandatory Wi-Fi or hardware requirements. Declare your property amenities directly, and apply for optional Wi-Fi Verified or Work-Ready badges whenever you are ready.'}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-5">
          <div className="rounded-2xl bg-white/10 p-4">
            <Zap className="mb-2 h-5 w-5 text-[#E6B87A]" />
            <div className="font-semibold">
              {isVi
                ? `Thu 100% tiền thuê (${hostCommissionPct}% hoa hồng)`
                : `Collect 100% of rent (${hostCommissionPct}% commission)`}
            </div>
            <p className="mt-1 text-xs text-[#CDE0D9]">
              {isVi
                ? 'Khách thanh toán online để giữ chỗ, tiền thuê trả cho bạn khi nhận phòng. Hỗ trợ đồng bộ lịch iCal hai chiều với Airbnb và Booking.com.'
                : 'Guests pay online to reserve, and you collect the rent at check-in. Two-way iCal sync with Airbnb and Booking.com.'}
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 p-4">
            <Sparkles className="mb-2 h-5 w-5 text-[#E6B87A]" />
            <div className="font-semibold">
              {isVi ? 'Badge kiểm định tùy chọn' : 'Optional Badges'}
            </div>
            <p className="mt-1 text-xs text-[#CDE0D9]">
              {isVi
                ? 'Không bắt buộc bàn làm việc hay tốc độ tối thiểu để đăng chỗ ở. Nếu chỗ ở đạt chuẩn, bạn có thể xin cấp badge Wi-Fi Verified hoặc Work-Ready để nổi bật hơn.'
                : 'No desk or minimum speed required to list. Request optional Wi-Fi Verified or Work-Ready badges anytime your property qualifies.'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="h-fit space-y-5 rounded-2xl border border-[#E5DFD3] bg-white p-7 lg:col-span-5">
          <h2 className="text-2xl font-semibold text-[#17221E]">
            {isVi ? 'Quy trình cho thuê' : 'How listing works'}
          </h2>
          <ul className="space-y-3 text-sm text-[#53635D]">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#164E3F]" />
              <span>
                {isVi
                  ? 'Miễn phí hoàn toàn khi đăng và quản lý chỗ ở, không phí xét duyệt.'
                  : 'Free to list and manage properties, with zero approval fees.'}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#164E3F]" />
              <span>
                {isVi
                  ? 'Tự khai thông tin bếp, máy giặt, bàn làm việc và tốc độ Wi-Fi để khách tìm đúng nhu cầu.'
                  : 'List your real amenities (kitchen, laundry, workspace, reported Wi-Fi) so guests can filter accurately.'}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#164E3F]" />
              <span>
                {isVi
                  ? 'Thiết lập giá gói 7, 14, 21, 30 đêm, loại phòng, hình ảnh và đồng bộ lịch iCal ngay trong Kênh chủ nhà.'
                  : 'Set 7/14/21/30-night package rates, room types, photos, and iCal sync in your Host Console.'}
              </span>
            </li>
          </ul>
          <div className="rounded-2xl bg-[#FAF8F3] p-4 text-xs text-[#53635D]">
            <ShieldCheck className="mr-1 inline h-4 w-4 text-[#164E3F]" />
            {isVi
              ? 'Sau khi hồ sơ được duyệt, chỗ ở sẽ hiển thị cho khách đặt phòng và bạn có thể gửi yêu cầu cấp badge Wi-Fi Verified hoặc Work-Ready.'
              : 'Once approved, your listing goes live to guests and you can apply for optional Wi-Fi Verified or Work-Ready badges anytime.'}
          </div>
        </div>

        <div className="rounded-2xl border border-[#E5DFD3] bg-white p-7 lg:col-span-7">
          {submittedId ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-bold text-[#164E3F]">
                <CheckCircle2 className="h-6 w-6" />
                {isVi ? 'Đã gửi hồ sơ đăng chỗ ở' : 'Listing application submitted'}
              </div>
              <p className="text-sm text-[#53635D]">
                {isVi ? 'Mã hồ sơ:' : 'Application ID:'}{' '}
                <span className="font-mono font-semibold text-[#17221E]">{submittedId}</span>
              </p>
              <p className="rounded-xl bg-[#FAF8F3] p-3 text-xs leading-relaxed text-[#53635D]">
                {isVi
                  ? 'Hồ sơ của bạn đã được chuyển đến đội ngũ xét duyệt đối tác. Chỗ ở và quyền truy cập Kênh chủ nhà sẽ mở sau khi được duyệt.'
                  : 'Your application has been sent to our Partner Operations team for review. Your listing and Host Console access will activate once approved.'}
              </p>
              <div className="flex flex-wrap gap-3">
                {user && (user.role === 'host' || user.role === 'admin') ? (
                  <Link href="/host" className="rounded-xl bg-[#164E3F] px-5 py-2.5 text-sm font-semibold text-white">
                    {isVi ? 'Mở Kênh chủ nhà' : 'Open Host Console'}
                  </Link>
                ) : (
                  <Link href="/dashboard" className="rounded-xl bg-[#164E3F] px-5 py-2.5 text-sm font-semibold text-white">
                    {isVi ? 'Về Tài khoản của tôi' : 'Back to Dashboard'}
                  </Link>
                )}
                <Link href="/stays" className="rounded-xl border border-[#E5DFD3] px-5 py-2.5 text-sm font-semibold text-[#17221E]">
                  {isVi ? 'Khám phá chỗ ở' : 'Browse stays'}
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="text-2xl font-semibold text-[#17221E]">
                {isVi ? 'Đăng ký chỗ ở miễn phí (€0)' : 'Submit your stay for free (€0 fee)'}
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                    {isVi ? 'Tên chủ nhà hoặc thương hiệu' : 'Owner or business name'}
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
                    placeholder="My An Courtyard Apartments"
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
                    <option value="coliving">{isVi ? 'Coliving' : 'Coliving'}</option>
                    <option value="boutique_hotel">{isVi ? 'Khách sạn boutique' : 'Boutique Hotel'}</option>
                    <option value="villa">{isVi ? 'Biệt thự riêng' : 'Villa'}</option>
                    <option value="eco_lodge">{isVi ? 'Nhà gỗ nghỉ dưỡng' : 'Eco Lodge'}</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                    {isVi ? 'Tốc độ Wi-Fi ước tính (Mbps)' : 'Reported Wi-Fi (Mbps, optional)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={5000}
                    value={measuredDownloadMbps}
                    onChange={(e) => setMeasuredDownloadMbps(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2.5 text-sm font-semibold"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                    {isVi ? 'Khu bếp (tự khai)' : 'Kitchen availability'}
                  </label>
                  <select
                    value={kitchenType}
                    onChange={(e) => setKitchenType(e.target.value as typeof kitchenType)}
                    className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2.5 text-sm font-medium"
                  >
                    <option value="full">{isVi ? 'Bếp riêng đầy đủ' : 'Full private kitchen'}</option>
                    <option value="kitchenette">{isVi ? 'Bếp nhỏ gọn (Kitchenette)' : 'Kitchenette'}</option>
                    <option value="shared">{isVi ? 'Bếp chung' : 'Shared kitchen'}</option>
                    <option value="none">{isVi ? 'Không có bếp' : 'No kitchen'}</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#53635D]">
                    {isVi ? 'Giặt sấy (tự khai)' : 'Laundry options'}
                  </label>
                  <select
                    value={laundryType}
                    onChange={(e) => setLaundryType(e.target.value as typeof laundryType)}
                    className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2.5 text-sm font-medium"
                  >
                    <option value="in_unit">{isVi ? 'Máy giặt trong phòng' : 'In-unit washer'}</option>
                    <option value="building">{isVi ? 'Khu giặt sấy tòa nhà' : 'Building laundry'}</option>
                    <option value="service">{isVi ? 'Dịch vụ giặt ủi' : 'Laundry service'}</option>
                    <option value="none">{isVi ? 'Không có máy giặt' : 'No laundry'}</option>
                  </select>
                </div>
              </div>

              <div className="rounded-2xl border border-[#E5DFD3] bg-[#FAF8F3] p-4">
                <div className="mb-2 text-xs font-semibold text-[#53635D]">
                  {isVi ? 'Tiện ích làm việc (tùy chọn, không bắt buộc)' : 'Workspace setup (optional self-declared)'}
                </div>
                <div className="flex flex-wrap gap-4 text-xs font-medium text-[#17221E]">
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={hasWorkspace} onChange={(e) => setHasWorkspace(e.target.checked)} className="accent-[#164E3F]" />
                    {isVi ? 'Có bàn làm việc riêng' : 'Dedicated desk'}
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={hasErgonomicChair} onChange={(e) => setHasErgonomicChair(e.target.checked)} className="accent-[#164E3F]" />
                    {isVi ? 'Ghế công thái học' : 'Ergonomic chair'}
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={hasExternalMonitor} onChange={(e) => setHasExternalMonitor(e.target.checked)} className="accent-[#164E3F]" />
                    {isVi ? 'Màn hình rời' : 'External monitor'}
                  </label>
                </div>
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
                    ? 'Đăng chỗ ở miễn phí (€0)'
                    : 'Submit listing for free (€0)'
                  : isVi
                    ? 'Đăng nhập để Gửi duyệt miễn phí'
                    : 'Log in to Submit for free'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
