'use client';

import { useState } from 'react';
import { Loader2, MessageCircle, Send, Sparkles } from 'lucide-react';
import type { ConciergeResponse } from '@/modules/concierge';
import { usePreferences } from './PreferencesProvider';
import { StayCard } from './StayCard';

export function AiConciergeBox({ isAuthenticated }: { isAuthenticated: boolean }) {
  const { locale } = usePreferences();
  const isVi = locale === 'vi';

  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ConciergeResponse | null>(null);

  const presets = isVi
    ? [
        'Gần biển Đà Nẵng 1 tháng, Wi-Fi 400+ Mbps, có màn hình 4K',
        'Yên tĩnh giữa rừng thông Đà Lạt, dưới $700/tháng',
        'Coliving tại Thảo Điền TP.HCM có bốt họp riêng',
      ]
    : [
        'Beach base in Da Nang for 1 month, 400+ Mbps, 4K monitor',
        'Quiet mountain month in Da Lat under $700',
        'Thao Dien Saigon coliving with call booths & founder community',
      ];

  async function submitPrompt(textToRun: string) {
    const clean = textToRun.trim();
    if (clean.length < 3) return;
    setPrompt(clean);
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/concierge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: clean }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error?.message ?? 'Could not run concierge search.');
      } else {
        setResult(json.result);
      }
    } catch {
      setError('Connection failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-[#164E3F]/20 bg-[#0F392E] p-6 text-[#FAF8F3] sm:p-10 lacquer-shadow">
      <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
        <div className="space-y-4 lg:col-span-5">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-[#E6B87A]">
            <Sparkles className="h-3.5 w-3.5" />
            {isVi ? 'Trợ lý chọn phòng trực tiếp' : 'Live Inventory AI Concierge'}
          </div>
          <h2 className="font-serif-display text-3xl font-semibold leading-tight">
            {isVi
              ? 'Mô tả tháng làm việc của bạn. Chúng tôi lọc ngay chỗ ở còn trống.'
              : 'Tell us the month. We’ll shortlist live Vietnam stays.'}
          </h2>
          <p className="text-sm leading-relaxed text-[#CDE0D9]">
            {isVi
              ? 'Trợ lý truy vấn trực tiếp bảng giá thực tế và tốc độ Wi-Fi đã kiểm định — không phải chatbot tư vấn chung chung.'
              : 'Searches our real-time Vietnam room packages, verified Mbps measurements, and live dates — never a generic travel chatbot.'}
          </p>
        </div>

        <div className="space-y-4 lg:col-span-7">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitPrompt(prompt);
            }}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                isVi
                  ? 'Ví dụ: Ở 1 tháng gần biển Đà Nẵng, Wi-Fi 400+ Mbps...'
                  : 'e.g. Beach month in Da Nang, 400+ Mbps Wi-Fi, under $900...'
              }
              className="flex-1 rounded-xl border border-white/20 bg-white px-4 py-3 text-sm text-[#17221E] placeholder-[#53635D] outline-none focus:ring-2 focus:ring-[#E6B87A]"
            />
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#C25E28] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#ad5020] disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isVi ? 'Tìm ngay' : 'Shortlist'}
            </button>
          </form>

          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => submitPrompt(p)}
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-left text-xs text-[#E7F1EC] transition hover:bg-white/20"
              >
                {p}
              </button>
            ))}
          </div>

          {error && (
            <div className="rounded-xl bg-[#C25E28]/25 px-4 py-2 text-xs text-white">
              {error}
            </div>
          )}
        </div>
      </div>

      {result && (
        <div className="mt-8 space-y-5 border-t border-white/15 pt-6">
          <div className="flex flex-col justify-between gap-3 rounded-2xl bg-white/10 p-4 text-sm text-[#FAF8F3] sm:flex-row sm:items-center">
            <div>
              <span className="mr-2 font-semibold text-[#E6B87A]">VietNomad AI:</span>
              {result.summary}
            </div>
            <a
              href={result.conciergeWhatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#25D366] px-4 py-2 text-xs font-bold text-[#0F392E] transition hover:brightness-105"
            >
              <MessageCircle className="h-4 w-4" />
              {isVi ? 'Chat Concierge (WhatsApp)' : 'Chat with Local Concierge (WhatsApp)'}
            </a>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {result.matches.map((stay) => (
              <StayCard key={stay.id} stay={stay} isAuthenticated={isAuthenticated} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
