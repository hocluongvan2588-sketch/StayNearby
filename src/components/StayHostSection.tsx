'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, MessageSquare, Send, ShieldCheck, X } from 'lucide-react';
import type { SessionUser } from '@/lib/auth/session';
import { localizeGuestError } from '@/lib/error-copy';
import { formatCountryLabel, formatHostDisplayName, type Locale } from '@/lib/i18n';

interface HostMessageItem {
  id: string;
  senderName: string;
  senderRole: string;
  body: string;
  createdAt: string;
}

export function StayHostSection({
  staySlug,
  stayTitle,
  hostId,
  hostName,
  hostNationality,
  hostBio,
  hostAvatarUrl,
  hostVerified,
  user,
  locale,
}: {
  staySlug: string;
  stayTitle: string;
  hostId: string;
  hostName: string;
  hostNationality: string;
  hostBio: string;
  hostAvatarUrl: string;
  hostVerified: boolean;
  user: SessionUser | null;
  locale: Locale;
}) {
  const isVi = locale === 'vi';
  // Public display name only — never internal handles like "Admin (username)".
  const displayName = formatHostDisplayName(hostName) || (isVi ? 'Chủ nhà' : 'Host');
  const countryLabel = formatCountryLabel(hostNationality, locale);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [messages, setMessages] = useState<HostMessageItem[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sentNotice, setSentNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || 'VN';

  async function openContactModal() {
    setModalOpen(true);
    if (!user) return;
    setLoadingThread(true);
    try {
      const res = await fetch(`/api/stays/${encodeURIComponent(staySlug)}/contact`);
      const json = await res.json();
      if (json.ok && Array.isArray(json.messages)) {
        setMessages(json.messages);
      }
    } catch {
      // Ignore transient load failures
    } finally {
      setLoadingThread(false);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (body.length < 2) return;
    setSending(true);
    setErrorMsg('');
    setSentNotice('');
    try {
      const res = await fetch(`/api/stays/${encodeURIComponent(staySlug)}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const json = await res.json();
      if (!json.ok) {
        setErrorMsg(localizeGuestError(json.error?.message, locale));
        return;
      }
      if (json.message) {
        setMessages((prev) => [...prev, json.message]);
      }
      setDraft('');
      setSentNotice(
        isVi
          ? 'Tin nhắn đã được gửi tới hộp thư chủ nhà trên VietNomad.'
          : 'Your message has been sent to the host on VietNomad.'
      );
    } catch {
      setErrorMsg(isVi ? 'Lỗi kết nối.' : 'Network error.');
    } finally {
      setSending(false);
    }
  }

  const isOwnListing = user?.id === hostId;

  return (
    <section className="py-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div className="flex items-start gap-4">
          {hostAvatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={hostAvatarUrl}
              alt={displayName}
              className="h-14 w-14 shrink-0 rounded-full border border-[#E5DFD3] object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#164E3F] text-base font-semibold text-white">
              {initials}
            </div>
          )}

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[20px] font-semibold leading-snug text-[#17221E]">
                {isVi ? `Chủ nhà: ${displayName}` : `Hosted by ${displayName}`}
              </h2>
              {hostVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F1EC] px-2.5 py-0.5 text-xs font-medium text-[#164E3F]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {isVi ? 'Đã xác minh' : 'Verified host'}
                </span>
              )}
            </div>

            {hostNationality && (
              <p className="text-sm text-[#53635D]">
                {countryLabel && (isVi ? `Đến từ ${countryLabel}` : `Based in ${countryLabel}`)}
              </p>
            )}

            {hostBio && (
              <p className="pt-1.5 text-[15px] leading-relaxed text-[#53635D]">
                {hostBio}
              </p>
            )}
          </div>
        </div>

        {!isOwnListing && (
          <button
            type="button"
            onClick={openContactModal}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[#17221E] bg-white px-4 py-2.5 text-sm font-semibold text-[#17221E] transition hover:bg-[#FAF8F3]"
          >
            <MessageSquare className="h-4 w-4 stroke-[1.75]" />
            {isVi ? 'Liên hệ chủ nhà' : 'Contact host'}
          </button>
        )}
      </div>

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#E5DFD3] pb-4">
              <div>
                <h3 className="text-lg font-semibold text-[#17221E]">
                  {isVi ? `Nhắn tin cho ${displayName}` : `Message ${displayName}`}
                </h3>
                <p className="mt-0.5 text-xs text-[#53635D]">{stayTitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label={isVi ? 'Đóng' : 'Close'}
                className="rounded-full p-1.5 text-[#53635D] hover:bg-[#FAF8F3]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!user ? (
              <div className="space-y-4 py-6">
                <p className="text-sm leading-relaxed text-[#53635D]">
                  {isVi
                    ? 'Vui lòng đăng nhập tài khoản VietNomad để nhắn tin trực tiếp với chủ nhà và theo dõi lịch sử trao đổi.'
                    : 'Sign in to your VietNomad account to message the host directly and keep all inquiry details in one place.'}
                </p>
                <Link
                  href={`/login?next=${encodeURIComponent(`/stays/${staySlug}`)}`}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-[#164E3F] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0F392E]"
                >
                  {isVi ? 'Đăng nhập để nhắn tin' : 'Log in to message host'}
                </Link>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {loadingThread ? (
                  <div className="flex items-center gap-2 py-6 text-xs text-[#53635D]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isVi ? 'Đang tải cuộc trò chuyện...' : 'Loading conversation...'}
                  </div>
                ) : (
                  messages.length > 0 && (
                    <div className="max-h-56 space-y-2.5 overflow-y-auto rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] p-3.5">
                      {messages.map((m) => (
                        <div
                          key={m.id}
                          className={`rounded-xl px-3.5 py-2.5 text-sm ${
                            m.senderRole === 'guest'
                              ? 'ml-6 bg-[#164E3F] text-white'
                              : 'mr-6 border border-[#E5DFD3] bg-white text-[#17221E]'
                          }`}
                        >
                          <div className="mb-0.5 text-[11px] opacity-75">
                            {m.senderName} · {m.createdAt.slice(0, 10)}
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                        </div>
                      ))}
                    </div>
                  )
                )}

                <form onSubmit={handleSend} className="space-y-3">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-[#53635D]">
                      {isVi
                        ? 'Câu hỏi về phòng trống, giờ nhận phòng hoặc tiện ích'
                        : 'Ask about availability, check-in hours, or property amenities'}
                    </span>
                    <textarea
                      rows={3}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder={
                        isVi
                          ? 'Ví dụ: Chào anh/chị, mình dự kiến nhận phòng đầu tháng tới trong 30 đêm...'
                          : 'Hi, I am planning a 30-night stay next month and wanted to ask...'
                      }
                      className="w-full rounded-xl border border-[#E5DFD3] bg-[#FAF8F3] px-3.5 py-2.5 text-sm text-[#17221E] outline-none focus:border-[#164E3F]"
                    />
                  </label>

                  {sentNotice && (
                    <div className="flex items-center gap-1.5 text-xs font-medium text-[#164E3F]">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>{sentNotice}</span>
                    </div>
                  )}
                  {errorMsg && (
                    <div className="text-xs font-medium text-[#C25E28]">{errorMsg}</div>
                  )}

                  <button
                    type="submit"
                    disabled={sending || draft.trim().length < 2}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#164E3F] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0F392E] disabled:opacity-50"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {isVi ? 'Gửi tin nhắn' : 'Send message'}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
