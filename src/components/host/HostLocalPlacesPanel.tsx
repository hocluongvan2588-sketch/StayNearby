'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ListingInput, ListingSelect, ListingTextarea } from '@/components/listing-form';
import { usePreferences } from '@/components/PreferencesProvider';
import {
  PLACE_CATEGORIES,
  PLACE_CATEGORY_LABELS,
  type PlaceCategory,
} from '@/lib/place-categories';

/**
 * Host Console → Listing Editor → "6. Local Recommendations".
 * Optional contribution flow: search existing verified places or propose a
 * new one. Everything lands in place_suggestions as 'pending' — VietNomad
 * moderates before anything is public. Hosts never edit shared place data.
 */

type Link = {
  placeId: string;
  name: string;
  category: string;
  address: string;
  distanceLabel: string;
  hostNote: string;
  source: 'curated' | 'host_suggested';
};

type Suggestion = {
  id: string;
  placeId: string | null;
  name: string;
  category: string;
  address: string;
  reason: string;
  distanceLabel: string;
  googleMapsUrl: string;
  status: 'pending' | 'needs_info' | 'approved' | 'rejected';
  reviewNote: string;
  linked: boolean;
};

type SearchHit = {
  placeId: string;
  name: string;
  category: string;
  address: string;
};

const STATUS_LABEL: Record<Suggestion['status'], { en: string; vi: string; className: string }> = {
  pending: { en: 'Pending review', vi: 'Chờ duyệt', className: 'text-[#8A6D1F]' },
  approved: { en: 'Approved', vi: 'Đã duyệt', className: 'text-[#164E3F]' },
  needs_info: { en: 'Needs more info', vi: 'Cần bổ sung thông tin', className: 'text-[#1D4ED8]' },
  rejected: { en: 'Not approved', vi: 'Không được duyệt', className: 'text-[#B42318]' },
};

const emptyForm = {
  name: '',
  category: 'restaurant' as PlaceCategory,
  address: '',
  googleMapsUrl: '',
  distanceLabel: '',
  imageUrl: '',
  reason: '',
};

export function HostLocalPlacesPanel({ stayId }: { stayId: string }) {
  const { locale } = usePreferences();
  const isVi = locale === 'vi';
  const t = (en: string, vi: string) => (isVi ? vi : en);

  const [links, setLinks] = useState<Link[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/host/stays/${stayId}/local-places`);
      if (!res.ok) throw new Error('load failed');
      const data = (await res.json()) as { links: Link[]; suggestions: Suggestion[] };
      setLinks(data.links);
      setSuggestions(data.suggestions);
    } catch {
      setError(t('Không tải được danh sách địa điểm.', 'Could not load places.'));
    } finally {
      setLoading(false);
    }
  }, [stayId, isVi]);

  useEffect(() => {
    // Deferred: never block hydration with a data fetch on mount.
    const timer = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stayId]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const term = query.trim();
    debounceRef.current = setTimeout(
      async () => {
        if (!term) {
          setHits([]);
          return;
        }
        setSearching(true);
        try {
          const res = await fetch(
            `/api/host/stays/${stayId}/local-places/search?q=${encodeURIComponent(term)}`
          );
          if (res.ok) {
            const data = (await res.json()) as { places: SearchHit[] };
            setHits(data.places);
          }
        } catch {
          /* search is best-effort */
        } finally {
          setSearching(false);
        }
      },
      term ? 300 : 0
    );
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, stayId]);

  async function post(path: string, method: string, body?: unknown) {
    setBusy(true);
    setNotice('');
    setError('');
    try {
      const res = await fetch(path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          data && typeof data === 'object' && 'error' in data
            ? String((data as { error?: { message?: string } }).error?.message ?? '')
            : '';
        throw new Error(msg || t('Thao tác thất bại.', 'Action failed.'));
      }
      return data;
    } finally {
      setBusy(false);
    }
  }

  async function linkExisting(placeId: string) {
    try {
      await post(`/api/host/stays/${stayId}/local-places`, 'POST', {
        placeId,
        reason: form.reason.trim() || undefined,
      });
      setNotice(t('Đã gửi đề xuất — chờ VietNomad duyệt.', 'Suggested — awaiting VietNomad review.'));
      setQuery('');
      setHits([]);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Thao tác thất bại.', 'Action failed.'));
    }
  }

  async function submitNew() {
    try {
      if (editingId) {
        await post(
          `/api/host/stays/${stayId}/local-places/suggestions/${editingId}`,
          'PATCH',
          {
            name: form.name.trim() || undefined,
            category: form.category,
            address: form.address.trim() || undefined,
            googleMapsUrl: form.googleMapsUrl.trim() || undefined,
            reason: form.reason.trim() || undefined,
            distanceLabel: form.distanceLabel.trim() || undefined,
            imageUrl: form.imageUrl.trim() || undefined,
          }
        );
        setNotice(t('Đã lưu đề xuất.', 'Suggestion saved.'));
      } else {
        await post(`/api/host/stays/${stayId}/local-places`, 'POST', {
          name: form.name.trim(),
          category: form.category,
          address: form.address.trim() || undefined,
          googleMapsUrl: form.googleMapsUrl.trim() || undefined,
          reason: form.reason.trim() || undefined,
          distanceLabel: form.distanceLabel.trim() || undefined,
          imageUrl: form.imageUrl.trim() || undefined,
        });
        setNotice(t('Đã gửi đề xuất — chờ VietNomad duyệt.', 'Suggested — awaiting VietNomad review.'));
      }
      setForm(emptyForm);
      setEditingId(null);
      setShowNew(false);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Thao tác thất bại.', 'Action failed.'));
    }
  }

  function startEdit(s: Suggestion) {
    setEditingId(s.id);
    setShowNew(true);
    setForm({
      name: s.name,
      category: (PLACE_CATEGORIES as readonly string[]).includes(s.category)
        ? (s.category as PlaceCategory)
        : 'restaurant',
      address: s.address,
      googleMapsUrl: s.googleMapsUrl,
      distanceLabel: s.distanceLabel,
      imageUrl: '',
      reason: s.reason,
    });
  }

  async function removeLink(placeId: string) {
    if (!window.confirm(t('Gỡ địa điểm này khỏi listing?', 'Remove this place from the listing?'))) {
      return;
    }
    try {
      await post(`/api/host/stays/${stayId}/local-places/links/${placeId}`, 'DELETE');
      setNotice(t('Đã gỡ khỏi listing.', 'Removed from listing.'));
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Thao tác thất bại.', 'Action failed.'));
    }
  }

  const catLabel = (c: string) => {
    const key = (PLACE_CATEGORIES as readonly string[]).includes(c)
      ? (c as PlaceCategory)
      : null;
    if (!key) return c;
    return isVi ? PLACE_CATEGORY_LABELS[key].vi : PLACE_CATEGORY_LABELS[key].en;
  };

  return (
    <div className="space-y-6">
      {notice ? (
        <p className="rounded-lg border border-[#B7D9C6] bg-[#F1F8F4] px-3 py-2 text-sm text-[#164E3F]">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-[#F3C1B8] bg-[#FEF3F2] px-3 py-2 text-sm text-[#B42318]">
          {error}
        </p>
      ) : null}

      {/* Search existing verified places */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-[#17221E]">
          {t('1. Giới thiệu địa điểm có sẵn', '1. Recommend an existing place')}
        </h3>
        <ListingInput
          label={t('Tìm địa điểm đã được xác minh', 'Search verified places')}
          placeholder={t('Tên quán, khu vực…', 'Name, area…')}
          value={query}
          onChange={setQuery}
          hint={t(
            'Chỉ tìm trong địa điểm VietNomad đã xác minh cùng điểm đến.',
            'Only VietNomad-verified places in the same destination.'
          )}
        />
        {searching ? <p className="text-xs text-[#53635D]">…</p> : null}
        {hits.length > 0 ? (
          <ul className="divide-y divide-[#E5DFD3] rounded-xl border border-[#E5DFD3]">
            {hits.map((h) => (
              <li key={h.placeId} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#17221E]">{h.name}</p>
                  <p className="truncate text-xs text-[#53635D]">
                    {catLabel(h.category)}
                    {h.address ? ` · ${h.address}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void linkExisting(h.placeId)}
                  className="shrink-0 rounded-lg border border-[#164E3F] px-3 py-1.5 text-xs font-semibold text-[#164E3F] hover:bg-[#F1F8F4] disabled:opacity-50"
                >
                  {t('Giới thiệu', 'Recommend')}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* New suggestion */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-[#17221E]">
            {t('2. Đề xuất địa điểm mới', '2. Propose a new place')}
          </h3>
          <button
            type="button"
            onClick={() => {
              setShowNew((v) => !v);
              setEditingId(null);
              setForm(emptyForm);
            }}
            className="text-sm font-semibold text-[#164E3F] hover:underline"
          >
            {showNew ? t('Đóng', 'Close') : t('+ Thêm địa điểm', '+ Add place')}
          </button>
        </div>
        {showNew ? (
          <div className="grid gap-4 rounded-xl border border-[#E5DFD3] p-4 sm:grid-cols-2">
            <ListingInput
              label={t('Tên địa điểm', 'Place name')}
              value={form.name}
              onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            />
            <ListingSelect
              label={t('Danh mục', 'Category')}
              value={form.category}
              onChange={(v) => setForm((f) => ({ ...f, category: v as PlaceCategory }))}
              options={PLACE_CATEGORIES.map((c) => ({
                value: c,
                label: isVi ? PLACE_CATEGORY_LABELS[c].vi : PLACE_CATEGORY_LABELS[c].en,
              }))}
            />
            <ListingInput
              className="sm:col-span-2"
              label={t('Địa chỉ', 'Address')}
              value={form.address}
              onChange={(v) => setForm((f) => ({ ...f, address: v }))}
            />
            <ListingInput
              className="sm:col-span-2"
              label={t('Liên kết Google Maps (tùy chọn)', 'Google Maps link (optional)')}
              placeholder="https://www.google.com/maps/..."
              value={form.googleMapsUrl}
              onChange={(v) => setForm((f) => ({ ...f, googleMapsUrl: v }))}
              hint={t(
                'Dán link chia sẻ — tọa độ được đọc tự động nếu có.',
                'Paste a share link — coordinates are read when present.'
              )}
            />
            <ListingInput
              label={t('Khoảng cách / thời gian (nếu biết)', 'Distance / travel time (if known)')}
              placeholder={t('VD: 5 phút đi bộ', 'e.g. 5 min walk')}
              value={form.distanceLabel}
              onChange={(v) => setForm((f) => ({ ...f, distanceLabel: v }))}
              hint={t('Không bắt buộc — đừng ước lượng nếu chưa chắc.', 'Optional — do not guess.')}
            />
            <ListingInput
              label={t('Hình ảnh (nếu có quyền dùng)', 'Image (if you may use it)')}
              placeholder="https://..."
              value={form.imageUrl}
              onChange={(v) => setForm((f) => ({ ...f, imageUrl: v }))}
            />
            <ListingTextarea
              className="sm:col-span-2"
              label={t('Lý do giới thiệu', 'Why recommend it')}
              rows={2}
              value={form.reason}
              onChange={(v) => setForm((f) => ({ ...f, reason: v }))}
              hint={t(
                'Chỉ địa điểm hữu ích cho khách lưu trú. Không cần quan hệ thương mại hay hoa hồng.',
                'Only places useful for guests. No commercial relationship needed.'
              )}
            />
            <div className="flex gap-2 sm:col-span-2">
              <button
                type="button"
                disabled={busy || form.name.trim().length < 2}
                onClick={() => void submitNew()}
                className="rounded-xl bg-[#164E3F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0F392E] disabled:opacity-50"
              >
                {editingId
                  ? t('Lưu đề xuất', 'Save suggestion')
                  : t('Gửi đề xuất', 'Submit suggestion')}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setShowNew(false);
                    setForm(emptyForm);
                  }}
                  className="rounded-xl border border-[#E5DFD3] px-4 py-2 text-sm font-medium text-[#53635D] hover:bg-[#F7F5F0]"
                >
                  {t('Hủy', 'Cancel')}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {/* Suggestions list */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-[#17221E]">
          {t('Đề xuất của bạn', 'Your suggestions')}
        </h3>
        {loading ? (
          <p className="text-xs text-[#53635D]">…</p>
        ) : suggestions.length === 0 ? (
          <p className="text-sm text-[#53635D]">
            {t('Chưa có đề xuất nào.', 'No suggestions yet.')}
          </p>
        ) : (
          <ul className="divide-y divide-[#E5DFD3] rounded-xl border border-[#E5DFD3]">
            {suggestions.map((s) => {
              const st = STATUS_LABEL[s.status];
              const editable = s.status === 'pending' || s.status === 'rejected';
              return (
                <li key={s.id} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#17221E]">
                      {s.name}
                      <span className="ml-2 text-xs font-normal text-[#53635D]">
                        {catLabel(s.category)}
                      </span>
                    </p>
                    <p className={`text-xs font-medium ${st.className}`}>
                      {isVi ? st.vi : st.en}
                      {s.linked && s.status === 'approved'
                        ? t(' · đang hiển thị', ' · live on listing')
                        : ''}
                      {s.status === 'approved' && !s.linked
                        ? t(' · đã gỡ khỏi listing', ' · unlinked from listing')
                        : ''}
                    </p>
                    {s.reason ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-[#53635D]">{s.reason}</p>
                    ) : null}
                    {s.reviewNote ? (
                      <p className="mt-0.5 text-xs text-[#1D4ED8]">
                        {t('Phản hồi: ', 'Review note: ')}
                        {s.reviewNote}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-3">
                    {editable ? (
                      <button
                        type="button"
                        onClick={() => startEdit(s)}
                        className="text-xs font-semibold text-[#164E3F] hover:underline"
                      >
                        {s.status === 'rejected' ? t('Gửi lại', 'Resubmit') : t('Sửa', 'Edit')}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Linked places on this listing */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-[#17221E]">
          {t('Đang hiển thị trên listing', 'Linked to this listing')}
        </h3>
        {loading ? (
          <p className="text-xs text-[#53635D]">…</p>
        ) : links.length === 0 ? (
          <p className="text-sm text-[#53635D]">{t('Chưa có địa điểm nào.', 'No places yet.')}</p>
        ) : (
          <ul className="divide-y divide-[#E5DFD3] rounded-xl border border-[#E5DFD3]">
            {links.map((l) => (
              <li key={l.placeId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[#17221E]">
                    {l.name}
                    <span className="ml-2 text-xs font-normal text-[#53635D]">
                      {catLabel(l.category)}
                      {l.distanceLabel ? ` · ${l.distanceLabel}` : ''}
                    </span>
                  </p>
                  <p className="text-xs text-[#53635D]">
                    {l.source === 'host_suggested'
                      ? t('Bạn giới thiệu', 'You recommended')
                      : t('VietNomad gắn cho listing', 'Curated by VietNomad')}
                    {l.hostNote ? ` · ${l.hostNote}` : ''}
                  </p>
                </div>
                {l.source === 'host_suggested' ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void removeLink(l.placeId)}
                    className="text-xs font-semibold text-[#B42318] hover:underline"
                  >
                    {t('Gỡ', 'Remove')}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-[#53635D]">
          {t(
            'Gỡ địa điểm chỉ xóa liên kết với listing này — địa điểm vẫn dùng chung trên nền tảng.',
            'Removing unlinks this listing only — the shared place stays on the platform.'
          )}
        </p>
      </div>
    </div>
  );
}
