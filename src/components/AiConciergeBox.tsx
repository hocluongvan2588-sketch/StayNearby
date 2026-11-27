'use client';

import { useState } from 'react';
import { Loader2, MessageCircle, Send } from 'lucide-react';
import { localizeGuestError } from '@/lib/error-copy';
import type { ConciergeResponse } from '@/modules/concierge';
import { usePreferences } from './PreferencesProvider';
import { PaginatedStayGrid } from './PaginatedStayGrid';

export function AiConciergeBox({ isAuthenticated }: { isAuthenticated: boolean }) {
  const { locale } = usePreferences();
  const isVi = locale === 'vi';

  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ConciergeResponse | null>(null);

  const presets = isVi
    ? [
        'Gần biển Đà Nẵng 2 tuần, có bếp riêng và nhiều quán ăn địa phương',
        'Đà Lạt yên tĩnh nghỉ dưỡng 1 tháng, giá dưới 700 USD',
        'Căn hộ ấm cúng tại Thảo Điền TP.HCM hoặc Phố cổ Hội An',
      ]
    : [
        'Beach stay in Da Nang for 2 weeks with full kitchen',
        'Quiet highland retreat in Da Lat for 1 month under $700',
        'Walkable apartment in Hoi An or Thao Dien Saigon',
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
        setError(localizeGuestError(json.error?.message, locale));
      } else {
        setResult(json.result);
      }
    } catch {
      setError(
        isVi ? 'Lỗi kết nối. Vui lòng thử lại.' : 'Connection failed. Please retry.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl bg-[#0F392E] p-6 text-[#FAF8F3] sm:p-10">
      <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
        <div className="space-y-3 lg:col-span-5">
          <h2 className="text-2xl font-semibold leading-tight sm:text-3xl">
            {isVi
              ? 'Mô tả kỳ nghỉ bạn mong muốn.'
              : 'Tell us what kind of stay you are looking for.'}
          </h2>
          <p className="text-sm leading-relaxed text-[#CDE0D9]">
            {isVi
              ? 'Gợi ý ngay chỗ ở còn phòng phù hợp theo thành phố, ngân sách, khu phố và tiện nghi sống.'
              : 'Instantly surface open stays matching your city, budget, neighborhood vibe, and home comforts.'}
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
                  ? 'Ví dụ: Gần biển Đà Nẵng 2 tuần, bếp riêng, dưới $900...'
                  : 'Example: Beach stay in Da Nang for 2 weeks, full kitchen, under $900...'
              }
              className="flex-1 rounded-xl border border-white/20 bg-white px-4 py-3 text-sm text-[#17221E] placeholder-[#53635D] outline-none focus:ring-2 focus:ring-[#E6B87A]"
            />
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#C25E28] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#ad5020] disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {isVi ? 'Tìm gợi ý' : 'Find stays'}
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
          <div className="flex flex-col justify-between gap-3 rounded-xl bg-white/10 p-4 text-sm text-[#FAF8F3] sm:flex-row sm:items-center">
            <div>
              <span className="mr-2 font-semibold text-[#E6B87A]">
                {isVi ? 'Kết quả phù hợp:' : 'Top matches:'}
              </span>
              {result.summary}
            </div>
            <a
              href={result.conciergeWhatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#25D366] px-4 py-2 text-xs font-bold text-[#0F392E] transition hover:brightness-105"
            >
              <MessageCircle className="h-4 w-4" />
              {isVi ? 'Hỏi hỗ trợ qua WhatsApp' : 'Ask via WhatsApp'}
            </a>
          </div>
          <PaginatedStayGrid
            stays={result.matches}
            isAuthenticated={isAuthenticated}
            gapClass="gap-5"
          />
        </div>
      )}
    </section>
  );
}
