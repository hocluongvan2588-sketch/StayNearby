'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Bell,
  CalendarSync,
  CalendarX,
  CheckCircle2,
  ExternalLink,
  PlusCircle,
  Wallet,
  Wifi,
} from 'lucide-react';
import { formatMoneyFromVnd, formatVndExact } from '@/lib/i18n';
import { getTodayIsoVietnam, addDaysIso } from '@/lib/dates';
import { usePreferences } from './PreferencesProvider';

interface HostConsoleData {
  walletBalanceVnd: number;
  stays: Array<{
    id: string;
    slug: string;
    titleEn: string;
    titleVi: string;
    destinationNameEn: string;
    destinationNameVi: string;
    propertyType: string;
    businessModel: 'booking_flow' | 'stay_direct';
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
    wholesale7Vnd: number;
    wholesale14Vnd: number;
    wholesale21Vnd: number;
    wholesale30Vnd: number;
    extraNightVnd: number;
    isDealFeatured: boolean;
    directBookingUrl: string;
  }>;
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
  const { locale, currency } = usePreferences();
  const isVi = locale === 'vi';

  const [walletVnd, setWalletVnd] = useState(data.walletBalanceVnd);
  const [message, setMessage] = useState('');
  const [blockRoomId, setBlockRoomId] = useState(data.stays[0]?.roomId ?? '');
  const [blockDate, setBlockDate] = useState(addDaysIso(getTodayIsoVietnam(), 15));

  async function handleTopUp(amountUsd: 50 | 100 | 200) {
    const res = await fetch('/api/host/wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountUsd }),
    });
    const json = await res.json();
    if (json.ok) {
      setWalletVnd(json.balanceVnd);
      setMessage(`Added $${amountUsd} to StayDirect™ advertising wallet.`);
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
          ? `Đã cập nhật giá gói net 7/14/21/30 đêm cho ${stay.titleVi}.`
          : `Updated 7/14/21/30-night net pricing for ${stay.titleEn}.`
        : json.error?.message ?? 'Update failed'
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
        note: 'Verified speed check & proof media updated in Host Console',
      }),
    });
    const json = await res.json();
    if (json.ok) {
      setMessage(isVi ? 'Đã cập nhật tốc độ Wi-Fi & link chứng thực.' : 'Verified Wi-Fi & proof URLs updated.');
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
        `iCal sync (${json.sync.status}): ${json.sync.blockedDaysCount} future days locked.`
      );
      window.location.reload();
    } else {
      setMessage(json.error?.message ?? 'iCal sync failed.');
    }
  }

  async function handleConfirmCheckin(bookingId: string) {
    const res = await fetch(`/api/bookings/${bookingId}/checkin`, { method: 'POST' });
    const json = await res.json();
    if (json.ok) {
      setMessage('Check-in & direct host payment marked completed (CHECKED_IN_COMPLETED).');
      window.location.reload();
    } else {
      setMessage(json.error?.message ?? 'Action failed.');
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
      setMessage(block ? `Blocked ${blockDate}` : `Unblocked ${blockDate}`);
      window.location.reload();
    } else {
      setMessage(json.error?.message ?? 'Could not update calendar.');
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
      {/* Header + Prepaid Ad Wallet */}
      <div className="grid gap-6 rounded-3xl border border-[#E5DFD3] bg-white p-6 sm:p-8 lg:grid-cols-12 lacquer-shadow">
        <div className="space-y-2 lg:col-span-7">
          <span className="rounded-full bg-[#E7F1EC] px-3 py-1 text-xs font-semibold text-[#164E3F]">
            {isVi
              ? 'Cổng Đối tác · 0% Hoa hồng · Thu 100% giá thuê tại Check-in'
              : 'Stay Partner Console · 0% Commission · Collect 100% Net Rent at Check-in'}
          </span>
          <h1 className="font-serif-display text-3xl font-semibold text-[#17221E]">
            {hostName}
          </h1>
          <p className="text-sm text-[#53635D]">
            {isVi
              ? 'Quản lý giá net 7/14/21/30 đêm, chứng thực Speedtest/Video góc làm việc, đồng bộ lịch iCal (Airbnb/Booking) và xác nhận khách check-in.'
              : 'Manage 7–30N net rates, Speedtest & Workspace proof, automated iCal sync (Airbnb/Booking.com), and check-in settlement.'}
          </p>
          <div className="pt-2">
            <Link
              href="/list-your-stay"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#164E3F] px-4 py-2 text-xs font-semibold text-white"
            >
              <PlusCircle className="h-4 w-4" />
              {isVi ? 'Nộp đơn thêm chỗ ở mới' : 'Apply Additional Stay'}
            </Link>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-[#C25E28]/25 bg-[#FAF8F3] p-5 lg:col-span-5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#C25E28]">
              <Wallet className="h-4 w-4" /> StayDirect™ Advertising Wallet
            </span>
            <span className="text-xs text-[#53635D]">1% / referral</span>
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

      {/* Property Packages, Wi-Fi Verification Proof & iCal Sync */}
      <section className="space-y-5">
        <h2 className="font-serif-display text-2xl font-semibold text-[#17221E]">
          {isVi ? 'Chỗ ở, Giá Net 7–30 đêm, Chứng thực Wi-Fi & iCal' : 'Properties, Net Tiers, Verification Media & iCal Sync'}
        </h2>

        <div className="grid gap-6">
          {data.stays.map((stay) => (
            <div key={stay.id} className="space-y-4 rounded-3xl border border-[#E5DFD3] bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5DFD3] pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-[#164E3F] px-2.5 py-0.5 text-white uppercase">
                      {stay.status}
                    </span>
                    <span className="rounded-full bg-[#E7F1EC] px-2.5 py-0.5 text-[#164E3F]">
                      {stay.verificationTier}
                    </span>
                    <span className="text-[#53635D]">
                      {isVi ? stay.destinationNameVi : stay.destinationNameEn} · {stay.unitsTotal} units
                    </span>
                  </div>
                  <Link
                    href={`/stays/${stay.slug}`}
                    className="font-serif-display mt-1 inline-flex items-center gap-1.5 text-2xl font-semibold text-[#17221E] hover:text-[#164E3F]"
                  >
                    {isVi ? stay.titleVi : stay.titleEn}
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>

                {/* Wi-Fi + Proof Media Form */}
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
                  <span>↓</span>
                  <input
                    name="up"
                    type="number"
                    defaultValue={stay.wifiUploadMbps}
                    className="w-16 rounded-lg border border-[#E5DFD3] bg-white px-2 py-1 font-semibold"
                    title="Upload Mbps"
                  />
                  <span>↑</span>
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
                    placeholder="Speedtest Proof URL"
                    className="w-40 rounded-lg border border-[#E5DFD3] bg-white px-2 py-1"
                  />
                  <input
                    name="videoUrl"
                    type="text"
                    defaultValue={stay.workspaceVideoUrl}
                    placeholder="Workspace Video URL"
                    className="w-40 rounded-lg border border-[#E5DFD3] bg-white px-2 py-1"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-[#164E3F] px-3 py-1 font-semibold text-white"
                  >
                    {isVi ? 'Lưu Proof & Speedtest' : 'Save Proof'}
                  </button>
                </form>
              </div>

              {/* Package Pricing & Channel Mode Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveStay(stay, new FormData(e.currentTarget));
                }}
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-7 lg:items-end"
              >
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[#53635D]">Model</label>
                  <select
                    name="businessModel"
                    defaultValue={stay.businessModel}
                    className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-2.5 py-2 text-xs font-semibold"
                  >
                    <option value="booking_flow">BookingFlow (0%)</option>
                    <option value="stay_direct">StayDirect™ (1%)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[#53635D]">7N Net (VND)</label>
                  <input name="w7" type="number" defaultValue={stay.wholesale7Vnd} className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-2.5 py-2 text-xs font-semibold" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[#53635D]">14N Net (VND)</label>
                  <input name="w14" type="number" defaultValue={stay.wholesale14Vnd} className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-2.5 py-2 text-xs font-semibold" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[#53635D]">21N Net (VND)</label>
                  <input name="w21" type="number" defaultValue={stay.wholesale21Vnd} className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-2.5 py-2 text-xs font-semibold" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[#53635D]">30N Net (VND)</label>
                  <input name="w30" type="number" defaultValue={stay.wholesale30Vnd} className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-2.5 py-2 text-xs font-semibold" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-[#53635D]">Extra/Nt (VND)</label>
                  <input name="extra" type="number" defaultValue={stay.extraNightVnd} className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-2.5 py-2 text-xs font-semibold" />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" name="deal" defaultChecked={stay.isDealFeatured} className="accent-[#C25E28]" />
                    Featured Deal
                  </label>
                  <button type="submit" className="rounded-xl bg-[#164E3F] px-3 py-2 text-xs font-semibold text-white">
                    {isVi ? 'Lưu gói' : 'Save Tiers'}
                  </button>
                </div>

                <div className="sm:col-span-2 lg:col-span-7">
                  <input
                    name="directBookingUrl"
                    type="text"
                    defaultValue={stay.directBookingUrl}
                    placeholder="Direct booking URL (required if using StayDirect™)"
                    className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-1.5 text-xs"
                  />
                </div>
              </form>

              {/* iCal Calendar Sync Bar */}
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
                    iCal Sync ({stay.icalSyncStatus})
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
                    {isVi ? 'Đồng bộ iCal' : 'Sync External Calendar'}
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Availability Control + Bookings & Host Collection */}
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-4 rounded-3xl border border-[#E5DFD3] bg-white p-6">
          <h3 className="font-serif-display flex items-center gap-2 text-xl font-semibold text-[#17221E]">
            <CalendarX className="h-5 w-5 text-[#C25E28]" />
            {isVi ? 'Quản lý khóa ngày trống tức thì' : 'Live Availability Blocker'}
          </h3>
          <div className="flex flex-wrap gap-2">
            <select
              value={blockRoomId}
              onChange={(e) => setBlockRoomId(e.target.value)}
              className="flex-1 rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 text-xs font-semibold"
            >
              {data.stays
                .filter((s) => s.roomId)
                .map((s) => (
                  <option key={s.roomId!} value={s.roomId!}>
                    {s.titleEn} · {s.roomNameEn}
                  </option>
                ))}
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
              Block
            </button>
            <button
              type="button"
              onClick={() => handleBlockToggle(false)}
              className="rounded-xl border border-[#E5DFD3] px-3 py-2 text-xs font-semibold"
            >
              Unblock
            </button>
          </div>

          <div className="max-h-52 space-y-1.5 overflow-y-auto pt-2 text-xs">
            {data.availabilityLocks.length === 0 ? (
              <p className="text-[#53635D]">All dates open for Instant Booking.</p>
            ) : (
              data.availabilityLocks.map((l) => (
                <div key={l.id} className="flex justify-between rounded-xl bg-[#FAF8F3] px-3 py-2">
                  <span>
                    <strong>{l.stayDate}</strong> · {l.stayTitleEn}
                  </span>
                  <span className="text-[#53635D]">
                    Booked: {l.bookedUnits} · Blocked: {l.blockedUnits}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="space-y-4 rounded-3xl border border-[#E5DFD3] bg-white p-6">
          <h3 className="font-serif-display text-xl font-semibold text-[#17221E]">
            {isVi ? 'Đơn đặt & Thu tiền trực tiếp khi Check-in' : 'Locked Reservations & Check-in Collection'}
          </h3>
          <div className="max-h-72 space-y-2.5 overflow-y-auto text-xs">
            {data.bookings.map((b) => (
              <div key={b.id} className="space-y-1.5 rounded-2xl bg-[#FAF8F3] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 font-bold text-[#17221E]">
                  <span>
                    {b.bookingCode} · {b.guestName} ({b.nationality})
                  </span>
                  <span className="text-[#164E3F]">
                    Collect at Check-in: {formatVndExact(b.payAtCheckinVnd)}
                  </span>
                </div>
                <div className="text-[#53635D]">
                  {b.stayTitleEn} · {b.checkIn} → {b.checkOut} ({b.nights}N) ·{' '}
                  <strong className="text-[#164E3F]">{b.status}</strong> · 12% Online Paid:{' '}
                  {formatVndExact(b.feeOnlineVnd)}
                </div>
                {(b.status === 'RESERVED_LOCKED' || b.status === 'confirmed') && (
                  <button
                    type="button"
                    onClick={() => handleConfirmCheckin(b.id)}
                    className="rounded-lg bg-[#164E3F] px-3 py-1 font-semibold text-white"
                  >
                    {isVi ? 'Xác nhận Đã Check-in & Thu đủ 100%' : 'Mark Checked-in & Direct Payment Received'}
                  </button>
                )}
              </div>
            ))}
            {data.referrals.map((r) => (
              <div key={r.id} className="rounded-2xl bg-[#FAEDE5] p-3">
                <div className="flex justify-between font-bold text-[#C25E28]">
                  <span>StayDirect™ Click · {r.memberName}</span>
                  <span>-{formatVndExact(r.referralFeeVnd)} (1%)</span>
                </div>
                <div className="text-[#53635D]">
                  {r.stayTitleEn} · {r.nights}N retail {formatVndExact(r.retailTotalVnd)}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Host Notifications Log */}
      {data.notifications.length > 0 && (
        <section className="space-y-3 rounded-3xl border border-[#E5DFD3] bg-white p-6">
          <h3 className="font-serif-display flex items-center gap-2 text-xl font-semibold text-[#17221E]">
            <Bell className="h-5 w-5 text-[#164E3F]" />
            {isVi ? 'Thông báo giữ phòng đã gửi Chủ nhà' : 'Host Reservation Alerts'}
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
    </div>
  );
}
