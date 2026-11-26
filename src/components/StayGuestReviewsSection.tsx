'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Loader2, Shield, Star } from 'lucide-react';
import type { SessionUser } from '@/lib/auth/session';
import type { Locale } from '@/lib/i18n';
import type { StayGuestReviewItem } from '@/modules/catalog';
import type { HostHouseRules } from '@/modules/host';

export function StayGuestReviewsSection({
  slug,
  user,
  locale,
  checkinFrom,
  checkoutBefore,
  defaultMinNights,
  houseRules,
  initialReviews,
  initialAvg,
}: {
  slug: string;
  user: SessionUser | null;
  locale: Locale;
  checkinFrom: string;
  checkoutBefore: string;
  defaultMinNights: number;
  houseRules: HostHouseRules;
  initialReviews: StayGuestReviewItem[];
  initialAvg: number | null;
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
        setErrMsg(json.error?.message ?? 'Could not submit review.');
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

  return (
    <div className="space-y-8">
      {/* House Rules */}
      <section className="rounded-3xl border border-[#E5DFD3] bg-white p-6">
        <h2 className="font-serif-display text-2xl font-semibold text-[#17221E]">
          {isVi ? 'Nội quy & Giờ nhận trả phòng' : 'House rules & check-in times'}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3 text-xs">
          <div className="rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] p-3">
            <div className="flex items-center gap-1.5 text-[#53635D]">
              <Clock className="h-3.5 w-3.5 text-[#164E3F]" />
              {isVi ? 'Nhận phòng từ' : 'Check-in'}
            </div>
            <div className="mt-1 font-semibold text-[#17221E]">{checkinFrom}</div>
          </div>
          <div className="rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] p-3">
            <div className="flex items-center gap-1.5 text-[#53635D]">
              <Clock className="h-3.5 w-3.5 text-[#164E3F]" />
              {isVi ? 'Trả phòng trước' : 'Check-out'}
            </div>
            <div className="mt-1 font-semibold text-[#17221E]">{checkoutBefore}</div>
          </div>
          <div className="rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] p-3">
            <div className="flex items-center gap-1.5 text-[#53635D]">
              <Shield className="h-3.5 w-3.5 text-[#164E3F]" />
              {isVi ? 'Lưu trú tối thiểu' : 'Minimum stay'}
            </div>
            <div className="mt-1 font-semibold text-[#17221E]">
              {defaultMinNights} {isVi ? 'đêm' : 'night(s)'}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#53635D]">
          <span className="rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-1">
            {houseRules.smokingAllowed
              ? isVi ? 'Cho phép hút thuốc' : 'Smoking allowed'
              : isVi ? 'Không hút thuốc trong phòng' : 'No smoking indoors'}
          </span>
          <span className="rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-1">
            {houseRules.partiesAllowed
              ? isVi ? 'Cho phép tiệc nhỏ' : 'Small gatherings allowed'
              : isVi ? 'Không tổ chức tiệc' : 'No parties or events'}
          </span>
          <span className="rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-1">
            {isVi ? `Giờ yên tĩnh: ${houseRules.quietHours}` : `Quiet hours: ${houseRules.quietHours}`}
          </span>
        </div>
        {(houseRules.petsNote || houseRules.extraGuestNote) && (
          <p className="mt-3 text-xs text-[#53635D]">
            {[houseRules.petsNote, houseRules.extraGuestNote].filter(Boolean).join(' · ')}
          </p>
        )}
      </section>

      {/* Verified Guest Reviews */}
      <section className="rounded-3xl border border-[#E5DFD3] bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif-display text-2xl font-semibold text-[#17221E]">
            {isVi ? 'Đánh giá từ khách VietNomad Stays' : 'VietNomad Guest Reviews'}
          </h2>
          {initialAvg !== null && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-1 text-xs font-semibold">
              <Star className="h-3.5 w-3.5 text-[#A67C2E]" fill="#A67C2E" />
              {initialAvg.toFixed(1)} ({reviews.length})
            </span>
          )}
        </div>

        {reviews.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#E5DFD3] bg-[#FAF8F3] p-4 text-xs text-[#53635D]">
            {isVi
              ? 'Chưa có đánh giá nào từ khách đặt trên VietNomad Stays cho chỗ ở này.'
              : 'No VietNomad Stays guest reviews have been posted for this residence yet.'}
          </p>
        ) : (
          <div className="space-y-3">
            {reviews.map((rv) => (
              <div
                key={rv.id}
                className="rounded-2xl border border-[#E5DFD3] bg-[#FAF8F3] p-4 text-xs space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#17221E]">{rv.guestName}</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-[#A67C2E]">
                    <Star className="h-3.5 w-3.5" fill="#A67C2E" />
                    {rv.rating}/5 · {rv.createdAt.slice(0, 10)}
                  </span>
                </div>
                <p className="text-sm text-[#17221E]">{rv.comment}</p>
                {rv.hostReply && (
                  <div className="rounded-xl border border-[#E5DFD3] bg-white p-3">
                    <div className="font-semibold text-[#164E3F]">
                      {isVi ? 'Phản hồi từ chủ nhà' : 'Host reply'}
                    </div>
                    <p className="mt-0.5 text-[#53635D]">{rv.hostReply}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {user && (
          <form onSubmit={handleSubmitReview} className="space-y-3 border-t border-[#E5DFD3] pt-4 text-xs">
            <div className="font-semibold text-[#17221E]">
              {isVi ? 'Chia sẻ trải nghiệm lưu trú của bạn' : 'Leave a guest review'}
            </div>
            {notice && (
              <div className="flex items-center gap-1.5 text-[#164E3F] font-medium">
                <CheckCircle2 className="h-4 w-4" />
                <span>{notice}</span>
              </div>
            )}
            {errMsg && <div className="text-[#C25E28] font-medium">{errMsg}</div>}
            <div className="flex items-center gap-2">
              <span className="text-[#53635D]">{isVi ? 'Chấm điểm:' : 'Rating:'}</span>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className={`rounded-lg border px-2.5 py-1 font-semibold ${
                    rating >= n
                      ? 'border-[#A67C2E] bg-[#FDF4DF] text-[#8E651A]'
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
                  ? 'Chia sẻ về không gian, sự sạch sẽ, tốc độ hỗ trợ của chủ nhà...'
                  : 'Share your thoughts on cleanliness, comfort, and host communication...'
              }
              className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 outline-none focus:border-[#164E3F]"
            />
            <button
              type="submit"
              disabled={submitting || !comment.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#164E3F] px-4 py-2 font-semibold text-white hover:bg-[#0F392E] disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isVi ? 'Gửi đánh giá' : 'Submit review'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
