'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  MapPin,
  Shield,
  Star,
} from 'lucide-react';
import type { SessionUser } from '@/lib/auth/session';
import { localizeGuestError } from '@/lib/error-copy';
import {
  formatCancellationPolicyLabel,
  formatCountNoun,
  formatNightsLabel,
  type Locale,
} from '@/lib/i18n';
import type { StayGuestReviewItem, StayRoomDetail } from '@/modules/catalog';
import type { HostHouseRules } from '@/modules/host';

export function StayGuestReviewsSection({
  slug,
  user,
  locale,
  checkinFrom,
  checkoutBefore,
  defaultMinNights,
  cancellationPolicy,
  serviceFeePct,
  houseRules,
  rooms,
  initialReviews,
  initialAvg,
  googleRating,
  googleReviewCount,
  destinationSlug,
  destinationName,
  neighborhoodName,
  destinationTagline,
  lat,
  lng,
}: {
  slug: string;
  user: SessionUser | null;
  locale: Locale;
  checkinFrom: string;
  checkoutBefore: string;
  defaultMinNights: number;
  cancellationPolicy: string;
  serviceFeePct: number;
  houseRules: HostHouseRules;
  rooms: StayRoomDetail[];
  initialReviews: StayGuestReviewItem[];
  initialAvg: number | null;
  googleRating: number;
  googleReviewCount: number;
  destinationSlug: string;
  destinationName: string;
  neighborhoodName: string;
  destinationTagline: string;
  lat: number | null;
  lng: number | null;
}) {
  const isVi = locale === 'vi';
  const [reviews, setReviews] = useState<StayGuestReviewItem[]>(initialReviews);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [errMsg, setErrMsg] = useState('');

  // Record 1 view event per browser session
  useEffect(() => {
    try {
      const key = `vn_viewed_${slug}`;
      if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        fetch(`/api/stays/${encodeURIComponent(slug)}/view`, { method: 'POST' }).catch(() => {});
      }
    } catch {
      // ignore storage errors
    }
  }, [slug]);

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmitting(true);
    setErrMsg('');
    setNotice('');
    try {
      const res = await fetch(`/api/stays/${encodeURIComponent(slug)}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment: comment.trim() }),
      });
      const json = await res.json();
      if (!json.ok) {
        setErrMsg(localizeGuestError(json.error?.message, locale));
        return;
      }
      if (json.review) {
        setReviews((prev) => [
          {
            id: json.review.id,
            guestName: user?.fullName ?? 'Guest',
            rating: json.review.rating,
            comment: json.review.comment,
            hostReply: null,
            hostRepliedAt: null,
            createdAt: json.review.createdAt,
          },
          ...prev,
        ]);
      }
      setComment('');
      setNotice(isVi ? 'Cảm ơn bạn đã gửi đánh giá.' : 'Thank you for your review.');
    } finally {
      setSubmitting(false);
    }
  }

  const areaMapsUrl =
    lat !== null && lng !== null
      ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          [neighborhoodName, destinationName, 'Vietnam'].filter(Boolean).join(', ')
        )}`;

  const policyDescription =
    cancellationPolicy === 'flexible'
      ? isVi
        ? 'Hoàn phí dịch vụ linh hoạt khi hủy sớm trước ngày nhận phòng.'
        : 'Flexible cancellation terms before check-in.'
      : cancellationPolicy === 'strict'
        ? isVi
          ? 'Áp dụng điều khoản hủy chặt chẽ cho phí giữ phòng.'
          : 'Strict cancellation terms apply to the online reservation fee.'
        : isVi
          ? 'Hoàn hủy theo tiêu chuẩn trước thời hạn quy định.'
          : 'Standard cancellation terms apply prior to arrival.';

  return (
    <div className="divide-y divide-[#E5DFD3]">
      {/* Section 10: Policies & House Rules (Open Section Layout, no Cards) */}
      <section className="py-10">
        <h2 className="text-[22px] font-semibold tracking-tight text-[#17221E] sm:text-[24px]">
          {isVi ? 'Những điều cần biết' : 'Things to know'}
        </h2>

        <div className="mt-6 grid gap-8 md:grid-cols-3">
          {/* Column 1: House Rules */}
          <div className="space-y-3 text-sm">
            <h3 className="text-base font-semibold text-[#17221E]">
              {isVi ? 'Nội quy chỗ ở' : 'House rules'}
            </h3>
            <ul className="space-y-2.5 text-[#53635D]">
              <li className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0 text-[#17221E]" />
                <span>
                  {isVi ? `Nhận phòng từ ${checkinFrom}` : `Check-in after ${checkinFrom}`}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0 text-[#17221E]" />
                <span>
                  {isVi ? `Trả phòng trước ${checkoutBefore}` : `Check-out before ${checkoutBefore}`}
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Shield className="h-4 w-4 shrink-0 text-[#17221E]" />
                <span>
                  {isVi
                    ? `Tối thiểu ${formatNightsLabel(defaultMinNights, locale)}`
                    : `Minimum stay: ${formatNightsLabel(defaultMinNights, locale)}`}
                </span>
              </li>
              <li>
                {houseRules.smokingAllowed
                  ? isVi
                    ? 'Cho phép hút thuốc'
                    : 'Smoking allowed'
                  : isVi
                    ? 'Không hút thuốc trong phòng'
                    : 'No smoking indoors'}
              </li>
              <li>
                {houseRules.partiesAllowed
                  ? isVi
                    ? 'Cho phép tụ họp nhỏ'
                    : 'Small gatherings allowed'
                  : isVi
                    ? 'Không tổ chức tiệc tùng'
                    : 'No parties or events'}
              </li>
              {houseRules.quietHours && (
                <li>
                  {isVi
                    ? `Giờ yên tĩnh: ${houseRules.quietHours}`
                    : `Quiet hours: ${houseRules.quietHours}`}
                </li>
              )}
              {(houseRules.petsNote || houseRules.extraGuestNote) && (
                <li className="pt-1 text-xs">
                  {[houseRules.petsNote, houseRules.extraGuestNote].filter(Boolean).join(' · ')}
                </li>
              )}
            </ul>
          </div>

          {/* Column 2: Payment & Cancellation Policy */}
          <div className="space-y-3 text-sm">
            <h3 className="text-base font-semibold text-[#17221E]">
              {isVi ? 'Chính sách hủy & Thanh toán' : 'Cancellation & payment'}
            </h3>
            <div className="space-y-2.5 leading-relaxed text-[#53635D]">
              <p className="font-medium text-[#17221E]">
                {formatCancellationPolicyLabel(cancellationPolicy, locale)}
              </p>
              <p>{policyDescription}</p>
              <p>
                {isVi
                  ? `Thanh toán ${serviceFeePct}% phí dịch vụ online để giữ phòng. Phần tiền thuê trả trực tiếp cho chủ nhà khi nhận phòng.`
                  : `Pay the ${serviceFeePct}% service fee online to lock your dates. Settle stay rent directly with your host at check-in.`}
              </p>
            </div>
          </div>

          {/* Column 3: Available Rooms / Configuration */}
          <div className="space-y-3 text-sm">
            <h3 className="text-base font-semibold text-[#17221E]">
              {isVi ? 'Cấu hình phòng' : 'Room options'}
            </h3>
            <ul className="space-y-2.5 text-[#53635D]">
              {rooms.map((rm) => {
                const roomName = isVi ? rm.nameVi : rm.nameEn;
                const specs = [
                  formatCountNoun(rm.maxGuests, 'guest', 'guests', 'khách', locale),
                  formatCountNoun(rm.bedsCount, 'bed', 'beds', 'giường', locale),
                  rm.areaSqm ? `${rm.areaSqm} m²` : null,
                ]
                  .filter(Boolean)
                  .join(' · ');
                return (
                  <li key={rm.id}>
                    <div className="font-medium text-[#17221E]">{roomName}</div>
                    <div className="text-xs">{specs}</div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* Section 11A: Guest Reviews (Open Section Layout) */}
      <section className="py-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-[22px] font-semibold tracking-tight text-[#17221E] sm:text-[24px]">
              {initialAvg !== null
                ? `${initialAvg.toFixed(1)} · ${formatCountNoun(
                    reviews.length,
                    'guest review',
                    'guest reviews',
                    'đánh giá từ khách VietNomad',
                    locale
                  )}`
                : isVi
                  ? 'Đánh giá từ khách lưu trú'
                  : 'Guest reviews'}
            </h2>
          </div>

          {googleReviewCount > 0 && (
            <div className="inline-flex items-center gap-1.5 text-sm text-[#53635D]">
              <Star className="h-4 w-4 text-[#A67C2E]" fill="#A67C2E" />
              <span>
                {googleRating.toFixed(1)} ({googleReviewCount}{' '}
                {isVi ? 'đánh giá trên Google' : 'Google reviews'})
              </span>
            </div>
          )}
        </div>

        {reviews.length === 0 ? (
          <p className="mt-4 text-sm text-[#53635D]">
            {isVi
              ? 'Chưa có đánh giá trực tiếp từ khách đặt qua VietNomad Stays cho chỗ ở này.'
              : 'No direct VietNomad Stays guest reviews have been posted for this place yet.'}
          </p>
        ) : (
          <div className="mt-6 grid gap-x-10 gap-y-6 md:grid-cols-2">
            {reviews.map((rv) => {
              const guestInitials =
                rv.guestName
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((p) => p[0]?.toUpperCase() ?? '')
                  .join('') || 'G';
              return (
                <article key={rv.id} className="space-y-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F2EDE3] text-xs font-semibold text-[#17221E]">
                        {guestInitials}
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-[#17221E]">
                          {rv.guestName}
                        </div>
                        <div className="text-xs text-[#53635D]">
                          {rv.createdAt.slice(0, 10)}
                        </div>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#17221E]">
                      <Star className="h-3.5 w-3.5 text-[#17221E]" fill="#17221E" />
                      {rv.rating.toFixed(1)}
                    </span>
                  </div>

                  <p className="text-[15px] leading-relaxed text-[#17221E]/90">
                    {rv.comment}
                  </p>

                  {rv.hostReply && (
                    <div className="border-l-2 border-[#E5DFD3] pl-3.5 text-xs text-[#53635D]">
                      <span className="font-semibold text-[#164E3F]">
                        {isVi ? 'Phản hồi của chủ nhà: ' : 'Host reply: '}
                      </span>
                      {rv.hostReply}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {user && (
          <form
            onSubmit={handleSubmitReview}
            className="mt-8 max-w-xl space-y-3 border-t border-[#E5DFD3] pt-6 text-sm"
          >
            <div className="font-semibold text-[#17221E]">
              {isVi ? 'Chia sẻ trải nghiệm lưu trú của bạn' : 'Leave a guest review'}
            </div>
            {notice && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-[#164E3F]">
                <CheckCircle2 className="h-4 w-4" />
                <span>{notice}</span>
              </div>
            )}
            {errMsg && <div className="text-xs font-medium text-[#C25E28]">{errMsg}</div>}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#53635D]">{isVi ? 'Chấm điểm:' : 'Rating:'}</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className={`rounded-lg border px-2.5 py-1 font-semibold transition ${
                    rating >= n
                      ? 'border-[#164E3F] bg-[#E7F1EC] text-[#164E3F]'
                      : 'border-[#E5DFD3] bg-white text-[#53635D]'
                  }`}
                >
                  {n}★
                </button>
              ))}
            </div>
            <textarea
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                isVi
                  ? 'Chia sẻ về không gian, sự sạch sẽ, vị trí hoặc hỗ trợ của chủ nhà...'
                  : 'Share your thoughts on the space, neighborhood, and host communication...'
              }
              className="w-full rounded-xl border border-[#E5DFD3] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#164E3F]"
            />
            <button
              type="submit"
              disabled={submitting || !comment.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#164E3F] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0F392E] disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isVi ? 'Gửi đánh giá' : 'Submit review'}
            </button>
          </form>
        )}
      </section>

      {/* Section 11B: Neighborhood Location Context */}
      <section className="py-10">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-[22px] font-semibold tracking-tight text-[#17221E] sm:text-[24px]">
              {isVi ? 'Khu vực chỗ ở' : 'Where you’ll be'}
            </h2>
            <div className="flex items-center gap-1.5 text-sm font-medium text-[#17221E]">
              <MapPin className="h-4 w-4 text-[#C25E28]" />
              <span>
                {[neighborhoodName, destinationName].filter(Boolean).join(', ')}
              </span>
            </div>
            {destinationTagline && (
              <p className="text-[15px] leading-relaxed text-[#53635D]">
                {destinationTagline}
              </p>
            )}
            <p className="text-xs text-[#53635D]">
              {isVi
                ? 'Địa chỉ chính xác và hướng dẫn nhận phòng chi tiết sẽ được chia sẻ ngay sau khi xác nhận đặt phòng.'
                : 'Exact street address and check-in instructions are shared right after booking confirmation.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <a
              href={areaMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#17221E] bg-white px-4 py-2.5 text-xs font-semibold text-[#17221E] transition hover:bg-[#FAF8F3]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {isVi ? 'Xem khu vực trên Google Maps' : 'Open area in Google Maps'}
            </a>
            <Link
              href={`/destinations/${destinationSlug}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#FAF8F3] px-4 py-2.5 text-xs font-semibold text-[#164E3F] hover:bg-[#E7F1EC]"
            >
              {isVi ? `Cẩm nang ${destinationName}` : `${destinationName} guide`}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
