'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Bell,
  CalendarSync,
  CalendarX,
  CheckCircle2,
  ExternalLink,
  ImagePlus,
  PlusCircle,
  Wallet,
  Wifi,
} from 'lucide-react';
import {
  formatBookingStatusLabel,
  formatIcalSyncStatusLabel,
  formatMoneyFromVnd,
  formatVerificationTierLabel,
  formatVndExact,
} from '@/lib/i18n';
import { getTodayIsoVietnam, addDaysIso } from '@/lib/dates';
import { HostStayEditorModal, type HostEditableStay } from './HostStayEditorModal';
import { usePreferences } from './PreferencesProvider';

interface HostConsoleData {
  mediaStorage: {
    supabaseConfigured: boolean;
    bucket: string;
  };
  walletBalanceVnd: number;
  stays: Array<
    HostEditableStay & {
      destinationNameEn: string;
      destinationNameVi: string;
      status: string;
      wifiDownloadMbps: number;
      wifiUploadMbps: number;
      wifiJitterMs: number;
      verificationTier: string;
      speedtestProofUrl: string;
      workspaceVideoUrl: string;
      roomId: string | null;
      roomNameEn: string;
      unitsTotal: number;
      icalUrl: string;
      icalLastSyncedAt: string | null;
      icalSyncStatus: string;
      isDealFeatured: boolean;
      directBookingUrl: string;
    }
  >;
  applications: Array<{
    id: string;
    stayName: string;
    businessModel: string;
    measuredDownloadMbps: number;
    status: string;
    reviewNote: string;
  }>;
  bookings: Array<{
    id: string;
    bookingCode: string;
    stayTitleEn: string;
    guestName: string;
    guestEmail: string;
    nationality: string;
    status: string;
    checkIn: string;
    checkOut: string;
    nights: number;
    wholesaleTotalVnd: number;
    feeOnlineVnd: number;
    payAtCheckinVnd: number;
  }>;
  referrals: Array<{
    id: string;
    stayTitleEn: string;
    memberName: string;
    nights: number;
    retailTotalVnd: number;
    referralFeeVnd: number;
  }>;
  availabilityLocks: Array<{
    id: string;
    roomId: string;
    stayTitleEn: string;
    roomNameEn: string;
    stayDate: string;
    bookedUnits: number;
    blockedUnits: number;
  }>;
  notifications: Array<{
    id: string;
    bookingCode: string;
    subject: string;
    status: string;
    createdAt: string;
  }>;
}

export function HostConsoleClient({
  hostName,
  data,
}: {
  hostName: string;
  data: HostConsoleData;
}) {
  const router = useRouter();
  const { locale, currency } = usePreferences();
  const isVi = locale === 'vi';

  const [walletVnd, setWalletVnd] = useState(data.walletBalanceVnd);
  const [message, setMessage] = useState('');
  const [editingStayId, setEditingStayId] = useState<string | null>(null);
  const [blockRoomId, setBlockRoomId] = useState(data.stays[0]?.roomId ?? '');
  const [blockDate, setBlockDate] = useState(addDaysIso(getTodayIsoVietnam(), 15));
  const editingStay = data.stays.find((s) => s.id === editingStayId) ?? null;

  async function handleTopUp(amountUsd: 50 | 100 | 200) {
    const res = await fetch('/api/host/wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountUsd }),
    });
    const json = await res.json();
    if (json.ok) {
      setWalletVnd(json.balanceVnd);
      setMessage(
        isVi
          ? `Đã nạp thêm $${amountUsd} vào số dư quảng cáo chủ nhà.`
          : `Added $${amountUsd} to your host ad balance.`
      );
    }
  }

  async function handleSaveStay(
    stay: HostConsoleData['stays'][number],
    form: FormData
  ) {
    const res = await fetch(`/api/host/stays/${stay.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessModel: form.get('businessModel'),
        directBookingUrl: form.get('directBookingUrl'),
        wholesale7Vnd: Number(form.get('w7')),
        wholesale14Vnd: Number(form.get('w14')),
        wholesale21Vnd: Number(form.get('w21')),
        wholesale30Vnd: Number(form.get('w30')),
        extraNightVnd: Number(form.get('extra')),
        isDealFeatured: form.get('deal') === 'on',
      }),
    });
    const json = await res.json();
    setMessage(
      json.ok
        ? isVi
          ? `Đã lưu bảng giá 7, 14, 21, 30 đêm cho ${stay.titleVi}.`
          : `Saved weekly and monthly prices for ${stay.titleEn}.`
        : json.error?.message ?? (isVi ? 'Không thể lưu thay đổi.' : 'Could not save changes.')
    );
  }

  async function handleRecordWifi(stayId: string, form: FormData) {
    const res = await fetch(`/api/host/stays/${stayId}/wifi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        downloadMbps: Number(form.get('down')),
        uploadMbps: Number(form.get('up')),
        jitterMs: Number(form.get('jitter')),
        speedtestProofUrl: String(form.get('proofUrl') ?? ''),
        workspaceVideoUrl: String(form.get('videoUrl') ?? ''),
        note: 'Speed check and desk details updated by host',
      }),
    });
    const json = await res.json();
    if (json.ok) {
      setMessage(isVi ? 'Đã cập nhật tốc độ Wi-Fi và chứng nhận.' : 'Updated Wi-Fi speed and proof links.');
      window.location.reload();
    }
  }

  async function handleSyncIcal(roomId: string, icalUrl: string) {
    const res = await fetch('/api/host/ical', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, icalUrl }),
    });
    const json = await res.json();
    if (json.ok) {
      setMessage(
        isVi
          ? `Đã đồng bộ lịch phòng: khóa ${json.sync.blockedDaysCount} ngày bận sắp tới.`
          : `Calendar synced: locked ${json.sync.blockedDaysCount} busy days.`
      );
      window.location.reload();
    } else {
      setMessage(json.error?.message ?? (isVi ? 'Không thể đồng bộ lịch phòng.' : 'Calendar sync failed.'));
    }
  }

  async function handleConfirmCheckin(bookingId: string) {
    const res = await fetch(`/api/bookings/${bookingId}/checkin`, { method: 'POST' });
    const json = await res.json();
    if (json.ok) {
      setMessage(
        isVi
          ? 'Đã xác nhận khách nhận phòng và thanh toán tiền thuê trực tiếp.'
          : 'Marked checked in and direct rent received.'
      );
      window.location.reload();
    } else {
      setMessage(json.error?.message ?? (isVi ? 'Thao tác thất bại.' : 'Action failed.'));
    }
  }

  async function handleBlockToggle(block: boolean) {
    if (!blockRoomId) return;
    const res = await fetch('/api/host/calendar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: blockRoomId, stayDate: blockDate, block }),
    });
    const json = await res.json();
    if (json.ok) {
      setMessage(block ? `${isVi ? 'Đã khóa ngày' : 'Blocked'} ${blockDate}` : `${isVi ? 'Đã mở lại ngày' : 'Unblocked'} ${blockDate}`);
      window.location.reload();
    } else {
      setMessage(json.error?.message ?? (isVi ? 'Không thể cập nhật lịch.' : 'Could not update calendar.'));
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-6 rounded-3xl border border-[#E5DFD3] bg-white p-6 sm:p-8 lg:grid-cols-12 lacquer-shadow">
        <div className="space-y-2 lg:col-span-7">
          <span className="rounded-full bg-[#E7F1EC] px-3 py-1 text-xs font-semibold text-[#164E3F]">
            {isVi
              ? 'Trang quản lý chủ nhà, 0% hoa hồng, nhận đủ 100% tiền nhà khi khách đến'
              : 'Host Portal, 0% commission, keep 100% of check-in rent'}
          </span>
          <h1 className="font-serif-display text-3xl font-semibold text-[#17221E]">
            {hostName}
          </h1>
          <p className="text-sm text-[#53635D]">
            {isVi
              ? 'Cập nhật giá thuê 7 đến 30 đêm, thông số Wi-Fi, kết nối lịch từ Airbnb hoặc Booking.com và xác nhận khi khách nhận phòng.'
              : 'Manage weekly and monthly rates, Wi-Fi proof, calendar sync with Airbnb or Booking.com, and check-in settlement.'}
          </p>
          <div className="pt-2">
            <Link
              href="/list-your-stay"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#164E3F] px-4 py-2 text-xs font-semibold text-white"
            >
              <PlusCircle className="h-4 w-4" />
              {isVi ? 'Đăng thêm chỗ ở mới' : 'Add another property'}
            </Link>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-[#C25E28]/25 bg-[#FAF8F3] p-5 lg:col-span-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#C25E28]">
              <Wallet className="h-4 w-4" /> {isVi ? 'Ví quảng cáo (Đặt trực tiếp)' : 'Host ad balance (Direct Booking)'}
            </span>
            <span className="text-xs text-[#53635D]">{isVi ? 'Phí 1% / lượt đặt' : '1% per referral'}</span>
          </div>
          <div className="font-serif-display text-3xl font-bold text-[#17221E]">
            {formatMoneyFromVnd(walletVnd, currency)}
          </div>
          <div className="text-xs text-[#53635D]">{formatVndExact(walletVnd)}</div>
          <div className="flex gap-2 pt-1">
            {([50, 100, 200] as const).map((usd) => (
              <button
                key={usd}
                type="button"
                onClick={() => handleTopUp(usd)}
                className="flex-1 rounded-xl border border-[#C25E28]/35 bg-white py-2 text-xs font-semibold text-[#C25E28] hover:bg-[#FAEDE5]"
              >
                +${usd}
              </button>
            ))}
          </div>
        </div>
      </div>

      {message && (
        <div className="flex items-center gap-2 rounded-2xl border border-[#164E3F]/30 bg-[#E7F1EC] p-4 text-sm font-medium text-[#164E3F]">
          <CheckCircle2 className="h-4 w-4" />
          <span>{message}</span>
        </div>
      )}

      <section className="space-y-5">
        <h2 className="font-serif-display text-2xl font-semibold text-[#17221E]">
          {isVi ? 'Danh sách chỗ ở, giá thuê và đồng bộ lịch' : 'Properties, rates, Wi-Fi proof, and calendar sync'}
        </h2>

        <div className="grid gap-6">
          {data.stays.map((stay) => (
            <div key={stay.id} className="space-y-4 rounded-3xl border border-[#E5DFD3] bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5DFD3] pb-4">
                <div className="flex items-start gap-4">
                  <img
                    src={stay.heroImage}
                    alt={stay.titleEn}
                    className="hidden h-20 w-28 shrink-0 rounded-2xl border border-[#E5DFD3] object-cover sm:block"
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                      <span className="rounded-full bg-[#164E3F] px-2.5 py-0.5 text-white">
                        {stay.status === 'live'
                          ? isVi
                            ? 'Đang mở đặt'
                            : 'Live'
                          : stay.status === 'limited'
                            ? isVi
                              ? 'Giới hạn'
                              : 'Limited'
                            : isVi
                              ? 'Tạm ẩn'
                              : 'Paused'}
                      </span>
                      <span className="rounded-full bg-[#E7F1EC] px-2.5 py-0.5 text-[#164E3F]">
                        {formatVerificationTierLabel(stay.verificationTier, locale)}
                      </span>
                      <span className="text-[#53635D]">
                        {isVi ? stay.destinationNameVi : stay.destinationNameEn}, {stay.galleryImages.length}{' '}
                        {isVi ? 'ảnh' : 'photos'}, {stay.rooms.length} {isVi ? 'loại phòng' : 'room types'}
                      </span>
                    </div>
                    <Link
                      href={`/stays/${stay.slug}`}
                      className="font-serif-display mt-1 inline-flex items-center gap-1.5 text-2xl font-semibold text-[#17221E] hover:text-[#164E3F]"
                    >
                      {isVi ? stay.titleVi : stay.titleEn}
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingStayId(stay.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#164E3F]/30 bg-[#E7F1EC] px-3.5 py-1.5 text-xs font-semibold text-[#164E3F] hover:bg-[#164E3F] hover:text-white transition"
                      >
                        <ImagePlus className="h-3.5 w-3.5" />
                        {isVi ? 'Quản lý ảnh, thông tin & phòng' : 'Edit photos, details & rooms'}
                      </button>
                    </div>
                  </div>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleRecordWifi(stay.id, new FormData(e.currentTarget));
                  }}
                  className="flex flex-wrap items-center gap-2 rounded-2xl bg-[#FAF8F3] p-2.5 text-xs"
                >
                  <Wifi className="h-4 w-4 text-[#164E3F]" />
                  <input
                    name="down"
                    type="number"
                    defaultValue={stay.wifiDownloadMbps}
                    className="w-16 rounded-lg border border-[#E5DFD3] bg-white px-2 py-1 font-semibold"
                    title="Download Mbps"
                  />
                  <span>{isVi ? 'xuống' : 'down'}</span>
                  <input
                    name="up"
                    type="number"
                    defaultValue={stay.wifiUploadMbps}
                    className="w-16 rounded-lg border border-[#E5DFD3] bg-white px-2 py-1 font-semibold"
                    title="Upload Mbps"
                  />
                  <span>{isVi ? 'lên' : 'up'}</span>
                  <input
                    name="jitter"
                    type="number"
                    defaultValue={stay.wifiJitterMs}
                    className="w-12 rounded-lg border border-[#E5DFD3] bg-white px-2 py-1"
                    title="Jitter ms"
                  />
                  <input
                    name="proofUrl"
                    type="text"
                    defaultValue={stay.speedtestProofUrl}
                    placeholder={isVi ? 'Link ảnh Speedtest' : 'Speedtest link'}
                    className="w-40 rounded-lg border border-[#E5DFD3] bg-white px-2 py-1"
                  />
                  <input
                    name="videoUrl"
                    type="text"
                    defaultValue={stay.workspaceVideoUrl}
                    placeholder={isVi ? 'Link video góc làm việc' : 'Desk tour link'}
                    className="w-40 rounded-lg border border-[#E5DFD3] bg-white px-2 py-1"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-[#164E3F] px-3 py-1 font-semibold text-white"
                  >
                    {isVi ? 'Lưu thông số Wi-Fi' : 'Save Wi-Fi proof'}
                  </button>
                </form>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveStay(stay, new FormData(e.currentTarget));
                }}
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-7 lg:items-end"
              >
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[#53635D]">
                    {isVi ? 'Hình thức đặt' : 'Booking method'}
                  </label>
                  <select
                    name="businessModel"
                    defaultValue={stay.businessModel}
                    className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-2.5 py-2 text-xs font-semibold"
                  >
                    <option value="booking_flow">{isVi ? 'Đặt qua VietNomad (0%)' : 'VietNomad (0% fee)'}</option>
                    <option value="stay_direct">{isVi ? 'Đặt trực tiếp (1%)' : 'Direct Booking (1%)'}</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[#53635D]">
                    {isVi ? 'Giá 7 đêm (VND)' : '7N Host Rate (VND)'}
                  </label>
                  <input name="w7" type="number" defaultValue={stay.wholesale7Vnd} className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-2.5 py-2 text-xs font-semibold" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[#53635D]">
                    {isVi ? 'Giá 14 đêm (VND)' : '14N Host Rate (VND)'}
                  </label>
                  <input name="w14" type="number" defaultValue={stay.wholesale14Vnd} className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-2.5 py-2 text-xs font-semibold" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[#53635D]">
                    {isVi ? 'Giá 21 đêm (VND)' : '21N Host Rate (VND)'}
                  </label>
                  <input name="w21" type="number" defaultValue={stay.wholesale21Vnd} className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-2.5 py-2 text-xs font-semibold" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[#53635D]">
                    {isVi ? 'Giá 30 đêm (VND)' : '30N Host Rate (VND)'}
                  </label>
                  <input name="w30" type="number" defaultValue={stay.wholesale30Vnd} className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-2.5 py-2 text-xs font-semibold" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[#53635D]">
                    {isVi ? 'Mỗi đêm thêm (VND)' : 'Extra night (VND)'}
                  </label>
                  <input name="extra" type="number" defaultValue={stay.extraNightVnd} className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-2.5 py-2 text-xs font-semibold" />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" name="deal" defaultChecked={stay.isDealFeatured} className="accent-[#C25E28]" />
                    {isVi ? 'Hiện mục Ưu đãi' : 'Feature in Deals'}
                  </label>
                  <button type="submit" className="rounded-xl bg-[#164E3F] px-3 py-2 text-xs font-semibold text-white">
                    {isVi ? 'Lưu bảng giá' : 'Save prices'}
                  </button>
                </div>

                <div className="sm:col-span-2 lg:col-span-7">
                  <input
                    name="directBookingUrl"
                    type="text"
                    defaultValue={stay.directBookingUrl}
                    placeholder={isVi ? 'Link đặt phòng website riêng (chỉ cần nếu chọn Đặt trực tiếp)' : 'Your direct booking URL (if using Direct Booking)'}
                    className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-1.5 text-xs"
                  />
                </div>
              </form>

              {stay.roomId && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    handleSyncIcal(stay.roomId!, String(fd.get('icalUrl') ?? ''));
                  }}
                  className="flex flex-col gap-2 rounded-2xl border border-[#E5DFD3] bg-[#FAF8F3] p-3 text-xs sm:flex-row sm:items-center"
                >
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#164E3F] shrink-0">
                    <CalendarSync className="h-4 w-4" />
                    {isVi ? 'Đồng bộ lịch phòng Airbnb / Booking' : 'Calendar sync (Airbnb, Booking.com)'} ({formatIcalSyncStatusLabel(stay.icalSyncStatus, locale)})
                  </span>
                  <input
                    name="icalUrl"
                    type="text"
                    defaultValue={stay.icalUrl}
                    placeholder="https://www.airbnb.com/calendar/ical/12345.ics"
                    className="flex-1 rounded-xl border border-[#E5DFD3] bg-white px-3 py-1.5"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-[#164E3F] px-3.5 py-1.5 font-semibold text-white"
                  >
                    {isVi ? 'Đồng bộ ngay' : 'Sync calendar'}
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-4 rounded-3xl border border-[#E5DFD3] bg-white p-6">
          <h3 className="font-serif-display flex items-center gap-2 text-xl font-semibold text-[#17221E]">
            <CalendarX className="h-5 w-5 text-[#C25E28]" />
            {isVi ? 'Đóng hoặc mở ngày trống' : 'Block or open room dates'}
          </h3>
          <div className="flex flex-wrap gap-2">
            <select
              value={blockRoomId}
              onChange={(e) => setBlockRoomId(e.target.value)}
              className="flex-1 rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs font-semibold"
            >
              {data.stays.flatMap((s) =>
                s.rooms.length > 0
                  ? s.rooms.map((rm) => (
                      <option key={rm.id} value={rm.id}>
                        {isVi ? s.titleVi : s.titleEn} ({isVi ? rm.nameVi : rm.nameEn})
                      </option>
                    ))
                  : s.roomId
                    ? [
                        <option key={s.roomId} value={s.roomId}>
                          {isVi ? s.titleVi : s.titleEn} ({s.roomNameEn})
                        </option>,
                      ]
                    : []
              )}
            </select>
            <input
              type="date"
              value={blockDate}
              min={getTodayIsoVietnam()}
              onChange={(e) => setBlockDate(e.target.value)}
              className="rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs font-semibold"
            />
            <button
              type="button"
              onClick={() => handleBlockToggle(true)}
              className="rounded-xl bg-[#C25E28] px-3 py-2 text-xs font-semibold text-white"
            >
              {isVi ? 'Khóa ngày' : 'Block'}
            </button>
            <button
              type="button"
              onClick={() => handleBlockToggle(false)}
              className="rounded-xl border border-[#E5DFD3] px-3 py-2 text-xs font-semibold"
            >
              {isVi ? 'Mở ngày' : 'Unblock'}
            </button>
          </div>

          <div className="max-h-52 space-y-1.5 overflow-y-auto pt-2 text-xs">
            {data.availabilityLocks.length === 0 ? (
              <p className="text-[#53635D]">
                {isVi ? 'Tất cả các ngày sắp tới đều đang mở đón khách.' : 'All upcoming dates are open for booking.'}
              </p>
            ) : (
              data.availabilityLocks.map((l) => (
                <div key={l.id} className="flex justify-between rounded-xl bg-[#FAF8F3] px-3 py-2">
                  <span>
                    <strong>{l.stayDate}</strong> ({l.stayTitleEn})
                  </span>
                  <span className="text-[#53635D]">
                    {isVi ? `Đã đặt: ${l.bookedUnits}, Đã khóa: ${l.blockedUnits}` : `Booked: ${l.bookedUnits}, Blocked: ${l.blockedUnits}`}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="space-y-4 rounded-3xl border border-[#E5DFD3] bg-white p-6">
          <h3 className="font-serif-display text-xl font-semibold text-[#17221E]">
            {isVi ? 'Đơn đặt phòng và thu tiền khi khách nhận phòng' : 'Bookings and check-in collection'}
          </h3>
          <div className="max-h-72 space-y-2.5 overflow-y-auto text-xs">
            {data.bookings.map((b) => (
              <div key={b.id} className="space-y-1.5 rounded-2xl bg-[#FAF8F3] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 font-bold text-[#17221E]">
                  <span>
                    {b.bookingCode}, {b.guestName} ({b.nationality})
                  </span>
                  <span className="text-[#164E3F]">
                    {isVi ? 'Thu khi nhận phòng:' : 'Collect at check-in:'} {formatVndExact(b.payAtCheckinVnd)}
                  </span>
                </div>
                <div className="text-[#53635D]">
                  {b.stayTitleEn}, {b.checkIn} {isVi ? 'đến' : 'to'} {b.checkOut} ({b.nights} {isVi ? 'đêm' : 'nights'}).{' '}
                  <strong className="text-[#164E3F]">{formatBookingStatusLabel(b.status, locale)}</strong>.{' '}
                  {isVi ? 'Khách đã đóng 12% online:' : '12% fee paid online:'} {formatVndExact(b.feeOnlineVnd)}
                </div>
                {(b.status === 'RESERVED_LOCKED' || b.status === 'confirmed') && (
                  <button
                    type="button"
                    onClick={() => handleConfirmCheckin(b.id)}
                    className="rounded-lg bg-[#164E3F] px-3 py-1 font-semibold text-white"
                  >
                    {isVi ? 'Xác nhận khách đã nhận phòng và trả đủ tiền' : 'Confirm check-in and rent received'}
                  </button>
                )}
              </div>
            ))}
            {data.referrals.map((r) => (
              <div key={r.id} className="rounded-2xl bg-[#FAEDE5] p-3">
                <div className="flex justify-between font-bold text-[#C25E28]">
                  <span>{isVi ? 'Lượt đặt trực tiếp' : 'Direct booking'} ({r.memberName})</span>
                  <span>-{formatVndExact(r.referralFeeVnd)} (1%)</span>
                </div>
                <div className="text-[#53635D]">
                  {r.stayTitleEn}, {r.nights} {isVi ? 'đêm' : 'nights'}, {formatVndExact(r.retailTotalVnd)}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {data.notifications.length > 0 && (
        <section className="space-y-3 rounded-3xl border border-[#E5DFD3] bg-white p-6">
          <h3 className="font-serif-display flex items-center gap-2 text-xl font-semibold text-[#17221E]">
            <Bell className="h-5 w-5 text-[#164E3F]" />
            {isVi ? 'Thông báo đặt phòng gần đây' : 'Recent booking alerts'}
          </h3>
          <div className="space-y-2 text-xs">
            {data.notifications.map((n) => (
              <div key={n.id} className="flex flex-wrap justify-between gap-2 rounded-xl bg-[#FAF8F3] p-3">
                <span className="font-medium text-[#17221E]">{n.subject}</span>
                <span className="text-[#53635D]">{n.createdAt.slice(0, 16).replace('T', ' ')}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {editingStay && (
        <HostStayEditorModal
          stay={editingStay}
          isVi={isVi}
          supabaseConfigured={data.mediaStorage.supabaseConfigured}
          storageBucket={data.mediaStorage.bucket}
          onClose={() => setEditingStayId(null)}
          onUpdated={(feedback) => {
            setMessage(feedback);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
