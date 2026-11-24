'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Check, Send, Star, Trash2, Upload } from 'lucide-react';
import type { ErrorCode } from '@/lib/errors';
import type { CancellationPolicyVersion } from '@/lib/config';
import type {
  AmenityOption,
  AreaOption,
  HostListingDetail,
  HostListingPhotoItem,
} from '@/modules/host';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { FallbackImage } from '@/components/ui/FallbackImage';
import { StatusBadge } from '@/components/ui/StatusBadge';

interface HostListingEditorProps {
  mode: 'create' | 'edit';
  areas: AreaOption[];
  amenities: AmenityOption[];
  initialListing?: HostListingDetail;
}

export function HostListingEditor({
  mode,
  areas,
  amenities,
  initialListing,
}: HostListingEditorProps) {
  const router = useRouter();
  const [listing, setListing] = useState<HostListingDetail | null>(
    initialListing ?? null
  );
  const [photos, setPhotos] = useState<HostListingPhotoItem[]>(
    initialListing?.photos ?? []
  );

  // Form states
  const [areaId, setAreaId] = useState(
    initialListing?.areaId ?? areas[0]?.id ?? ''
  );
  const [propertyType, setPropertyType] = useState<
    'apartment' | 'studio' | 'villa' | 'house' | 'homestay'
  >(initialListing?.propertyType ?? 'apartment');
  const [titleEn, setTitleEn] = useState(
    initialListing?.latestRevision.titleEn ?? ''
  );
  const [summaryEn, setSummaryEn] = useState(
    initialListing?.latestRevision.summaryEn ?? ''
  );
  const [descriptionEn, setDescriptionEn] = useState(
    initialListing?.latestRevision.descriptionEn ?? ''
  );
  const [houseRulesText, setHouseRulesText] = useState(
    initialListing?.latestRevision.houseRulesEn.join('\n') ??
      'Quiet hours after 22:00\nNo indoor smoking'
  );
  const [maxGuests, setMaxGuests] = useState(
    String(initialListing?.maxGuests ?? 2)
  );
  const [bedrooms, setBedrooms] = useState(
    String(initialListing?.bedrooms ?? 1)
  );
  const [beds, setBeds] = useState(String(initialListing?.beds ?? 1));
  const [bathrooms, setBathrooms] = useState(
    String(initialListing?.bathrooms ?? 1)
  );
  const [minNights, setMinNights] = useState(
    String(initialListing?.minNights ?? 3)
  );
  const [maxNights, setMaxNights] = useState(
    String(initialListing?.maxNights ?? 60)
  );
  const [baseNightlyRateVnd, setBaseNightlyRateVnd] = useState(
    String(initialListing?.baseNightlyRateVnd ?? 1200000)
  );
  const [cleaningFeeVnd, setCleaningFeeVnd] = useState(
    String(initialListing?.cleaningFeeVnd ?? 200000)
  );
  const [cancellationPolicyVersion, setCancellationPolicyVersion] =
    useState<CancellationPolicyVersion>(
      initialListing?.cancellationPolicyVersion ?? 'flexible_24h'
    );
  const [hasDedicatedDesk, setHasDedicatedDesk] = useState(
    initialListing?.latestRevision.hasDedicatedDesk ?? true
  );
  const [workspaceNotesEn, setWorkspaceNotesEn] = useState(
    initialListing?.latestRevision.workspaceNotesEn ?? ''
  );
  const [checkinConditionsEn, setCheckinConditionsEn] = useState(
    initialListing?.latestRevision.checkinConditionsEn ??
      'Check-in from 14:00, check-out before 12:00. Self check-in supported.'
  );
  const [lateCheckinAvailable, setLateCheckinAvailable] = useState(
    initialListing?.latestRevision.lateCheckinAvailable ?? true
  );
  const [exactAddress, setExactAddress] = useState(
    initialListing?.exactAddress ?? ''
  );
  const [checkinInstructionsEn, setCheckinInstructionsEn] = useState(
    initialListing?.checkinInstructionsEn ?? ''
  );
  const [hostContactPhone, setHostContactPhone] = useState(
    initialListing?.hostContactPhone ?? ''
  );
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>(
    initialListing?.amenityCodes ?? ['kitchen', 'washer', 'dedicated_desk', 'wifi']
  );

  const [saving, setSaving] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoAlt, setPhotoAlt] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<{ code?: ErrorCode; message: string } | null>(
    null
  );

  function toggleAmenity(code: string) {
    setSelectedAmenities((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  }

  function buildPayload() {
    return {
      areaId,
      propertyType,
      maxGuests: Number.parseInt(maxGuests, 10) || 1,
      bedrooms: Number.parseInt(bedrooms, 10) || 0,
      beds: Number.parseInt(beds, 10) || 1,
      bathrooms: Number.parseFloat(bathrooms) || 1,
      minNights: Number.parseInt(minNights, 10) || 1,
      maxNights: Number.parseInt(maxNights, 10) || 60,
      baseNightlyRateVnd: Number.parseInt(baseNightlyRateVnd, 10) || 0,
      cleaningFeeVnd: Number.parseInt(cleaningFeeVnd, 10) || 0,
      cancellationPolicyVersion,
      titleEn: titleEn.trim(),
      summaryEn: summaryEn.trim(),
      descriptionEn: descriptionEn.trim(),
      houseRulesEn: houseRulesText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      hasDedicatedDesk,
      workspaceNotesEn: workspaceNotesEn.trim() || undefined,
      checkinConditionsEn: checkinConditionsEn.trim(),
      lateCheckinAvailable,
      exactAddress: exactAddress.trim(),
      checkinInstructionsEn: checkinInstructionsEn.trim(),
      hostContactPhone: hostContactPhone.trim() || undefined,
      amenityCodes: selectedAmenities,
    };
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const payload = buildPayload();
      const endpoint =
        mode === 'create' || !listing
          ? '/api/host/listings'
          : `/api/host/listings/${listing.id}`;
      const method = mode === 'create' || !listing ? 'POST' : 'PATCH';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError({
          code: json?.error?.code ?? 'VALIDATION_ERROR',
          message: json?.error?.message ?? 'Không thể lưu chỗ ở.',
        });
        return;
      }

      const saved = json.listing as HostListingDetail;
      setListing(saved);
      setPhotos(saved.photos);
      setNotice(
        mode === 'create'
          ? 'Đã tạo bản nháp chỗ ở. Vui lòng tải ảnh lên và bấm Gửi kiểm duyệt.'
          : saved.status === 'published'
            ? 'Đã lưu thay đổi. Bản cập nhật nội dung công khai nằm ở bản nháp chờ duyệt; giá và lịch có hiệu lực ngay.'
            : 'Đã lưu thông tin chỗ ở thành công.'
      );

      if (mode === 'create') {
        router.push(`/host/listings/${saved.id}`);
      } else {
        router.refresh();
      }
    } catch {
      setError({
        code: 'INTERNAL_ERROR',
        message: 'Không thể kết nối máy chủ.',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !listing) return;

    setUploadingPhoto(true);
    setError(null);
    setNotice(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('altTextEn', photoAlt.trim() || titleEn || 'Stay photo');
      if (photos.length === 0) {
        fd.append('setAsCover', 'true');
      }

      const res = await fetch(`/api/host/listings/${listing.id}/photos`, {
        method: 'POST',
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError({
          code: json?.error?.code ?? 'VALIDATION_ERROR',
          message: json?.error?.message ?? 'Tải ảnh thất bại.',
        });
        return;
      }

      setPhotos((prev) => [...prev, json.photo as HostListingPhotoItem]);
      setPhotoAlt('');
      setNotice('Đã tải ảnh lên thành công.');
      router.refresh();
    } catch {
      setError({ code: 'INTERNAL_ERROR', message: 'Lỗi khi tải ảnh lên.' });
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSetCover(photoId: string) {
    if (!listing) return;
    setError(null);
    const res = await fetch(`/api/host/listings/${listing.id}/photos/${photoId}`, {
      method: 'PATCH',
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError({
        code: json?.error?.code ?? 'INTERNAL_ERROR',
        message: json?.error?.message ?? 'Không thể đặt ảnh bìa.',
      });
      return;
    }
    setPhotos((prev) =>
      prev.map((p) => ({ ...p, isCover: p.id === photoId }))
    );
    router.refresh();
  }

  async function handleDeletePhoto(photoId: string) {
    if (!listing) return;
    setError(null);
    const res = await fetch(`/api/host/listings/${listing.id}/photos/${photoId}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (!res.ok || !json.ok) {
      setError({
        code: json?.error?.code ?? 'INTERNAL_ERROR',
        message: json?.error?.message ?? 'Không thể xóa ảnh.',
      });
      return;
    }
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    router.refresh();
  }

  async function handleSubmitForReview() {
    if (!listing) return;
    setSubmittingReview(true);
    setError(null);
    setNotice(null);
    try {
      // Save latest form values first before submitting
      const saveRes = await fetch(`/api/host/listings/${listing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      const saveJson = await saveRes.json();
      if (!saveRes.ok || !saveJson.ok) {
        setError({
          code: saveJson?.error?.code ?? 'VALIDATION_ERROR',
          message: saveJson?.error?.message ?? 'Không thể lưu nội dung trước khi gửi duyệt.',
        });
        return;
      }

      const submitRes = await fetch(`/api/host/listings/${listing.id}/submit`, {
        method: 'POST',
      });
      const submitJson = await submitRes.json();
      if (!submitRes.ok || !submitJson.ok) {
        setError({
          code: submitJson?.error?.code ?? 'VALIDATION_ERROR',
          message: submitJson?.error?.message ?? 'Không thể gửi kiểm duyệt.',
        });
        return;
      }

      setListing(submitJson.listing as HostListingDetail);
      setNotice('Đã gửi hồ sơ chỗ ở lên quản trị viên chờ kiểm duyệt.');
      router.refresh();
    } catch {
      setError({ code: 'INTERNAL_ERROR', message: 'Không thể kết nối máy chủ.' });
    } finally {
      setSubmittingReview(false);
    }
  }

  const currentStatus = listing?.status ?? 'draft';

  return (
    <div className="space-y-8">
      {listing && (
        <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-ivory)] p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-medium text-[var(--color-text)]">Trạng thái căn:</span>
            <StatusBadge
              label={
                currentStatus === 'published'
                  ? 'Đã công bố'
                  : currentStatus === 'pending_review'
                    ? 'Đang chờ duyệt'
                    : currentStatus === 'changes_requested'
                      ? 'Cần chỉnh sửa theo góp ý'
                      : currentStatus === 'suspended'
                        ? 'Đang tạm ẩn'
                        : 'Bản nháp'
              }
              tone={
                currentStatus === 'published'
                  ? 'success'
                  : currentStatus === 'pending_review'
                    ? 'warning'
                    : currentStatus === 'changes_requested' || currentStatus === 'suspended'
                      ? 'danger'
                      : 'neutral'
              }
              withIcon
            />
            {listing.latestRevision.status === 'pending_review' &&
              currentStatus === 'published' && (
                <StatusBadge label="Bản sửa đang chờ duyệt" tone="warning" />
              )}
          </div>
          {listing.status === 'published' && (
            <Link
              href={`/stays/${listing.slug}`}
              className="text-sm font-medium text-[var(--color-primary)] hover:underline underline-offset-4"
            >
              Xem trang công khai
            </Link>
          )}
        </div>
      )}

      {listing?.reviewNote && (
        <div
          role="alert"
          className="rounded-[12px] border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-4 text-sm text-[var(--color-warning-text)]"
        >
          <strong>Ghi chú từ Quản trị viên:</strong> {listing.reviewNote}
        </div>
      )}

      {notice && (
        <div
          role="status"
          className="rounded-[12px] border border-[#C4DCD2] bg-[var(--color-primary-soft)] p-4 text-sm text-[var(--color-primary)] flex items-center gap-2"
        >
          <Check className="w-5 h-5 shrink-0" aria-hidden="true" />
          <span>{notice}</span>
        </div>
      )}

      {error && <ErrorAlert code={error.code} message={error.message} locale="vi" />}

      <form onSubmit={handleSave} className="space-y-8">
        {/* 1. Thông tin công khai (hiển thị cho khách bằng tiếng Anh) */}
        <section className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text)]">
              1. Thông tin hiển thị cho khách (tiếng Anh)
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Nếu căn đã công bố, mọi chỉnh sửa nội dung ở mục này sẽ được lưu thành bản nháp mới để quản trị viên duyệt trước khi thay thế bản công khai.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="host-area"
                className="block text-sm font-medium text-[var(--color-text)] mb-1.5"
              >
                Khu vực
              </label>
              <select
                id="host-area"
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm"
              >
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nameVi}, {a.cityVi}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="host-type"
                className="block text-sm font-medium text-[var(--color-text)] mb-1.5"
              >
                Loại chỗ ở
              </label>
              <select
                id="host-type"
                value={propertyType}
                onChange={(e) =>
                  setPropertyType(
                    e.target.value as
                      | 'apartment'
                      | 'studio'
                      | 'villa'
                      | 'house'
                      | 'homestay'
                  )
                }
                className="w-full min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm"
              >
                <option value="apartment">Căn hộ (Apartment)</option>
                <option value="studio">Studio</option>
                <option value="house">Nhà riêng (House)</option>
                <option value="villa">Biệt thự (Villa)</option>
                <option value="homestay">Homestay</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="host-title"
              className="block text-sm font-medium text-[var(--color-text)] mb-1.5"
            >
              Tiêu đề chỗ ở (EN)
            </label>
            <input
              id="host-title"
              type="text"
              required
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              placeholder="Ví dụ: Quiet Sunlit Loft near West Lake"
              className="w-full min-h-[44px] px-3.5 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="host-summary"
              className="block text-sm font-medium text-[var(--color-text)] mb-1.5"
            >
              Mô tả ngắn gọn (EN)
            </label>
            <input
              id="host-summary"
              type="text"
              required
              value={summaryEn}
              onChange={(e) => setSummaryEn(e.target.value)}
              placeholder="Tóm tắt trong 1 câu điểm nổi bật để ở 2–4 tuần..."
              className="w-full min-h-[44px] px-3.5 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="host-desc"
              className="block text-sm font-medium text-[var(--color-text)] mb-1.5"
            >
              Mô tả chi tiết không gian & khu vực xung quanh (EN)
            </label>
            <textarea
              id="host-desc"
              rows={4}
              required
              value={descriptionEn}
              onChange={(e) => setDescriptionEn(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="host-rules"
              className="block text-sm font-medium text-[var(--color-text)] mb-1.5"
            >
              Nội quy nhà (mỗi dòng 1 quy định, bằng tiếng Anh)
            </label>
            <textarea
              id="host-rules"
              rows={3}
              value={houseRulesText}
              onChange={(e) => setHouseRulesText(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm"
            />
          </div>
        </section>

        {/* 2. Sức chứa, giá VND & điều kiện nhận phòng */}
        <section className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-5">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            2. Sức chứa, giá mỗi đêm (VND) & nhận phòng
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label
                htmlFor="host-guests"
                className="block text-xs font-medium text-[var(--color-text-muted)] mb-1"
              >
                Khách tối đa
              </label>
              <input
                id="host-guests"
                type="number"
                min={1}
                max={20}
                required
                value={maxGuests}
                onChange={(e) => setMaxGuests(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] text-sm tabular-nums"
              />
            </div>
            <div>
              <label
                htmlFor="host-bedrooms"
                className="block text-xs font-medium text-[var(--color-text-muted)] mb-1"
              >
                Phòng ngủ
              </label>
              <input
                id="host-bedrooms"
                type="number"
                min={0}
                max={20}
                required
                value={bedrooms}
                onChange={(e) => setBedrooms(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] text-sm tabular-nums"
              />
            </div>
            <div>
              <label
                htmlFor="host-beds"
                className="block text-xs font-medium text-[var(--color-text-muted)] mb-1"
              >
                Giường
              </label>
              <input
                id="host-beds"
                type="number"
                min={1}
                max={30}
                required
                value={beds}
                onChange={(e) => setBeds(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] text-sm tabular-nums"
              />
            </div>
            <div>
              <label
                htmlFor="host-bathrooms"
                className="block text-xs font-medium text-[var(--color-text-muted)] mb-1"
              >
                Phòng tắm
              </label>
              <input
                id="host-bathrooms"
                type="number"
                step="0.5"
                min={0.5}
                max={20}
                required
                value={bathrooms}
                onChange={(e) => setBathrooms(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] text-sm tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label
                htmlFor="host-rate"
                className="block text-xs font-medium text-[var(--color-text-muted)] mb-1"
              >
                Giá mặc định / đêm (VND)
              </label>
              <input
                id="host-rate"
                type="number"
                min={50000}
                step={10000}
                required
                value={baseNightlyRateVnd}
                onChange={(e) => setBaseNightlyRateVnd(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] text-sm tabular-nums"
              />
            </div>
            <div>
              <label
                htmlFor="host-cleaning"
                className="block text-xs font-medium text-[var(--color-text-muted)] mb-1"
              >
                Phí dọn dẹp (VND)
              </label>
              <input
                id="host-cleaning"
                type="number"
                min={0}
                step={10000}
                required
                value={cleaningFeeVnd}
                onChange={(e) => setCleaningFeeVnd(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] text-sm tabular-nums"
              />
            </div>
            <div>
              <label
                htmlFor="host-min-nights"
                className="block text-xs font-medium text-[var(--color-text-muted)] mb-1"
              >
                Số đêm tối thiểu
              </label>
              <input
                id="host-min-nights"
                type="number"
                min={1}
                max={180}
                required
                value={minNights}
                onChange={(e) => setMinNights(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] text-sm tabular-nums"
              />
            </div>
            <div>
              <label
                htmlFor="host-max-nights"
                className="block text-xs font-medium text-[var(--color-text-muted)] mb-1"
              >
                Số đêm tối đa
              </label>
              <input
                id="host-max-nights"
                type="number"
                min={1}
                max={365}
                required
                value={maxNights}
                onChange={(e) => setMaxNights(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] text-sm tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="host-cancel-policy"
                className="block text-sm font-medium text-[var(--color-text)] mb-1.5"
              >
                Chính sách hủy áp dụng
              </label>
              <select
                id="host-cancel-policy"
                value={cancellationPolicyVersion}
                onChange={(e) =>
                  setCancellationPolicyVersion(
                    e.target.value as CancellationPolicyVersion
                  )
                }
                className="w-full min-h-[44px] px-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm"
              >
                <option value="flexible_24h">Linh hoạt (trước 24 giờ)</option>
                <option value="moderate_5d">Trung bình (trước 5 ngày)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="host-checkin-cond"
                className="block text-sm font-medium text-[var(--color-text)] mb-1.5"
              >
                Điều kiện giờ nhận phòng (EN)
              </label>
              <input
                id="host-checkin-cond"
                type="text"
                value={checkinConditionsEn}
                onChange={(e) => setCheckinConditionsEn(e.target.value)}
                placeholder="Ví dụ: Check-in from 14:00. Late check-in via smart lock."
                className="w-full min-h-[44px] px-3.5 rounded-[12px] border border-[var(--color-border)] text-sm"
              />
            </div>
          </div>

          <label className="inline-flex items-center gap-2.5 min-h-[44px] text-sm text-[var(--color-text)] cursor-pointer">
            <input
              type="checkbox"
              checked={lateCheckinAvailable}
              onChange={(e) => setLateCheckinAvailable(e.target.checked)}
              className="w-4 h-4 accent-[var(--color-primary)]"
            />
            <span>Hỗ trợ nhận phòng muộn (khai báo công khai để khách hạ cánh tối biết)</span>
          </label>
        </section>

        {/* 3. Tiện nghi do chủ nhà khai báo (gồm Wi-Fi tùy chọn, không đo tốc độ) */}
        <section className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text)]">
              3. Tiện nghi do chủ nhà tự khai báo
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Wi-Fi được đánh dấu như một tiện nghi tùy chọn cùng bếp, máy giặt và bàn làm việc (không có đo hoặc cam kết tốc độ mạng).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {amenities.map((am) => (
              <label
                key={am.code}
                className="flex items-center gap-2.5 min-h-[44px] px-3.5 rounded-[12px] border border-[var(--color-border)] text-sm cursor-pointer hover:border-[var(--color-primary)]"
              >
                <input
                  type="checkbox"
                  checked={selectedAmenities.includes(am.code)}
                  onChange={() => toggleAmenity(am.code)}
                  className="w-4 h-4 accent-[var(--color-primary)]"
                />
                <span>{am.labelVi}</span>
              </label>
            ))}
          </div>

          <div className="pt-2 space-y-3">
            <label className="inline-flex items-center gap-2.5 min-h-[44px] text-sm text-[var(--color-text)] cursor-pointer">
              <input
                type="checkbox"
                checked={hasDedicatedDesk}
                onChange={(e) => setHasDedicatedDesk(e.target.checked)}
                className="w-4 h-4 accent-[var(--color-primary)]"
              />
              <span>Có góc bàn làm việc riêng cho làm việc từ xa</span>
            </label>

            <div>
              <label
                htmlFor="host-workspace-notes"
                className="block text-sm font-medium text-[var(--color-text)] mb-1.5"
              >
                Ghi chú không gian làm việc (EN, tùy chọn)
              </label>
              <input
                id="host-workspace-notes"
                type="text"
                value={workspaceNotesEn}
                onChange={(e) => setWorkspaceNotesEn(e.target.value)}
                placeholder="Ví dụ: 140cm oak desk beside balcony window, ergonomic chair"
                className="w-full min-h-[44px] px-3.5 rounded-[12px] border border-[var(--color-border)] text-sm"
              />
            </div>
          </div>
        </section>

        {/* 4. Thông tin riêng tư sau khi xác nhận */}
        <section className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text)]">
              4. Địa chỉ chính xác & hướng dẫn nhận phòng (Bảo mật)
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Chỉ hiển thị cho khách có đơn đã được xác nhận, chủ nhà và quản trị viên. Khách chưa đặt chỉ thấy tên khu vực.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="host-exact-address"
                className="block text-sm font-medium text-[var(--color-text)] mb-1.5"
              >
                Địa chỉ chi tiết (số nhà, tên đường)
              </label>
              <input
                id="host-exact-address"
                type="text"
                required
                value={exactAddress}
                onChange={(e) => setExactAddress(e.target.value)}
                placeholder="Ví dụ: 48 Quảng Khánh, Tây Hồ, Hà Nội"
                className="w-full min-h-[44px] px-3.5 rounded-[12px] border border-[var(--color-border)] text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="host-phone"
                className="block text-sm font-medium text-[var(--color-text)] mb-1.5"
              >
                Số điện thoại liên hệ khi nhận phòng
              </label>
              <input
                id="host-phone"
                type="text"
                value={hostContactPhone}
                onChange={(e) => setHostContactPhone(e.target.value)}
                placeholder="+84 90..."
                className="w-full min-h-[44px] px-3.5 rounded-[12px] border border-[var(--color-border)] text-sm"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="host-checkin-inst"
              className="block text-sm font-medium text-[var(--color-text)] mb-1.5"
            >
              Hướng dẫn vào nhà & mã khóa (EN)
            </label>
            <textarea
              id="host-checkin-inst"
              rows={2}
              value={checkinInstructionsEn}
              onChange={(e) => setCheckinInstructionsEn(e.target.value)}
              placeholder="Ví dụ: Enter alley 48, keypad code shared 2 hours before arrival..."
              className="w-full px-3.5 py-2.5 rounded-[12px] border border-[var(--color-border)] text-sm"
            />
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving || submittingReview}
            className="min-h-[48px] px-6 rounded-[12px] bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
          >
            {saving
              ? 'Đang lưu...'
              : mode === 'create'
                ? 'Tạo bản nháp & Tiếp tục tải ảnh'
                : 'Lưu thay đổi'}
          </button>

          {listing && (
            <button
              type="button"
              disabled={saving || submittingReview || photos.length === 0}
              onClick={handleSubmitForReview}
              className="inline-flex items-center gap-2 min-h-[48px] px-6 rounded-[12px] border border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)] text-sm font-semibold hover:bg-[#e1ede7] disabled:opacity-50"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              <span>
                {submittingReview ? 'Đang gửi duyệt...' : 'Gửi kiểm duyệt'}
              </span>
            </button>
          )}
        </div>
      </form>

      {/* 5. Quản lý ảnh (chỉ hiện sau khi đã tạo căn) */}
      {listing && (
        <section className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text)]">
              5. Thư viện ảnh chỗ ở ({photos.length} / 12 ảnh)
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Cần tối thiểu 1 ảnh thực tế (JPEG, PNG hoặc WebP, tối đa 5 MB/ảnh) trước khi gửi duyệt. Ảnh nháp được lưu tách biệt và kiểm soát quyền truy cập ở server.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label
                htmlFor="photo-alt-input"
                className="block text-xs font-medium text-[var(--color-text-muted)] mb-1"
              >
                Mô tả ảnh (EN, tùy chọn)
              </label>
              <input
                id="photo-alt-input"
                type="text"
                value={photoAlt}
                onChange={(e) => setPhotoAlt(e.target.value)}
                placeholder="Ví dụ: Desk overlooking quiet courtyard"
                className="w-full min-h-[44px] px-3.5 rounded-[12px] border border-[var(--color-border)] text-sm"
              />
            </div>

            <label className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-sm font-medium text-[var(--color-text)] cursor-pointer hover:border-[var(--color-primary)]">
              <Upload className="w-4 h-4 text-[var(--color-primary)]" aria-hidden="true" />
              <span>{uploadingPhoto ? 'Đang tải ảnh...' : 'Chọn ảnh tải lên'}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploadingPhoto || photos.length >= 12}
                onChange={handlePhotoUpload}
                className="sr-only"
              />
            </label>
          </div>

          {photos.length === 0 ? (
            <div className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-ivory)] p-6 text-sm text-[var(--color-text-muted)] text-center">
              Chỗ ở này chưa có ảnh. Hãy tải lên ít nhất 1 ảnh trước khi gửi kiểm duyệt.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden flex flex-col"
                >
                  <FallbackImage
                    src={photo.url}
                    alt={photo.altTextEn}
                    fallbackLabel="Ảnh chỗ ở"
                    className="rounded-none border-0"
                  />
                  <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-[var(--color-text-muted)]">
                        {photo.altTextEn}
                      </span>
                      {photo.isCover && (
                        <StatusBadge label="Ảnh bìa" tone="success" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      {!photo.isCover && (
                        <button
                          type="button"
                          onClick={() => handleSetCover(photo.id)}
                          className="flex-1 min-h-[40px] px-2.5 rounded-[12px] border border-[var(--color-border)] text-xs font-medium inline-flex items-center justify-center gap-1 hover:border-[var(--color-primary)]"
                        >
                          <Star className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Đặt ảnh bìa</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeletePhoto(photo.id)}
                        aria-label={`Xóa ảnh ${photo.altTextEn}`}
                        className="min-h-[40px] min-w-[40px] px-2.5 rounded-[12px] border border-[var(--color-danger-border)] text-[var(--color-danger-text)] inline-flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
