'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Bookmark,
  Calendar,
  CheckCircle2,
  KeyRound,
  MapPin,
  Sparkles,
  Wallet,
  Wifi,
} from 'lucide-react';
import type { SessionUser } from '@/lib/auth/session';
import { formatMoneyFromVnd } from '@/lib/i18n';
import { usePreferences } from './PreferencesProvider';

interface MemberDashboardData {
  bookings: Array<{
    id: string;
    bookingCode: string;
    staySlug: string;
    titleEn: string;
    titleVi: string;
    heroImage: string;
    destinationNameEn: string;
    destinationNameVi: string;
    roomNameEn: string;
    roomNameVi: string;
    businessModel: string;
    status: string;
    checkIn: string;
    checkOut: string;
    nights: number;
    guestTotalVnd: number;
    rewardCreditEarnedVnd: number;
    cancellationPolicy: string;
    refundAmountVnd: number;
    creditIssuedVnd: number;
    wifiDownloadMbps: number;
    directBookingUrl: string | null;
    exactAddress: string | null;
    checkinInstructionsEn: string | null;
    checkinInstructionsVi: string | null;
  }>;
  savedStays: Array<{
    id: string;
    slug: string;
    titleEn: string;
    titleVi: string;
    heroImage: string;
    wifiDownloadMbps: number;
    destinationNameEn: string;
    destinationNameVi: string;
    monthDisplayVnd: number;
  }>;
  rsvps: Array<{
    id: string;
    titleEn: string;
    titleVi: string;
    cityEn: string;
    cityVi: string;
    eventDate: string;
    venueEn: string;
    venueVi: string;
  }>;
}

export function MemberDashboardClient({
  user,
  data,
}: {
  user: SessionUser;
  data: MemberDashboardData;
}) {
  const { locale, currency } = usePreferences();
  const isVi = locale === 'vi';
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  async function handleCancel(bookingId: string) {
    setBusyId(bookingId);
    setNotice('');
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: 'POST' });
      const json = await res.json();
      if (!json.ok) {
        setNotice(json.error?.message ?? 'Could not cancel booking.');
      } else {
        const out = json.outcome;
        setNotice(
          isVi
            ? `Đã hủy đặt phòng (${out.tier}). Hoàn tiền: ${formatMoneyFromVnd(out.refundAmountVnd, currency)}, Account Credit: ${formatMoneyFromVnd(out.creditIssuedVnd, currency)}.`
            : `Cancelled (${out.tier}). Cash refund: ${formatMoneyFromVnd(out.refundAmountVnd, currency)}, Account Credit issued: ${formatMoneyFromVnd(out.creditIssuedVnd, currency)}.`
        );
        window.location.reload();
      }
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
      {/* Member Header & Wallet KPIs */}
      <div className="flex flex-col justify-between gap-6 rounded-3xl border border-[#E5DFD3] bg-white p-6 sm:p-8 md:flex-row md:items-center lacquer-shadow">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#E7F1EC] px-3 py-1 text-xs font-semibold text-[#164E3F] uppercase">
              {user.role}
            </span>
            {user.membershipTier === 'premium' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#A67C2E] px-3 py-1 text-xs font-semibold text-white">
                <Sparkles className="h-3.5 w-3.5" /> Nomad Pass Premium
              </span>
            ) : (
              <Link
                href="/membership"
                className="rounded-full border border-[#A67C2E]/40 px-3 py-1 text-xs font-semibold text-[#A67C2E] hover:bg-[#FAF8F3]"
              >
                {isVi ? 'Nâng cấp Premium (Hoàn 4%)' : 'Upgrade to Premium (4% Back)'}
              </Link>
            )}
          </div>
          <h1 className="font-serif-display mt-2 text-3xl font-semibold text-[#17221E]">
            {user.fullName}
          </h1>
          <p className="text-xs text-[#53635D]">
            {user.email} · {user.nationality}
            {user.vatTaxId ? ` · VAT ID: ${user.vatTaxId}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="rounded-2xl bg-[#FAF8F3] px-5 py-3">
            <div className="flex items-center gap-1.5 text-xs text-[#53635D]">
              <Wallet className="h-4 w-4 text-[#164E3F]" />
              {isVi ? 'Ví Reward Credit' : 'Reward Credit Balance'}
            </div>
            <div className="font-serif-display text-2xl font-bold text-[#164E3F]">
              {formatMoneyFromVnd(user.rewardCreditVnd, currency)}
            </div>
          </div>
          {user.role === 'host' && (
            <Link
              href="/host"
              className="flex items-center rounded-2xl bg-[#164E3F] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0F392E]"
            >
              {isVi ? 'Mở Cổng Chủ nhà →' : 'Open Host Console →'}
            </Link>
          )}
          {user.role === 'admin' && (
            <Link
              href="/admin"
              className="flex items-center rounded-2xl bg-[#C25E28] px-5 py-3 text-sm font-semibold text-white hover:bg-[#ad5020]"
            >
              {isVi ? 'Mở Admin & CRM →' : 'Open Admin & CRM →'}
            </Link>
          )}
        </div>
      </div>

      {notice && (
        <div className="rounded-2xl border border-[#164E3F]/30 bg-[#E7F1EC] p-4 text-sm font-medium text-[#164E3F]">
          {notice}
        </div>
      )}

      {/* Bookings & Unlocked Check-In Instructions */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif-display text-2xl font-semibold text-[#17221E]">
            {isVi ? 'Lịch lưu trú của bạn' : 'Your Extended Stays & Referrals'}
          </h2>
          <Link href="/stays" className="text-sm font-semibold text-[#164E3F] hover:underline">
            {isVi ? '+ Đặt thêm chỗ ở' : '+ Book another base'}
          </Link>
        </div>

        {data.bookings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E5DFD3] bg-white p-8 text-center text-sm text-[#53635D]">
            {isVi ? 'Bạn chưa có đặt phòng nào.' : 'No bookings yet. Explore work-ready Vietnam stays to lock your first week or month.'}
          </div>
        ) : (
          <div className="grid gap-5">
            {data.bookings.map((b) => (
              <div
                key={b.id}
                className="grid gap-5 rounded-3xl border border-[#E5DFD3] bg-white p-5 sm:grid-cols-12"
              >
                <div className="overflow-hidden rounded-2xl sm:col-span-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={b.heroImage}
                    alt={isVi ? b.titleVi : b.titleEn}
                    className="aspect-[4/3] h-full w-full object-cover"
                  />
                </div>
                <div className="space-y-3 sm:col-span-9">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                        <span className="rounded-full bg-[#164E3F] px-2.5 py-0.5 text-white">
                          {b.bookingCode}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 uppercase ${
                            b.status === 'confirmed'
                              ? 'bg-[#E7F1EC] text-[#164E3F]'
                              : b.status === 'cancelled'
                                ? 'bg-[#FAEDE5] text-[#C25E28]'
                                : 'bg-[#F2EDE3] text-[#17221E]'
                          }`}
                        >
                          {b.status}
                        </span>
                        <span className="text-[#53635D]">
                          <Wifi className="mr-1 inline h-3.5 w-3.5 text-[#164E3F]" />
                          {b.wifiDownloadMbps} Mbps
                        </span>
                      </div>
                      <Link
                        href={`/stays/${b.staySlug}`}
                        className="font-serif-display mt-1 block text-2xl font-semibold text-[#17221E] hover:text-[#164E3F]"
                      >
                        {isVi ? b.titleVi : b.titleEn}
                      </Link>
                      <div className="text-xs text-[#53635D]">
                        {isVi ? b.destinationNameVi : b.destinationNameEn} ·{' '}
                        {isVi ? b.roomNameVi : b.roomNameEn}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-bold text-[#17221E]">
                        {formatMoneyFromVnd(b.guestTotalVnd, currency)}
                      </div>
                      <div className="text-xs text-[#53635D]">
                        {b.nights} {isVi ? 'đêm' : 'nights'} · {b.checkIn} → {b.checkOut}
                      </div>
                    </div>
                  </div>

                  {/* Unlocked Address & Smart Lock when confirmed */}
                  {b.exactAddress && (
                    <div className="rounded-2xl border border-[#164E3F]/20 bg-[#FAF8F3] p-4 text-xs">
                      <div className="mb-1 flex items-center gap-1.5 font-semibold text-[#164E3F]">
                        <KeyRound className="h-4 w-4" />
                        {isVi ? 'Địa chỉ & Hướng dẫn nhận phòng đã mở khóa' : 'Unlocked Street Address & Check-in Details'}
                      </div>
                      <div className="font-medium text-[#17221E]">
                        <MapPin className="mr-1 inline h-3.5 w-3.5 text-[#C25E28]" />
                        {b.exactAddress}
                      </div>
                      <p className="mt-1 text-[#53635D]">
                        {isVi ? b.checkinInstructionsVi : b.checkinInstructionsEn}
                      </p>
                    </div>
                  )}

                  {b.status === 'direct_referral' && b.directBookingUrl && (
                    <div className="rounded-2xl bg-[#FAEDE5] p-3 text-xs text-[#C25E28]">
                      StayDirect™ 0% Markup referral link:{' '}
                      <span className="font-semibold underline">{b.directBookingUrl}</span>
                    </div>
                  )}

                  {b.status === 'cancelled' && (
                    <div className="rounded-2xl bg-[#F2EDE3] p-3 text-xs text-[#17221E]">
                      {isVi
                        ? `Hoàn tiền: ${formatMoneyFromVnd(b.refundAmountVnd, currency)} · Account Credit cấp thêm: ${formatMoneyFromVnd(b.creditIssuedVnd, currency)}`
                        : `Cash refund: ${formatMoneyFromVnd(b.refundAmountVnd, currency)} · Account Credit issued: ${formatMoneyFromVnd(b.creditIssuedVnd, currency)}`}
                    </div>
                  )}

                  {b.status === 'confirmed' && (
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                      <span className="text-xs text-[#53635D]">
                        <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-[#164E3F]" />
                        {isVi
                          ? `Chính sách ${b.cancellationPolicy}: miễn phí hoàn tiền trong 48h đầu hoặc hoàn Credit trước hạn.`
                          : `${b.cancellationPolicy} policy: 48h cooling-off cash refund or adequate-notice 100% credit.`}
                      </span>
                      <button
                        type="button"
                        disabled={busyId === b.id}
                        onClick={() => handleCancel(b.id)}
                        className="rounded-xl border border-[#C25E28]/40 px-3.5 py-1.5 text-xs font-semibold text-[#C25E28] hover:bg-[#FAEDE5]"
                      >
                        {busyId === b.id
                          ? '...'
                          : isVi
                            ? 'Hủy theo chính sách NomadStays'
                            : 'Cancel Booking'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Saved Stays & Event RSVPs */}
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-3xl border border-[#E5DFD3] bg-white p-6">
          <h3 className="font-serif-display mb-4 flex items-center gap-2 text-xl font-semibold text-[#17221E]">
            <Bookmark className="h-5 w-5 text-[#C25E28]" />
            {isVi ? 'Chỗ ở đã lưu' : 'Saved Favourites'}
          </h3>
          {data.savedStays.length === 0 ? (
            <p className="text-sm text-[#53635D]">
              {isVi ? 'Bấm biểu tượng đánh dấu trên thẻ chỗ ở để lưu.' : 'Bookmark any stay card to compare later.'}
            </p>
          ) : (
            <div className="space-y-3">
              {data.savedStays.map((s) => (
                <Link
                  key={s.id}
                  href={`/stays/${s.slug}`}
                  className="flex items-center justify-between rounded-2xl bg-[#FAF8F3] p-3 hover:bg-[#E7F1EC]/50"
                >
                  <div>
                    <div className="font-semibold text-[#17221E]">{isVi ? s.titleVi : s.titleEn}</div>
                    <div className="text-xs text-[#53635D]">
                      {isVi ? s.destinationNameVi : s.destinationNameEn} · {s.wifiDownloadMbps} Mbps
                    </div>
                  </div>
                  <div className="text-sm font-bold text-[#164E3F]">
                    {formatMoneyFromVnd(s.monthDisplayVnd, currency)}/mo
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-[#E5DFD3] bg-white p-6">
          <h3 className="font-serif-display mb-4 flex items-center gap-2 text-xl font-semibold text-[#17221E]">
            <Calendar className="h-5 w-5 text-[#164E3F]" />
            {isVi ? 'Lịch Vietnam Brunch Club đã đăng ký' : 'My Nomad Brunch Club RSVPs'}
          </h3>
          {data.rsvps.length === 0 ? (
            <div className="space-y-2 text-sm text-[#53635D]">
              <p>{isVi ? 'Chưa đăng ký buổi gặp mặt nào.' : 'No meetup RSVPs yet.'}</p>
              <Link href="/community" className="inline-block font-semibold text-[#164E3F] hover:underline">
                {isVi ? 'Xem lịch Meetup tại Việt Nam →' : 'Browse Vietnam Brunch Club →'}
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {data.rsvps.map((ev) => (
                <div key={ev.id} className="rounded-2xl bg-[#FAF8F3] p-3">
                  <div className="font-semibold text-[#17221E]">{isVi ? ev.titleVi : ev.titleEn}</div>
                  <div className="text-xs text-[#53635D]">
                    {ev.eventDate} · {isVi ? ev.venueVi : ev.venueEn}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
