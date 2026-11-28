'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Locale } from '@/lib/i18n';
import type { EventTaxonomy } from '@/modules/platform-settings';

interface DestinationOption {
  id: string;
  nameEn: string;
  nameVi: string;
}

const inputClass =
  'w-full rounded-lg border border-[#E5DFD3] bg-white px-3.5 py-2.5 text-sm text-[#17221E] focus:border-[#164E3F] focus:outline-none';
const labelClass = 'mb-1 block text-xs font-semibold text-[#53635D]';

/**
 * Public event submission form (Community spec §6). No account required.
 * Posts to /api/events/submissions — status becomes 'pending' for admin
 * review; nothing publishes automatically. Honeypot field `company` must
 * stay empty.
 */
export function SubmitEventForm({
  destinations,
  taxonomy,
  locale,
}: {
  destinations: DestinationOption[];
  taxonomy: EventTaxonomy;
  locale: Locale;
}) {
  const isVi = locale === 'vi';
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [priceType, setPriceType] = useState<'free' | 'paid'>('free');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const form = new FormData(e.currentTarget);
      const num = (key: string) => {
        const raw = String(form.get(key) ?? '').trim();
        return raw ? Number(raw) : null;
      };
      const payload = {
        title: String(form.get('title') ?? ''),
        organizerName: String(form.get('organizerName') ?? ''),
        contactName: String(form.get('contactName') ?? ''),
        contactEmail: String(form.get('contactEmail') ?? ''),
        category: String(form.get('category') ?? ''),
        destinationId: String(form.get('destinationId') ?? ''),
        venue: String(form.get('venue') ?? ''),
        mapsUrl: String(form.get('mapsUrl') ?? ''),
        startAt: String(form.get('startAt') ?? ''),
        endAt: String(form.get('endAt') ?? ''),
        language: String(form.get('language') ?? ''),
        imageUrl: String(form.get('imageUrl') ?? ''),
        description: String(form.get('description') ?? ''),
        priceType,
        priceAmount: priceType === 'paid' ? num('priceAmount') : null,
        priceCurrency: priceType === 'paid' ? String(form.get('priceCurrency') ?? 'USD') : 'USD',
        maxAttendees: num('maxAttendees'),
        sourceUrl: String(form.get('sourceUrl') ?? ''),
        conditions: String(form.get('conditions') ?? ''),
        rightsConfirmed: form.get('rightsConfirmed') === 'on',
        company: String(form.get('company') ?? ''),
      };
      const res = await fetch('/api/events/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(
          json.error?.message ||
            (isVi ? 'Không gửi được. Vui lòng thử lại.' : 'Could not submit. Please try again.')
        );
        return;
      }
      setDone(true);
    } catch {
      setError(isVi ? 'Không gửi được. Vui lòng thử lại.' : 'Could not submit. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="max-w-xl space-y-3">
        <p className="text-base font-semibold text-[#164E3F]">
          {isVi
            ? 'Đã nhận sự kiện của bạn'
            : 'Your event has been received'}
        </p>
        <p className="text-sm leading-relaxed text-[#53635D]">
          {isVi
            ? 'VietNomad sẽ kiểm duyệt thông tin trước khi xuất bản. Chúng tôi có thể liên hệ qua email bạn đã cung cấp nếu cần bổ sung chi tiết.'
            : 'VietNomad will review the details before publishing. We may email you if anything needs to be clarified.'}
        </p>
        <Link href="/community" className="text-sm font-semibold text-[#164E3F] hover:underline">
          {isVi ? '← Về Cộng đồng' : '← Back to Community'}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-5" noValidate>
      <div>
        <label className={labelClass} htmlFor="title">
          {isVi ? 'Tên sự kiện *' : 'Event name *'}
        </label>
        <input id="title" name="title" required maxLength={160} className={inputClass} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="organizerName">
            {isVi ? 'Cá nhân / đơn vị tổ chức *' : 'Organizer *'}
          </label>
          <input
            id="organizerName"
            name="organizerName"
            required
            maxLength={160}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="language">
            {isVi ? 'Ngôn ngữ tổ chức *' : 'Organizing language *'}
          </label>
          <select id="language" name="language" required defaultValue="en" className={inputClass}>
            {taxonomy.languages.map((l) => (
              <option key={l.slug} value={l.slug}>
                {isVi ? l.nameVi : l.nameEn}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="contactName">
            {isVi ? 'Tên người gửi *' : 'Your name *'}
          </label>
          <input
            id="contactName"
            name="contactName"
            required
            maxLength={120}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="contactEmail">
            {isVi ? 'Email liên hệ *' : 'Contact email *'}
          </label>
          <input
            id="contactEmail"
            name="contactEmail"
            type="email"
            required
            maxLength={200}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="category">
            {isVi ? 'Danh mục *' : 'Category *'}
          </label>
          <select id="category" name="category" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              {isVi ? 'Chọn danh mục' : 'Pick a category'}
            </option>
            {taxonomy.categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {isVi ? c.nameVi : c.nameEn}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="destinationId">
            {isVi ? 'Thành phố *' : 'City *'}
          </label>
          <select
            id="destinationId"
            name="destinationId"
            required
            defaultValue=""
            className={inputClass}
          >
            <option value="" disabled>
              {isVi ? 'Chọn thành phố' : 'Pick a city'}
            </option>
            {destinations.map((d) => (
              <option key={d.id} value={d.id}>
                {isVi ? d.nameVi : d.nameEn}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="venue">
          {isVi ? 'Địa điểm *' : 'Venue *'}
        </label>
        <input id="venue" name="venue" required maxLength={200} className={inputClass} />
      </div>

      <div>
        <label className={labelClass} htmlFor="mapsUrl">
          {isVi ? 'Liên kết Google Maps (nếu có)' : 'Google Maps link (optional)'}
        </label>
        <input
          id="mapsUrl"
          name="mapsUrl"
          type="url"
          placeholder="https://maps.app.goo.gl/…"
          maxLength={500}
          className={inputClass}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="startAt">
            {isVi ? 'Bắt đầu *' : 'Starts *'}
          </label>
          <input id="startAt" name="startAt" type="datetime-local" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="endAt">
            {isVi ? 'Kết thúc (nếu có)' : 'Ends (optional)'}
          </label>
          <input id="endAt" name="endAt" type="datetime-local" className={inputClass} />
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="imageUrl">
          {isVi ? 'Hình ảnh sự kiện — liên kết ảnh' : 'Event image — image URL'}
        </label>
        <input
          id="imageUrl"
          name="imageUrl"
          type="url"
          placeholder="https://…"
          maxLength={500}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-[#53635D]">
          {isVi
            ? 'Dùng ảnh do bạn sở hữu quyền sử dụng. Ảnh chỗ ở không phù hợp.'
            : 'Use an image you have the rights to. Stay photos are not a fit.'}
        </p>
      </div>

      <div>
        <label className={labelClass} htmlFor="description">
          {isVi ? 'Nội dung giới thiệu *' : 'Description *'}
        </label>
        <textarea
          id="description"
          name="description"
          required
          minLength={20}
          maxLength={2000}
          rows={5}
          className={inputClass}
        />
      </div>

      <div>
        <span className={labelClass}>{isVi ? 'Chi phí tham gia *' : 'Participation fee *'}</span>
        <div className="flex gap-4 text-sm text-[#17221E]">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="priceType"
              value="free"
              checked={priceType === 'free'}
              onChange={() => setPriceType('free')}
            />
            {isVi ? 'Miễn phí' : 'Free'}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="priceType"
              value="paid"
              checked={priceType === 'paid'}
              onChange={() => setPriceType('paid')}
            />
            {isVi ? 'Có phí' : 'Paid'}
          </label>
        </div>
        {priceType === 'paid' ? (
          <div className="mt-2 flex gap-3">
            <input
              name="priceAmount"
              type="number"
              min="0.01"
              step="0.01"
              required
              placeholder={isVi ? 'Giá' : 'Amount'}
              className={`w-40 ${inputClass}`}
            />
            <select
              name="priceCurrency"
              defaultValue="USD"
              className={`w-28 ${inputClass}`}
            >
              <option value="USD">USD</option>
              <option value="VND">VND</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="maxAttendees">
            {isVi ? 'Số người tối đa (nếu có)' : 'Max attendees (optional)'}
          </label>
          <input id="maxAttendees" name="maxAttendees" type="number" min="1" className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="sourceUrl">
            {isVi ? 'Website / liên kết đăng ký chính thức' : 'Official website / registration link'}
          </label>
          <input
            id="sourceUrl"
            name="sourceUrl"
            type="url"
            placeholder="https://…"
            maxLength={500}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-[#53635D]">
            {isVi
              ? 'Có liên kết: nút Đăng ký sẽ trỏ tới trang này.'
              : 'If set, the Register button links here.'}
          </p>
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="conditions">
          {isVi ? 'Điều kiện tham gia (nếu có)' : 'Conditions (optional)'}
        </label>
        <textarea id="conditions" name="conditions" maxLength={2000} rows={3} className={inputClass} />
      </div>

      {/* honeypot */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      <label className="flex items-start gap-2 text-sm text-[#17221E]">
        <input type="checkbox" name="rightsConfirmed" required className="mt-1" />
        <span>
          {isVi
            ? 'Tôi xác nhận mình có quyền sử dụng nội dung và hình ảnh của sự kiện này.'
            : 'I confirm I have the rights to use the content and images for this event.'}
        </span>
      </label>

      {error ? <p className="text-sm font-semibold text-[#B42318]">{error}</p> : null}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-11 items-center justify-center rounded-xl bg-[#164E3F] px-6 text-sm font-semibold text-white transition hover:bg-[#0F392E] disabled:opacity-60"
      >
        {busy ? '…' : isVi ? 'Gửi duyệt' : 'Submit for review'}
      </button>
    </form>
  );
}
