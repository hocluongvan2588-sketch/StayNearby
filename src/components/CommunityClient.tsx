'use client';

import { useState } from 'react';
import { Calendar, CheckCircle2, Globe2, MapPin, ShieldCheck, ShoppingBag, Users } from 'lucide-react';
import type { SessionUser } from '@/lib/auth/session';
import { usePreferences } from './PreferencesProvider';

interface EventItem {
  id: string;
  cityEn: string;
  cityVi: string;
  titleEn: string;
  titleVi: string;
  eventDate: string;
  venueEn: string;
  venueVi: string;
  spotsTotal: number;
  spotsTaken: number;
  imageUrl: string;
}

interface MarketItem {
  id: string;
  category: string;
  titleEn: string;
  titleVi: string;
  partnerName: string;
  summaryEn: string;
  summaryVi: string;
  priceLabel: string;
  memberPerkEn: string;
  memberPerkVi: string;
}

export function CommunityClient({
  user,
  events,
  marketplace,
  rsvpEventIds,
}: {
  user: SessionUser | null;
  events: EventItem[];
  marketplace: MarketItem[];
  rsvpEventIds: string[];
}) {
  const { locale } = usePreferences();
  const isVi = locale === 'vi';

  const [passport, setPassport] = useState('UK / EU / Japan / Korea');
  const [joinedIds, setJoinedIds] = useState<string[]>(rsvpEventIds);
  const [counts, setCounts] = useState<Record<string, number>>(
    Object.fromEntries(events.map((e) => [e.id, e.spotsTaken]))
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const visaInfo: Record<string, { ruleEn: string; ruleVi: string; tipEn: string; tipVi: string }> = {
    'UK / EU / Japan / Korea': {
      ruleEn: '45-day visa-free entry or 90-day multi-entry e-Visa ($25 to $50 online).',
      ruleVi: 'Miễn thị thực 45 ngày hoặc e-Visa 90 ngày nhiều lần (đăng ký online từ 25 đến 50 USD).',
      tipEn: 'Apply for the 90-day e-Visa at least 7 working days before your flight if staying 1 to 3 months.',
      tipVi: 'Nên xin e-Visa 90 ngày trước ngày bay tối thiểu 7 ngày làm việc nếu bạn ở từ 1 đến 3 tháng.',
    },
    'USA / Canada / Australia': {
      ruleEn: '90-day single or multiple-entry Vietnam e-Visa via the official immigration portal.',
      ruleVi: 'Đăng ký e-Visa Việt Nam 90 ngày (1 lần hoặc nhiều lần) trên cổng thông tin xuất nhập cảnh.',
      tipEn: 'Flying directly to Phu Quoc Island gives an automatic 30-day visa-free stay for all passports.',
      tipVi: 'Bay thẳng quốc tế tới đảo Phú Quốc được miễn thị thực 30 ngày cho mọi hộ chiếu.',
    },
    'ASEAN Passports': {
      ruleEn: '21 to 30 days visa-free entry across all airports, plus 90-day e-Visa option.',
      ruleVi: 'Miễn thị thực 21 đến 30 ngày tại mọi sân bay quốc tế, hoặc xin thêm e-Visa 90 ngày.',
      tipEn: 'Every VietNomad host completes temporary residence registration for you automatically.',
      tipVi: 'Chủ nhà trên VietNomad sẽ hỗ trợ khai báo tạm trú theo đúng quy định địa phương.',
    },
  };

  async function handleRsvp(eventId: string) {
    if (!user) {
      window.location.assign('/login?next=/community');
      return;
    }
    setBusyId(eventId);
    try {
      const res = await fetch('/api/events/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });
      const json = await res.json();
      if (json.ok) {
        setJoinedIds((prev) => (prev.includes(eventId) ? prev : [...prev, eventId]));
        if (typeof json.spotsTaken === 'number') {
          setCounts((prev) => ({ ...prev, [eventId]: json.spotsTaken }));
        }
      }
    } finally {
      setBusyId(null);
    }
  }

  const activeVisa = visaInfo[passport] ?? visaInfo['UK / EU / Japan / Korea'];

  return (
    <div className="mx-auto max-w-7xl space-y-16 px-4 py-12 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-[#E5DFD3] bg-white p-6 sm:p-10 lacquer-shadow">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
          <div className="space-y-3 lg:col-span-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E7F1EC] px-3 py-1 text-xs font-semibold text-[#164E3F]">
              <ShieldCheck className="h-3.5 w-3.5" />
              {isVi ? 'Thông tin Visa Việt Nam 2026' : 'Vietnam Visa Checker'}
            </span>
            <h1 className="font-serif-display text-3xl font-semibold text-[#17221E] sm:text-4xl">
              {isVi
                ? 'Hướng dẫn Visa nhập cảnh và lưu trú dài ngày'
                : 'Simple 30 to 90-day stays in Vietnam'}
            </h1>
            <p className="text-sm text-[#53635D]">
              {isVi
                ? 'Chọn nhóm hộ chiếu để xem thời hạn miễn visa, quy định e-Visa 90 ngày và miễn visa riêng cho Phú Quốc.'
                : 'Pick your passport region to check visa-free entry windows and 90-day e-Visa rules.'}
            </p>
          </div>

          <div className="space-y-4 rounded-2xl border border-[#E5DFD3] bg-[#FAF8F3] p-5 lg:col-span-6">
            <label className="block">
              <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#53635D]">
                <Globe2 className="h-4 w-4 text-[#164E3F]" />
                {isVi ? 'Nhóm hộ chiếu' : 'Passport region'}
              </span>
              <select
                value={passport}
                onChange={(e) => setPassport(e.target.value)}
                className="w-full rounded-xl border border-[#E5DFD3] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#17221E]"
              >
                {Object.keys(visaInfo).map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-xl bg-white p-4 text-sm">
              <div className="font-bold text-[#164E3F]">
                {isVi ? activeVisa.ruleVi : activeVisa.ruleEn}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[#53635D]">
                {isVi ? activeVisa.tipVi : activeVisa.tipEn}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="max-w-2xl">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#C25E28]">
            {isVi ? 'Gặp mặt cộng đồng' : 'Community Meetups'}
          </span>
          <h2 className="font-serif-display mt-1 text-3xl font-semibold text-[#17221E]">
            {isVi
              ? 'Gặp gỡ cộng đồng tại Đà Nẵng, TP.HCM và Hà Nội'
              : 'Weekly meetups in Da Nang, Saigon, and Hanoi'}
          </h2>
          <p className="mt-1 text-sm text-[#53635D]">
            {isVi
              ? 'Giữ chỗ miễn phí cho các buổi cà phê và giao lưu hàng tuần.'
              : 'Reserve a free seat at weekly coffees, brunches, and local gatherings.'}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {events.map((ev) => {
            const joined = joinedIds.includes(ev.id);
            const taken = counts[ev.id] ?? ev.spotsTaken;
            return (
              <div
                key={ev.id}
                className="flex flex-col overflow-hidden rounded-3xl border border-[#E5DFD3] bg-white lacquer-shadow"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ev.imageUrl}
                  alt={isVi ? ev.titleVi : ev.titleEn}
                  className="aspect-[16/10] w-full object-cover"
                />
                <div className="flex flex-1 flex-col justify-between p-5">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#C25E28]">
                      <span>{isVi ? ev.cityVi : ev.cityEn}</span>
                      <span className="inline-flex items-center gap-1 text-[#53635D]">
                        <Users className="h-3.5 w-3.5" /> {taken}/{ev.spotsTotal}
                      </span>
                    </div>
                    <h3 className="font-serif-display text-xl font-semibold text-[#17221E]">
                      {isVi ? ev.titleVi : ev.titleEn}
                    </h3>
                    <div className="text-xs text-[#53635D]">
                      <Calendar className="mr-1 inline h-3.5 w-3.5 text-[#164E3F]" />
                      {ev.eventDate}
                    </div>
                    <div className="text-xs text-[#53635D]">
                      <MapPin className="mr-1 inline h-3.5 w-3.5 text-[#C25E28]" />
                      {isVi ? ev.venueVi : ev.venueEn}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={joined || busyId === ev.id}
                    onClick={() => handleRsvp(ev.id)}
                    className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${
                      joined
                        ? 'bg-[#E7F1EC] text-[#164E3F]'
                        : 'bg-[#164E3F] text-white hover:bg-[#0F392E]'
                    }`}
                  >
                    {joined ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        {isVi ? 'Đã giữ chỗ' : 'Seat reserved'}
                      </>
                    ) : busyId === ev.id ? (
                      '...'
                    ) : isVi ? (
                      'Đăng ký tham gia miễn phí'
                    ) : (
                      'Reserve free seat'
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section id="marketplace" className="space-y-6">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-widest text-[#164E3F]">
            <ShoppingBag className="h-3.5 w-3.5" /> {isVi ? 'Dịch vụ bổ trợ' : 'Gear & Connectivity'}
          </span>
          <h2 className="font-serif-display mt-1 text-3xl font-semibold text-[#17221E]">
            {isVi
              ? 'Thuê màn hình 4K, mua eSIM 5G và bảo hiểm du lịch'
              : 'Essential gear and connectivity in Vietnam'}
          </h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {marketplace.map((m) => (
            <div
              key={m.id}
              className="flex flex-col justify-between rounded-3xl border border-[#E5DFD3] bg-white p-5"
            >
              <div>
                <span className="rounded-full bg-[#FAF8F3] px-2.5 py-0.5 text-[11px] font-semibold uppercase text-[#C25E28]">
                  {m.category}
                </span>
                <h3 className="font-serif-display mt-2 text-lg font-semibold text-[#17221E]">
                  {isVi ? m.titleVi : m.titleEn}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[#53635D]">
                  {isVi ? m.summaryVi : m.summaryEn}
                </p>
              </div>
              <div className="mt-4 border-t border-[#E5DFD3] pt-3">
                <div className="text-sm font-bold text-[#164E3F]">{m.priceLabel}</div>
                <div className="mt-0.5 text-[11px] text-[#A67C2E]">
                  {isVi ? m.memberPerkVi : m.memberPerkEn}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
