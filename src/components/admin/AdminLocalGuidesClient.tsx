'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  EyeOff,
  MapPin,
  Plus,
  QrCode,
} from 'lucide-react';
import { formatVnd } from '@/lib/format';
import type {
  AdminLocalGuidesData,
  LocalGuideBudgetTier,
  LocalGuideDurationBucket,
  LocalGuideTheme,
} from '@/modules/local-guides';

interface AdminLocalGuidesClientProps {
  initialData: AdminLocalGuidesData;
}

const THEME_LABELS_VI: Record<LocalGuideTheme, string> = {
  food: 'Ẩm thực bản địa',
  culture: 'Văn hóa & dạo bộ',
  leisure: 'Thư giãn',
  coworking: 'Coworking & làm việc',
};

const DURATION_LABELS_VI: Record<LocalGuideDurationBucket, string> = {
  '1_2_hours': '1–2 giờ',
  half_day: 'Nửa ngày',
};

const BUDGET_LABELS_VI: Record<LocalGuideBudgetTier, string> = {
  budget: 'Tiết kiệm',
  moderate: 'Vừa phải',
  splurge: 'Trải nghiệm cao',
};

export function AdminLocalGuidesClient({
  initialData,
}: AdminLocalGuidesClientProps) {
  const [data, setData] = useState<AdminLocalGuidesData>(initialData);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // QR generator state
  const [qrAreaSlug, setQrAreaSlug] = useState<string>(
    initialData.areas[0]?.slug ?? 'tay-ho-hanoi'
  );
  const [qrMode, setQrMode] = useState<'path' | 'full'>('path');
  const [qrResult, setQrResult] = useState<{
    areaSlug: string;
    areaNameVi: string;
    targetPath: string;
    targetUrl: string;
    svg: string;
  } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  // Create Place form state
  const [placeAreaId, setPlaceAreaId] = useState<string>(
    initialData.areas[0]?.id ?? ''
  );
  const [placeNameEn, setPlaceNameEn] = useState('');
  const [placeNameVi, setPlaceNameVi] = useState('');
  const [placeTheme, setPlaceTheme] = useState<LocalGuideTheme>('food');
  const [placeDescEn, setPlaceDescEn] = useState('');
  const [placeDescVi, setPlaceDescVi] = useState('');
  const [placeCostVnd, setPlaceCostVnd] = useState('120000');
  const [placeBudget, setPlaceBudget] = useState<LocalGuideBudgetTier>('budget');
  const [placeMapsUrl, setPlaceMapsUrl] = useState('https://maps.google.com/?q=');
  const [placePartnerUrl, setPlacePartnerUrl] = useState('');
  const [placeSource, setPlaceSource] = useState('StayNearby Editorial');
  const [placeHasBooths, setPlaceHasBooths] = useState(false);
  const [placeBookingReq, setPlaceBookingReq] = useState(false);
  const [placePublished, setPlacePublished] = useState(true);
  const [creatingPlace, setCreatingPlace] = useState(false);

  // Create Guide form state
  const [guideAreaId, setGuideAreaId] = useState<string>(
    initialData.areas[0]?.id ?? ''
  );
  const [guideTitleEn, setGuideTitleEn] = useState('');
  const [guideTitleVi, setGuideTitleVi] = useState('');
  const [guideSummaryEn, setGuideSummaryEn] = useState('');
  const [guideSummaryVi, setGuideSummaryVi] = useState('');
  const [guideTheme, setGuideTheme] = useState<LocalGuideTheme>('food');
  const [guideDuration, setGuideDuration] =
    useState<LocalGuideDurationBucket>('1_2_hours');
  const [guideBudget, setGuideBudget] = useState<LocalGuideBudgetTier>('budget');
  const [guideTotalVnd, setGuideTotalVnd] = useState('150000');
  const [guideSource, setGuideSource] = useState('StayNearby Editorial');
  const [guideStop1, setGuideStop1] = useState('');
  const [guideStop2, setGuideStop2] = useState('');
  const [guidePublished, setGuidePublished] = useState(true);
  const [creatingGuide, setCreatingGuide] = useState(false);

  async function refreshAll() {
    const res = await fetch('/api/admin/local-guides');
    if (res.ok) {
      const payload = (await res.json()) as AdminLocalGuidesData & { ok: boolean };
      setData({
        areas: payload.areas,
        places: payload.places,
        guides: payload.guides,
      });
    }
  }

  async function handleGenerateQr() {
    setErrorMessage(null);
    setQrLoading(true);
    try {
      const res = await fetch(
        `/api/admin/local-guides/qr/${encodeURIComponent(qrAreaSlug)}?mode=${qrMode}`
      );
      const payload = (await res.json()) as {
        ok?: boolean;
        error?: { message?: string };
        areaSlug: string;
        areaNameVi: string;
        targetPath: string;
        targetUrl: string;
        svg: string;
      };
      if (!res.ok) {
        setErrorMessage(payload.error?.message || 'Không thể tạo mã QR.');
        return;
      }
      setQrResult(payload);
    } finally {
      setQrLoading(false);
    }
  }

  async function handleTogglePlace(placeId: string, nextPublished: boolean) {
    setBusyId(placeId);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/admin/local-guides/places/${placeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: nextPublished }),
      });
      const payload = (await res.json()) as {
        error?: { message?: string };
      };
      if (!res.ok) {
        setErrorMessage(payload.error?.message || 'Cập nhật địa điểm thất bại.');
        return;
      }
      await refreshAll();
      setStatusMessage(
        nextPublished ? 'Đã công bố địa điểm.' : 'Đã chuyển địa điểm về nháp ẩn.'
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleGuide(guideId: string, nextPublished: boolean) {
    setBusyId(guideId);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/admin/local-guides/guides/${guideId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: nextPublished }),
      });
      const payload = (await res.json()) as {
        error?: { message?: string };
      };
      if (!res.ok) {
        setErrorMessage(payload.error?.message || 'Cập nhật tuyến thất bại.');
        return;
      }
      await refreshAll();
      setStatusMessage(
        nextPublished ? 'Đã công bố tuyến trải nghiệm.' : 'Đã ẩn tuyến về trạng thái nháp.'
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreatePlace(e: React.FormEvent) {
    e.preventDefault();
    setCreatingPlace(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/admin/local-guides/places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          areaId: placeAreaId,
          nameEn: placeNameEn,
          nameVi: placeNameVi || placeNameEn,
          theme: placeTheme,
          shortDescriptionEn: placeDescEn,
          shortDescriptionVi: placeDescVi || placeDescEn,
          estimatedCostVnd: Number.parseInt(placeCostVnd, 10) || 0,
          budgetTier: placeBudget,
          hasVideoCallBooths: placeHasBooths,
          bookingRequired: placeBookingReq,
          mapsUrl: placeMapsUrl,
          partnerBookingUrl: placePartnerUrl || undefined,
          source: placeSource,
          isPublished: placePublished,
        }),
      });
      const payload = (await res.json()) as {
        error?: { message?: string };
      };
      if (!res.ok) {
        setErrorMessage(payload.error?.message || 'Không thể thêm địa điểm mới.');
        return;
      }
      setPlaceNameEn('');
      setPlaceNameVi('');
      setPlaceDescEn('');
      setPlaceDescVi('');
      setPlacePartnerUrl('');
      await refreshAll();
      setStatusMessage('Đã tạo địa điểm kiểm chứng mới.');
    } finally {
      setCreatingPlace(false);
    }
  }

  async function handleCreateGuide(e: React.FormEvent) {
    e.preventDefault();
    setCreatingGuide(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const stopIds = [guideStop1, guideStop2].filter(Boolean);
    if (stopIds.length === 0) {
      setErrorMessage('Vui lòng chọn ít nhất 1 điểm dừng thuộc khu vực đã chọn.');
      setCreatingGuide(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/local-guides/guides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          areaId: guideAreaId,
          titleEn: guideTitleEn,
          titleVi: guideTitleVi || guideTitleEn,
          summaryEn: guideSummaryEn,
          summaryVi: guideSummaryVi || guideSummaryEn,
          theme: guideTheme,
          durationBucket: guideDuration,
          budgetTier: guideBudget,
          estimatedTotalVnd: Number.parseInt(guideTotalVnd, 10) || 0,
          source: guideSource,
          isPublished: guidePublished,
          stops: stopIds.map((pid) => ({ placeId: pid })),
        }),
      });
      const payload = (await res.json()) as {
        error?: { message?: string };
      };
      if (!res.ok) {
        setErrorMessage(payload.error?.message || 'Không thể tạo tuyến mới.');
        return;
      }
      setGuideTitleEn('');
      setGuideTitleVi('');
      setGuideSummaryEn('');
      setGuideSummaryVi('');
      setGuideStop1('');
      setGuideStop2('');
      await refreshAll();
      setStatusMessage('Đã tạo tuyến gợi ý mới.');
    } finally {
      setCreatingGuide(false);
    }
  }

  const placesInSelectedGuideArea = data.places.filter((p) => p.areaId === guideAreaId);

  return (
    <div className="space-y-8">
      {statusMessage && (
        <div
          role="status"
          className="rounded-[12px] border border-[#C4DCD2] bg-[var(--color-primary-soft)] px-4 py-3 text-sm text-[var(--color-primary)] font-medium"
        >
          {statusMessage}
        </div>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="rounded-[12px] border border-[#F2C4C4] bg-[#FDF3F3] px-4 py-3 text-sm text-[#9B1C1C] font-medium"
        >
          {errorMessage}
        </div>
      )}

      {/* Section 1: Public QR Code Generator */}
      <section className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-5">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-[var(--color-text)] flex items-center gap-2">
            <QrCode className="w-5 h-5 text-[var(--color-primary)]" aria-hidden="true" />
            <span>Tạo mã QR công khai đặt tại chỗ ở</span>
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Mã QR chỉ trỏ đúng tới đường dẫn công khai{' '}
            <code className="font-mono text-xs bg-[var(--color-surface-muted)] px-1.5 py-0.5 rounded">
              /explore/[areaSlug]
            </code>{' '}
            và tuyệt đối không nhúng guestId, bookingId hay dữ liệu đặt phòng.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label
              htmlFor="qr-area-select"
              className="block text-xs font-semibold text-[var(--color-text-muted)]"
            >
              Chọn khu vực
            </label>
            <select
              id="qr-area-select"
              value={qrAreaSlug}
              onChange={(e) => setQrAreaSlug(e.target.value)}
              className="min-h-[44px] px-3 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm"
            >
              {data.areas.map((a) => (
                <option key={a.id} value={a.slug}>
                  {a.nameVi} ({a.cityVi}) — /{a.slug}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="qr-mode-select"
              className="block text-xs font-semibold text-[var(--color-text-muted)]"
            >
              Định dạng liên kết QR
            </label>
            <select
              id="qr-mode-select"
              value={qrMode}
              onChange={(e) => setQrMode(e.target.value as 'path' | 'full')}
              className="min-h-[44px] px-3 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm"
            >
              <option value="path">Đường dẫn sạch (/explore/[areaSlug])</option>
              <option value="full">URL đầy đủ theo tên miền hiện tại</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleGenerateQr}
            disabled={qrLoading}
            className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            <QrCode className="w-4 h-4" aria-hidden="true" />
            <span>{qrLoading ? 'Đang tạo QR...' : 'Tạo mã QR'}</span>
          </button>
        </div>

        {qrResult && (
          <div className="rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-surface-ivory)] p-5 flex flex-wrap items-center gap-6">
            <div
              className="w-[180px] h-[180px] p-2 rounded-[10px] border border-[var(--color-border)] bg-white [&>svg]:w-full [&>svg]:h-full shrink-0"
              dangerouslySetInnerHTML={{ __html: qrResult.svg }}
            />
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-[var(--color-text)]">
                Khu vực: {qrResult.areaNameVi}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                Đích quét QR:{' '}
                <code className="font-mono text-[var(--color-primary)] font-semibold">
                  {qrResult.targetUrl}
                </code>
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Link
                  href={qrResult.targetPath}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-medium text-[var(--color-text)] hover:border-[var(--color-primary)]"
                >
                  <span>Mở trang công khai</span>
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
                <a
                  href={`/api/admin/local-guides/qr/${encodeURIComponent(qrResult.areaSlug)}?mode=${qrMode}&format=svg`}
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-[10px] bg-[var(--color-primary)] text-white text-xs font-medium hover:bg-[var(--color-primary-hover)]"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Tải file SVG</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Section 2: Curated Guides Management */}
      <section className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text)]">
              Tuyến gợi ý trải nghiệm ({data.guides.length})
            </h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              Trang công khai hiển thị tối đa 5 tuyến đã công bố cho mỗi khu vực.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {data.guides.map((g) => (
            <div
              key={g.id}
              className="rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-surface-ivory)] p-4 flex flex-wrap items-start justify-between gap-4 text-sm"
            >
              <div className="space-y-1.5 max-w-2xl">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-semibold ${
                      g.isPublished
                        ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                        : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    {g.isPublished ? 'Đã công bố' : 'Nháp ẩn'}
                  </span>
                  <span className="font-medium text-[var(--color-text)]">
                    {g.areaNameVi}
                  </span>
                  <span>·</span>
                  <span>{THEME_LABELS_VI[g.theme]}</span>
                  <span>·</span>
                  <span>{DURATION_LABELS_VI[g.durationBucket]}</span>
                  <span>·</span>
                  <span>{BUDGET_LABELS_VI[g.budgetTier]}</span>
                </div>
                <p className="font-semibold text-[var(--color-text)]">{g.titleVi}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{g.summaryVi}</p>
                <p className="text-xs text-[var(--color-text-muted)] tabular-nums">
                  Ước tính: <strong>{formatVnd(g.estimatedTotalVnd, 'vi')}</strong> ·{' '}
                  {g.stops.length} điểm dừng · Nguồn: {g.source} (Kiểm chứng{' '}
                  {g.verifiedAt.slice(0, 10)})
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/explore/${g.areaSlug}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 min-h-[40px] px-3 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-medium text-[var(--color-text)]"
                >
                  <span>Xem trang</span>
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  disabled={busyId === g.id}
                  onClick={() => handleToggleGuide(g.id, !g.isPublished)}
                  className={`inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-[10px] text-xs font-medium ${
                    g.isPublished
                      ? 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]'
                      : 'bg-[var(--color-primary)] text-white'
                  } disabled:opacity-60`}
                >
                  {g.isPublished ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Ẩn về nháp</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Công bố</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add Guide Form */}
        <form
          onSubmit={handleCreateGuide}
          className="pt-5 border-t border-[var(--color-hairline)] space-y-4"
        >
          <h3 className="text-base font-semibold text-[var(--color-text)] flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-[var(--color-primary)]" aria-hidden="true" />
            <span>Thêm tuyến trải nghiệm mới</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <select
              aria-label="Khu vực của tuyến"
              value={guideAreaId}
              onChange={(e) => {
                setGuideAreaId(e.target.value);
                setGuideStop1('');
                setGuideStop2('');
              }}
              className="min-h-[44px] px-3 rounded-[10px] border border-[var(--color-border)]"
            >
              {data.areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nameVi} ({a.cityVi})
                </option>
              ))}
            </select>

            <input
              type="text"
              required
              placeholder="Tiêu đề tiếng Anh (EN)"
              value={guideTitleEn}
              onChange={(e) => setGuideTitleEn(e.target.value)}
              className="min-h-[44px] px-3 rounded-[10px] border border-[var(--color-border)]"
            />

            <input
              type="text"
              placeholder="Tiêu đề tiếng Việt (VI)"
              value={guideTitleVi}
              onChange={(e) => setGuideTitleVi(e.target.value)}
              className="min-h-[44px] px-3 rounded-[10px] border border-[var(--color-border)]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <input
              type="text"
              required
              placeholder="Tóm tắt tiếng Anh (EN)"
              value={guideSummaryEn}
              onChange={(e) => setGuideSummaryEn(e.target.value)}
              className="min-h-[44px] px-3 rounded-[10px] border border-[var(--color-border)]"
            />
            <input
              type="text"
              placeholder="Tóm tắt tiếng Việt (VI)"
              value={guideSummaryVi}
              onChange={(e) => setGuideSummaryVi(e.target.value)}
              className="min-h-[44px] px-3 rounded-[10px] border border-[var(--color-border)]"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <select
              aria-label="Chủ đề tuyến"
              value={guideTheme}
              onChange={(e) => setGuideTheme(e.target.value as LocalGuideTheme)}
              className="min-h-[44px] px-3 rounded-[10px] border border-[var(--color-border)]"
            >
              {Object.entries(THEME_LABELS_VI).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>

            <select
              aria-label="Thời lượng tuyến"
              value={guideDuration}
              onChange={(e) =>
                setGuideDuration(e.target.value as LocalGuideDurationBucket)
              }
              className="min-h-[44px] px-3 rounded-[10px] border border-[var(--color-border)]"
            >
              {Object.entries(DURATION_LABELS_VI).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>

            <select
              aria-label="Mức ngân sách"
              value={guideBudget}
              onChange={(e) =>
                setGuideBudget(e.target.value as LocalGuideBudgetTier)
              }
              className="min-h-[44px] px-3 rounded-[10px] border border-[var(--color-border)]"
            >
              {Object.entries(BUDGET_LABELS_VI).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>

            <input
              type="number"
              min={0}
              required
              placeholder="Tổng chi phí (VND)"
              value={guideTotalVnd}
              onChange={(e) => setGuideTotalVnd(e.target.value)}
              className="min-h-[44px] px-3 rounded-[10px] border border-[var(--color-border)]"
            />

            <input
              type="text"
              required
              placeholder="Nguồn kiểm chứng"
              value={guideSource}
              onChange={(e) => setGuideSource(e.target.value)}
              className="min-h-[44px] px-3 rounded-[10px] border border-[var(--color-border)]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <select
              aria-label="Điểm dừng 1"
              value={guideStop1}
              onChange={(e) => setGuideStop1(e.target.value)}
              className="min-h-[44px] px-3 rounded-[10px] border border-[var(--color-border)]"
            >
              <option value="">-- Chọn điểm dừng số 1 --</option>
              {placesInSelectedGuideArea.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameVi} ({THEME_LABELS_VI[p.theme]})
                </option>
              ))}
            </select>

            <select
              aria-label="Điểm dừng 2 (tùy chọn)"
              value={guideStop2}
              onChange={(e) => setGuideStop2(e.target.value)}
              className="min-h-[44px] px-3 rounded-[10px] border border-[var(--color-border)]"
            >
              <option value="">-- Điểm dừng số 2 (không bắt buộc) --</option>
              {placesInSelectedGuideArea.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameVi} ({THEME_LABELS_VI[p.theme]})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-[var(--color-text)]">
              <input
                type="checkbox"
                checked={guidePublished}
                onChange={(e) => setGuidePublished(e.target.checked)}
                className="w-4 h-4"
              />
              <span>Công bố ngay lên trang công khai</span>
            </label>

            <button
              type="submit"
              disabled={creatingGuide}
              className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>{creatingGuide ? 'Đang lưu...' : 'Tạo tuyến trải nghiệm'}</span>
            </button>
          </div>
        </form>
      </section>

      {/* Section 3: Local Places Management */}
      <section className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            Địa điểm đã kiểm chứng ({data.places.length})
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Quản lý điểm dừng, buồng gọi video coworking, liên kết Google Maps và nguồn xác minh.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.places.map((p) => (
            <div
              key={p.id}
              className="rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-surface-ivory)] p-4 flex flex-col justify-between gap-3 text-sm"
            >
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span
                    className={`px-2 py-0.5 rounded-full font-semibold ${
                      p.isPublished
                        ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                        : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'
                    }`}
                  >
                    {p.isPublished ? 'Đã công bố' : 'Nháp ẩn'}
                  </span>
                  <span className="text-[var(--color-text-muted)]">
                    {p.areaNameVi} · {THEME_LABELS_VI[p.theme]}
                  </span>
                </div>
                <p className="font-semibold text-[var(--color-text)]">{p.nameVi}</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {p.shortDescriptionVi}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] tabular-nums">
                  Chi phí ước tính: <strong>{formatVnd(p.estimatedCostVnd, 'vi')}</strong>
                  {p.theme === 'coworking' &&
                    ` · ${p.hasVideoCallBooths ? 'Có buồng gọi video' : 'Bàn chung'} · ${
                      p.bookingRequired ? 'Cần đặt trước' : 'Đến trực tiếp'
                    }`}
                </p>
                <p className="text-[11px] text-[var(--color-text-muted)]">
                  Nguồn: {p.source} · {p.verifiedAt.slice(0, 10)}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--color-hairline)]">
                <a
                  href={p.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-primary)] hover:underline"
                >
                  <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Google Maps</span>
                </a>
                <button
                  type="button"
                  disabled={busyId === p.id}
                  onClick={() => handleTogglePlace(p.id, !p.isPublished)}
                  className={`inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-[10px] text-xs font-medium ${
                    p.isPublished
                      ? 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]'
                      : 'bg-[var(--color-primary)] text-white'
                  } disabled:opacity-60`}
                >
                  {p.isPublished ? 'Ẩn về nháp' : 'Công bố'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add Place Form */}
        <form
          onSubmit={handleCreatePlace}
          className="pt-5 border-t border-[var(--color-hairline)] space-y-4"
        >
          <h3 className="text-base font-semibold text-[var(--color-text)] flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-[var(--color-primary)]" aria-hidden="true" />
            <span>Thêm địa điểm kiểm chứng mới</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <select
              aria-label="Khu vực địa điểm"
              value={placeAreaId}
              onChange={(e) => setPlaceAreaId(e.target.value)}
              className="min-h-[44px] px-3 rounded-[10px] border border-[var(--color-border)]"
            >
              {data.areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nameVi} ({a.cityVi})
                </option>
              ))}
            </select>

            <input
              type="text"
              required
              placeholder="Tên địa điểm (EN)"
              value={placeNameEn}
              onChange={(e) => setPlaceNameEn(e.target.value)}
              className="min-h-[44px] px-3 rounded-[10px] border border-[var(--color-border)]"
            />

            <input
              type="text"
              placeholder="Tên địa điểm (VI)"
              value={placeNameVi}
              onChange={(e) => setPlaceNameVi(e.target.value)}
              className="min-h-[44px] px-3 rounded-[10px] border border-[var(--color-border)]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <input
              type="text"
              required
              placeholder="Mô tả ngắn (EN)"
              value={placeDescEn}
              onChange={(e) => setPlaceDescEn(e.target.value)}
              className="min-h-[44px] px-3 rounded-[10px] border border-[var(--color-border)]"
            />
            <input
              type="text"
              placeholder="Mô tả ngắn (VI)"
              value={placeDescVi}
              onChange={(e) => setPlaceDescVi(e.target.value)}
              className="min-h-[44px] px-3 rounded-[10px] border border-[var(--color-border)]"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <select
              aria-label="Chủ đề địa điểm"
              value={placeTheme}
              onChange={(e) => setPlaceTheme(e.target.value as LocalGuideTheme)}
              className="min-h-[44px] px-3 rounded-[10px] border border-[var(--color-border)]"
            >
              {Object.entries(THEME_LABELS_VI).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>

            <select
              aria-label="Mức ngân sách địa điểm"
              value={placeBudget}
              onChange={(e) =>
                setPlaceBudget(e.target.value as LocalGuideBudgetTier)
              }
              className="min-h-[44px] px-3 rounded-[10px] border border-[var(--color-border)]"
            >
              {Object.entries(BUDGET_LABELS_VI).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>

            <input
              type="number"
              min={0}
              required
              placeholder="Chi phí dự kiến (VND)"
              value={placeCostVnd}
              onChange={(e) => setPlaceCostVnd(e.target.value)}
              className="min-h-[44px] px-3 rounded-[10px] border border-[var(--color-border)]"
            />

            <input
              type="text"
              required
              placeholder="Nguồn kiểm chứng"
              value={placeSource}
              onChange={(e) => setPlaceSource(e.target.value)}
              className="min-h-[44px] px-3 rounded-[10px] border border-[var(--color-border)]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <input
              type="url"
              required
              placeholder="Liên kết Google Maps (https://...)"
              value={placeMapsUrl}
              onChange={(e) => setPlaceMapsUrl(e.target.value)}
              className="min-h-[44px] px-3 rounded-[10px] border border-[var(--color-border)]"
            />
            <input
              type="url"
              placeholder="Liên kết đặt chỗ đối tác (tùy chọn)"
              value={placePartnerUrl}
              onChange={(e) => setPlacePartnerUrl(e.target.value)}
              className="min-h-[44px] px-3 rounded-[10px] border border-[var(--color-border)]"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--color-text)]">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={placeHasBooths}
                  onChange={(e) => setPlaceHasBooths(e.target.checked)}
                />
                <span>Có buồng gọi video</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={placeBookingReq}
                  onChange={(e) => setPlaceBookingReq(e.target.checked)}
                />
                <span>Cần đặt trước</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={placePublished}
                  onChange={(e) => setPlacePublished(e.target.checked)}
                />
                <span>Công bố ngay</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={creatingPlace}
              className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>{creatingPlace ? 'Đang lưu...' : 'Thêm địa điểm'}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
