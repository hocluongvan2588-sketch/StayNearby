'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, MessageSquare, Send, Star } from 'lucide-react';
import { usePreferences } from '@/components/PreferencesProvider';
import type { HostReviewsData } from '@/modules/host-console';

export function HostReviewsClient({
  initialData,
}: {
  initialData: HostReviewsData;
}) {
  const { locale } = usePreferences();
  const isVi = locale === 'vi';

  const [data, setData] = useState<HostReviewsData>(initialData);
  const [filter, setFilter] = useState<'all' | 'unreplied' | 'replied'>('all');
  const [stayId, setStayId] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState('');
  const [notice, setNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  async function reload(nextFilter = filter, nextStayId = stayId) {
    const sp = new URLSearchParams();
    sp.set('replyFilter', nextFilter);
    if (nextStayId) sp.set('stayId', nextStayId);
    const res = await fetch(`/api/host/reviews?${sp.toString()}`);
    const json = await res.json();
    if (json.ok) setData(json);
  }

  async function submitReply(reviewId: string) {
    const reply = (replyDrafts[reviewId] ?? '').trim();
    if (!reply) return;
    setBusyId(reviewId);
    setErrorMsg('');
    setNotice('');
    try {
      const res = await fetch(`/api/host/reviews/${reviewId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply }),
      });
      const json = await res.json();
      if (!json.ok) {
        setErrorMsg(json.error?.message ?? 'Could not post reply.');
        return;
      }
      setNotice(isVi ? 'Đã đăng phản hồi đánh giá.' : 'Reply posted.');
      await reload();
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif-display text-2xl font-semibold text-[#17221E]">
          {isVi ? 'Đánh giá từ khách lưu trú' : 'Guest Reviews'}
        </h1>
        <p className="mt-0.5 text-xs text-[#53635D]">
          {isVi
            ? 'Theo dõi phản hồi thực tế của khách và trả lời trực tiếp để nâng độ tin cậy.'
            : 'Read verified guest reviews and respond publicly to build trust.'}
        </p>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-[#164E3F]/30 bg-[#E7F1EC] px-4 py-2.5 text-xs font-medium text-[#164E3F]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl border border-[#C25E28]/40 bg-[#FAEDE5] px-4 py-2.5 text-xs font-medium text-[#C25E28]">
          {errorMsg}
        </div>
      )}

      {/* Summary Row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-[#E5DFD3] bg-white p-4">
          <div className="text-xs text-[#53635D]">{isVi ? 'Điểm trung bình' : 'Average score'}</div>
          <div className="mt-1 flex items-center gap-1.5 text-2xl font-semibold text-[#17221E]">
            <Star className="h-5 w-5 text-[#A67C2E]" />
            {data.summary.avgRating !== null ? data.summary.avgRating.toFixed(1) : '—'}
          </div>
        </div>
        <div className="rounded-xl border border-[#E5DFD3] bg-white p-4">
          <div className="text-xs text-[#53635D]">{isVi ? 'Tổng đánh giá' : 'Total reviews'}</div>
          <div className="mt-1 text-2xl font-semibold text-[#17221E]">{data.summary.totalCount}</div>
        </div>
        <div className="rounded-xl border border-[#E5DFD3] bg-white p-4">
          <div className="text-xs text-[#53635D]">{isVi ? 'Chưa phản hồi' : 'Unanswered'}</div>
          <div className="mt-1 text-2xl font-semibold text-[#C25E28]">
            {data.summary.unrepliedCount}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5 text-xs">
          {(
            [
              { key: 'all' as const, en: 'All', vi: 'Tất cả' },
              { key: 'unreplied' as const, en: 'Unanswered', vi: 'Chưa trả lời' },
              { key: 'replied' as const, en: 'Answered', vi: 'Đã trả lời' },
            ] as const
          ).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                setFilter(f.key);
                reload(f.key, stayId);
              }}
              className={`rounded-lg border px-3 py-1.5 font-medium ${
                filter === f.key
                  ? 'border-[#164E3F] bg-[#164E3F] text-white'
                  : 'border-[#E5DFD3] bg-white text-[#53635D]'
              }`}
            >
              {isVi ? f.vi : f.en}
            </button>
          ))}
        </div>

        <select
          value={stayId}
          onChange={(e) => {
            const v = e.target.value;
            setStayId(v);
            reload(filter, v);
          }}
          className="rounded-lg border border-[#E5DFD3] bg-white px-3 py-1.5 text-xs font-medium"
        >
          <option value="">{isVi ? 'Tất cả cơ sở' : 'All properties'}</option>
          {data.stays.map((s) => (
            <option key={s.id} value={s.id}>
              {isVi ? s.titleVi : s.titleEn}
            </option>
          ))}
        </select>
      </div>

      {/* Reviews List */}
      {data.reviews.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E5DFD3] bg-white p-12 text-center">
          <MessageSquare className="mx-auto h-9 w-9 text-[#53635D]" strokeWidth={1.5} />
          <h2 className="mt-3 text-sm font-semibold text-[#17221E]">
            {isVi ? 'Chưa có đánh giá nào được ghi nhận' : 'No guest reviews yet'}
          </h2>
          <p className="mt-1 text-xs text-[#53635D]">
            {isVi
              ? 'Sau khi khách hoàn tất lưu trú và gửi đánh giá tại trang chỗ ở, đánh giá sẽ hiển thị tại đây.'
              : 'Once guests complete a stay and submit a review on your listing page, it will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.reviews.map((rev) => (
            <article
              key={rev.id}
              className="space-y-3 rounded-xl border border-[#E5DFD3] bg-white p-5 text-xs"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#17221E]">{rev.guestName}</span>
                    {rev.bookingCode && (
                      <span className="font-mono text-[11px] text-[#164E3F]">
                        {rev.bookingCode}
                      </span>
                    )}
                  </div>
                  <div className="text-[#53635D]">
                    {isVi ? rev.stayTitleVi : rev.stayTitleEn} · {rev.createdAt.slice(0, 10)}
                  </div>
                </div>
                <div className="inline-flex items-center gap-1 rounded-md border border-[#E5DFD3] bg-[#FAF8F3] px-2.5 py-1 font-semibold text-[#17221E]">
                  <Star className="h-3.5 w-3.5 text-[#A67C2E]" />
                  {rev.rating}/5
                </div>
              </div>

              <p className="text-sm leading-relaxed text-[#17221E]">{rev.comment}</p>

              {rev.hostReply ? (
                <div className="rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] p-3">
                  <div className="font-semibold text-[#164E3F]">
                    {isVi ? 'Phản hồi của bạn' : 'Your reply'}
                  </div>
                  <p className="mt-1 text-[#53635D]">{rev.hostReply}</p>
                </div>
              ) : (
                <div className="flex gap-2 pt-1">
                  <input
                    value={replyDrafts[rev.id] ?? ''}
                    onChange={(e) =>
                      setReplyDrafts((prev) => ({ ...prev, [rev.id]: e.target.value }))
                    }
                    placeholder={
                      isVi ? 'Viết lời cảm ơn hoặc phản hồi...' : 'Write a reply to this review...'
                    }
                    className="flex-1 rounded-lg border border-[#E5DFD3] bg-[#FAF8F3] px-3 py-2 outline-none focus:border-[#164E3F]"
                  />
                  <button
                    type="button"
                    disabled={busyId === rev.id}
                    onClick={() => submitReply(rev.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#164E3F] px-3.5 py-2 font-semibold text-white hover:bg-[#0F392E]"
                  >
                    {busyId === rev.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    {isVi ? 'Gửi phản hồi' : 'Post reply'}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
